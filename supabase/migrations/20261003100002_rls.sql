-- CertChase row level security, helper functions, grants and Storage policies.
--
-- Access model (same as Dunnit)
--   * anon: no access to any table, view or helper function.
--   * authenticated: rows of orgs the caller is a member of (via memberships).
--   * service_role: used ONLY by server-side cron (/api/cron/*), extraction jobs and the
--     Stripe webhook with SUPABASE_SECRET_KEY. It has BYPASSRLS, so none of the policies
--     below apply to it. Those code paths must always scope their queries by org_id
--     themselves. The append-only trigger on agent_events still applies to service_role.
--
-- Policy style
--   * USING clauses use `org_id in (select public.current_org_ids())`: the sub-select
--     is evaluated once per statement (initPlan) and works with the org_id indexes.
--   * WITH CHECK clauses on insert/update use public.is_org_member(org_id) so a row
--     cannot be written into, or moved to, an org the caller does not belong to.
--   * The helpers are SECURITY DEFINER so they can read memberships without
--     recursing through the memberships policy.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = (select auth.uid());
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = org
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- First folder of a Storage object name as a uuid, or null when it is not a canonical
-- (lowercase) uuid. A bare `(storage.foldername(name))[1]::uuid` in a policy raises
-- "invalid input syntax for type uuid" for any object whose first segment is not a
-- uuid, which would make every listing of the bucket fail for every member. This
-- returns null instead, and null never matches an org (docs/decisions/0002).
create or replace function public.storage_object_org_id(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1]
           ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.current_org_ids() from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
revoke all on function public.storage_object_org_id(text) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.current_org_ids() to authenticated, service_role;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;
grant execute on function public.storage_object_org_id(text) to authenticated, service_role;

-- set_updated_at / append-only functions are trigger functions; nobody calls them directly.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.agent_events_append_only() from public, anon, authenticated;
revoke all on function public.agent_events_no_truncate() from public, anon, authenticated;
revoke all on function public.handle_new_user() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants (minimal). Supabase's default privileges grant ALL on new public tables to
-- anon and authenticated; strip that and grant back only what each table needs.
-- RLS then narrows the rows.
-- ---------------------------------------------------------------------------

revoke all on
  public.organizations, public.memberships, public.requirement_templates, public.vendors,
  public.certificates, public.chase_cadences, public.chase_touches, public.outbox,
  public.agent_events, public.vendor_overview
from public, anon, authenticated;

grant all on
  public.organizations, public.memberships, public.requirement_templates, public.vendors,
  public.certificates, public.chase_cadences, public.chase_touches, public.outbox,
  public.agent_events, public.vendor_overview
to service_role;

-- organizations: read; update only the user-editable settings (column-level grant).
-- plan and stripe_* are written only by the Stripe webhook (service_role), so a
-- member cannot upgrade themselves to Pro through the API.
grant select on public.organizations to authenticated;
grant update (name, slug, timezone, legal_name, voice, autonomy) on public.organizations to authenticated;

-- memberships: read only. Rows are created by handle_new_user() (security definer).
grant select on public.memberships to authenticated;

grant select, insert, update, delete on public.requirement_templates to authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.certificates to authenticated;
grant select, insert, update on public.chase_cadences to authenticated;
grant select, insert, update on public.chase_touches to authenticated;

-- outbox: written by the sending pipeline with service_role.
grant select on public.outbox to authenticated;

-- agent_events: append-only.
grant select, insert on public.agent_events to authenticated;

-- view: RLS of the underlying tables applies (security_invoker = true).
grant select on public.vendor_overview to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create policy "members read their orgs"
  on public.organizations for select
  to authenticated
  using (id in (select public.current_org_ids()));

create policy "members update their orgs"
  on public.organizations for update
  to authenticated
  using (id in (select public.current_org_ids()))
  with check (public.is_org_member(id));

-- No insert policy: orgs are created by handle_new_user(). No delete policy:
-- account deletion is a service_role operation.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create policy "members read memberships of their orgs"
  on public.memberships for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

-- No insert/update/delete policies: only handle_new_user() (security definer)
-- and service_role write memberships.

-- ---------------------------------------------------------------------------
-- requirement_templates
-- ---------------------------------------------------------------------------

create policy "members read requirement templates"
  on public.requirement_templates for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members insert requirement templates"
  on public.requirement_templates for insert
  to authenticated
  with check (public.is_org_member(org_id));

create policy "members update requirement templates"
  on public.requirement_templates for update
  to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (public.is_org_member(org_id));

create policy "owners delete requirement templates"
  on public.requirement_templates for delete
  to authenticated
  using (public.is_org_owner(org_id));

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------

create policy "members read vendors"
  on public.vendors for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members insert vendors"
  on public.vendors for insert
  to authenticated
  with check (public.is_org_member(org_id));

create policy "members update vendors"
  on public.vendors for update
  to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (public.is_org_member(org_id));

create policy "owners delete vendors"
  on public.vendors for delete
  to authenticated
  using (public.is_org_owner(org_id));

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

create policy "members read certificates"
  on public.certificates for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members insert certificates"
  on public.certificates for insert
  to authenticated
  with check (public.is_org_member(org_id));

create policy "members update certificates"
  on public.certificates for update
  to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (public.is_org_member(org_id));

create policy "owners delete certificates"
  on public.certificates for delete
  to authenticated
  using (public.is_org_owner(org_id));

-- ---------------------------------------------------------------------------
-- chase_cadences
-- ---------------------------------------------------------------------------

create policy "members read chase cadences"
  on public.chase_cadences for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members insert chase cadences"
  on public.chase_cadences for insert
  to authenticated
  with check (public.is_org_member(org_id));

create policy "members update chase cadences"
  on public.chase_cadences for update
  to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- chase_touches
-- ---------------------------------------------------------------------------

create policy "members read chase touches"
  on public.chase_touches for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members insert chase touches"
  on public.chase_touches for insert
  to authenticated
  with check (public.is_org_member(org_id));

create policy "members update chase touches"
  on public.chase_touches for update
  to authenticated
  using (org_id in (select public.current_org_ids()))
  with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- outbox (read only for members)
-- ---------------------------------------------------------------------------

create policy "members read outbox"
  on public.outbox for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- agent_events (select + insert; UPDATE/DELETE blocked for every role by trigger)
-- ---------------------------------------------------------------------------

create policy "members read agent events"
  on public.agent_events for select
  to authenticated
  using (org_id in (select public.current_org_ids()));

create policy "members append agent events"
  on public.agent_events for insert
  to authenticated
  with check (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket 'certificates' (docs/decisions/0002)
--
-- Object name: <org_id>/<certificate_id>/<file_name>. Access is decided by the first
-- path segment only: members of that org may read, upload and update; owners may
-- delete. Uploads must be exactly two folders deep. Signed URLs for the document pane
-- are created server-side for a path the caller can already read.
--
-- RLS on storage.objects is enabled by Supabase itself (the table is owned by
-- supabase_storage_admin, so this migration does not alter it).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict do nothing;

create policy "certchase members read org certificate files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and public.storage_object_org_id(name) in (select public.current_org_ids())
  );

create policy "certchase members upload org certificate files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificates'
    and public.is_org_member(public.storage_object_org_id(name))
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
  );

create policy "certchase members update org certificate files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'certificates'
    and public.storage_object_org_id(name) in (select public.current_org_ids())
  )
  with check (
    bucket_id = 'certificates'
    and public.is_org_member(public.storage_object_org_id(name))
    and coalesce(array_length(storage.foldername(name), 1), 0) = 2
  );

create policy "certchase owners delete org certificate files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'certificates'
    and public.is_org_owner(public.storage_object_org_id(name))
  );
