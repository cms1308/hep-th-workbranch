---
name: pause
description: Checkpoint the active research project before ending or clearing a session — flush in-progress work to disk and bring STATE.md to where a cold session can continue seamlessly. Use when the user says pause, wrap up, or is about to clear the session.
---

## Shared memory and execution contract

Read `harness/MEMORY.md` and the project's PROJECT, STATE and DECISIONS before edits.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


1. **Flush in-progress work.** An unfinished derivation goes into the current step's note
   as a `## WIP` section stating exactly where it stopped, what has been checked so far,
   and what remains. Scratch computations go into `calc/` with a one-line header comment.
   If the draft was edited this session, bring `paper/PUNCHLINES.md` back in sync before
   checkpointing; if that cannot be finished now, record in `STATE.md` exactly which
   sections' entries are stale.
2. **Update the current files** following `harness/MEMORY.md`: STATE contains one
   current stopping point and next action; PLAN contains the checklist; RESULTS contains
   scoped results and their evidence; DECISIONS contains the current rules. Preserve
   superseded decisions in HISTORY and detailed unresolved issues in OPEN-QUESTIONS.
3. **Check the checkpoint** with `node harness/cli.mjs check <slug>`. Read the resulting
   STATE and its required-reading links as a cold session would. Keep it within the
   advisory 200-line / 16-KB budget without hiding blockers or moving active rules to history.
4. **Save and report** using the explicit queue/flush commands in OPERATIONS. Report in
   Korean what was saved, any commit/push failure, and `/resume-project <slug>`.
