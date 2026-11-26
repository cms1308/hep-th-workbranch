---
name: solve
description: Execute the next step(s) of the active research project — calculate, verify, record, have the other vendor's model review each step, correct, update state — and hand the reviewed results to the paper. The same command in Claude and in Codex. Use when the user says to continue, solve, or do the next step of a project.
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
Either model may lead. The CLI sends each review to the vendor other than the app that runs
it (commands, acceptance and recovery in `harness/AUTOMATION.md`).
User sign-off of the formulation stays the user's; a model's plan review does not replace it.

Before each nontrivial calculation read `harness/EVIDENCE.md`, prepare the
verification spec before running, and record its run manifest. An execution PASS
is not a proof; record the evidence kind and checked range in RESULTS.

For each step:

1. **Prepare.** Read the step's `serves:` line against PROJECT's success criteria and
   the latest project review. If the step no longer serves them, or it relies on data,
   results or code built for another question that no inventory covers (MEMORY,
   Changing the question), say so and propose the change before calculating.
   Re-read the wiki method/derivation pages relevant to this step. If a technique or
   reference gap appears mid-step, stop and suggest `/wiki-ingest` rather than
   improvising from general knowledge.
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
   Replace STATE's required reading with the next action's PLAN step, RESULTS IDs,
   note sections and relevant issues, each with a link and reason; follow MEMORY's
   dependency and decision rules rather than accumulating completed-step notes.
   Run `node harness/cli.mjs check <slug>`; report remaining findings honestly.
6. **Review by the other vendor.** Before the first step of a plan that has not been
   reviewed, run `node harness/cli.mjs review-request <slug> --target plan`; after each step
   is checkpointed, `--target step-N`. Do not edit the
   project while it runs. Accept only a completed, current report (AUTOMATION), save it in
   full as `notes/review-<target>-<run-id>.md`, and update STATE, RESULTS and
   OPEN-QUESTIONS by research-review's record rules.
   - Corrections required: fix the blocking findings with this skill, checkpoint and request
     a review of the same target again, keeping earlier reports and finding IDs. At most
     three rounds for a target unless the user set another limit.
   - A reviewer is report-only and runs no code. A check it asks for is arranged as a
     separately scoped research-review under EVIDENCE.md before the re-review.
   - Inconclusive, failed execution, missing references, exhausted usage, changed scope or
     conflicting evidence: preserve the state and report what is needed. Do not retry
     silently or advance dependent steps.
   - Ready: go on to the next authorized step without another instruction. A passed review
     does not turn finite-order or numerical evidence into a proof. A step the user exempts
     from review is recorded as unreviewed in RESULTS.

When all results the agreed paper needs are reviewed, write `notes/paper-handoff.md`
(result IDs, criteria, review links and versions, assumptions, unresolved limitations, the
proposed thesis, required reading), set STATE's next action to `/paper`, checkpoint and
stop; do not start writing the paper in the same pass. On resumption reconstruct review
rounds and outstanding work from STATE and the saved review runs; a restart never resets
the round count.

If a step reveals the plan itself is wrong, propose the revised plan to the user before
continuing — do not silently reroute. If the user's instruction changes the question the
project answers, follow MEMORY "Changing the question" instead of adding steps.

End of turn: summarize in Korean what was established, how it was verified, what it
changes for the success criteria, and what comes next. Append the one-line session recommendation from harness/PROTOCOL.md.
