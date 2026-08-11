# Paper style

What separates a draft that reads like a paper from one that reads like uploaded project
notes. Read before writing or revising any `paper/*.tex`. Every rule here traces to a
defect found in a real draft; extend it the same way, not with adjectives. The planned
next extension is to take passages from a small corpus of papers in the project's own
subfield, write the same passage the way a draft here would come out, and record what the
published version leaves out — the omissions are what does not show up from reading alone.

## The notes → paper filter

`notes/` is written for the next session: it records what was checked, in the order the
work happened, with background restated so the work can be picked up cold. The paper is
written for a referee who already knows the field. Moving material between them is a
filter, not a translation.

**Does not cross into the paper at all**

- The step's `verify:` criterion, and the record of the checks passing — dimension checks,
  limiting cases, special cases, agreement with the literature, cross-checks, counts of
  cases validated. Reproducibility material belongs in an appendix at most.
- Dead ends and abandoned approaches, unless the failure is itself a result.
- The order the work happened in, and any narration of it ("we first computed …, which
  then led us to …").
- Background restated for a future self: standard facts and definitions the field shares.
  Fix conventions by citation, in as few lines as possible.
- Script names, `calc/` paths, and anything about how the computation was run.

**Crosses, transformed**

- Hand derivations → compressed to the steps a referee needs in order to reconstruct the
  rest; long algebra to an appendix.
- A result → stated in the paper's own argument, not in the framing of the step that
  produced it.
- "Agrees with [paper]" → a citation attached to the claim it supports.
- Notation → exactly as fixed in `PROJECT.md`.

**Crosses as is**

- Final formulas, result tables, and citations already recorded in the notes or
  `PROJECT.md`.

## Organize by argument, not by chronology

The notes are ordered by when the work was done; the paper is ordered by what the reader
needs next in order to accept the thesis. A section whose order still matches the notes'
order is the most common reason a draft still reads like notes after every sentence in it
has been fixed.

## Established rules

- **No textbook-level review.** Do not spell out standard facts experts know (free chiral
  $R=\tfrac23$, $\Delta=\tfrac32 R$, gaugino $R=1$, the KPS replacement procedure).
- **No verification bookkeeping in the main text** — not "cross-checked three independent
  ways", not "validated on five anchors". The main text states background and facts.
- **No single-use symbols.** Do not introduce a symbol whose value is never used; if the
  only thing said about it is a relation, state the relation in prose instead.
- **No `\boxed` equations.** Emphasis on a display comes from the surrounding prose
  naming it as the result, not from a frame (user, 2026-08-11; removed from
  eq:positivity and eq:RY-closed in susu-quiver).
- **A fact carried over from `notes/` states only itself.** The notes record a checked
  fact in isolation, often in the source's framing; a draft that lifts the sentence tends
  to supply the surrounding picture from nothing, and that picture is not checked. Before
  writing a fact imported from a note, recompute its neighbours — the other members of the
  set it belongs to — and write what the whole set does.
  Real case (ad-chains, 2026-08-11, caught by the user twice a day apart): notes/06,07,10
  record the two-sided parity fact as "the flipped middle Casimir sits at exactly $R=2/3$
  with its partner $X$ at exactly $4/3$". Two successive drafts wrapped it in "in the
  two-sided families no operator drops below the bound", which is false — every other
  flipped Casimir sits strictly below $2/3$ and its partner strictly above $4/3$, so a
  single $(2/3,4/3)$ pair was never the picture. The neighbours take one line to compute
  and would have caught it either time.

## Before leaving a section

These are decisions made while writing, so they are checked while the section is still
open — not left for `/proofread`, which then finds a section's worth of them at once and
rewrites text that should never have been written that way. Run them section by section,
in the same pass that records the punchlines.

- **Every noun phrase used as a name**: grep the draft for it. Not already there means it
  is not a term — use the literature's word, or write the description out in full. Do not
  repair one by adding a gloss. A phrase that occurs exactly once is the tell.
- **Every symbol**: defined before its first use, used more than once, and spelled as
  `PROJECT.md` fixes it.
- **Self-containedness**: a reader with only the paper in hand has every definition,
  convention, and citation the section leans on. Anything the section silently inherits
  from `notes/` or from earlier conversation is a gap — either state it or cite it.
- **Every claim** traces to a note or to a citation already recorded in the notes or
  `PROJECT.md`.

What genuinely cannot be checked here — stale cross-references left by later
restructuring, terminology drift after a rename, table and caption consistency across the
whole document, contradictions between distant sections, the map falling behind the text —
is what `/proofread` is for.

## Candidate triggers

Grep the main text for: `we checked`, `we verified`, `cross-check`, `sanity check`,
`for completeness`, `as expected`, `it turns out`. These are notes voice; each occurrence
is a candidate finding, not an automatic error.
