---
name: import-project
description: Onboard pre-existing research material (paper draft, calculations, data, notes) into a harness project — analyze it, reconstruct the state, and scaffold the project so work can continue with /solve, /paper, /revise. Use when the user brings work that already exists outside this repo.
---

## Shared memory and execution contract

Read `harness/MEMORY.md`; for an existing project, read PROJECT, STATE and DECISIONS
before edits. When onboarding a new project, create them from the imported material.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Input: path(s) to the existing material in $ARGUMENTS or the conversation
(LaTeX draft, Mathematica/Jupyter notebooks, data files, hand notes...).

## 1. Inventory

Read everything the user points at. Classify each file: draft (.tex/.pdf), calculation
(notebook/script), data, notes/correspondence. Report what was found before analyzing.

## 2. Reconstruct the project — from the material, not from guesses

From the draft and calculations, reverse-engineer:
- the problem being solved and its intended success criteria,
- the conventions in use (signature, normalizations, notation),
- which results are already established, and **how each is supported**: verified by a
  reproducible calculation found in the material / derived in the draft only / merely
  claimed. Do not upgrade a claim to a result.
- what visibly remains: TODOs in the draft, missing sections, dangling refs, unverified
  steps.

## 3. Cross-check knowledge

Collect the draft's references; check which exist in the LLMwiki vault. For key missing
ones, suggest `/wiki-ingest` (arXiv ids from the .bib). Read the relevant wiki pages so
the reconstruction uses the vault's distilled understanding.

## 4. Interview the user

Present the reconstruction (in Korean) and ask what the files cannot tell:
- Is the reconstructed problem statement right? What is the actual goal now?
- Which results does the user consider solid vs. shaky?
- Known issues, referee feedback, abandoned directions?
- Copy or move the originals? (Default: **copy**, originals untouched.)

## 5. Scaffold

Create `projects/<slug>/` from `templates/`:
- `PROJECT.md`: reconstructed formulation, conventions, references (ingest status marked).
- Existing draft → `paper/`; calculations/data → `calc/` (with a one-line header noting
  provenance and date of import). Write `paper/PUNCHLINES.md` from
  `templates/PUNCHLINES.md` for the imported draft — reading it closely enough to state
  its thesis, spine, and per-paragraph claims is what turns someone else's text into
  something this harness can revise; sections that resist a punchline go into the import
  audit as open questions.
- `notes/00-import.md`: the import audit — inventory, result-by-result support status,
  discrepancies noticed, what was NOT verified.
- `PLAN.md`: plan with already-done steps checked off; each imported result listed in
  `RESULTS.md` tagged **[imported — verified here: yes/no]**; open questions
  seeded from the remaining work and any shaky results.

## 6. Verification offer

Propose which imported results are worth re-verifying (cheap, load-bearing, or shaky
ones first) as the first `/solve` steps. The user decides; record the decision in the
plan. An imported result loses its "not verified here" tag only after passing a check in
this harness.

Get user sign-off on `PROJECT.md` + `STATE.md` before continuing with the normal
lifecycle (`/solve`, `/paper`, `/revise`).

Scaffold STATE, PLAN, RESULTS, DECISIONS, HISTORY and OPEN-QUESTIONS from their
templates together. Results and the full plan go in their dedicated files; STATE
links them. Imported claims retain their original verification status.
