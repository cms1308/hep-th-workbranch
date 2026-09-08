---
name: resume-project
description: Cold-start into an ongoing research project — read its state files, brief the user on what the project is and where it stands, then continue. Use at the start of a new session or when the user asks where a project stands. (Named resume-project because /resume is a Claude Code built-in.)
---

## Shared memory and execution contract

Read `harness/MEMORY.md` and the project's PROJECT, STATE and DECISIONS before edits.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Input: optional project slug in $ARGUMENTS.

1. If no slug: `ls projects/`, read each `STATE.md` Status block; if more than one project
   is active, ask the user which one.
2. Read the project's `PROJECT.md` and `STATE.md` in full, plus DECISIONS, the relevant PLAN and RESULTS entries, and the most recent 1–2 notes
   in `notes/`. If the project has a draft, read `paper/PUNCHLINES.md` as well — its
   thesis, spine, and section punchlines are the fastest way into a paper this session
   has no memory of.
3. Brief the user in Korean, concretely:
   - 이 프로젝트가 무엇인지 (문제 한 문장)
   - 초안이 있으면 그 thesis 한 문장과 지금 spine이 어디까지 세워져 있는지
   - 어디까지 했는지 — established results를 수식 포함해서
   - 지금 어느 단계이고 정확히 어디서 멈췄는지
   - 다음 할 일과 open questions
4. If the user asked to continue (or confirms), proceed directly with the `/solve`
   protocol from the recorded stopping point. Otherwise stop after the briefing.
