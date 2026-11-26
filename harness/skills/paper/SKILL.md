---
name: paper
description: Write a project's paper from its reviewed results to a verified draft — claims and outline, the draft with the grounds of every sentence, the verification gate, review by the other vendor's model and corrections. The same command in Claude and in Codex. Use when the user asks for a draft, write-up or paper.
---

Read `harness/PAPER-REVIEW.md` (with its verification gate), `PAPER-STYLE.md` and
`harness/AUTOMATION.md`. Write from recorded results and primary sources, not from memory
of the conversation.

Either model may write or edit the manuscript. The CLI records the app that runs it as the
writer of the text that changed, and takes the reviewer and the judges of each unit from a
vendor that did not write it.

## 1. Prerequisites

- Read `notes/paper-handoff.md` if present, the RESULTS entries the paper will state,
  their notes, reviews, assumptions and limits. A result whose calculation has no passed
  review is not stated as established: finish its review with solve, or stop and report.
- Every source the paper will cite must be in the wiki, since the grounds quote its text.
  Ingest a missing one as the user's working rules say. Search the literature beyond the
  wiki before calling anything new.
- Ask only about an unresolved scientific or scope choice, not for routine approval.

## 2. Claims and structure

Write `OUTLINE.json` before the prose: the central claims, each with the restrictions it
holds under, the sentences that will state the setting, and the role of every Section and
paragraph. Revise it when the argument changes. Definitions, motivation and transitions are
roles like any other.

## 3. Draft

- Use the project's JHEP setup: `jheppub.sty` locally or in a sibling LaTeX directory,
  otherwise from the JHEP author site; `paper/main.tex` and its included sources. Preserve
  a separately requested manuscript directory or author version.
- Take bibliography metadata from recorded references or INSPIRE.
- Organize the argument for the reader: definitions, derivations and checks where needed,
  lengthy support in appendices. Keep notation, assumptions and test ranges intact. The
  abstract and conclusion state what the body establishes, with the same scope.
- Write each sentence with its ground, in the same pass:
  - its entry in `GROUNDS.json`: its type and the quoted passages of notes, RESULTS,
    calculation outputs or cited sources that it rests on;
  - each numeral in `FACTS.json`: a calculation output, or a declared name;
  - each symbol, and each term the literature does not attest, in `LEXICON.json`.
  A sentence that no record supports is not written.

## 4. Verification gate

- `node harness/cli.mjs paper-verify <slug>`: its first run enrolls the draft. Repeat until
  code finds nothing to fix.
- `node harness/cli.mjs paper-judge <slug>`. A failed unit is changed,
  never overruled. A verdict the writer disputes goes to the user. Changed units are
  verified again.

## 5. Citations and the lead's reading

- Run cite-check for every citation of the draft.
- Read the whole manuscript sentence by sentence against the records (PAPER-REVIEW, "Judge
  every sentence"). The gate and the review do not replace this reading.

## 6. Review by the other model

- `node harness/cli.mjs review-request <slug> --target paper` (the reviewer is the other
  vendor's model). Do not edit the project while it runs.
- Accept only a completed, current report (AUTOMATION). Save it in full with its version
  metadata as `notes/review-paper-<run-id>.md`, and record its scope and unresolved
  findings in STATE.
- Fix blocking findings with revise, which verifies the changed units again, and request a
  re-review. Keep earlier reports and finding IDs. At most three correction rounds unless
  the user set another limit; reconstruct the count across sessions.
- Stop and record an inconclusive or failed review, a usage limit, a missing source, a scope
  decision or a physical contradiction. A calculation defect goes back to solve:
  unsupported physics is never repaired by changing prose.

## 7. Done

The draft is done when the `paper-verify` table shows no failure and nothing awaiting, the
latest review passes for the final files and the PDF compiles. Update STATE, checkpoint,
and report in Korean with that table and the review record. An unfinished draft is
reported with `paper-verify --wip "<reason>"` and its list of unverified units. Submission
is the user's decision.
