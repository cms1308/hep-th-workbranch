---
name: research-review
description: Review a research project's plan, a completed calculation step, the whole project against its question, or its manuscript, including re-review after corrections. Use to review in this session, in Codex or Claude; solve and paper dispatch the same review to the other vendor's model. Records findings and independent checks without rewriting the author's work. Manuscript editing uses revise and whole-draft citation audits cite-check.
---

# Research review

Input examples: `/research-review <slug> plan`, `/research-review <slug> step 3`,
`/research-review <slug> recheck step 3`, `/research-review <slug> project`,
`/research-review <slug> paper`. Infer the project from the user's context.
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

List every chosen value and restriction of the plan (numbers of data points, cuts, lists
of cases, sizes, thresholds) with the ground the plan states for it and the kind of
ground: the question itself, a measurement with its run, or a cited source. A choice
whose ground is convenience, habit or what already exists, or that has none, is a
blocking finding unless the plan names it to the user as a choice without a ground.
Check also that data taken over from an earlier question are named as such, and that
nothing the question needs is left out or postponed because it does not exist yet.

## Project review

The target is the project as a whole, read against the question in PROJECT and STATE.
Run it when the user changes the question (MEMORY, Changing the question), before
`/paper`, and when the user asks; the reviewer is one who did not do the work.
Read PROJECT (question, success criteria, inherited material), STATE, DECISIONS, PLAN,
RESULTS in full, the inventory note if one exists, and the data, inputs and records the
results actually rest on (their selection, ranges and composition), not only the notes
that describe them. Answer, with locations:

1. Is the question in PROJECT the one the user's latest decisions ask? A question that
   lives only in DECISIONS or a note is a finding.
2. Can the material the results rest on answer it? For each dataset, result or code path:
   the question and selection it was built for, and what that selection does to the
   claims (which cases dominate, which are cut or absent, what was exposed before).
3. Do the checks and comparisons made test what the success criteria ask, at the
   generality the claims use? A claim tested only where it is guaranteed, or on cases
   the method has effectively seen, is a finding.
4. Which results support, contradict or do not bear on the success criteria; which
   criteria have no evidence yet.
5. What a referee of the eventual paper would ask first, answered from the record or
   listed as open.
6. The open PLAN steps and their `serves:` lines against the success criteria: steps
   that serve none, criteria that no step serves.

Findings that invalidate the foundation of several steps are reported as such, not
split into per-step items. Write `notes/review-project-YYYY-MM-DD.md` with the verdict
`ready` (the work can answer the question as planned), `corrections required` or
`inconclusive`, scoped to the question as stated.

## Manuscript review

Target `paper`: `/research-review <slug> paper`, or the review that paper's workflow
dispatches to the vendor that did not write the manuscript. Read PAPER-STYLE, PAPER-REVIEW
and the manuscript in scope, with the results, notes and data it relies on, and check its
citations against their primary sources as cite-check describes. Check:

- Claims, assumptions and quantifiers agree with the supporting record. A finite expansion,
  a restricted parameter range or a numerical check is not an all-orders proof.
- Each central claim has the same scope in the abstract, introduction, body and conclusion.
- Equations, tables, captions and text agree; notation is defined before use and consistent;
  references point to the right material; renames have left no stale term.
- The argument has its necessary steps and no contradiction or redundancy. Definitions,
  motivation and transitions may serve it without a new result. A missing paragraph map is
  not a finding.
- Each Section does what its title says, and each sentence stands where its subject is.
- Terminology is the literature's or defined in the manuscript; no coined labels, and no
  work log in place of exposition.

Findings follow the record rules below, with the verdict scoped to the manuscript. A
`ready` verdict attests only the checks the report lists; the table of the verification
gate is separate evidence and is not reported as the reviewer's own.

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

Write an English review note under `notes/review-plan-YYYY-MM-DD.md`,
`notes/review-step-NN-YYYY-MM-DD.md`, `notes/review-project-YYYY-MM-DD.md` or `notes/review-paper-YYYY-MM-DD.md`; use a new suffix for subsequent passes so the
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
