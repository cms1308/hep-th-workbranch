---
name: auto-paper
description: Lead paper writing in GPT and automatically call Claude for report-only manuscript reviews and rechecks. Use for the agreed GPT-led paper and Claude-review loop after calculation handoff.
---

# GPT-led paper

This workflow is led by the user's GPT/Codex conversation. In Claude, prepare the
handoff instead of impersonating GPT. Read harness/AUTOMATION.md for dispatch,
acceptance and recovery. Follow project startup and read notes/paper-handoff.md if
present, plus the linked results and reviews. Verify prerequisites from evidence;
a handoff alone is not evidence that calculations passed review.

1. Establish the agreed paper scope and ensure the required calculations have review
   support for that scope. Stop on missing prerequisites or unresolved blocking findings.
2. Use paper for first drafting and revise for corrections. Follow PAPER-STYLE,
   PUNCHLINES and PAPER-REVIEW, building the claim map before prose. Perform the
   required citation checks, scan and compile, then checkpoint before dispatch.
3. Call review-request with target paper and reviewer claude. Wait with progress
   updates; do not edit the project concurrently. The reviewer returns findings only.
4. Accept only a completed, current report. Preserve the full report and version
   metadata in notes/review-paper-<run-id>.md and update STATE with its scope and
   unresolved issues. Record exact reviewer identity when known, otherwise unknown.
   Never use a general ready verdict as an attestation of unexamined citation rows
   or paragraph IDs. Apply attestations only for explicitly documented checks.
5. Resolve blocking findings with revise, update the map and citation ledger as needed,
   compile and checkpoint, then request Claude re-review. Retain earlier reports and
   stable finding IDs. Stop after three correction rounds unless the user set another
   limit; reconstruct the count across resumed conversations.
6. Stop and record any inconclusive/failed review, usage limit, missing source, scope
   decision or physical contradiction. Return calculation defects to the calculation
   workflow; do not repair unsupported physics merely by changing prose.
7. Finish only after the latest paper review passes for the final substantive files,
   required evidence and citation coverage are accounted for, and the PDF compiles.
   Deliver the manuscript and review record; submission remains the user's decision.

Do not call an additional reviewer from a delegated review. On resumption inspect
saved run status before another call. The loop runs while this conversation executes;
it is not an unattended service after the conversation stops.
