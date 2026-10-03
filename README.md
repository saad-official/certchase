# CertChase

**Certificates of insurance, tracked and chased.** Live at [getcertchase.vercel.app](https://getcertchase.vercel.app). CertChase keeps a roster of your subcontractors and vendors, reads each certificate of insurance with a vision model, judges it against the coverage your contract requires using plain rules, and chases brokers for corrections and renewals with emails you approve.

Part of the [Vibe Build Series](https://github.com/saad-official/vibe-build-series): real products for small businesses, built in public on free tiers.

## Why

Seven in ten collected certificates are non-compliant in some way, and fewer than half of small firms have any alert when one expires. The gap is found after a claim. Incumbent trackers start around $1,000 a year and target portfolios of hundreds of vendors, so small general contractors, property managers and venues use spreadsheets.

## How it works

1. **Requirements** — define what a contract requires: general liability limits, auto, workers' comp, umbrella, additional insured, waiver of subrogation, notice of cancellation.
2. **Extraction** — upload an ACORD 25 PDF or photo. Gemini extracts policies, limits, dates and endorsements into a strict schema with per-field confidence and evidence quotes.
3. **Rules decide** — a deterministic engine compares the extraction with the requirements and produces a status (compliant, deficient, expiring, expired) and an exact list of gaps. No compliance verdict ever comes from a language model.
4. **Chase** — the agent drafts a deficiency, renewal or first-request email that quotes the gaps. You approve, edit or reject. Pro can auto-send renewal reminders.
5. **Exposure dashboard** — status board, contract value at risk, certificates expiring in 30 days, and an append-only audit trail of every model call and human decision.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, pg_cron) · Vercel AI SDK 7 with Gemini (vision) and Groq · @react-pdf/renderer (synthetic demo certificates) · Stripe (test mode) · Vitest · Vercel

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # Supabase, Gemini/Groq, Stripe test keys
pnpm dev
```

Schema lives in `supabase/migrations`; apply with `pnpm exec supabase link --project-ref <ref>` then `pnpm db:push`.

## Docs

- [Spec](docs/spec.md) · [Plan](docs/plan.md) · [Decisions](docs/decisions/)

## Try the demo

1. Sign up (email and password; no confirmation email needed).
2. Vendors → **Load demo vendors**. Eight synthetic subcontractors are created and seven ACORD 25-style certificates are rendered, uploaded and read. With a Gemini key configured the vision model does the reading; without one the known fixture is used, and the certificate page shows the two side by side.
3. Open a deficient vendor to see the gaps the rules found, then Queue → approve the drafted broker email. In demo mode nothing leaves the app: the Outbox shows what would have been sent.
4. Requirements → change a limit and watch the roster re-evaluate.
