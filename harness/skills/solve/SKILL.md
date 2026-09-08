---
name: solve
description: Execute the next step(s) of the active research project — calculate, verify, record, update state. Use when the user says to continue, solve, or do the next step of a project.
---

## Shared memory and execution contract

Read `harness/MEMORY.md` and the project's PROJECT, STATE and DECISIONS before edits.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Precondition: `PROJECT.md` and `STATE.md` of the project have been read this session.
Scope: the step(s) the user asked for; if unspecified, the next unchecked plan step.

Before each nontrivial calculation read `harness/EVIDENCE.md`, prepare the
verification spec before running, and record its run manifest. An execution PASS
is not a proof; record the evidence kind and checked range in RESULTS.

For each step:

1. **Prepare.** Re-read the wiki method/derivation pages relevant to this step. If a
   technique or reference gap appears mid-step, stop and suggest `/wiki-ingest` rather
   than improvising from general knowledge.
2. **Calculate.** Nontrivial algebra goes in `calc/` as a re-runnable sympy script
   (Mathematica only if the user asks); keep the hand derivation for the note. Use the
   conventions fixed in `PROJECT.md`.
3. **Verify** against the step's `verify:` criterion plus standard checks (dimensions,
   limits, special cases, symmetries, literature agreement). A failed check is never
   rationalized: investigate; if still stuck, record the discrepancy honestly in
   `OPEN-QUESTIONS.md` and tell the user.
4. **Record.** Write `notes/NN-<slug>.md` from `templates/note.md`: goal, setup,
   derivation, boxed result, verification outcomes, interpretation.
5. **Update memory**: check off the step in PLAN (title, date, notes/run refs and R/N ID),
   record the scoped result in RESULTS with assumptions, evidence kind and dependencies,
   and replace STATE's current phase and next action. New standing decisions go to
   DECISIONS; superseded decisions go to HISTORY with their replacement. Detailed
   unresolved issues belong in OPEN-QUESTIONS, with current blockers linked from STATE.
   Run `node harness/cli.mjs check <slug>`; report remaining findings honestly.

If a step reveals the plan itself is wrong, propose the revised plan to the user before
continuing — do not silently reroute.

End of turn: summarize in Korean what was established, how it was verified, and what
comes next.
