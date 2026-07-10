# Research Harness — hep-th projects

This repo carries theoretical-physics research projects from problem statement to
JHEP-style paper, across many Claude sessions. **Continuity lives in files, not in the
conversation**: each project's `STATE.md` is the single source of truth for where it stands.

## Session-start protocol

Before doing anything else in this repo:

1. `ls projects/`. If empty, wait for the user to bring a problem and suggest `/new-project`.
2. Read the `## Status` block of every `projects/*/STATE.md`.
3. If the user names a project, or exactly one project is active, read that `STATE.md` in
   full and give the user a short briefing (in Korean): what the project is, what has been
   established (key results inline), what the current step is, what comes next.

Never calculate or edit inside a project without having read its `PROJECT.md` and `STATE.md`.

## Layout

```
CLAUDE.md            this protocol
templates/           PROJECT.md / STATE.md / note templates — start new files from these
projects/<slug>/
  PROJECT.md         problem formulation, background, references, conventions (stable)
  STATE.md           live continuity: status, plan checklist, results, current step, open questions
  notes/NN-<step>.md permanent record of each completed step
  calc/              re-runnable scripts (sympy etc.), one per calculation
  paper/             JHEP LaTeX draft (created by /paper)
```

## Lifecycle

```
/new-project   formulate & plan → scaffold projects/<slug>/
/import-project onboard pre-existing material (draft, calculations, data) into a project
/solve         execute next step(s): calculate → verify → notes/ → STATE.md
/pause         checkpoint before ending a session
/resume-project cold-start briefing in a new session, then continue
/paper         JHEP-style draft from established results
/revise        flow-aware revision of the draft
```

If the user says they are about to clear/end the session, run the `/pause` protocol
without being asked.

## Knowledge protocol (LLMwiki)

The vault at `/Users/cms1308/git/LLMwiki` is the primary knowledge source
(`Index.md` → `wiki/` pages; `sources/` only for equation-level detail).

- Before formulating or solving, check the wiki for relevant topics, methods, and results.
- If a needed reference is **not** in the wiki, do not silently answer from general
  knowledge: name the missing papers (arXiv ids where possible) and suggest the user run
  `/wiki-ingest` in the LLMwiki project. Proceed from general knowledge only if the user
  explicitly says so, and record that caveat in `STATE.md` open questions.
- Never edit the vault from here. Results worth keeping → suggest `/wiki-ingest`.
- Propagate wiki citations into notes, `PROJECT.md`, and the paper.

## Calculation discipline

- Every plan step gets a `verify:` criterion **before** the calculation starts.
- Prefer machine-checked algebra: put nontrivial computations in `calc/` as re-runnable
  sympy scripts (Mathematica only if the user asks), and keep the hand derivation in the note.
- Standard checks: dimensions, limiting cases, special cases with known answers,
  symmetries, agreement with the literature.
- A step is done only when its criterion passes. A failed check is never rationalized
  away — investigate, and if stuck, record the discrepancy honestly in `STATE.md`.

## State discipline

- Update `STATE.md` at the end of **every completed step**, not only at `/pause`.
- `notes/` is the permanent record; `STATE.md` holds only distilled results and pointers.

## Conventions

- Interact with the user in Korean; write all artifacts (STATE, notes, paper) in English.
- Papers use the JHEP class (`jheppub.sty`).
- Per-project notation (signature, normalizations, index conventions) is fixed in
  `PROJECT.md` and used consistently everywhere, including the paper.
