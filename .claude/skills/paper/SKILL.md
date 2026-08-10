---
name: paper
description: Write a JHEP-style LaTeX paper draft in paper/ from the project's established results. Use when the user asks for a draft, write-up, or paper.
---

Precondition: read `PROJECT.md`, `STATE.md`, and **all** of `notes/` — the paper is
written from the notes, not from memory of the session.

## 1. Result inventory

List which results are paper-worthy, confirm each is verified (its note records the
checks), and map how they connect into a narrative: motivation → setup → calculation →
results → discussion. Flag any result whose verification is incomplete — it does not go
in the paper without a caveat the user approves.

## 2. Outline — get sign-off

Propose, in Korean: the thesis (the one sentence the paper argues), the spine of claims
that thesis rests on in the order they are established, the section structure, and which
result goes where. Wait for the user's OK before writing.

## 3. Scaffold

- `paper/main.tex` using the JHEP class. Find `jheppub.sty`: check
  `~/git/LaTeX/` first; otherwise download from the JHEP author site; if neither works,
  ask the user.
- `paper/refs.bib`: pull entries from the wiki's `papers/` pages and
  `sources/arxiv/*/inspire.json` (INSPIRE texkeys preferred). Every literature claim in
  the draft must carry a citation already recorded in the notes or PROJECT.md.
- `paper/PUNCHLINES.md` from `templates/PUNCHLINES.md`, filled in with the signed-off
  thesis and spine. It is written before the prose, not after.

## 4. Write

Read `PAPER-STYLE.md` first and apply its notes → paper filter to every section: the
notes are written for the next session, the paper for a referee, and most of what a note
records deliberately does not cross. Notation exactly as fixed in `PROJECT.md`. Abstract
and introduction state precisely what is new.

Order each section by what the reader needs next to accept the thesis, not by the order
the steps were done in — the notes' order is the default the draft has to be moved off.

As each section is finished, run the "Before leaving a section" checks in
`PAPER-STYLE.md` on it — coined terminology, symbol hygiene, self-containedness, claims
traceable — and fix what they find while the section is still open. Leaving them to
`/proofread` means rewriting text that should not have been written that way.

Then record the section in `paper/PUNCHLINES.md`: the section's punchline
and one punchline per paragraph, with anchors. Do this while the section is fresh, not in
a sweep at the end. A paragraph you cannot state a punchline for does not belong in the
draft — cut it or merge it into its neighbour before moving on, and the same goes for two
paragraphs that come out with the same punchline.

## 5. Compile and record

Compile with `latexmk -pdf`, fix all errors and undefined references, report the result.
Update the `sync:` line of `paper/PUNCHLINES.md` and `STATE.md` (phase → paper drafting,
plus a Paper section tracking draft status).
