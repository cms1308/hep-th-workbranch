---
name: research-review
description: Review a research project's plan or a completed calculation step, including re-review after corrections. Use to review a research plan or completed solve step in either Codex or Claude. Records findings and independent checks without rewriting the author's calculation. Paper editing and whole-draft citation audits use their existing skills.
---

# Plan and calculation review

Input examples: `/research-review <slug> plan`, `/research-review <slug> step 3`,
`/research-review <slug> recheck step 3`. Infer the project from the user's context.
Without a target, review the plan if no calculation exists; otherwise review the
latest completed step awaiting review. Ask only if the target remains ambiguous.

This skill runs in the current session; it does not switch models, dispatch another
task, or start the next solve step. Record the actual reviewer identity when known;
Do not infer independent verification from the reviewer model alone. Another
model reviewing shared work is not a blind comparison.

## Shared contract and scope

Follow harness/PROTOCOL.md, harness/MEMORY.md and harness/OPERATIONS.md. Read the
project's PROJECT, STATE, DECISIONS, relevant PLAN and RESULTS entries and linked
notes. Resolve the read-only wiki with `node harness/cli.mjs paths`; follow the
knowledge protocol for missing sources. A review request authorizes reading the
named work even if its original workstream was independent; it does not authorize
merging projects or changing their research scope.

Review the agreed objective and evidence level. Do not demand an all-orders proof
for an explicitly finite-order target, or global analytic convergence for a formal
local result. Flag claims exceeding that target. Separate necessary corrections
from optional extensions. Plan review is not the user's formulation sign-off.

## Plan review

Check whether the plan identifies the actual source equations, conventions,
unknowns and proposed contribution. Inspect relevant primary sources for substantive
claims; check novelty beyond the wiki before endorsing it. A search with no match
does not prove absence from the literature.

Assess the minimum useful result, dependencies, concrete `verify:` criteria and
fallbacks. Identify missing inputs and unjustified restrictions of parameter space.
Check that the proposed checks can distinguish success from failure. Give concrete
corrections with file/section references; do not rewrite PROJECT or PLAN during review.

## Completed-step review

1. Identify the step, result IDs, predeclared criteria, assumptions and dependencies.
   Record the project commit and worktree status, plus hashes of the reviewed files
   when uncommitted changes are included. Do not treat another session's live edits
   as a stable review target; check for changes before issuing the verdict.
2. Read the derivation, code, verification specifications and actual run outputs.
   Check source conventions, normalization, initial data, parameter coverage and
   physical interpretation as relevant. An execution PASS alone is not validation
   of the claim.
3. Re-run relevant checks when useful. Independently check the core claim using an
   alternative derivation, separately constructed implementation, limiting case or
   source comparison appropriate to the claim. Explain the independence and its
   limits; repeating the same code or transcribing the same formula is reproduction.
   If no independent check is feasible, state what remains unverified.
4. For new nontrivial verification calculations follow harness/EVIDENCE.md: declare
   the criterion first, create a separate `calc/review-<target>-<check>.py` and
   `calc/checks/review-<target>-<check>.json`, and run through the harness runner.
   Keep the author's scripts and derivation unchanged. Do not silently fix and
   approve the original work in the same review.
5. Trace any failure to affected result IDs and dependent steps. On re-review,
   retain the earlier findings, inspect the corrections, and recheck affected
   claims rather than repeating every unchanged check. A material change to the
   reviewed inputs or assumptions requires a new review of dependent conclusions.

## Record and hand off

Write an English review note under `notes/review-plan-YYYY-MM-DD.md` or
`notes/review-step-NN-YYYY-MM-DD.md`; use a new suffix for subsequent passes so the
earlier record survives. Include:

- Target and reviewed versions, actual reviewer, and agreed success criteria.
- Checks performed, primary-source locations, run links, and independence limits.
- Findings with stable IDs, evidence/location, impact and a concrete requested fix.
- Supported claims with their evidence kind and checked range; unverified claims.
- Verdict: `ready`, `corrections required`, or `inconclusive`, explicitly scoped to
  the reviewed objective. `ready` requires the agreed criteria to be supported and
  no unresolved finding that invalidates the claimed result or dependent work.
- Next action: author correction, missing evidence, or the next planned step.

Update STATE concisely with the review link and separate author completion from
review completion. Link substantive unresolved findings from OPEN-QUESTIONS, and
add a review link and scope to affected RESULTS entries without upgrading their
evidence kind merely because they were reviewed. Do not change PLAN checkboxes,
research claims, conventions or paper text as part of this skill. If these shared
files are being edited concurrently, leave the review note and report the pending
state update rather than overwriting another session's changes.

For corrections that affect validity, identify which dependent step should wait;
do not block unrelated work. Optional improvements alone do not prevent `ready`.
Run `node harness/cli.mjs check <slug>`, inspect the task's diff, then queue and
flush only this review's files per OPERATIONS. Report in Korean the verdict,
important findings, what was independently checked, and the exact next action.
