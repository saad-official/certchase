# CertChase — implementation plan

Reuses Dunnit's plumbing (auth, Supabase clients, AI SDK factory, email provider, Stripe client, app shell, CI). Each phase ends with passing checks and a commit.

## Phase 0 — Foundation
- [x] Copy shared plumbing, rename, install, add @react-pdf/renderer
- [ ] Design tokens (IBM Plex Sans + Mono, graphite/bone/cobalt/verdigris/saffron/oxblood)
- [ ] Spec, plan, README; GitHub repo, Vercel project, Supabase project

## Phase 1 — Domain core (pure TypeScript, TDD)
- [ ] `lib/domain/types.ts` — template rules schema, extraction schema, evaluation types
- [ ] `lib/domain/rules.ts` — evaluateCertificate with gap codes
- [ ] `lib/domain/cadence.ts` — request / deficiency / renewal schedules, send windows
- [ ] `lib/domain/guardrails.ts` — chase email validation, autonomy decision
- [ ] `lib/domain/metrics.ts` — status counts, value at risk, expiring soon
- [ ] `lib/domain/normalize.ts` — name matching, money and date helpers

## Phase 2 — Data layer
- [ ] Migrations: schema, RLS (tables and storage), cron (Vault-backed)
- [ ] Generated DB types, mappers

## Phase 3 — AI and documents
- [ ] `lib/ai/prompts/extract-acord25.ts` — Gemini vision extraction with schema
- [ ] `lib/ai/prompts/chase-writer.ts` — deficiency / renewal / request emails
- [ ] `lib/pdf/acord25.tsx` — synthetic certificate renderer for demo and tests

## Phase 4 — Services
- [ ] certificates (upload, extract, evaluate, review), chasing (drafts, sending), tick, demo seed

## Phase 5 — App
- [ ] Vendors (roster with status chips, detail with certificate pane and timeline)
- [ ] Certificates (upload, exceptions review, evaluation panel)
- [ ] Queue, Outbox, Dashboard, Settings (templates editor, voice, autonomy), Billing
- [ ] API routes: cron tick/daily, Stripe webhook, health

## Phase 6 — Marketing and ship
- [ ] Landing page, pricing, legal, OG image
- [ ] Deploy, env script, README walkthrough
