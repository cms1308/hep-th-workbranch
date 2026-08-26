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

## 4. Map first, then write

**The full punchline map precedes all prose** (user rule, 2026-08-26: fix what the paper
claims, structure the steps that establish it — those steps ARE the punchlines — and
only then write text to match; never write first and extract punchlines after). Before
any prose, extend `paper/PUNCHLINES.md` to the complete argument: every planned
section's punchline, and under it one punchline per planned paragraph — each the single
claim a unit of text will exist to make, ordered by what the reader needs next to accept
the thesis, not by the order the steps were done in. This is structuring the argument,
not summarizing text: a paragraph is planned because the spine needs its claim, never
because material exists for it. Anchors stay empty at this stage — they are filled with
the paragraph's first ~6 words once the prose exists.

Then write to the map: each paragraph is written to make exactly its pre-declared
punchline. If writing reveals the map is wrong — a step missing, a claim that splits,
a planned paragraph not needed — change the map first, deliberately, then write;
never let the prose drift and re-derive its punchline afterwards.

Read `PAPER-STYLE.md` before writing and apply its notes → paper filter to every
section: the notes are written for the next session, the paper for a referee, and most
of what a note records deliberately does not cross. Notation exactly as fixed in
`PROJECT.md`. Abstract and introduction state precisely what is new.

As each section is finished, run the "Before leaving a section" checks in
`PAPER-STYLE.md` on it — coined terminology, symbol hygiene, self-containedness, claims
traceable — fix what they find while the section is still open (leaving them to
`/proofread` means rewriting text that should not have been written that way), fill in
the anchors, and confirm each paragraph still makes its mapped claim.

## 5. Compile and record

Compile with `latexmk -pdf`, fix all errors and undefined references, report the result.
Update the `sync:` line of `paper/PUNCHLINES.md` and `STATE.md` (phase → paper drafting,
plus a Paper section tracking draft status).
