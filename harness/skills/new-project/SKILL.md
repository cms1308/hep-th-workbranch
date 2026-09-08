---
name: new-project
description: Start a new hep-th research project from a problem the user brings — study background via LLMwiki, formulate the problem precisely, decompose into verifiable steps, and scaffold the project directory. Use when the user brings a new physics problem or asks to start a project.
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
  now, before any calculation. Order by dependency; flag risky or uncertain steps and say
  what the fallback is.

## 4. Scaffold

- Create `projects/<slug>/` with `PROJECT.md` and `STATE.md` from `templates/`, plus empty
  `notes/` and `calc/`.
- `PROJECT.md`: formulation, success criteria, background summary with wiki links and
  citations, references (marking which need ingest), conventions.
- `PLAN.md`: plan checklist; `STATE.md`: status `formulated`, current step = step 1.
- Show the user the formulation and plan (in Korean) and get sign-off **before** any
  `/solve` work begins.

Scaffold STATE, PLAN, RESULTS, DECISIONS, HISTORY and OPEN-QUESTIONS from their
templates together. Results and the full plan go in their dedicated files; STATE
links them. Imported claims retain their original verification status.
