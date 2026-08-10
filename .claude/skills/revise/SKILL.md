---
name: revise
description: Revise the project's paper draft with whole-paper awareness — understand the flow and blast radius before applying the requested change. Use for any edit to paper/, including referee responses.
---

Never apply a requested edit blind. Protocol:

1. **Load the map, then the whole paper.** Read `paper/PUNCHLINES.md` first — the thesis,
   the spine, and the section punchlines tell you what the paper is arguing before you
   read a line of it — then all of `paper/*.tex` (and the relevant `STATE.md` results)
   unless already read this session. You must know the paper's argument, not just the
   sentence being edited. If the map does not exist yet, tell the user and build it from
   `templates/PUNCHLINES.md` before editing, unless they decline: the whole-paper read it
   needs is one this protocol performs anyway.
2. **Understand intent.** What problem is the user pointing at — clarity, correctness,
   emphasis, a referee comment? If the request is ambiguous, ask.
3. **Determine the blast radius** before editing: notation defined elsewhere,
   forward/backward references, claims echoed in abstract/introduction/conclusions,
   equation and section cross-references, consistency with `PROJECT.md` conventions.
   The map shortcuts this — a paragraph tagged `[Sk]` carries a spine claim, so check
   every other paragraph tagged `[Sk]` and the abstract/introduction/conclusions echoes
   of it.
4. **Push back when needed.** If the requested change conflicts with the paper's logic or
   with an established result, say so and propose an alternative instead of silently
   complying. A change that contradicts the thesis or a spine claim is not a wording
   question: surface it as such.
5. **Edit surgically**: the requested change plus the ripple edits it genuinely forces —
   no drive-by rewording of untouched text. New prose obeys `PAPER-STYLE.md`; text pulled
   in from `notes/` to answer the request goes through its notes → paper filter rather
   than being pasted across.
6. **Update the map in the same edit.** Every paragraph whose claim changed, and every
   paragraph added, deleted, or moved; the section punchline if what the section
   contributes changed; the spine or thesis if the change reaches that far; anchors for
   any paragraph whose opening words changed; the `sync:` line. A map that disagrees with
   the draft is worse than no map.
7. **Recompile** (`latexmk -pdf`) and report in Korean: what changed, where ripple edits
   were needed and why, and which punchlines moved — flagging explicitly if the edit
   changed a spine claim or the thesis.
