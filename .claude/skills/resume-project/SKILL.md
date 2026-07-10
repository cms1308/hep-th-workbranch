---
name: resume-project
description: Cold-start into an ongoing research project — read its state files, brief the user on what the project is and where it stands, then continue. Use at the start of a new session or when the user asks where a project stands. (Named resume-project because /resume is a Claude Code built-in.)
---

Input: optional project slug in $ARGUMENTS.

1. If no slug: `ls projects/`, read each `STATE.md` Status block; if more than one project
   is active, ask the user which one.
2. Read the project's `PROJECT.md` and `STATE.md` in full, plus the most recent 1–2 notes
   in `notes/`.
3. Brief the user in Korean, concretely:
   - 이 프로젝트가 무엇인지 (문제 한 문장)
   - 어디까지 했는지 — established results를 수식 포함해서
   - 지금 어느 단계이고 정확히 어디서 멈췄는지
   - 다음 할 일과 open questions
4. If the user asked to continue (or confirms), proceed directly with the `/solve`
   protocol from the recorded stopping point. Otherwise stop after the briefing.
