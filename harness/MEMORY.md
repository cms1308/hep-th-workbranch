# Project memory

`STATE.md` is the authority for the current phase and the next action. It is a short
entry point, not the complete result archive. A project uses these files:

| File | Authority and update rule |
|---|---|
| PROJECT.md | Problem and conventions; change only when scope or conventions change. |
| STATE.md | One Status, one Current step, next action, critical constraints, links. Replace superseded status. Advisory budget: 200 lines and 16 KB. |
| RESULTS.md | Detailed result catalog with existing R/N IDs unchanged. Each new result records scope, evidence kind, assumptions, dependencies, note and run links. Mark superseded results with the replacement ID. |
| PLAN.md | Complete checklist, including completed steps and every open step's predeclared `verify:` criterion. |
| DECISIONS.md | Current standing decisions about scope, notation, writing and ownership. Read in full before project edits. Replace an obsolete decision here after recording it in HISTORY.md with its replacement and reason. |
| HISTORY.md | Past decisions and dated changes. Historical evidence, not instructions overriding the current files. Do not read all history at startup. |
| OPEN-QUESTIONS.md | Detailed unresolved issues, failed approaches and operational gotchas. STATE links the blockers for the current task. |
| notes/ | Permanent derivations and records of completed work. |

## Reading and writing

- Startup: read each project's short Status. For the selected project read PROJECT,
  STATE and DECISIONS, then the relevant PLAN steps, RESULTS entries and notes.
  Follow STATE's explicit required-reading links (especially legacy migrated decisions).
- Solve: choose the next relevant open PLAN step, fix its verification criterion before
  calculation, record evidence, update RESULTS and PLAN, replace STATE's stopping point.
- Paper/revision: read DECISIONS and the relevant RESULTS as well as the paper map.
  Record a new standing decision in DECISIONS in the same edit, history in HISTORY.
- Pause: flush WIP into notes; update the current files and run `node harness/cli.mjs check
  <slug>`. Do not move unresolved constraints to history merely to meet a size target.
- A failed calculation stays open. A completed or declined step records its date and
  evidence or rationale. Do not turn an unverified imported result into a verified one
  during a state migration.

## Migration

The 2026-09-08 migration preserves the original STATE bytes under
`notes/state-before-2026-09-08.md` and records hashes in `notes/state-migration.json`.
Whole original sections are routed to the files above without deleting formulas,
result IDs or caveats. Legacy mixed chronological/current decision blocks remain
explicitly labelled in DECISIONS and must be read before edits; they are distilled
when that project resumes, not guessed during an infrastructure change. HISTORY
preserves the old Status and stopping-point record, including inconsistencies.
Each short STATE records its current summary separately and points to the full record.
Existing references to old STATE section names remain resolvable via stub headings.

Do not re-run migration over an already migrated project. On another computer, fetch
the individual project repository and offer a fast-forward pull; never migrate its old
STATE independently over changes already made elsewhere.
