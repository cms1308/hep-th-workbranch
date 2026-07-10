---
name: import-project
description: Onboard pre-existing research material (paper draft, calculations, data, notes) into the harness — analyze it, reconstruct the project state, and scaffold projects/<slug>/ so work can continue with /solve, /paper, /revise. Use when the user brings work that already exists outside this repo.
---

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
  provenance and date of import).
- `notes/00-import.md`: the import audit — inventory, result-by-result support status,
  discrepancies noticed, what was NOT verified.
- `STATE.md`: plan with already-done steps checked off; each imported result listed under
  Established results tagged **[imported — verified here: yes/no]**; open questions
  seeded from the remaining work and any shaky results.

## 6. Verification offer

Propose which imported results are worth re-verifying (cheap, load-bearing, or shaky
ones first) as the first `/solve` steps. The user decides; record the decision in the
plan. An imported result loses its "not verified here" tag only after passing a check in
this harness.

Get user sign-off on `PROJECT.md` + `STATE.md` before continuing with the normal
lifecycle (`/solve`, `/paper`, `/revise`).
