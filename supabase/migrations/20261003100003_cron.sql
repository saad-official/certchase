-- CertChase background jobs (spec 3.8).
--
--   certchase-tick       hourly at minute 7: POST {certchase_cron_url} with
--                        Authorization: Bearer {certchase_cron_secret}
--                        (url = https://<app>/api/cron/tick). The route evaluates
--                        expirations, advances chase cadences, creates drafts and
--                        auto-sends approved touches using the service role key.
--   certchase-keepalive  daily no-op placeholder (`select 1`). The real keep-alive is
--                        the Vercel cron hitting /api/cron/daily, which queries Supabase.
--
-- Hosted Supabase does not allow `alter database ... set app.settings.*` (permission
-- denied for the postgres role), so the tick job reads its URL and bearer secret from
-- Supabase Vault each time it runs, exactly like Dunnit's 20261003000005_cron_vault.sql.
-- Secrets are never baked into this migration or into cron.job. Until both secrets
-- exist the job runs but posts nothing, so this migration is safe to apply to an
-- environment that has not been configured yet (local, CI).
--
-- One-time setup per environment (SQL editor or `supabase db query --linked`; never
-- commit values):
--   select vault.create_secret('https://<app-host>/api/cron/tick', 'certchase_cron_url');
--   select vault.create_secret('<CRON_SECRET>', 'certchase_cron_secret');
-- Rotate with: select vault.update_secret(id, '<new value>') from vault.secrets where name = '...';
--
-- Cleanup:
--   select cron.unschedule('certchase-tick');
--   select cron.unschedule('certchase-keepalive');
--
-- Inspect runs:  select * from cron.job_run_details order by start_time desc limit 20;
-- HTTP results:  select * from net._http_response order by created desc limit 20;

-- pg_cron's control file pins it to pg_catalog (relocatable = false, schema = pg_catalog);
-- `with schema extensions` would fail with "must be installed in schema pg_catalog".
-- It always creates its own `cron` schema for its tables and functions.
create extension if not exists pg_cron with schema pg_catalog;

-- pg_net creates its functions in the `net` schema regardless of the extension schema.
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- certchase-tick (idempotent: drop any earlier definition, then schedule)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from cron.job where jobname = 'certchase-tick') then
    perform cron.unschedule('certchase-tick');
  end if;
end $$;

select cron.schedule(
  'certchase-tick',
  '7 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'certchase_cron_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'certchase_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (select 1 from vault.decrypted_secrets where name in ('certchase_cron_url', 'certchase_cron_secret') having count(*) = 2);
  $job$
);

-- ---------------------------------------------------------------------------
-- certchase-keepalive (unconditional no-op placeholder; cron.schedule upserts by name)
-- ---------------------------------------------------------------------------

select cron.schedule('certchase-keepalive', '17 6 * * *', 'select 1');
