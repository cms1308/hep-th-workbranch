---
name: report
description: Produce a friendly, plain-language TL;DR report (LaTeX + PDF) of a project's established results, written from notes/ for a reader who wants to understand the project quickly — not a JHEP draft. English by default; Korean if the user asks. Use when the user asks for a report, summary document, or TL;DR of a project.
---

## Shared memory and execution contract

Read `harness/MEMORY.md` and the project's PROJECT, STATE and DECISIONS before edits.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Input: optional project slug (default: the active project) and optional language
request. Default language is English; write Korean only if the user asks.

Precondition: read `PROJECT.md`, `STATE.md`, `DECISIONS.md`, `RESULTS.md`, and
all notes supporting the planned claims (follow dependencies) — the report is
written from the notes, not from memory of the session.

## What a report is (and is not)

A report answers, for a reader with physics background but no time: what was the
question, what did we find, how solid is it, and what remains. It is **not** a paper
draft — no referee, no literature review, no completeness. It is also **not** the
notes — no verification bookkeeping, no narration of the order the work happened in.

The reader is **outside this harness** and has never seen this repo. Nothing in the
report may presuppose or mention its structure: no "phase", "step", "note",
"STATE.md", "plan", file paths, or session vocabulary. The report reads as a
self-contained research summary; if a sentence only makes sense to someone who knows
how this repo works, rewrite it in terms of the physics.

- **Plain language first, formula second.** Every result gets one sentence stating
  what it means before any equation appears. Include a formula only when the result
  *is* the formula; otherwise state the result in words.
- **Honest about status.** A verified result is stated plainly; anything unverified
  or in progress is labeled as such — in plain terms ("preliminary", "not yet
  checked"), not in harness terms. Never promote an open question into a finding.
- **Traceable — but invisibly.** Every claim comes from a specific note or `RESULTS.md`
  result. Record the source as a LaTeX comment (`% src: notes/03-anomaly-matching.md`)
  above the claim, never in the rendered text.
- **Short by density, not by omission.** Target 2–4 pages for a results summary; a
  report the user asks to be pedagogical may run to 6–10 pages. The limit that matters
  is one idea per paragraph: a paragraph that mixes setup, numbers and caveats is
  summarizing too little and quoting too much.

All repo conventions apply: no invented terminology, notation as fixed in
`PROJECT.md`, no hard-wrapped `.tex` prose.

## Readability contract

Origin: the 2026-09-29 landscapeML-schur report. It was correct, sourced and free of
harness vocabulary, and the user could not read it: every section raised a question
the report should have answered ("why predict central charges?", "how many clusters
and what do they share?", "what is a sample?", "why was this experiment done?"). The
report had been organized by the project's chronology and by the harness's evidence
hierarchy (confirmatory endpoint first) instead of by the reader's questions, it showed
one example cluster instead of the result, it had no figure, and it used terms and
numbers without saying what they mean or what scale they live on. These rules prevent
that report.

1. **Lead with the user's aim, not the project's machinery.** If the aim is X (for
   example a clustering) and the confirmatory experiments were Y (for example
   prediction tests), the report's main section is X's result. Y appears afterwards,
   introduced by the sentence that links them ("the prediction tests are how we checked
   what the clustering distance measures") and by what each Y result changed in the
   reading of X. If Y cannot be linked to X in one sentence, the report is not ready.
2. **Every section title is a question the reader has, and the section answers it.**
   Order by the reader's questions (what was asked → what came out → how we know →
   what it means and does not mean → what is next), never by the order the work
   happened or by result IDs. A section that cannot be titled by a question is
   bookkeeping and is cut.
3. **Purpose before method.** Every experiment, model, transform or statistic is
   preceded by one sentence saying why it exists in this project. A method whose
   purpose cannot be stated in the physics is left out.
4. **The whole result, not an example.** A clustering result is the full table of
   groups (size, the physical range of each, what its members share) plus the
   statistic over every setting that was run; one displayed partition is never the
   result. A prediction result is the comparison table with every declared row that
   bears on the question. Say what was not found with the same prominence as what was.
5. **Numbers carry their scale.** Before the first error, difference or score, state
   what a good and a bad value look like in this problem (for example "rank runs from
   5 to 40; guessing the mean gives an error of about 6; one unit is a correct integer
   guess"). Intervals are explained once, in words, where they first appear.
6. **A figure for anything spatial.** A report about clusters, neighborhoods,
   embeddings or distributions contains at least one picture of the objects, produced
   by a recorded script from recorded data (a run manifest, a note), never drawn by
   hand and never from numbers that exist only in the session.
7. **One worked example carried through.** Pick one concrete object (one theory, one
   operator, one configuration) with its actual recorded numbers and follow it through
   every definition the reader must hold; abstract definitions alone do not survive a
   first reading.
8. **Say what the members of a group share, and what is not known.** For every
   grouping, ranking or classification the report shows, one paragraph answers "so
   what do the members have in common?" in two lists: what is established and what is
   not. If the annotations used to judge a grouping are themselves functions of the
   inputs, say so, because it bounds what the grouping can ever show.
9. **A glossary at the end** with one line per technical term the reader must hold
   (representations, error measures, intervals, samples and resamples, information
   measures, algorithms). Terms are defined the first time in the text as well.
10. **Numbers only from records.** Anything computed during the session to answer a
    question goes into a re-runnable script, a spec, a run and a note before it goes
    into the report. A number without a `% src:` is a defect.

## Structure

```
report/report.tex        English (default)
report/report-ko.tex     Korean, only when requested
report/figures/*.png     figures, produced by a recorded script
```

Plain `article` class (11pt, sensible margins via `geometry`), `amsmath`,
`hyperref`, `graphicx` — deliberately not the JHEP class. For Korean use `kotex` and
compile with `latexmk -cd -xelatex projects/<slug>/report/report-ko.tex`; English compiles
with `latexmk -cd -pdf projects/<slug>/report/report.tex`. Set a Korean main font that
exists on the machine (check `fc-list :lang=ko`), and use curly quotation marks; straight
quotes render wrongly with CJK fonts.

In a Korean report, technical terms stay in English: physics terminology
(superpotential, anomaly matching, moduli space, ...), group/symmetry names, and
mathematical objects are written in English as-is, with Korean carrying the
surrounding prose. Do not translate or transliterate them into Korean.

Sections, in this order, each titled by the question it answers:

1. **TL;DR** — a boxed paragraph at the top: the aim, what was built, the main result
   in the aim's own terms, what it means and does not mean, confidence. A reader who
   stops here still leaves with the punchline. Written last.
2. **What was asked** — the aim and the operational question, a short paragraph each.
3. **Background** — only the definitions the reader must hold to read the result, with
   the worked example (rule 7). For a results summary this is one page at most; for a
   pedagogical report, as long as the definitions need.
4. **The data** — what objects, how many, how they were checked, what was merged.
5. **The main result** — the section that answers the aim (rule 1), with the whole
   result (rule 4), a figure (rule 6), the scale of its numbers (rule 5) and the
   established/not-established lists (rule 8).
6. **How we know what the result measures** — the confirmatory experiments, each
   introduced by its purpose (rule 3) and closed by what it changed in the reading of
   the main result.
7. **What remains** — done, in progress, not started, as research goals, never as plan
   bookkeeping.
8. **Open questions** — from `OPEN-QUESTIONS.md` and STATE's current blockers, as
   questions, not spun as results.
9. **Glossary** (rule 9).

## Procedure

1. Read the precondition files; inventory the established results and their
   verification status. Write down the reader's questions the report must answer, in
   the reader's words; when the report is being regenerated after the user asked
   questions about an earlier version, those questions are the specification.
2. Make the figures and any grouping tables from recorded outputs with a script under
   `calc/` and a spec; run it; record it in a note if the numbers are new (rule 10).
3. Write the report in the section order above. The TL;DR is written **last**, after
   the body exists — it compresses the body, not the plan.
4. Re-read every sentence against the notes (self-review rules apply): no claim the
   notes do not support, no coined labels, no number you have not checked against
   `calc/` output or a note's Verification block. Then read the draft as the reader:
   for each section, state the question it answers; for each paragraph, state its one
   idea; for each method, find the sentence that says why. Fix what fails. Then check
   the rendered text (not comments) for harness vocabulary — grep for phase, step,
   note, plan, STATE, session, verify (and their Korean equivalents) — and rewrite any
   hit in terms of the physics.
5. Compile with `latexmk` until 0 errors and 0 undefined references; render the first
   pages to an image and look at them. The report is a derived artifact: regenerate it
   from the notes when it goes stale rather than hand-patching it.
6. Report back in Korean: where the files are, what the TL;DR says, the list of reader
   questions the report answers, and anything that could not be included because its
   verification is incomplete.
