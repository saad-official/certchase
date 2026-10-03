# 0001. The model extracts; deterministic rules decide compliance

- Status: accepted
- Date: 2026-10-03

## Context

CertChase tells an owner whether a subcontractor is insured well enough to be on site. A wrong "compliant" is the expensive failure: the gap is found after a claim, when the uninsured loss can reach six figures. Certificates (ACORD 25) arrive as scanned PDFs and photos, so reading them needs a vision model (Gemini Flash-Lite). Models read forms well, but they do not apply a limit comparison, a date boundary or a name match the same way every time, and a verdict produced in free text cannot be tested or explained.

## Decision

1. **The model only extracts.** The extraction call returns JSON that matches a strict schema (spec 3.3): insured, producer, holder, policies with limits, endorsements and dates, plus `fieldConfidence` and short `evidence` quotes per field. It never returns a status. The output is stored in `certificates.extraction`; model, prompt version, tokens and latency go to `certificates.extraction_meta` and to the append-only `agent_events`.
2. **Pure rules decide.** `evaluateCertificate(extraction, template, today)` in `lib/domain` compares the extraction with the vendor's `requirement_templates.rules` and returns `{ status, gaps[], earliestExpiration, needsReview }`. The result is stored in `certificates.evaluation`. A check constraint allows only the four `evaluation_status` values in `evaluation.status`. Vendor status in `vendor_overview` is read from that stored verdict, with `missing` when there is nothing to judge.
3. **Low confidence is shown, not hidden.** Fields under 0.7 confidence set `needs_review`. The evaluation still runs and is labelled "needs review" until the owner confirms the fields (`reviewed_at`).
4. **Chase emails quote the rules, not the model.** `chase_touches.gaps` holds the rule engine's gaps. Guardrails reject a draft that does not list them exactly. Sending stays human-approved, except Pro renewal reminders at confidence 0.8 or higher.

## Consequences

- Every verdict can be reproduced from stored data and unit-tested (gap codes, boundary dates, limits, holder matching). Changing models changes extraction quality, not policy.
- A misread field produces a wrong input that can be seen and corrected, with evidence quotes, instead of an unexplained verdict.
- The stored evaluation goes stale as dates pass. The hourly `certchase-tick` job has to re-evaluate certificates near expiry. The view does not recompute expiry from `current_date`.
- Adding a coverage type means changing the extraction schema, the template schema, the rule engine and their tests together.
