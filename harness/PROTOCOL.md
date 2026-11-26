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
    RULES.json, LEXICON.json, FACTS.json, OUTLINE.json, GROUNDS.json, VERIFY.json
                     only for a manuscript enrolled in the verification gate (PAPER-REVIEW)
  report/            plain-language TL;DR report (created by /report)
```

## Lifecycle

```
/new-project     start a project: formulate and plan a new problem, or reconstruct one
                 from existing material (draft, calculations, data) → projects/<slug>/
/resume-project  cold-start briefing in a new session, then continue
/solve           next step(s): calculate → verify → record → review by the other vendor's
                 model → corrections → STATE.md; then the paper handoff
/research-review review of a plan, a step, the project or the manuscript, in this session
                 (solve and paper dispatch it to the other vendor)
/paper           paper from reviewed results: outline → draft with the grounds of every
                 sentence → verification gate → review by the other vendor → corrections
/revise          every manuscript change: a specified edit or referee response, wording,
                 or a read-through; the changed units pass the gate again
/cite-check      every \cite against the cited paper itself: exact location of the claim
                 (equation/section/table), whether the paper is the ORIGINAL source or a
                 restatement, bib entry vs INSPIRE; maintains paper/CITATIONS.md
/report          plain-language TL;DR report (tex+pdf) from notes/ — English by default,
                 Korean on request
/pause           checkpoint before ending a session
```
Every command is the same in Claude and in Codex, and either model may edit the same
manuscript or calculation. The CLI records the app that runs it as the author of what
changed; review and the independent verdicts are always by a vendor that did not write it.

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
- **Try the methods and report results** (user rule, 2026-11-10). When a question admits
  several methods (models, algorithms, solvers, symbolic regression, other search
  procedures), try a broad set and report each outcome. Needing a new package is not a
  reason to skip a method or to defer it to the user: install it (in a separate project
  environment if the pinned one must stay unchanged), record its versions in a checked-in
  requirements file and run it. Prior exposure of the data changes only how a result is
  labelled (exploratory, post hoc), never whether it is run. A method that cannot be run
  is reported with its failure. A negative conclusion states the methods actually tried
  and is not generalized beyond them. Scope approvals for new data, physics ranges,
  papers and releases still apply.

## State discipline

- Update `STATE.md` at the end of **every completed step**, not only at `/pause`.
- When the user changes the question a project answers, follow
  [MEMORY](MEMORY.md#changing-the-question): PROJECT and STATE's Question are rewritten,
  inherited material is inventoried and the project is reviewed before new steps.
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

- **Permanent language-and-content check (user, 2026-11-05).** Judge every word,
  technical expression and sentence in context, following
  [PAPER-REVIEW](PAPER-REVIEW.md#language-and-content-check). A section description
  must match the section actually written. Do not infer a generic stylistic objection
  from the user's examples, or treat one literature occurrence as proof that the
  draft's wording is natural. For language evidence exclude versions published in
  the preceding two years; record the actual corpus, dates and coverage. A full
  word-frequency audit must account for every token and every sentence, not a sample.
- **Permanent sentence-by-sentence judgment rule (user, 2026-11-04).** When writing or
  revising a manuscript, judge every sentence for physical and mathematical correctness,
  evidential support, exact meaning and scope, terminology and logical role. Before
  delivery, read the complete manuscript without skipping sentences, including captions,
  footnotes and appendices. An explicitly scoped excerpt requires the same complete
  judgment within its scope and dependencies. Follow [PAPER-REVIEW](PAPER-REVIEW.md#judge-every-sentence).
  Compilation, searches, delegated reviewer reports and scripted edits do not replace
  this responsibility (user, 2026-11-25); `queue` prints a reminder for manuscript TeX.
- **Verification gate, implemented and piloted (user, 2026-11-25; pilot 2026-11-26).** Rules become
  registered checks, verdicts come from code or an independent model, and a completion
  report requires every unit verified ([design](design/paper-verification.md)). Implemented:
  the checks that code decides, among them the comparison of terms and standard notation
  with a dated literature corpus (`corpus-build`), run by
  `node harness/cli.mjs paper-verify <slug> [paper-dir]`, and the independent verdicts of
  `node harness/cli.mjs paper-judge <slug> [paper-dir] --writer <claude|codex>`: a judge of
  the vendor that did not write the text, tested on seeded defects in every call. The
  outline of an enrolled manuscript is `OUTLINE.json`: its central claims with their
  restrictions, one entry for every paragraph and the sentences that state its setting,
  held to the text by code and by the judges (`paper-outline` prints it next to the text).
  Every sentence has an entry in `GROUNDS.json`: its type and the passages of the
  manuscript, the notes, the calculation outputs or the cited sources it rests on, quoted
  and judged against it (`paper-grounds`;
  [PAPER-REVIEW](PAPER-REVIEW.md#verification-gate)). A manuscript is gated once it is
  enrolled (its directory holds `VERIFY.json`). For an enrolled manuscript the table
  printed by `paper-verify` is the only evidence of verification a report may cite, and
  the Stop hook blocks the end of a turn that changed it without a complete verification
  or a declared work in progress (the tool hooks of
  [OPERATIONS](OPERATIONS.md#manuscript-verification-gate), installed 2026-11-26). A judge sees a sentence with its paragraph, its headings, the
  passages it rests on and the outline, not the rest of the notes, the data or the cited
  sources. In the pilot (stage 5, susu-quiver, 2026-11-26) the gate reached a complete
  verification, and the other vendor's review of the verified text then found errors in the
  calculations behind it: the reading duty above and the review stay in full for every
  manuscript, enrolled or not.
- Use the default explanatory prose in `PAPER-STYLE.md` for drafting and substantive prose
  edits. Shared context, authorization, validation and optional review tracking are in
  [PAPER-REVIEW.md](PAPER-REVIEW.md).
- Plan the main argument and section roles for substantial drafting. A short outline
  normally suffices; `PUNCHLINES.md` retains its name for compatibility. No per-paragraph
  claim map, fixed claim/evidence order or separate map for a local edit is required
  (a manuscript enrolled in the verification gate keeps one entry for each paragraph in
  `OUTLINE.json`).
  Definitions, motivation and transitions are valid parts of a paper.
- Match new calculations and primary-source reading to the claims being checked. The
  complete sentence-by-sentence judgment above remains mandatory. Preserve claims,
  evidence, qualifications, citations and author cuts. Check new or changed attributions;
  audit the full paper before submission.
  Formal scans and attestations are available when useful, not routine editing gates.
- The 2026-10-13 user-requested simplification replaces the earlier global paragraph-map
  requirement; [rationale and historical examples](style/history-2026-10-13.md) are archived.
  Explicit project decisions still apply. Do not add a new universal rule for each edit.

## Conventions

- Interact with the user in Korean; write all artifacts (STATE, notes, paper) in English.
- **No automatic Codex side panels (user, 2026-11-16).** Do not open or focus a right-side
  panel, preview, editor, browser tab or other app window unless the user explicitly
  requests that UI action. Creating, editing, compiling or checking a file is not a
  request to display it. Avoid artifact-opening hooks and output directives that
  automatically display deliverables; report completion in text, with an ordinary
  file link when useful. Headless compilation/rendering and local image inspection
  for verification are allowed. This preference also applies when a skill normally
  asks to announce or display an artifact.
- **Use established terminology.** Avoid invented labels, compressed noun phrases,
  metaphors for technical operations and unnecessary synonyms. Use the literature's
  or project's name, or describe the object clearly. Check uncertain terminology;
  absence from the current draft or a single occurrence does not disqualify a standard
  term. Define necessary notation without using definitions to justify needless jargon.
- Remove redundant explanation. When the argument needs missing information, provide
  the definition or intermediate step; when an unclear phrase adds nothing, cut it.
- Papers use the JHEP class (`jheppub.sty`).
- **Capitalize document references (user, 2026-11-17).** Always start reference nouns
  with a capital letter: `Section`, `Subsection`, `Figure`, `Table`, `Equation`,
  `Appendix`, `Chapter`, their plurals and abbreviations (`Sec.`, `Fig.`, `Eq.`, etc.).
  This applies throughout manuscripts and
  reports, including mid-sentence references, captions and footnotes, and references
  such as "this Section" or "the following Tables". Preserve lowercase LaTeX command
  and environment names, label keys and paths. Generic mathematical phrases such as
  "a differential equation" are not document references. See `PAPER-STYLE.md`.
- **Sentence-case titles, retained capitals (user, 2026-11-25).** In manuscripts,
  capitalize only the first word of the paper title and of every section, subsection,
  subsubsection, appendix and `\paragraph` title. The word after a colon in a title is
  lowercase as well ("Review: dualizing one node"). A word keeps the capital it has in
  running text: proper names and terms named after people (Lagrange multiplier, Seiberg
  duality, Veneziano limit), acronyms (SQCD, SCFT, RG), group and algebra names
  ($SU(N)$, $\mathcal N=1$), and labels the manuscript capitalizes throughout (Type I,
  Type II). Never lowercase these for the sake of the rule, and do not capitalize other
  words in a title. Write group names in titles as math, as in the text, with
  `\texorpdfstring` for the PDF bookmark. See `PAPER-STYLE.md`.
- **LaTeX `\paragraph` headings only where they fit (user, 2026-11-16; clarified
  2026-11-24).** `\paragraph` is allowed where it organizes parallel units of one
  argument, for example one paragraph per type or per case. Do not use it as
  decoration, as a sentence-length heading or in place of a transition; integrate
  such content into ordinary prose, and use a section or subsection only when the
  argument needs that structure. Apply this to the material being written or revised,
  without rewriting unrelated manuscripts or historical sources.
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
