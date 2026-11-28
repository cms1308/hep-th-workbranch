---
name: new-project
description: Start a hep-th research project — from a problem the user brings (study the background in LLMwiki, formulate it precisely, decompose it into verifiable steps) or from existing material (a draft, calculations, data, notes: inventory it, reconstruct the project and its support, interview the user) — and scaffold the project directory. Use when the user brings a new problem, asks to start a project, or brings work that already exists outside this repository.
---

## Shared memory and execution contract

Read `harness/MEMORY.md`; for an existing project, read PROJECT, STATE and DECISIONS
before edits. For a new project, create those files from the templates below.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Input: the user's problem statement (possibly vague), from $ARGUMENTS or the conversation.

## 1. Understand before formulating

- Read `<resolved-wiki>/Index.md`, then open every wiki page plausibly relevant
  to the problem (topics, concepts, methods, results, questions). Trust the wiki over
  general knowledge.
- Identify gaps: which references does the problem need that the wiki does not cover?
  List them with arXiv ids where known and suggest the user run `/wiki-ingest` in the
  LLMwiki project. Proceed without them only on explicit user OK, recording the caveat.

## 2. Formulate — with the user, not for them

- Restate the problem precisely: what is computed/shown, in which theory/regime, what
  form the answer takes, and what counts as success.
- Surface every ambiguity or competing interpretation as a question (use the available user-input tool when clarification is required);
  never pick silently.
- Fix notation and conventions up front (signature, normalizations, index conventions).

## 3. Plan

- Decompose into steps small enough that each has a concrete `verify:` criterion decided
  now, before any calculation, and a `serves:` line naming the success criterion it
  advances and the outcome that would change the plan. Order by dependency; flag risky
  or uncertain steps and say what the fallback is.
- If the formulation relies on data, results or code that already exist (another
  project, an earlier phase), list them with the question and selection each was built
  for and whether that fits this question; put the list in PROJECT's Inherited material.

## 4. Scaffold

- Create `projects/<slug>/` with `PROJECT.md` and `STATE.md` from `templates/`, plus empty
  `notes/` and `calc/`.
- `PROJECT.md`: formulation, success criteria, background summary with wiki links and
  citations, references (marking which need ingest), conventions.
- `PLAN.md`: plan checklist; `STATE.md`: the Question, status `formulated`, current step = step 1.
- Show the user the formulation and plan (in Korean) and get sign-off **before** any
  `/solve` work begins.

Scaffold STATE, PLAN, RESULTS, DECISIONS, HISTORY and OPEN-QUESTIONS from their
templates together. Results and the full plan go in their dedicated files; STATE
links them. Imported claims retain their original verification status.

## Starting from existing material

When the user brings work that already exists outside this repository (a draft,
notebooks or scripts, data, notes), the input is the path(s) to it. These steps take the
place of sections 1–3; scaffolding and the user's sign-off follow section 4, with the
additions of step 5.

1. **Inventory.** Read everything the user points at and classify each file: draft
   (.tex/.pdf), calculation (notebook/script), data, notes or correspondence. Report what
   was found before analyzing.
2. **Reconstruct from the material, not from guesses**: the problem and its intended
   success criteria; the conventions in use; which results are established and how each is
   supported (a reproducible calculation in the material, derived in the draft only, or
   merely claimed; a claim is never upgraded to a result); what visibly remains (TODOs,
   missing sections, dangling references, unverified steps).
3. **Cross-check knowledge.** Collect the draft's references and check which are in the
   wiki; name the missing key ones with arXiv ids for ingest, and read the relevant wiki
   pages.
4. **Interview the user** in Korean with the reconstruction, and ask what the files cannot
   tell: whether the problem statement is right and what the goal is now, which results
   the user considers solid or shaky, known issues, referee feedback or abandoned
   directions, and whether to copy or move the originals (default: copy, originals
   untouched).
5. **Scaffold** as in section 4, with the draft in `paper/` and calculations and data in
   `calc/` (a one-line header noting provenance and import date), an existing or short
   new section outline, `notes/00-import.md` as the import audit (inventory, result-by-result
   support status, discrepancies, what was not verified), PLAN with the done steps checked,
   and every imported result in RESULTS tagged **[imported — verified here: yes/no]**.
6. **Offer verification.** Propose which imported results to verify first (load-bearing
   or shaky) as the first `/solve` steps; the user decides and the plan
   records it. An imported result loses its tag only after passing a check in this harness.
   An imported draft is enrolled in the verification gate when `/paper` or `/revise` first
   works on it.

## Changing the question of an existing project

When the user changes what an existing project is trying to answer, apply sections 2–3
to that project as MEMORY "Changing the question" specifies: rewrite PROJECT's Problem
and Success criteria and STATE's Question (old text to HISTORY), write the inventory of
inherited material, have it reviewed with `/research-review <slug> project`, recheck the
open steps' `serves:` lines, and get the user's sign-off before steps for the new
question start.
