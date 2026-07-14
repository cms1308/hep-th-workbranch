---
name: proofread
description: Systematic section-by-section read-through of the active project's paper draft — find and fix stale references, symbol collisions, claim/data mismatches, and terminology drift. Use when the user asks to check, read through, or proofread a section or the whole draft (distinct from /revise, which applies a user-specified change).
---

Input: optional section spec ("3.2", "sec:dualAF", "intro", "all"). Default: the
sections not yet proofread this session, in order.

## Protocol

1. **Load ground truth first.** Read the target section(s) in full from
   `paper/main.tex`, plus the `STATE.md` results and the `notes/` files the
   section traces to. Never judge a section against memory alone: every
   quantitative claim is checked against the notes' Verification blocks or the
   `calc/out/*.json` it cites. If a claim cannot be traced, that is itself a
   finding.

2. **Hunt with the checklist** (each item has caught real defects):
   - **Stale cross-references**: prose describing content that a later revision
     moved or deleted ("exhibited below", "as shown in Section X", "we quantify
     this in ..."). These are the most common casualty of restructuring passes.
   - **Self-contradiction / overclaiming**: a sentence whose neighbor
     contradicts it ("the case realized is (1)" followed by case-(2)
     discussion); unconditional claims that a caveat elsewhere (†-markers,
     framework caveats) restricts.
   - **Symbol hygiene**: the same letter with two meanings in one subsection;
     symbols used before or without definition; subscripts whose referent is
     ambiguous. Check against the paper-wide conventions (PROJECT.md) and
     recent renames.
   - **Claim-vs-data precision**: every number, grid, count, and range quoted
     must match the calc output exactly — "all assignments up to 6" is wrong if
     the sweep ran the diagonal {0,2,4,6}. Understate rather than round up.
   - **Table/caption/text consistency**: row counts vs caption wording, marker
     footnotes present in all tables that need them, values matching the
     machine-checked scripts.
   - **Terminology drift**: after a rename (notation, "scenario" vs
     "topology", criterion names), grep the whole file for survivors of the
     old term, including in generated tables and captions.
   - **Imported-text grammar**: legacy sentences with missing articles/verbs.

3. **Physics changes are out of scope.** If a candidate fix would alter a
   physical claim, stop and check the notes; if the text and the notes
   disagree, surface the discrepancy to the user instead of silently editing
   (it may be a real error in either place).

4. **Fix surgically, then verify**: apply the edits, `latexmk -pdf` must give
   0 errors and 0 undefined references/citations, and grep-check that renames
   left no orphans.

5. **Commit** (per the project's standing commit policy) with a message
   listing the findings, and **report in Korean**: per finding — what was
   wrong, what it became, and why; state explicitly which sections are now
   proofread and which remain.
