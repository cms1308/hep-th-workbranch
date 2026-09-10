---
name: auto-calculate
description: Lead an authorized calculation workflow in Claude and automatically call Codex for plan and step reviews, corrections and rechecks. Use when the user requests the Claude-led calculation and GPT-review loop.
---

# Claude-led calculations

This workflow is led by the user's Claude conversation. In a GPT conversation,
explain the required handoff instead of impersonating Claude. Read
harness/AUTOMATION.md for commands, result acceptance and recovery.

1. Follow the normal project startup and solve skills. Establish the user's approved
   scope and stopping point from PROJECT, STATE and DECISIONS. Existing approval
   requirements remain in effect; model plan review is not user formulation sign-off.
2. Check for an outstanding review run before dispatch. Obtain Codex plan review if
   the current plan has not been reviewed. Complete one authorized solve step and
   checkpoint its derivation, evidence and current state before calling Codex.
3. Run review-request with reviewer codex and target plan or step-N. Wait for the
   process through the host's resumable command tool, giving progress updates. Do not
   edit the project while it runs. Do not call the reviewer through another reviewer.
4. Accept only a completed, current report as described in AUTOMATION.md. Preserve
   its full report and version metadata in a new notes/review-<target>-<run-id>.md;
   update STATE, affected RESULTS and OPEN-QUESTIONS following research-review's
   record-and-handoff rules. The lead records the reviewer identity accurately.
5. For corrections required, fix the blocking findings using solve, checkpoint, then
   request a new review of the same target. Preserve finding IDs and prior reports.
   After three correction rounds for a target, stop with the unresolved findings
   unless the user specified another limit. Optional improvements do not block ready.
6. For inconclusive, failed execution, missing references, exhausted usage, changed
   scope or conflicting evidence, preserve state and report what is needed. Do not
   silently retry, invent evidence or advance dependent steps. Report-only reviewers
   cannot run new verification code: arrange the requested independent check as a
   separately scoped research-review using EVIDENCE.md before requesting re-review.
7. For ready, advance to the next authorized step without another user instruction.
   Passing review does not upgrade finite-order or numerical evidence into a proof.
8. When all results needed for the agreed paper are reviewed, write notes/paper-handoff.md
   with result IDs, criteria, review links/versions, assumptions, unresolved limitations,
   proposed thesis and required reading. Update STATE's next action to auto-paper in
   the user's GPT conversation, checkpoint, and stop. Do not begin writing the paper.

On resumption reconstruct the round count and outstanding work from STATE and saved
review runs; never reset the correction limit because the conversation restarted.
