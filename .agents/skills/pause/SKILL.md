---
name: pause
description: Checkpoint the active research project before ending or clearing a session — flush in-progress work to disk and bring STATE.md to where a cold session can continue seamlessly. Use when the user says pause, wrap up, or is about to clear the session.
---

1. **Flush in-progress work.** An unfinished derivation goes into the current step's note
   as a `## WIP` section stating exactly where it stopped, what has been checked so far,
   and what remains. Scratch computations go into `calc/` with a one-line header comment.
   If the draft was edited this session, bring `paper/PUNCHLINES.md` back in sync before
   checkpointing; if that cannot be finished now, record in `STATE.md` exactly which
   sections' entries are stale.
2. **Rewrite `STATE.md`** so a fresh session with zero conversation memory can continue.
   Rewrite means REPLACE, never append: every section holds the current state, not a log
   of the sessions that produced it.
   - Status: phase + date. Replace the standing status; do not leave a dated paragraph
     beside it.
   - Plan: a checklist. One line per step — title, date, `[notes/NN, calc/*.py]`, and its
     (R) number. What the step established goes in Established results, not here, and
     never in both.
   - Established results: the one place results accumulate, formulas inline.
   - Current step: exactly ONE stopping point — this session's — and the very next
     action. The previous stopping point is superseded; delete it, its content is
     already in its note.
   - Paper (projects with a draft): the standing style and content decisions, each
     stated once. Supersede in place — a decision that replaced an earlier one leaves no
     trace of the earlier one. `/revise` and `/proofread` write here as they go, so at
     pause this section is checked for duplicates, not rebuilt.
   - Open questions / gotchas: failed approaches, subtle conventions, pending ingests —
     anything this session learned the hard way. Delete entries once resolved rather
     than striking them through.
3. **Check the size.** `STATE.md` is a pointer file: it should stay far smaller than the
   `notes/` it points to. If it grew this session, find what should have been replaced
   and was appended instead — repeated dated blocks and per-step result summaries
   duplicated between Plan and Established results are the usual causes.
4. **Verify the checkpoint**: re-read `STATE.md` and ask "could I continue from the files
   alone?" If anything is missing, add it now.
5. Report to the user in Korean: what was saved, and the one-line resume instruction
   (`새 세션에서 /resume-project <slug>`).
