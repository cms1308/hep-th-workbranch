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
PAPER-STYLE.md       what keeps a draft from reading like project notes — read before writing paper/
templates/           PROJECT.md / STATE.md / note / PUNCHLINES.md templates — start new files from these
projects/<slug>/
  PROJECT.md         problem formulation, background, references, conventions (stable)
  STATE.md           live continuity: status, plan checklist, results, current step, open questions
  notes/NN-<step>.md permanent record of each completed step
  calc/              re-runnable scripts (sympy etc.), one per calculation
  paper/             JHEP LaTeX draft (created by /paper)
    main.tex         the draft
    PUNCHLINES.md    thesis, spine, and one punchline per section and per paragraph
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
/proofread     systematic read-through of the draft: stale refs, symbol collisions,
               claim/data mismatches vs notes/calc, terminology drift, paragraphs that
               no longer make the claim PUNCHLINES.md records for them
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

## Paper discipline

- `PAPER-STYLE.md` holds the notes → paper filter and the style rules the drafts here are
  held to. Read it before writing or revising `paper/*.tex`. It grows by recording defects
  found in real drafts.
- Every draft carries `paper/PUNCHLINES.md` (from `templates/PUNCHLINES.md`): the paper's
  thesis in one sentence, the spine of claims it rests on, and one punchline — the single
  claim the text exists to make — for every section and every paragraph. Paragraphs are
  identified by an anchor, their first ~6 words verbatim, so entries survive edits that
  move text.
- Read the map before touching the draft, and update it in the edit that changes what a
  paragraph claims — never as a later sweep. A map that disagrees with the draft is worse
  than no map, so `/proofread` treats a mismatch as a finding and resolves it against the
  notes.
- Never invent a punchline for a paragraph that makes no claim, and never adjust the
  spine to accommodate a section that no spine claim needs. Both are findings for the
  user, and both are the point of keeping the map.
- The terminology rule below applies to the map as well: punchlines are written in the
  draft's own words.

## Conventions

- Interact with the user in Korean; write all artifacts (STATE, notes, paper) in English.
- **Never invent terminology.** Do not coin a term, a label, or a compressed noun phrase
  to name an idea. Two allowed moves: use the word the literature or the draft already
  uses, or write the description out in full every time — including when no standard
  term exists. Banned: notation-derived labels ("½-tensor" for a node with
  $N_{\rm rank\text{-}2}=\tfrac12$), metaphors for technical operations ("its anomaly
  filled by bifundamentals"), coined contrasts standing in for an argument, and rare
  synonyms for something the draft already names. Test before writing any noun phrase
  as a name: grep the draft — if it is not already there, it is not a term. A phrase
  occurring exactly once is itself the smell.
- **When a phrase is unclear, cut it, don't gloss it.** These readers do not need the
  background restated; the surrounding equations and worked examples usually already
  carry the content. Propose an expansion only if the information appears nowhere else.
- Papers use the JHEP class (`jheppub.sty`).
- **Never hard-wrap `.tex` prose.** Each paragraph is a single source line; newlines only
  between paragraphs and around environments and comments. Environment internals
  (`equation`, `tabular`, `tikzpicture`) and comment lines keep their own line structure.
  This applies to every write and every edit of a `.tex` file — an edit must not
  reintroduce mid-paragraph breaks into a line it touches.
- Per-project notation (signature, normalizations, index conventions) is fixed in
  `PROJECT.md` and used consistently everywhere, including the paper.
