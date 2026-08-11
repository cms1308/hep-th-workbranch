---
name: report
description: Produce a friendly, plain-language TL;DR report (LaTeX + PDF) of a project's established results, written from notes/ for a reader who wants to understand the project quickly — not a JHEP draft. English by default; Korean if the user asks. Use when the user asks for a report, summary document, or TL;DR of a project.
---

Input: optional project slug (default: the active project) and optional language
request. Default language is English; write Korean only if the user asks.

Precondition: read `PROJECT.md`, `STATE.md`, and **all** of `notes/` — the report is
written from the notes, not from memory of the session.

## What a report is (and is not)

A report answers, for a reader with physics background but no time: what was the
question, what did we find, how solid is it, and what remains. It is **not** a paper
draft — no referee, no literature review, no completeness. It is also **not** the
notes — no verification bookkeeping, no narration of the order the work happened in.

- **Plain language first, formula second.** Every result gets one sentence stating
  what it means before any equation appears. Include a formula only when the result
  *is* the formula; otherwise point to the note that has it.
- **Honest about status.** A result whose note records passing checks is stated
  plainly; anything unverified or in progress is labeled as such. Never promote an
  open question into a finding.
- **Traceable.** Every claim comes from a specific note or `STATE.md` result. Cite the
  note file inline (e.g. `[notes/03-anomaly-matching.md]`) so the reader can drill down.
- **Short.** Target 2–4 pages. If a section is growing past that, it is summarizing
  too little and quoting too much.

All repo conventions apply: no invented terminology, notation as fixed in
`PROJECT.md`, no hard-wrapped `.tex` prose.

## Structure

```
report/report.tex        English (default)
report/report-ko.tex     Korean, only when requested
```

Plain `article` class (11pt, sensible margins via `geometry`), `amsmath`,
`hyperref` — deliberately not the JHEP class. For Korean use `kotex` and compile
with `latexmk -xelatex`; English compiles with `latexmk -pdf`.

Sections, in order:

1. **TL;DR** — a boxed paragraph of 3–5 sentences at the top: question, answer,
   confidence. A reader who stops here should still leave with the punchline.
2. **The problem** — what was asked and why it is interesting, a short paragraph.
3. **What we found** — one subsection or bold-led paragraph per established result,
   in logical (not chronological) order: plain statement, the key formula or number
   if essential, note citation, and how it was checked in one clause.
4. **Status and next steps** — where the plan stands (done / current / remaining),
   distilled from `STATE.md`.
5. **Open questions** — from `STATE.md`, stated as questions, not spun as results.

## Procedure

1. Read the precondition files; inventory the established results and their
   verification status.
2. Write the report. The TL;DR is written **last**, after the body exists — it
   compresses the body, not the plan.
3. Re-read every sentence against the notes (self-review rules apply): no claim the
   notes do not support, no coined labels, no number you have not checked against
   `calc/` output or a note's Verification block.
4. Compile with `latexmk` until 0 errors and 0 undefined references. The report is a
   derived artifact: regenerate it from the notes when it goes stale rather than
   hand-patching it.
5. Report back in Korean: where the files are, what the TL;DR says, and anything that
   could not be included because its verification is incomplete.
