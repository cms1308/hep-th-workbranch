---
name: revise
description: Change a project's manuscript — a specified edit or referee response, a wording polish (proposed or applied), or a read-through that finds and fixes defects — preserving scientific claims unless their change is authorized and supported; in an enrolled manuscript the changed units pass the verification gate again. Use for every manuscript edit and read-through.
---

Read `harness/PAPER-REVIEW.md` and, for prose, `PAPER-STYLE.md`. Keep the user's intended
scope and work in proportion to the change: a local edit needs the surrounding paragraphs
and targeted searches, not a pass over the whole draft. The writer of a change is the app
that runs this skill (`claude` in Claude Code, `codex` in Codex); its judges and reviewer
are of the other vendor.

## Kinds of request

- **A specified change**: an edit, a referee response, or an incoming author copy (merged
  by PAPER-REVIEW's comparison procedure, never assumed to be a superset). Read the
  affected passage and the definitions and evidence it depends on. For a change to the
  structure or to a central claim, read the whole argument and its echoes in the abstract,
  introduction and conclusion. A request that conflicts with established results is
  explained, not carried out by changing physics.
- **Wording**: clarify overloaded sentences, ambiguous referents, repetition and awkward
  connections. Keep the definitions and explanations the reader needs, restrained
  punctuation and established terminology. Preserve formulas, citations, qualifications,
  ranges and meaning. A change that needs a new physical claim is reported, not made as a
  wording improvement. On a request for suggestions, return each passage with the proposed
  wording and a brief reason, and change nothing.
- **Read-through**: read the passages in scope against the results, notes and data they rely
  on, with the checks of research-review's manuscript review. Fix the editorial defects found
  and report each scientific discrepancy with its evidence. Never invent a result or weaken a
  needed claim to remove a finding.

## Apply and verify

1. Apply the change and the corrections it requires (notation, equation references,
   tables, citations, conclusions elsewhere). Preserve intentional cuts and unrelated
   prose. Update the outline only if the argument or the role of a Section changed.
2. Recheck changed scientific claims against the records and changed citation claims
   against their sources; mark the affected rows of `CITATIONS.md` STALE. Run cite-check for
   new or questionable attributions.
3. In an enrolled manuscript (its directory holds `VERIFY.json`), give the changed sentences
   their entries (grounds, facts, names, lexicon, outline), then run
   `node harness/cli.mjs paper-verify <slug>` and `paper-judge <slug> --writer <writer>`
   for what changed. During the review loop of paper, or after a substantive change,
   request the other vendor's review as paper describes.
4. Compile after source changes and check the affected references and layout. Record a
   standing decision only when the edit establishes one. Update STATE, checkpoint, and
   report in Korean what changed, its verification and any unresolved scientific issue.
