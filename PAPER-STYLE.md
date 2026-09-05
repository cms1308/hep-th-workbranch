# Paper style

What separates a draft that reads like a paper from one that reads like uploaded project
notes. Read before writing or revising any `paper/*.tex`. Every rule here traces to a
defect found in a real draft, or to a correction the professor made to one; extend it the
same way, not with adjectives. Project-specific decisions (banned words, notation, section
shapes) live in the project's `STATE.md` Paper section, not here.

Reorganized 2026-09-05 (user: 'paper style 정리') from the rule list that had grown since
2026-08-10 plus the observations of the professor's 2026-09-05 correction pass; every
earlier rule is kept, grouped by theme, with its origin. Two conflicts between the old
rules and the professor's practice were resolved in the professor's direction and are
marked RESOLVED below; the user can reverse either.

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

**A section is justified by a spine claim, not by having a punchline.** The professor cut
ad-chains §4 (the negative-result scan) although it was true, verified, and mapped: the
paper's flow — four theories, evidence for each — did not need it (2026-09-05). Before
keeping a section, name the spine claim the reader cannot accept without it.

## Voice and register

Recorded from the professor's correction pass on ad-chains (2026-09-05; the diff of the
professor's file against the harness's last version is the corpus the planned "small
corpus of papers in the subfield" extension was meant to supply).

- **Guided narrative in the first person plural.** "Consider a quiver gauge theory…", "Let
  us look at the spectrum", "We do this by splitting the two fundamentals…", "We choose the
  superpotential as", "Repeating the same procedure as in Section 2.1, we obtain", "We fix
  the $R$-charges from 1) …, 2) …, and 3) …", "Interestingly, we find…", "Notice that…". The
  harness wrote impersonal result sentences ("Performing $a$-maximization as in Section 2.1
  gives the $R$-charges of Table 3 for every $n\ge2$"). Walk the reader through the steps
  and name the agent.
- **Claim, then evidence, in the standard hedged register.** "We claim that these two
  gauge theories … are infrared dual", "Our claim implies having identical superconformal
  indices", "The duality implies that the RHS of (2.9) equals the RHS of (2.10). An
  analytic proof of this identity would be desirable. Instead, we explicitly compute…",
  "This is consistent with the conjecture that…". The harness asserted ("The duality
  asserts that (2.9) equals (2.10)"). The hedge is register only: the quantifier that says
  how far the claim was checked stays (see Precision below).
- **A short physics remark is not a gloss (RESOLVED, supersedes the 2026-08-27 "no glosses,
  no interpretive closers" rule in part).** Banned, as before: a clause that paraphrases
  what a display already shows ("where $\phi_ib^2\phi_{i+1}$ is the unique gauge
  contraction of the four fields", "the plethystic exponential assembles the multi-letter
  states and the Haar integral projects onto gauge singlets") or restates a paragraph as its
  meaning ("a flow between two non-Lagrangian theories is thereby realized by…") — user,
  2026-08-27: "제발 이 논문에 필요없는 쓸데없는 말, 해석들 넣지 마". Allowed, as the
  professor writes them: a remark that states a checkable fact the reader would otherwise
  have to work out — "Notice that unlike usual quivers, we only have exactly one, not a
  pair, of bifundamentals for each edge", "The length of the quiver equals the rank of the
  Argyres-Douglas theory", "This agrees with the expectation since $(A_1,A_{2n})$ theory
  does not have any flavor symmetry", "which is the only other gauge-invariant operator
  that has $R=4/3$, $f=-2$". Test: does the sentence carry a fact that is not in the
  display or the claim next to it? If not, it is a gloss. The professor's own closing
  claim per case ("Therefore, we claim our gauge theory flows to … in the infrared,
  exhibiting supersymmetry enhancement") stays.
- **Orientation at the point of use.** A one-line reminder of a definition where it is
  used ("once again $M_i$ are the flip fields for the `mesonic' operators, and $X_k$ …
  `Coulomb branch' operators") and "theory" after every label ("the $(A_1,A_{2n})$ theory")
  are not restatements in the sense of the colon rule below; keep them.
- **Parentheses are the aside device.** "(flip) deformations", "(triplet)", "(generalized)",
  "(unflipped)", "(baryonic)", "(subregular)", "(see Appendix A for the precise definitions
  of symbols)". Colons, semicolons and em-dashes stay rare in the harness's own prose
  (user, 2026-09-02: ':,;,--- 사용하는거 좀 자제해'); a colon introducing a display and a
  caption's column-list colon are fine.
- **Literature jargon yes, coinages no (RESOLVED).** "Casimir operators", "mesonic
  operators", "(generalized) mesons", "nilpotent Higgsing", "dual frame", "verbatim" are
  the professor's words and stay when the professor writes them. The never-invent-
  terminology rule (CLAUDE.md) targets coined labels, metaphors for operations and rare
  synonyms, not standard jargon; a project's banned list in `STATE.md` records the user's
  own reactions to specific drafts and governs the harness's own prose there.
- **Compact index ranges, in-line enumerations, narrated derivations.**
  "$M_{i=0,1,\cdots,\lfloor n/2\rfloor}$", "$\Delta(M_{i\ge1})$" instead of "the $M_i$
  with $1\le i\le\lfloor n/2\rfloor$"; "1) …, 2) …, and 3) …"; "Then, we compute … to
  obtain [display]. Now, using the relations … we get [display]."
- **Citations are sparser and placed once,** where the reader would look the fact up (the
  first case section, a summary table's caption), not on every restatement. Exceptions in
  Precision below.
- **Grammar is the harness's job.** The professor's copies drop articles and slip number
  agreement; fix these silently on the next pass, never copy them as style.

## Parallel case sections

(user, 2026-09-05, on the four theory subsections of ad-chains; supersedes the naive
reading of the 2026-09-03 instruction '똑같은 형식의 문장 반복하지말고 알아서 rephrase'.)

- **The running order is identical in every case section**, so the reader navigates by
  position: definition → derivation/result → spectrum → flavor → (flow) → $n=1$ → index →
  Schur limit → closing claim, or whatever the project fixes.
- **The procedure is written once, in full, in the first case.** Every later case points
  back in one sentence ("Repeating the same procedure as in Section 2.1, we obtain…", "We
  proceed as in Section 2.1") and gives only what differs plus the data — the table, the
  display, the value.
- **Vary the connective sentences lightly; never re-describe the procedure in new words.**
  Consecutive sections must not read as one template with the labels swapped, but
  rephrasing is not a goal: a fresh paraphrase of the same content costs the reader
  attention and hides what actually differs. Never let a variation smuggle in information
  the first case did not state.
- **What genuinely differs is said outright** — a flow paragraph that exists only for two
  of the cases, a flavor symmetry that is $SU(2)\times U(1)$ here and $U(1)$ there — as a
  sentence of its own, not inside a reworded template sentence.

## Precision that must survive editing

The professor's pass dropped every quantifier along with the assertive register
(ad-chains, 2026-09-05: "at every computed order", the $\ft^9$/$\ft^6$ orders, "with the
flavor fugacities set to one" all went, and the intro said "agree to leading order").
These are defects to restore, not style to adopt.

- **How far a claim was checked is stated somewhere in the paper** — the order of the
  expansion, the fugacities kept or set to one, the range of $n$. Once is enough; zero is
  not. A hedge ("we claim", "consistent with") never replaces the quantifier.
- **A conjecture attributed to others keeps its citation**, and so does a value quoted
  from a paper the first time it is quoted.
- **No verification bookkeeping in the main text** — not "cross-checked three independent
  ways", not "validated on five anchors". The quantifier above is the fact of the check,
  not its bookkeeping.
- **No textbook-level review.** Do not spell out standard facts experts know (free chiral
  $R=\tfrac23$, $\Delta=\tfrac32R$, gaugino $R=1$, the KPS replacement procedure).

## Formulas and symbols

- **No single-use symbols.** Do not introduce a symbol whose value is never used; if the
  only thing said about it is a relation, state the relation in prose instead.
- **One normalization per quantity, paper-wide** (user, 2026-08-13). A quantity displayed
  in one normalization is displayed in that normalization everywhere: never $b_0=(\cdots)N
  +O(1)$ in one place and $b_0/N=\cdots+O(1/N)$ in another, and never both inside one
  display (eq:multipair-b0 in susu-quiver). Second case (ad-chains, 2026-09-05): the flavor
  central charge written as $-6\,\tr R\,T^AT^B$ with $\tr_{\rm fund}T^AT^B=\tfrac12$ in one
  section and as $-3\,\tr RFF$ in another — the two agree only in different generator
  normalizations, and a reader using the stated one gets half the value.
- **A colon must add, not rename.** "realized by the singlets and the $\tr\phi_k^2$ that
  carry no $X$: the operators $M_0$, $M_j$ and $\tr\phi_k^2$ with $k>\lceil n/2\rceil$…"
  says the same set twice, once in words and once in symbols. Write the set once, in the
  form that carries the information — the symbols with their index ranges — and let the
  count follow from the ranges instead of being asserted ("Their number is $n$") (user,
  2026-08-27, ad-chains §3 ¶3).
- **No `\boxed` equations.** Emphasis on a display comes from the surrounding prose naming
  it as the result, not from a frame (user, 2026-08-11; removed from eq:positivity and
  eq:RY-closed in susu-quiver).

## Paragraphs and arguments

- **A technical clause states its role in the claim, not just its fact.** A soundness
  condition dropped into a paragraph as a bare fact ("no gauge-invariant operator violates
  the unitarity bound at any of the maxima") leaves the reader unable to say what the
  paragraph's claim needs it for. Write the role: "the quoted central charges are the
  infrared values --- nothing falls below the unitarity bound, so no decoupling revises
  them." Test: delete the clause and ask what objection to the punchline returns; that
  objection is what the clause should be phrased against. (ad-chains §4, 2026-08-26: the
  endpoint-soundness clause survived four rounds of author confusion because its role was
  never stated.)
- **Don't compress an argument into a summary clause.** A closing formula that only a
  reader who already understands the paragraph can parse ("the one-sided chains realize
  the two ends of the moment-map flow with the same fields") hides the argument instead of
  making it. Write the steps out: which theories, which operator, what adding it does. If
  the compressed line is redundant with the paragraph, cut it; if it is not, the paragraph
  was missing a step (user, 2026-08-24, ad-chains §3 ¶5).
- **When another paragraph absorbs a paragraph's content, cut it — do not trim the
  overlap.** A rewrite that moves definitions or a rule into a new paragraph leaves the old
  paragraph with nothing to claim; the reflex is to delete the repeated sentences and keep
  the rest, which leaves a paragraph that survives only because it was already written.
  Ask first whether it still has a punchline no other paragraph makes — and check the
  theory sections, which usually carry the same content per case. Real case (ad-chains §2,
  2026-08-28): the $M$/$X$ paragraph kept "nothing decouples" as its job through a
  whole-draft proofread and a targeted one, while §3–6 ¶2 already said it per theory ("the
  ones whose dimension does not exceed 1"); once the new Method paragraph defined $M$ and
  $X$, the paragraph had no claim left, and the user had to cut it.
- **A fact carried over from `notes/` states only itself.** The notes record a checked fact
  in isolation, often in the source's framing; a draft that lifts the sentence tends to
  supply the surrounding picture from nothing, and that picture is not checked. Before
  writing a fact imported from a note, recompute its neighbours — the other members of the
  set it belongs to — and write what the whole set does. Real case (ad-chains, 2026-08-11,
  caught by the user twice a day apart): notes/06,07,10 record the two-sided parity fact as
  "the flipped middle Casimir sits at exactly $R=2/3$ with its partner $X$ at exactly
  $4/3$". Two successive drafts wrapped it in "in the two-sided families no operator drops
  below the bound", which is false — every other flipped Casimir sits strictly below $2/3$
  and its partner strictly above $4/3$, so a single $(2/3,4/3)$ pair was never the picture.
  The neighbours take one line to compute and would have caught it either time.

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
  deformation", "flip set", "frame", and a label system ("$D$/$A_1$/$A_2$ terminations",
  superpotentials named $W_{D|A_2}$ after them) all passed it for two weeks in ad-chains
  until the user's professor flagged them as invented terms (2026-08-27) and the paper had
  to be restructured to remove them. Test against the literature: would a paper in the
  field use the phrase? If not, name the object by what the literature names (the SCFT it
  flows to, an equation number) or describe the configuration in full ("flavors at one
  end", "the superpotential terms at node $n$"). When picking up a draft mid-project, audit
  it for this before adding to it.
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
is a candidate finding, not an automatic error ("It turns out that" is in the professor's
own §2.1 and stays there).

## Process: the professor's copies

The professor works in their own copy, and every copy is a partial merge. The ad-chains
file of 2026-09-05 had §2.1, the Discussion and the appendix prose from the professor's
2026-09-02 file (the harness's same-night objective fixes — "Coulomm", "denote", the
$k$-citations, the caption AD labels, $\xi^F\to\xi^f$, the (1.1) period — reverted a second
time) with the 2026-09-03 body integrals and (A.9) pasted in. Before touching a professor
copy: back up the last harness PDF, diff the copy against it, list what it reverted and
what it cut, report before editing, and re-apply the objective fixes as a list — never
assume the copy is a superset. The professor edits the prose that carries the argument —
openers, derivation, spectrum, flavor, flow, $n=1$, closers — and leaves displays, tables
and series untouched; read the diff with that expectation.

A professor's copy also brings citation keys typed from memory. A key that resolves on
INSPIRE is not yet the right paper: ad-chains 2026-09-06 cited `Kutasov:1995ve`
(hep-th/9503086, the adjoint-SQCD duality) for the unitarity-bound decoupling procedure,
which is Kutasov–Parnachev–Sahakyan hep-th/0308071 (`Kutasov:2003iy`). Before fetching a
new entry, check that the paper the key names is the one the sentence needs; a wrong key
compiles cleanly and reads plausibly in the bibliography. The same copy dropped a clause
that defined a symbol still used in the next display ($a^w$ in the single-letter index),
so the symbol-hygiene check runs on every professor copy, not only on new prose.
