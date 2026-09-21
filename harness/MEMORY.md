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
  STATE and DECISIONS in full, then STATE's task-specific required reading below.
- Solve: choose the next relevant open PLAN step, fix its verification criterion before
  calculation, record evidence, update RESULTS and PLAN, replace STATE's stopping point
  and required reading for the next action.
- Paper/revision: read DECISIONS and the relevant RESULTS as well as the paper map.
  Record a new standing decision in DECISIONS in the same edit, history in HISTORY.
- Pause: flush WIP into notes; update the current files and run `node harness/cli.mjs check
  <slug>`. Do not move unresolved constraints to history merely to meet a size target.
- A failed calculation stays open. A completed or declined step records its date and
  evidence or rationale. Do not turn an unverified imported result into a verified one
  during a state migration.

## Required reading

STATE's `Required reading` is the dependency list for its next action, not an archive
index. Name the PLAN step, RESULTS IDs, note sections and open issues needed, with
links and a short reason for each. Use heading anchors or exact section titles;
require a whole note only when the next action needs the whole derivation. Include
assumptions, conventions, unresolved review findings and failed approaches that constrain
the task. Follow further dependencies when needed; this list is a starting point,
not a prohibition on reading more. Replace obsolete entries at every completed step
and pause instead of appending each new note.

Do not read notes merely because they are the most recent. If an older STATE has no
useful dependency list or lists the whole archive, locate the selected PLAN step and
its result/note references using headings and search, then read the relevant sections.
Preserve explicit project-specific prerequisites; narrow broad links only after checking
their scope. Record the resulting list when updating STATE.

Read the selected draft's PUNCHLINES for paper work, a requested manuscript briefing,
or an explicit dependency of the current task. A draft's existence alone does not
require reading its map when resuming calculations. Paper-editing prerequisites remain.

## Keeping decisions current

DECISIONS contains current rules with their date, scope and source, not a session log.
When a decision is explicitly replaced, preserve its original text in HISTORY with
the replacement, reason and source link before removing it from DECISIONS. Keep the
current decision and its provenance in DECISIONS. Historical explanations belong in
HISTORY; derivations and results remain in notes and RESULTS. Do not archive a rule
merely because it is old, lengthy or concerns a different phase. Keep ambiguous or
unresolved constraints visible until resolved, and preserve existing link targets.

## Migration

The 2026-09-08 migration preserves the original STATE bytes under
`notes/state-before-2026-09-08.md` and records hashes in `notes/state-migration.json`.
Whole original sections are routed to the files above without deleting formulas,
result IDs or caveats. Legacy mixed chronological/current decision blocks remain
explicitly labelled in DECISIONS and must be read before edits. On that project's
next working resume, separate current rules from history using the procedure above;
preserve the original mixed block in HISTORY and keep all still-active constraints
in DECISIONS. A briefing-only resume does not require rewriting project files. Do not
guess the decisions during an infrastructure change. HISTORY
preserves the old Status and stopping-point record, including inconsistencies.
Each short STATE records its current summary separately and points to the full record.
Existing references to old STATE section names remain resolvable via stub headings.

Do not re-run migration over an already migrated project. On another computer, fetch
the individual project repository and offer a fast-forward pull; never migrate its old
STATE independently over changes already made elsewhere.
