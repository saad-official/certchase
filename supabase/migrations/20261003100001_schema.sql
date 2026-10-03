-- CertChase schema (spec section 4).
--
-- Conventions (same as Dunnit)
--   * uuid primary keys via gen_random_uuid(); created_at timestamptz not null default now().
--   * Every tenant table carries org_id. Child tables reference their parent with a
--     composite (id, org_id) foreign key so a row can never point at another org's row,
--     even if a caller supplies a foreign id (defence in depth on top of RLS).
--   * RLS is enabled here, immediately after each table is created, so no table ever
--     exists without it. Policies, grants and Storage policies live in
--     20261003100002_rls.sql.
--   * Vendor status ('missing', 'compliant', ...) is derived in vendor_overview from the
--     latest certificate's evaluation, never stored on vendors.
--   * The model extracts, the rules decide (docs/decisions/0001): `extraction` holds model
--     output, `evaluation` holds the deterministic rule engine's verdict.

-- ---------------------------------------------------------------------------
-- Enums (created before any table that uses them)
-- ---------------------------------------------------------------------------

create type public.plan as enum ('free', 'pro');

-- manual: every chase email waits for approval.
-- auto_renewals: Pro only; renewal reminders at confidence >= 0.8 are sent without approval.
create type public.autonomy as enum ('manual', 'auto_renewals');

-- Output of evaluateCertificate(). Independent of any vendor: it describes one
-- certificate judged against one template. Vendor status adds 'missing' on top.
create type public.evaluation_status as enum ('compliant', 'deficient', 'expiring', 'expired');

-- pending: uploaded, extraction not finished
-- extracted: extraction stored (evaluation may or may not be present yet)
-- failed: extraction failed
-- superseded: a newer certificate for the same vendor replaced this one
create type public.certificate_status as enum ('pending', 'extracted', 'failed', 'superseded');

-- request_initial: vendor has no certificate (day 0, +7, +14)
-- deficiency: evaluation deficient or expired (day 0, +7, +14)
-- renewal: evaluation expiring (30, 14, 7 days before expiration)
create type public.chase_kind as enum ('request_initial', 'deficiency', 'renewal');

-- draft: waiting in the approval queue
-- approved: approved (by a person or by auto-send), not yet handed to a provider
-- snoozed / rejected / cancelled: removed from the queue without sending
-- sent / failed: provider outcome
create type public.touch_status as enum (
  'draft', 'approved', 'snoozed', 'rejected', 'cancelled', 'sent', 'failed'
);

-- active: planner will run it at next_run_at
-- paused: waiting (e.g. do_not_contact, bad email); see pause_reason
-- stopped: halted for good (vendor now compliant, manual stop)
-- completed: all steps of the current kind sent
create type public.cadence_status as enum ('active', 'paused', 'stopped', 'completed');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (char_length(name) between 1 and 120),
  slug                   text not null unique
                           check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  plan                   public.plan not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  timezone               text not null default 'UTC',
  -- Name the certificate holder must match when a template sets
  -- certificateHolderMustMatch. Seeded from business_name at sign-up when one was
  -- given, otherwise null; the rule engine falls back to `name` when null.
  legal_name             text check (legal_name is null or char_length(legal_name) between 1 and 200),
  -- { business_name, signature, tone_notes }
  voice                  jsonb not null default '{}'::jsonb
                           check (jsonb_typeof(voice) = 'object'),
  autonomy               public.autonomy not null default 'manual',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create table public.memberships (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.memberships enable row level security;

-- PK covers (org_id, user_id); RLS helpers look up by user_id first.
create index memberships_user_id_idx on public.memberships (user_id, org_id);

-- ---------------------------------------------------------------------------
-- requirement_templates
-- ---------------------------------------------------------------------------

create table public.requirement_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  -- Shape validated by lib/domain (template rules schema), see spec 3.1:
  -- { generalLiability, autoLiability, workersComp, umbrella, additionalInsured,
  --   waiverOfSubrogation, primaryNonContributory, noticeOfCancellationDays,
  --   certificateHolderMustMatch }
  rules      jsonb not null check (jsonb_typeof(rules) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- target for composite foreign keys from child tables
  unique (id, org_id),
  -- also serves as the org_id index (leading column)
  unique (org_id, name)
);

alter table public.requirement_templates enable row level security;

-- At most one default template per org. A unique index cannot be deferred, so to move
-- the default, clear the old one first, then set the new one (two statements).
create unique index requirement_templates_one_default_per_org
  on public.requirement_templates (org_id)
  where is_default;

create trigger requirement_templates_set_updated_at
  before update on public.requirement_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------

create table public.vendors (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 200),
  contact_email        text not null check (contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  broker_name          text check (broker_name is null or char_length(broker_name) <= 200),
  broker_email         text check (broker_email is null or broker_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  trade                text check (trade is null or char_length(trade) <= 120),
  contract_value_cents bigint not null default 0 check (contract_value_cents >= 0),
  template_id          uuid not null,
  do_not_contact       boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, org_id),
  -- NO ACTION (not cascade): a template in use cannot be deleted; reassign vendors
  -- first. Org deletion still works because both rows go in the same statement and
  -- NO ACTION is checked at statement end.
  foreign key (template_id, org_id) references public.requirement_templates (id, org_id)
);

alter table public.vendors enable row level security;

create index vendors_org_id_idx on public.vendors (org_id);
create index vendors_org_name_idx on public.vendors (org_id, lower(name));
create index vendors_template_id_idx on public.vendors (template_id, org_id);

create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

create table public.certificates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  vendor_id           uuid not null,
  -- Storage object name in bucket 'certificates': <org_id>/<certificate_id>/<file_name>
  -- (docs/decisions/0002). The check ties the row to its own org and id, so a row can
  -- never point at a file in another org's folder.
  storage_path        text not null unique
                        check (
                          starts_with(storage_path, org_id::text || '/' || id::text || '/')
                          and char_length(storage_path) > 74  -- 36 + 1 + 36 + 1: a file name must follow
                          and char_length(storage_path) <= 1024
                          and position('/' in substr(storage_path, 75)) = 0
                        ),
  file_name           text not null check (char_length(file_name) between 1 and 255),
  mime_type           text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  -- 10 MB, same as the bucket's file_size_limit
  size_bytes          int not null check (size_bytes between 1 and 10485760),
  source              text not null default 'upload' check (source in ('upload', 'email', 'demo')),
  -- model output (extraction schema, spec 3.3), incl. fieldConfidence and evidence
  extraction          jsonb check (extraction is null or jsonb_typeof(extraction) = 'object'),
  -- { model, promptVersion, tokensIn, tokensOut, latencyMs, fixture?, ... }
  extraction_meta     jsonb check (extraction_meta is null or jsonb_typeof(extraction_meta) = 'object'),
  -- rule engine output { status, gaps[], earliestExpiration, needsReview }.
  -- status must be an evaluation_status value (keep this list in sync with the enum).
  evaluation          jsonb check (
                        evaluation is null
                        or (jsonb_typeof(evaluation) = 'object'
                            and evaluation ->> 'status' in ('compliant', 'deficient', 'expiring', 'expired'))
                      ),
  status              public.certificate_status not null default 'pending',
  -- denormalised from evaluation for filtering, sorting and the cron tick
  earliest_expiration date,
  needs_review        boolean not null default false,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, org_id),
  -- Deleting a vendor deletes its certificate rows. Storage objects are NOT deleted by
  -- the database: the app removes <org_id>/<certificate_id>/* first.
  foreign key (vendor_id, org_id) references public.vendors (id, org_id) on delete cascade
);

alter table public.certificates enable row level security;

create index certificates_org_id_idx on public.certificates (org_id);
-- latest certificate per vendor (vendor_overview) and vendor FK lookups
create index certificates_vendor_created_idx on public.certificates (vendor_id, created_at desc);
-- "expiring in the next 30 days" and the cron tick
create index certificates_expiration_idx on public.certificates (earliest_expiration)
  where status = 'extracted' and earliest_expiration is not null;

create trigger certificates_set_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chase_cadences (one per vendor)
-- ---------------------------------------------------------------------------

create table public.chase_cadences (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  vendor_id    uuid not null unique,
  kind         public.chase_kind not null,
  -- last step sent for the current kind: 0 = nothing sent yet, 1-3 = steps.
  -- Reset to 0 when kind changes (e.g. renewal -> deficiency).
  step         int not null default 0 check (step between 0 and 3),
  status       public.cadence_status not null default 'active',
  next_run_at  timestamptz,
  pause_reason text check (pause_reason is null or char_length(pause_reason) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, org_id),
  foreign key (vendor_id, org_id) references public.vendors (id, org_id) on delete cascade
);

alter table public.chase_cadences enable row level security;

create index chase_cadences_org_id_idx on public.chase_cadences (org_id);
-- cron tick: "active cadences due now"
create index chase_cadences_status_next_run_idx on public.chase_cadences (status, next_run_at);

create trigger chase_cadences_set_updated_at
  before update on public.chase_cadences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chase_touches (drafted / sent chase emails)
-- ---------------------------------------------------------------------------

create table public.chase_touches (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  vendor_id           uuid not null,
  -- nullable: request_initial chases have no certificate
  certificate_id      uuid,
  kind                public.chase_kind not null,
  -- broker when known, else the vendor contact (spec 3.5)
  to_email            text not null check (to_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  subject             text not null,
  body                text not null,
  status              public.touch_status not null default 'draft',
  confidence          numeric(4, 3) not null default 0 check (confidence between 0 and 1),
  rationale           text,
  -- the exact rule-engine gaps the email quotes: [{ code, message, required?, actual? }]
  gaps                jsonb not null default '[]'::jsonb check (jsonb_typeof(gaps) = 'array'),
  snoozed_until       timestamptz,
  reject_reason       text check (reject_reason is null or char_length(reject_reason) <= 500),
  approved_by         uuid references auth.users (id) on delete set null,
  approved_at         timestamptz,
  sent_at             timestamptz,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, org_id),
  check (status <> 'sent' or sent_at is not null),
  foreign key (vendor_id, org_id) references public.vendors (id, org_id) on delete cascade,
  -- keep the touch if its certificate is deleted; only certificate_id is nulled (PG15+ column list)
  foreign key (certificate_id, org_id) references public.certificates (id, org_id)
    on delete set null (certificate_id)
);

alter table public.chase_touches enable row level security;

create index chase_touches_org_status_idx on public.chase_touches (org_id, status);
create index chase_touches_vendor_created_idx on public.chase_touches (vendor_id, created_at desc);
create index chase_touches_certificate_id_idx on public.chase_touches (certificate_id)
  where certificate_id is not null;
create index chase_touches_approved_by_idx on public.chase_touches (approved_by)
  where approved_by is not null;
create index chase_touches_snoozed_idx on public.chase_touches (org_id, snoozed_until)
  where status = 'draft' and snoozed_until is not null;

create trigger chase_touches_set_updated_at
  before update on public.chase_touches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outbox (rendered emails; the default EmailProvider)
-- ---------------------------------------------------------------------------

create table public.outbox (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  touch_id   uuid not null,
  to_email   text not null,
  subject    text not null,
  html       text,
  text       text not null,
  provider   text not null default 'outbox' check (provider in ('outbox', 'resend')),
  status     text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  foreign key (touch_id, org_id) references public.chase_touches (id, org_id) on delete cascade
);

alter table public.outbox enable row level security;

create index outbox_org_created_idx on public.outbox (org_id, created_at desc);
create index outbox_touch_id_idx on public.outbox (touch_id);

-- ---------------------------------------------------------------------------
-- agent_events (append-only audit log)
-- ---------------------------------------------------------------------------

create table public.agent_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  actor          text not null check (actor in ('agent', 'user', 'system', 'cron', 'webhook')),
  type           text not null check (char_length(type) between 1 and 100),
  entity_type    text,
  entity_id      uuid,
  input          jsonb,
  output         jsonb,
  model          text,
  prompt_version text,
  tokens_in      int check (tokens_in >= 0),
  tokens_out     int check (tokens_out >= 0),
  latency_ms     int check (latency_ms >= 0),
  created_at     timestamptz not null default now()
);

alter table public.agent_events enable row level security;

create index agent_events_org_created_idx on public.agent_events (org_id, created_at desc);
create index agent_events_entity_idx on public.agent_events (org_id, entity_type, entity_id, created_at desc)
  where entity_id is not null;

-- Rejects UPDATE always. Rejects DELETE unless the parent organization is already
-- gone, i.e. the delete is the ON DELETE CASCADE from deleting the whole org
-- (account deletion). This applies to every role, including service_role.
create or replace function public.agent_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return old;
  end if;
  raise exception 'agent_events is append-only (% rejected)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger agent_events_no_update_delete
  before update or delete on public.agent_events
  for each row execute function public.agent_events_append_only();

create or replace function public.agent_events_no_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'agent_events is append-only (TRUNCATE rejected)'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger agent_events_no_truncate
  before truncate on public.agent_events
  for each statement execute function public.agent_events_no_truncate();

-- ---------------------------------------------------------------------------
-- New-user bootstrap: one organization + owner membership + default requirement
-- template per sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business text;
  v_name     text;
  v_base     text;
  v_slug     text;
  v_org_id   uuid;
begin
  v_business := left(nullif(btrim(new.raw_user_meta_data ->> 'business_name'), ''), 120);
  v_name := coalesce(
    v_business,
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'My business'
  );
  v_name := left(v_name, 120);

  -- slugify: lowercase, non-alphanumerics -> '-', collapse, trim, cap length
  v_base := lower(v_name);
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := btrim(left(v_base, 48), '-');
  if v_base = '' then
    v_base := 'org';
  end if;

  v_slug := v_base;
  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end loop;

  -- legal_name only from an explicit business name; an email local part is not a legal name.
  insert into public.organizations (name, slug, legal_name, voice)
  values (v_name, v_slug, v_business, jsonb_build_object('business_name', v_name))
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  -- Spec 3.1 default: GL $1M/$2M, Auto $1M CSL, WC statutory + $1M, additional insured
  -- and waiver required, 30-day notice. Amounts are in cents.
  insert into public.requirement_templates (org_id, name, rules, is_default)
  values (
    v_org_id,
    'Standard subcontractor',
    '{
      "generalLiability": { "eachOccurrenceCents": 100000000, "aggregateCents": 200000000 },
      "autoLiability": { "combinedSingleLimitCents": 100000000 },
      "workersComp": { "required": true, "eachAccidentCents": 100000000 },
      "umbrella": null,
      "additionalInsured": true,
      "waiverOfSubrogation": true,
      "primaryNonContributory": false,
      "noticeOfCancellationDays": 30,
      "certificateHolderMustMatch": true
    }'::jsonb,
    true
  );

  return new;
end;
$$;

-- Trigger functions cannot be called through PostgREST, but keep EXECUTE closed anyway.
revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- vendor_overview: one row per vendor with its template, latest certificate and
-- cadence, plus the derived vendor_status.
--
-- security_invoker = true makes the view run with the caller's privileges, so the
-- RLS policies on vendors/certificates/requirement_templates/chase_cadences apply and
-- nothing leaks across orgs. Without it the view would run as its owner (postgres)
-- and bypass RLS.
--
-- "Latest certificate" = newest by created_at that is not 'superseded'. A pending or
-- failed newest certificate has no evaluation, so the vendor reads 'missing' until a
-- certificate is evaluated (certificate_status tells the UI why).
-- vendor_status is the stored evaluation status; it does not re-derive expiry from
-- current_date. The hourly tick re-evaluates certificates as dates pass.
-- ---------------------------------------------------------------------------

create view public.vendor_overview
with (security_invoker = true)
as
select
  v.id,
  v.org_id,
  v.name,
  v.contact_email,
  v.broker_name,
  v.broker_email,
  v.trade,
  v.contract_value_cents,
  v.template_id,
  v.do_not_contact,
  v.notes,
  v.created_at,
  v.updated_at,
  t.name                                                 as template_name,
  lc.id                                                  as latest_certificate_id,
  lc.status                                              as certificate_status,
  (lc.evaluation ->> 'status')::public.evaluation_status as evaluation_status,
  lc.earliest_expiration,
  lc.needs_review,
  lc.created_at                                          as certificate_created_at,
  cc.id                                                  as cadence_id,
  cc.kind                                                as cadence_kind,
  cc.step                                                as cadence_step,
  cc.status                                              as cadence_status,
  cc.next_run_at,
  case
    when lc.id is null then 'missing'
    else coalesce(lc.evaluation ->> 'status', 'missing')
  end                                                    as vendor_status
from public.vendors v
left join public.requirement_templates t
  on t.id = v.template_id and t.org_id = v.org_id
left join lateral (
  select c.id, c.status, c.evaluation, c.earliest_expiration, c.needs_review, c.created_at
  from public.certificates c
  where c.vendor_id = v.id
    and c.org_id = v.org_id
    and c.status <> 'superseded'
  order by c.created_at desc, c.id desc
  limit 1
) lc on true
left join public.chase_cadences cc
  on cc.vendor_id = v.id and cc.org_id = v.org_id;
