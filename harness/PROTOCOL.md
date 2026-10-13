# Research Harness — hep-th projects

This repo carries theoretical-physics research projects from problem statement to
JHEP-style paper, across Claude and Codex sessions. **Continuity lives in files, not in the
conversation**: each project's `STATE.md` is the single source of truth for where it stands.

## Session-start protocol

Before doing anything else in this repo:

0. Fetch this harness repository and inspect its status (in PowerShell run the two
   commands separately): `git fetch --quiet`, then `git status -sb`. If behind,
   report the count and offer `git pull --ff-only`; never pull, rebase or force-push
   without the user's instruction. Fetch failure is reported, never hidden.
   Read [MEMORY.md](MEMORY.md) for current file ownership and [OPERATIONS.md](OPERATIONS.md)
   for OS-independent paths and checkpoint commands. At turn end checkpoint the files
   changed by this task, in each affected repository; Stop is only a fallback.
1. `ls projects/`. If empty, wait for the user to bring a problem and suggest `/new-project`.
2. Read the `## Status` block of every `projects/*/STATE.md`.
3. If the user names a project, or exactly one project is active, read that `STATE.md` in
   full and give the user a short briefing (in Korean): what the project is, what has been
   established (key results inline), what the current step is, what comes next.

Never calculate or edit inside a project without reading its `PROJECT.md`, `STATE.md`
and `DECISIONS.md` (when present), plus the linked records relevant to the task.

## Layout

```
harness/PROTOCOL.md  this shared protocol
PAPER-STYLE.md       what keeps a draft from reading like project notes — read before writing paper/
templates/           project memory, note, verification and paper-outline templates — start new files from these
projects/<slug>/
  PROJECT.md         problem formulation, background, references, conventions (stable)
  STATE.md           short current status, next action and required-reading links
  RESULTS.md         detailed result catalog; existing R/N IDs are retained
  PLAN.md            full checklist and verify criteria
  DECISIONS.md       standing decisions
  HISTORY.md         past decisions and prior state records
  OPEN-QUESTIONS.md   detailed issues, failed approaches and operational gotchas
  notes/NN-<step>.md permanent record of each completed step
  calc/              re-runnable scripts (sympy etc.), one per calculation
  paper/             JHEP LaTeX draft (created by /paper)
    main.tex         the draft
    PUNCHLINES.md    short section outline when useful; paragraph mapping is optional
    CITATIONS.md     per-citation ledger: where in the cited paper the claim sits, and
                     whether that paper is the original source (maintained by /cite-check)
  report/            plain-language TL;DR report (created by /report)
```

## Lifecycle

```
/new-project   formulate & plan → scaffold projects/<slug>/
/import-project onboard pre-existing material (draft, calculations, data) into a project
/solve         execute next step(s): calculate → verify → notes/ → STATE.md
/research-review    review a plan or completed step → findings and independent checks → STATE.md
/auto-calculate Claude-led solve → Codex review → corrections → calculation handoff
/auto-paper     GPT-led paper → Claude review → corrections → final draft
/pause         checkpoint before ending a session
/resume-project cold-start briefing in a new session, then continue
/paper         JHEP-style draft from established results
/report        plain-language TL;DR report (tex+pdf) from notes/ — English by default, Korean on request
/revise        flow-aware revision of the draft
/line-edit     improve wording and flow while preserving claims; propose or apply edits
               according to the user's requested mode and project decisions
/proofread     systematic read-through of the draft: stale refs, symbol collisions,
               claim/data mismatches vs notes/calc, terminology drift, paragraphs that
               leave gaps or contradictions in the argument
/cite-check    every \cite against the cited paper itself: exact location of the claim
               (equation/section/table), whether the paper is the ORIGINAL source or a
               restatement, bib entry vs INSPIRE; maintains paper/CITATIONS.md
```

If the user says they are about to clear/end the session, run the `/pause` protocol
without being asked.

Conversation-led automatic CLI calls follow [AUTOMATION.md](AUTOMATION.md).
Delegated review children are report-only: they return the report instead of editing
state or checkpointing; the lead records it and performs the normal state updates.
They never dispatch another reviewer. Existing research scope approvals still apply.

## Knowledge protocol (LLMwiki)

Resolve the wiki as a sibling of this harness via `node harness/cli.mjs paths`.
The sibling containing `Index.md` and `wiki/` is the primary knowledge source
(`Index.md` → `wiki/` pages; `sources/` only for equation-level detail).

- Before formulating or solving, check the wiki for relevant topics, methods, and results.
- If a needed reference is **not** in the wiki, do not silently answer from general
  knowledge: name the missing papers (arXiv ids where possible) and suggest the user run
  `/wiki-ingest` in the LLMwiki project. Proceed from general knowledge only if the user
  explicitly says so, and record that caveat in OPEN-QUESTIONS and link it from STATE.
- Never edit the vault from here. Results worth keeping → suggest `/wiki-ingest`.
- Propagate wiki citations into notes, `PROJECT.md`, and the paper.
- **Novelty claims require a literature search first** (user rule, 2026-08-18).
- **Citation-attribution checks also go beyond the wiki** (user rule, 2026-08-26): when
  verifying who a result or convention should be credited to, read the primary sources
  (arXiv/alphaXiv full text, INSPIRE), not just the wiki pages — wiki attribution can be
  coarse. The systematic form of this is `/cite-check` (user rule, 2026-08-27): every
  citation in a draft is verified in the cited paper's own text — exact location, and
  whether that paper is the original or merely restates/reproduces the result — with the
  verdicts kept in `paper/CITATIONS.md`. A correct value with a secondary source is a
  defect (origin: AMS [1610.05311] cited for AD central charges that are
  Shapere–Tachikawa's [0804.1957, 0809.3238]). Origin: the (A_1,D_6)/(A_1,A_5) Schur indices were first conjectured in
  Buican--Nishinaka [1505.05884], visible only in the CS/BN primary texts. Before
  writing that a result is "new", "not in the literature", or "unremarked", search for it
  beyond the wiki: alphaXiv/arXiv full-text and INSPIRE for the specific formula, identity,
  or statement (searching the objects themselves — e.g. "fermionic expression Macdonald
  index" — not just the papers already cited). Absence from the wiki or from the one source
  paper is NOT evidence of novelty. Record in the note what was searched and what was (not)
  found; if a match surfaces, cite it and recalibrate the claim (e.g. "proves the
  conjecture of X" instead of "new"). Origin: step 26 of ad-chains claimed a fermionic form
  as unremarked; it was Conjecture 1 of Foda–Zhu [1912.01896], caught by the user.

## Calculation discipline

- Every plan step gets a `verify:` criterion **before** the calculation starts.
- Prefer machine-checked algebra: put nontrivial computations in `calc/` as re-runnable
  sympy scripts (Mathematica only if the user asks), and keep the hand derivation in the note.
- Standard checks: dimensions, limiting cases, special cases with known answers,
  symmetries, agreement with the literature.
- A step is done only when its criterion passes. A failed check is never rationalized
  away — investigate, and if stuck, record the discrepancy in OPEN-QUESTIONS and link it from STATE.

## State discipline

- Update `STATE.md` at the end of **every completed step**, not only at `/pause`.
- `notes/` is the permanent derivation record; `RESULTS.md` holds the detailed catalog.
- Follow [MEMORY.md](MEMORY.md): update PLAN, RESULTS and DECISIONS as appropriate, and
  replace STATE's current status, next action and its required-reading dependencies
  at every completed step. Keep current decisions separate from historical records.

## Session recommendation

When reporting a completed step to the user, append one Korean line:
`세션: 유지 권장 — <reason>.` or `세션: 새 세션 권장 — <reason>.`
Use only context already available; do not reread files, inspect session logs or
query usage merely to make this recommendation. Prefer continuing for closely
connected next steps and ongoing corrections/debugging. Prefer a new session after
verification and checkpointing when the next task changes topic or method, or much
irrelevant trial-and-error/tool output has accumulated. For an independent review,
recommend a separate reviewer session; this alone does not establish independence.
Do not invent remaining-context percentages, cache costs or fixed step-count limits.
The recommendation is advisory: do not open a session, request confirmation or stop
authorized multi-step work solely because of it. Include it in the normal report.

## Paper discipline

- Use the default explanatory prose in `PAPER-STYLE.md` for drafting and substantive prose
  edits. Shared context, authorization, validation and optional review tracking are in
  [PAPER-REVIEW.md](PAPER-REVIEW.md).
- Plan the main argument and section roles for substantial drafting. A short outline
  normally suffices; `PUNCHLINES.md` retains its name for compatibility. No per-paragraph
  claim map, fixed claim/evidence order or separate map for a local edit is required.
  Definitions, motivation and transitions are valid parts of a paper.
- Match review to the change. Preserve claims, evidence, qualifications, citations and
  author cuts. Check new or changed attributions; audit the full paper before submission.
  Formal scans and attestations are available when useful, not routine editing gates.
- The 2026-10-13 user-requested simplification replaces the earlier global paragraph-map
  requirement; [rationale and historical examples](style/history-2026-10-13.md) are archived.
  Explicit project decisions still apply. Do not add a new universal rule for each edit.

## Conventions

- Interact with the user in Korean; write all artifacts (STATE, notes, paper) in English.
- **Use established terminology.** Avoid invented labels, compressed noun phrases,
  metaphors for technical operations and unnecessary synonyms. Use the literature's
  or project's name, or describe the object clearly. Check uncertain terminology;
  absence from the current draft or a single occurrence does not disqualify a standard
  term. Define necessary notation without using definitions to justify needless jargon.
- Remove redundant explanation. When the argument needs missing information, provide
  the definition or intermediate step; when an unclear phrase adds nothing, cut it.
- Papers use the JHEP class (`jheppub.sty`).
- **Never hard-wrap `.tex` prose.** Each paragraph is a single source line; newlines only
  between paragraphs and around environments and comments. Environment internals
  (`equation`, `tabular`, `tikzpicture`) and comment lines keep their own line structure.
  This applies to every write and every edit of a `.tex` file — an edit must not
  reintroduce mid-paragraph breaks into a line it touches.
- Per-project notation (signature, normalizations, index conventions) is fixed in
  `PROJECT.md` and used consistently everywhere, including the paper.

## Executable checks

Before nontrivial calculations follow [EVIDENCE.md](EVIDENCE.md); for manuscript work
follow [PAPER-REVIEW.md](PAPER-REVIEW.md). Check structure with `node harness/cli.mjs check`.
Evidence and review findings do not automatically rewrite physical claims. New failure
classes get a sanitized evaluation case under `evals/`; see `evals/README.md`.

All relative command paths in this protocol and shared skills are from the harness root.
Find it by walking up to `harness/cli.mjs`; do not assume a user name, drive or OS.
