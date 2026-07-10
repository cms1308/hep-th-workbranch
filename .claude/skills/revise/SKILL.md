---
name: revise
description: Revise the project's paper draft with whole-paper awareness — understand the flow and blast radius before applying the requested change. Use for any edit to paper/, including referee responses.
---

Never apply a requested edit blind. Protocol:

1. **Load the whole paper.** Read all of `paper/*.tex` (and the relevant `STATE.md`
   results) unless already read this session. You must know the paper's argument, not
   just the sentence being edited.
2. **Understand intent.** What problem is the user pointing at — clarity, correctness,
   emphasis, a referee comment? If the request is ambiguous, ask.
3. **Determine the blast radius** before editing: notation defined elsewhere,
   forward/backward references, claims echoed in abstract/introduction/conclusions,
   equation and section cross-references, consistency with `PROJECT.md` conventions.
4. **Push back when needed.** If the requested change conflicts with the paper's logic or
   with an established result, say so and propose an alternative instead of silently
   complying.
5. **Edit surgically**: the requested change plus the ripple edits it genuinely forces —
   no drive-by rewording of untouched text.
6. **Recompile** (`latexmk -pdf`) and report in Korean: what changed, and where ripple
   edits were needed and why.
