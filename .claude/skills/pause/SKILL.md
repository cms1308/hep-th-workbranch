---
name: pause
description: Checkpoint the active research project before ending or clearing a session — flush in-progress work to disk and bring STATE.md to where a cold session can continue seamlessly. Use when the user says pause, wrap up, or is about to clear the session.
---

1. **Flush in-progress work.** An unfinished derivation goes into the current step's note
   as a `## WIP` section stating exactly where it stopped, what has been checked so far,
   and what remains. Scratch computations go into `calc/` with a one-line header comment.
2. **Rewrite `STATE.md`** so a fresh session with zero conversation memory can continue:
   - Status line (phase + date)
   - Plan checklist, up to date
   - Established results with formulas inline
   - Current step: exact stopping point and the very next action
   - Open questions / gotchas: failed approaches, subtle conventions, pending ingests —
     anything this session learned the hard way.
3. **Verify the checkpoint**: re-read `STATE.md` and ask "could I continue from the files
   alone?" If anything is missing, add it now.
4. Report to the user in Korean: what was saved, and the one-line resume instruction
   (`새 세션에서 /resume-project <slug>`).
