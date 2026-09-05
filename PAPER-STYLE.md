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
- **A technical clause states its role in the claim, not just its fact.** A soundness
  condition dropped into a paragraph as a bare fact ("no gauge-invariant operator
  violates the unitarity bound at any of the maxima") leaves the reader unable to say
  what the paragraph's claim needs it for. Write the role: "the quoted central charges
  are the infrared values --- nothing falls below the unitarity bound, so no decoupling
  revises them." Test: delete the clause and ask what objection to the punchline
  returns; that objection is what the clause should be phrased against. (ad-chains §4,
  2026-08-26: the endpoint-soundness clause survived four rounds of author confusion
  because its role was never stated.)
- **Don't compress an argument into a summary clause.** A closing formula that
  only a reader who already understands the paragraph can parse ("the one-sided
  chains realize the two ends of the moment-map flow with the same fields")
  hides the argument instead of making it. Write the steps out: which theories,
  which operator, what adding it does. If the compressed line is redundant with
  the paragraph, cut it; if it is not, the paragraph was missing a step (user,
  2026-08-24, ad-chains §3 ¶5).
- **No glosses on formulas, no interpretive closers.** A clause that explains what a
  displayed formula already shows ("where $\phi_ib^2\phi_{i+1}$ is the unique gauge
  contraction of the four fields", "which is why they carry the $X_k$", "the plethystic
  exponential assembles the multi-letter states and the Haar integral projects onto gauge
  singlets") or that restates a paragraph as its meaning ("a flow between two
  non-Lagrangian theories is thereby realized by…") is filler to this reader. State the
  fact once, in the formula or in the claim; do not narrate it (user, 2026-08-27,
  ad-chains: "제발 이 논문에 필요없는 쓸데없는 말, 해석들 넣지 마").
- **A colon must add, not rename.** "realized by the singlets and the $\tr\phi_k^2$ that carry no $X$: the operators $M_0$, $M_j$ and $\tr\phi_k^2$ with $k>\lceil n/2\rceil$…" says the same set twice, once in words and once in symbols. Write the set once, in the form that carries the information — the symbols with their index ranges — and let the count follow from the ranges instead of being asserted ("Their number is $n$") (user, 2026-08-27, ad-chains §3 ¶3).
- **No `\boxed` equations.** Emphasis on a display comes from the surrounding prose
  naming it as the result, not from a frame (user, 2026-08-11; removed from
  eq:positivity and eq:RY-closed in susu-quiver).
- **When another paragraph absorbs a paragraph's content, cut it — do not trim the overlap.**
  A rewrite that moves definitions or a rule into a new paragraph leaves the old paragraph
  with nothing to claim; the reflex is to delete the repeated sentences and keep the rest,
  which leaves a paragraph that survives only because it was already written. Ask first
  whether it still has a punchline no other paragraph makes — and check the theory sections,
  which usually carry the same content per case. Real case (ad-chains §2, 2026-08-28): the
  $M$/$X$ paragraph kept "nothing decouples" as its job through a whole-draft proofread and a
  targeted one, while §3–6 ¶2 already said it per theory ("the ones whose dimension does not
  exceed 1"); once the new Method paragraph defined $M$ and $X$, the paragraph had no claim
  left, and the user had to cut it.
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
- **`notes/` vocabulary is not paper vocabulary.** The grep-the-draft test above is
  circular once an earlier session has written the working label into the draft:
  "termination", "one-sided/two-sided chain", "end superpotential", "active
  deformation", "flip set", "frame", and a label system ("$D$/$A_1$/$A_2$
  terminations", superpotentials named $W_{D|A_2}$ after them) all passed it for two
  weeks in ad-chains until the user's professor flagged them as invented terms
  (2026-08-27) and the paper had to be restructured to remove them. Test against the
  literature: would a paper in the field use the phrase? If not, name the object by
  what the literature names (the SCFT it flows to, an equation number) or describe the
  configuration in full ("flavors at one end", "the superpotential terms at node
  $n$"). When picking up a draft mid-project, audit it for this before adding to it.
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

- **One normalization per quantity, paper-wide.** A quantity displayed in one
  normalization is displayed in that normalization everywhere: if the paper's standard
  form is $b_0=(\cdots)N+O(1)$, never write $b_0/N=\cdots+O(1/N)$ elsewhere — and never
  mix the two inside one display (user, 2026-08-13; eq:multipair-b0 in susu-quiver had
  $b_0^{(\widetilde1)}$ exact next to $b_0^{(2)\rm mag}/N$).

## Observed: the professor's correction pass (ad-chains v3, 2026-09-05)

Source: a word-level diff of the professor's `main.tex` (2026-09-05, §4 cut) against the
last harness-written version (the `main.pdf` of 2026-09-03). Recorded as observations of
what the professor changed, kept, and cut. Where an observation conflicts with a rule above,
the conflict is marked and left for the user; nothing here overrides a rule yet.

1. **Cuts go by flow, not by content.** §4 (the negative-result scan, "other superpotential
   terms") was removed because it does not serve the flow — four theories, evidence for each
   — although it was true, verified, and mapped. A section is not justified by having a
   punchline; it is justified by a spine claim the reader needs. (Also gone: the appendix's
   closing orders sentence and the Discussion's 5d-construction paragraph — deliberate or
   stale-base, for the user.)
2. **Guided narrative in the first person plural.** "Consider a quiver gauge theory…", "Let
   us look at the spectrum", "We do this by splitting the two fundamentals…", "We choose the
   superpotential as", "Repeating the same procedure as in Section 2.1, we obtain", "We fix
   the $R$-charges from 1) …, 2) …, and 3) …", "Interestingly, we find…", "Notice that…". The
   harness wrote impersonal result sentences ("Performing $a$-maximization as in Section 2.1
   gives the $R$-charges of Table 3 for every $n\ge2$"). The professor walks the reader
   through the steps and names the agent.
3. **Orientation is repeated at the point of use, not factored out.** Each subsection
   restates what $M_i$ and $X_k$ flip ("once again $M_i$ are the flip fields for the
   `mesonic' operators, and $X_k$ … `Coulomb branch' operators"; "As before, we have cubic
   interactions for the fundamentals at both ends, quartic interactions for the
   bifundamentals, and flip fields for…"), and "theory" follows every label ("the
   $(A_1,A_{2n})$ theory"; subsection titles "… theory"). The cut-don't-gloss and
   colon-restatement rules above were written against invented glosses; a one-line reminder
   of a definition where it is used is not their target.
4. **Short physics remarks are wanted where the harness cut them.** "Notice that unlike
   usual quivers, we only have exactly one, not a pair, of bifundamentals for each edge";
   "The length of the quiver equals the rank of the Argyres-Douglas theory"; "This agrees
   with the expectation since $(A_1,A_{2n})$ theory does not have any flavor symmetry";
   "which is the only other gauge-invariant operator that has $R=4/3$, $f=-2$"; "which is a
   Drinfeld-Sokolov reduction … via subregular orbit". CONFLICT with "No glosses on formulas,
   no interpretive closers". The difference: each remark is a checkable fact the reader would
   otherwise have to work out, not a paraphrase of the display it follows. User to decide
   how the rule is reworded.
5. **Claim and evidence are separated, in the standard hedged register.** "We claim that
   these two gauge theories … are infrared dual", "Our claim implies having identical
   superconformal indices", "The duality implies that the RHS of (2.9) equals the RHS of
   (2.10). An analytic proof of this identity would be desirable. Instead, we explicitly
   compute…", "This is consistent with the conjecture that…", "They should be identical to
   the vacuum characters…". The harness asserted ("The duality asserts that (2.9) equals
   (2.10)"; "which are, at every computed order, the vacuum characters…"). Cost riding on
   this: every quantifier went too — "at every computed order", the $\ft^9$/$\ft^6$ orders,
   "with the flavor fugacities set to one" — and the intro now says "agree to leading order",
   which understates. Hedging the claim is style; losing the statement of how far it was
   checked is a defect to restore.
6. **Citations are sparser and placed once.** The AD central charges are cited in §2.1 and in
   Table 1's caption, then stated bare in §3.1/§3.2; the $k_F$ citations, the
   VOA-identification citations and the Virasoro-conjecture citation were dropped. The
   harness's cite-on-every-claim habit (the /cite-check regime) is not the professor's; a
   citation for a conjecture attributed to others must stay regardless.
7. **Literature jargon is used freely.** "Casimir operators", "mesonic operators",
   "(generalized) mesons", "flipper", "nilpotent Higgsing", "dual frame", "Coulomb branch
   operators" (unhyphenated), "verbatim". Several are on the ad-chains banned list, but the
   professor's complaint of 2026-08-27 was about INVENTED terms ("Claude's weird terms").
   The ban targets coinages, not standard jargon; user to decide whether "Casimir",
   "verbatim", "frame" stay banned for the harness's own prose.
8. **Parenthetical qualifiers as the aside device.** "(and their respective
   superpotential)", "(flip) deformations", "(triplet)", "(generalized)", "(unflipped)",
   "(baryonic)", "(subregular)", "(see Appendix A for the precise definitions of symbols)".
   Colons and semicolons also return. The punctuation-restraint rule was about the harness's
   overuse of colons and em-dashes; the professor's parentheses are a different device.
9. **Compact index ranges in subscripts, enumerations in-line, derivations narrated between
   displays.** "$M_{i=0,1,\cdots,\lfloor n/2\rfloor}$",
   "$\tr\phi^2_{k=1,\cdots,\lceil n/2\rceil-1}$", "$\Delta(M_{i\ge1})$" instead of "the $M_i$
   with $1\le i\le\lfloor n/2\rfloor$"; "1) …, 2) …, and 3) …"; "Then, we compute … to
   obtain [display]. Now, using the relations … we get [display]."
10. **Grammar is looser than the harness's — not a style to copy.** Dropped articles ("gives
    $n$-dimensional Coulomb branch", "flows to $(A_1,D_{2n+1})$ theory"), number agreement
    ("They indeed agrees", "This indices", "The cross … denote", "each fields"), a missing
    "In" before "Sections …". These the harness fixes silently on the next pass.
11. **What was left untouched:** the displays, the tables, the index series, Discussion
    ¶2–¶4, the appendix body. The professor edits the prose that carries the argument —
    openers, derivation, spectrum, flavor, flow, $n=1$, closers — and leaves the data.
12. **Process: the professor works in their own copy, and every copy is a partial merge.**
    The 2026-09-05 file has §2.1, the Discussion and the appendix prose from the professor's
    2026-09-02 file (the harness's same-night objective fixes — "Coulomm", "denote", the
    $k$-citations, the caption AD labels, $\xi^F\to\xi^f$, the (1.1) period — reverted again)
    with the 2026-09-03 body integrals and (A.9) pasted in. Before touching a professor copy:
    diff it against the last harness PDF, list what it reverted, and re-apply the objective
    fixes as a list — never assume the copy is a superset.
