---
name: solve
description: Execute the next step(s) of the active research project — calculate, verify, record, update state. Use when the user says to continue, solve, or do the next step of a project.
---

Precondition: `PROJECT.md` and `STATE.md` of the project have been read this session.
Scope: the step(s) the user asked for; if unspecified, the next unchecked plan step.

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
   `STATE.md` open questions and tell the user.
4. **Record.** Write `notes/NN-<slug>.md` from `templates/note.md`: goal, setup,
   derivation, boxed result, verification outcomes, interpretation.
5. **Update `STATE.md`**: check off the step, distill the result into Established
   results, set the current step and next action.

If a step reveals the plan itself is wrong, propose the revised plan to the user before
continuing — do not silently reroute.

End of turn: summarize in Korean what was established, how it was verified, and what
comes next.
