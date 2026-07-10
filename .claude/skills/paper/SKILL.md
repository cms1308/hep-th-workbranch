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

Propose the section structure and which result goes where (in Korean). Wait for the
user's OK before writing.

## 3. Scaffold

- `paper/main.tex` using the JHEP class. Find `jheppub.sty`: check
  `~/git/LaTeX/` first; otherwise download from the JHEP author site; if neither works,
  ask the user.
- `paper/refs.bib`: pull entries from the wiki's `papers/` pages and
  `sources/arxiv/*/inspire.json` (INSPIRE texkeys preferred). Every literature claim in
  the draft must carry a citation already recorded in the notes or PROJECT.md.

## 4. Write

Section by section from the notes: derivations compressed to paper level, long algebra
moved to appendices, notation exactly as fixed in `PROJECT.md`. Abstract and
introduction state precisely what is new.

## 5. Compile and record

Compile with `latexmk -pdf`, fix all errors and undefined references, report the result.
Update `STATE.md` (phase → paper drafting, plus a Paper section tracking draft status).
