# CertChase — product and technical spec

Status: approved design, 2026-10-03. App 2 of the [Vibe Build Series](https://github.com/saad-official/vibe-build-series).

## 1. Problem

Small general contractors, property managers, venues and franchise operators must hold a valid certificate of insurance (COI) from every subcontractor and vendor. Industry figures put 7 in 10 collected certificates as non-compliant in some way, and fewer than half of small firms have any alert when one expires. The failure mode is silent: a certificate lapses, nobody notices, and the gap is discovered after a claim, when the uninsured loss commonly reaches six figures. Incumbent trackers (myCOI, Jones, SmartCompliance) start around $1,000 a year and are built for portfolios of hundreds of vendors. Small firms use spreadsheets.

CertChase keeps a vendor roster with the coverage each contract requires, reads uploaded ACORD 25 certificates with a vision model, judges them against the requirements with deterministic rules, and chases brokers for corrections and renewals with emails the owner approves.

**Architecture principle: the model extracts, the rules decide.** No compliance verdict ever comes from a language model.

## 2. Users and plans

- **Owner** of an organisation (one org per account in v1).
- **Free:** up to 10 vendors, manual approval of every email, demo vendors with synthetic certificates.
- **Pro ($39/month, Stripe test mode):** unlimited vendors, auto-send renewal reminders, email-in certificates, weekly exposure digest.

## 3. Core flows

### 3.1 Requirement templates
An org defines one or more templates (e.g. "Standard subcontractor", "Vendor, low risk"). A template is a structured rule set:

```
generalLiability: { eachOccurrenceCents, aggregateCents } | null
autoLiability:    { combinedSingleLimitCents } | null
workersComp:      { required: true, eachAccidentCents } | null
umbrella:         { eachOccurrenceCents } | null
additionalInsured: boolean          // certificate holder named as additional insured
waiverOfSubrogation: boolean
primaryNonContributory: boolean
noticeOfCancellationDays: number    // 0 = not required
certificateHolderMustMatch: boolean // holder on the certificate must match the org's legal name
```
A default template is created at sign-up with common small-contractor values (GL $1M/$2M, Auto $1M CSL, WC statutory + $1M, additional insured and waiver required, 30-day notice).

### 3.2 Vendors
Vendor = subcontractor or supplier with a contact email, an optional broker contact, trade, contract value, and a requirement template. Vendor status is derived from its latest certificate evaluation: `missing` (no certificate), `compliant`, `deficient`, `expiring` (within 30 days), `expired`.

### 3.3 Certificate intake and extraction
Upload a PDF or image (drag and drop, max 10 MB) to Supabase Storage. An extraction job sends the file to Gemini Flash-Lite with a strict JSON schema:

```
insuredName, producerName, producerEmail?, producerPhone?, certificateHolderName,
issueDate (YYYY-MM-DD),
policies: [{ type: gl|auto|wc|umbrella|other, insurer, policyNumber, effectiveDate, expirationDate,
             limits: { eachOccurrenceCents?, aggregateCents?, combinedSingleLimitCents?, eachAccidentCents? },
             additionalInsured: boolean|null, waiverOfSubrogation: boolean|null,
             primaryNonContributory: boolean|null }],
noticeOfCancellationDays: number|null,
descriptionOfOperations: string,
fieldConfidence: { [field]: 0..1 },
evidence: { [field]: short quote from the document }
```
Every call is logged to `agent_events` with model, prompt version, tokens and latency. Fields under 0.7 confidence are shown in an exceptions panel for the owner to confirm or correct before the evaluation is trusted (the evaluation still runs and is labelled "needs review").

### 3.4 Rule engine (deterministic)
`evaluateCertificate(extraction, template, today)` returns `{ status, gaps[], earliestExpiration, needsReview }`:
- For each required coverage: present? limits ≥ required? expiration > today?
- Endorsements: additional insured, waiver, primary/non-contributory on the GL policy when required.
- Notice of cancellation days ≥ required.
- Holder name match (normalised) when required.
- `expiring` when the earliest required policy expires within 30 days; `expired` when any required policy has expired; `deficient` when any other gap exists; `compliant` otherwise. Gaps carry a code, a human sentence and the values compared, so the chase email can quote them exactly.

### 3.5 Chasing (agent, human-approved)
Three email kinds, written by the model from the rule output and the org's voice, validated by guardrails (must mention vendor name, must list the exact gaps from the rules, no legal threats, sign-off present):
- **request_initial** when a vendor has no certificate: day 0, +7, +14.
- **deficiency** when the evaluation is deficient or expired: day 0, +7, +14.
- **renewal** when expiring: 30, 14 and 7 days before expiration, then it becomes a deficiency chase.
Emails go to the broker when known, else the vendor contact. Approval queue identical in spirit to Dunnit's: approve and send, edit, reject with reason, snooze, bulk approve above a confidence threshold. Autonomy: Pro can auto-send renewal reminders at ≥ 0.8 confidence. Email provider abstraction with Outbox (default) and Resend demo mode.

### 3.6 Dashboard
Status board (counts and % compliant), contract value at risk (sum of contract values of vendors not compliant), expiring in the next 30 days, recent activity, and a per-vendor red/amber/green roster.

### 3.7 Demo data
"Load demo vendors" creates 8 vendors and generates realistic ACORD-25-style certificate PDFs with `@react-pdf/renderer`, uploads them to Storage and runs extraction. When no model key is configured, the seeder stores the fixture extraction that produced the PDF, so the demo always works and, with a key, the UI can show "fixture vs extracted" agreement. Statuses are chosen to cover compliant, deficient (limits, missing waiver), expiring, expired and missing.

### 3.8 Billing and jobs
Stripe Checkout and Customer Portal (test mode); `organizations.plan` gates vendor count and autonomy. Jobs: pg_cron every hour calls `/api/cron/tick` (evaluate expirations, advance chase cadences, create drafts, auto-send approved touches); Vercel daily cron keeps Supabase awake.

## 4. Data model (Supabase Postgres)

```
organizations(id, name, slug, plan, stripe_customer_id, stripe_subscription_id, timezone, legal_name,
              voice jsonb, autonomy, created_at, updated_at)
memberships(org_id, user_id, role, created_at)
requirement_templates(id, org_id, name, rules jsonb, is_default bool, created_at, updated_at)
vendors(id, org_id, name, contact_email, broker_name, broker_email, trade, contract_value_cents,
        template_id, do_not_contact, notes, created_at, updated_at)
certificates(id, org_id, vendor_id, storage_path, file_name, mime_type, size_bytes, source,
             extraction jsonb, extraction_meta jsonb, evaluation jsonb, status, earliest_expiration date,
             needs_review bool, reviewed_at, created_at, updated_at)
chase_cadences(id, org_id, vendor_id unique, kind, step int, status, next_run_at, pause_reason, created_at, updated_at)
chase_touches(id, org_id, vendor_id, certificate_id, kind, to_email, subject, body, status, confidence,
              rationale, gaps jsonb, snoozed_until, reject_reason, approved_by, approved_at, sent_at,
              provider_message_id, created_at, updated_at)
outbox(...)            -- as Dunnit
agent_events(...)      -- append-only, as Dunnit
```
Storage bucket `certificates` (private); object path `<org_id>/<certificate_id>/<file_name>`; RLS on `storage.objects` by the first path segment.

## 5. Architecture

Next.js 16 App Router, route groups `(marketing)`, `(auth)`, `(app)`. `lib/domain/*` pure (templates schema, extraction schema, rule engine, cadence, guardrails, metrics) with Vitest. `lib/ai/*` (Gemini vision extraction, chase writer). `lib/services/*` (certificates, evaluation, chasing, tick, demo seed with PDF generation). `lib/pdf/acord25.tsx` renders synthetic certificates. Supabase SSR auth as in Dunnit.

## 6. Design identity

Documents, dates and limits: a precise, technical feel. Not the editorial warmth of Dunnit.

- Type: IBM Plex Sans (UI and headings, tight tracking on headings) + IBM Plex Mono (policy numbers, limits, dates).
- Palette: graphite `#1F2328`, bone `#F6F4EF`, cobalt `#2458E6` (actions), verdigris `#2F8F6B` (compliant), saffron `#D98E04` (expiring / needs review), oxblood `#9B2C2C` (deficient / expired), slate `#5B6470` (muted).
- Layout: dense data tables with sticky headers, a right-hand document pane on certificate pages, status chips with a leading square. Marketing uses a drafting-grid texture and large monospace figures.

## 7. Testing

Vitest: rule engine (every gap code, boundary dates, limit comparisons, holder matching), cadence planner, guardrails, template schema, metrics, extraction schema fixtures. PGlite harness for migrations and RLS. CI: lint, typecheck, test, build.

## 8. Out of scope for v1

Endorsement page OCR beyond the ACORD 25 form, multi-org, vendor self-service portal, e-signatures.
