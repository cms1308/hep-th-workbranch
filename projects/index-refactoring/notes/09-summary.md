# 09 — Final report: correctness verdict, defect list, derived conditions, performance

*Date: 2026-08-19 · wiki pages used: — (synthesis of notes/01-08) · references: [arXiv:2408.02953], [arXiv:1806.08353], [arXiv:1610.05311], [arXiv:1708.08307], [arXiv:hep-th/0209056]; deliverable `refactor/` + `calc/08_refactor.py`*

## Goal

Close the project: state the physics-correctness verdict for the index
pipeline of `landscape_refactored.py` (scope (b)+(c)), the complete defect
list with resolutions, the independently derived consistency conditions
including the paper typo found, and the before/after performance of the
refactored pipeline. Verify criterion: user sign-off.

## 1. Verdict on physics correctness

**The index pipeline computes what the landscape papers prescribe.** Every
consistency condition and operator-extraction rule in the Mathematica
post-processing maps to a stated prescription of 2408.02953 /
1806.08353 / 1610.05311, verified three independent ways:

- **Code ↔ paper audit** (steps 2-3): C1/C2 unitarity checks are a
  faithful — indeed per-U(1)-flavor *refined* — implementation
  (notes/02); decoupled/fliped/relevant/marginal thresholds are exactly
  the R-charge bounds $R\le\frac23$ / $R<\frac43$ / $R<2$ / $R=2$, and the
  `wcond2` F-term substitution reproduces the chiral-ring counting of the
  worked examples in 1806.08353 (notes/03). Key mechanism: checks and
  `dim3` act on the reduced index with fictitious per-field fugacities set
  to 1, so F-term-paired contributions cancel numerically before any
  check; the refined index is used only to *identify* operators.
- **Conditions ↔ representation theory** (step 7): C1-C4 were re-derived
  from scratch out of su(2,2|1) Gram matrices (trusting neither paper),
  and the derived conditions coincide with both papers' main-text
  statements. The audit is therefore anchored to a proof, not to a quote.
- **Regression** (step 5): on the SU3s1S1nf2 baseline the pipeline
  reproduces the old run byte-identically (82/82 entries, every field
  including 30-digit central charges and full index strings), and rejects
  17/19 curated-out entries by the implemented C1/C2 check.

The qualifications to this verdict are exactly the findings F1-F5 and C1'
below — two missing conditions, two latent implementation defects, and one
curation discrepancy — all now resolved.

## 2. The consistency conditions, as proven (R7)

Conventions: $\mathcal I=\mathrm{Tr}(-1)^Ft^{3(R+2j_1)}y^{2j_2}$,
$j_1=\bar\jmath$ dotted, $j_2=j$ the $\chi_j(y)$ spin;
$\mathcal I_{\rm red}=(1-t^3y)(1-t^3/y)(\mathcal I-1)$; $E$ = $t$-exponent.
Contribution table (independent of the left type $X$ except the flagged
row):

| multiplet | contribution to $\mathcal I_{\rm red}$ | unitarity range |
|---|---|---|
| $X\bar B_1[j,0,R]$ | $(-1)^{2j}t^{3R}\chi_j$ | $E=3R\ge2+2j$; equality = free field, which adds the EOM residual $(-1)^{2j+1}t^{3R+3}\chi_{j-1/2}$ (user finding, 2026-08-18) |
| $X\bar A_2[j,0,R]$ | $(-1)^{2j+1}t^{6+3R}\chi_j$ | $E\ge6+2j$; equality = conserved-current multiplet |
| $X\bar A_1[j,\bar\jmath,R]$ | $(-1)^{2j+2\bar\jmath+1}t^{6+3R+6\bar\jmath}\chi_j$ | $E\ge6+2j+4\bar\jmath$ |
| $X\bar L$ | $0$ | — |

Derived conditions (52/52 machine checks, calc/07_*):

- **C1**: any term at $E<2+2j$ ⇒ non-unitary.
- **C1′** (sharper than papers and code): content at $E=2+2j$ exactly is
  exclusively free-field; $j\ge\frac12$ chiral-sign content ⇒ free
  *spinning* sector — checked by neither the papers' stated conditions nor
  the original code.
- **C2**: wrong-sign term in $2+2j\le E<6+2j$ (after free-field removal)
  ⇒ non-unitary. Per-flavor refinement is strictly stronger than the net
  check (real case: baseline line 90).
- **C3**: net coefficient $c>0$ of $(-1)^{2j+1}t^{6+2j}\chi_j$ ⇒ $c$
  conserved-current multiplets $A_1\bar A_2[j,0,\frac{2j}3]$ net of chiral
  partners: $j=0$ flavor currents; $j=\frac12$ extra supercurrents
  ($\mathcal N\ge2$ or free); $j\ge1$ higher-spin current ⇒ free sector
  (Maldacena-Zhiboedov input). Converse false (negative partners can
  hide it). No analogous condition exists at $\bar\jmath\ge\frac12$
  (slot degeneracy — window-edge uniqueness only at $\bar\jmath=0$).
- **C4**: every contribution has $E\ge2$, so a unitary SCFT has
  $\mathcal I=1+O(t^2)\ne0$. In this series pipeline a literally-zero
  index cannot occur (the PE constant term is the gauge-singlet 1); the
  operational degenerate case is $\mathcal I\equiv1$ within truncation —
  the index as the shadow of the protected spectrum coming back *empty*.
  A unitary SCFT cannot erase that shadow: it has a stress tensor
  ($-t^9\chi_{1/2}$, inside the now-exact window) and, for these
  gauge-theory candidates, a generically nonempty chiral ring whose
  $R<2$ multiplets are absolutely protected against recombination. The
  Witten-index logic then reads a collapsed index as the supercharge
  pairing up everything — SUSY not preserved in the IR — which is the
  papers' C4 bullet. Concretely the collapse mechanism is letter-level:
  an $R=1$ vector-like pair (a mass term) cancels boson against conjugate
  fermion exactly. Classified as *possible* SUSY breaking because within
  a $t^9$ truncation total cancellation above the window is not excluded.

**Literature discrepancy found (the one typo):** the general formula for
$\hat{\mathcal H}_{(j,\bar\jmath)}$ in the appendix reference list of
1708.08307 prints the exponent $2+(\bar\jmath+2j)/3$; the correct value is
$2+(2\bar\jmath+4j)/3$ (our $E=6+2j+4\bar\jmath$ with his $(j,\bar\jmath)$
mirrored), contradicting his own special cases. The main-text condition
statements of BOTH papers are typo-free — confirmed by proof rather than
assumption.

## 3. Defect list and resolutions

| finding | what it was | resolution |
|---|---|---|
| **F1** (gap) | C3 not implemented: a candidate with a higher-spin free-field signal passed as `consistent` | implemented in the proven form on the net reduced index; $j\ge1$ hit → verdict `inconsistent (free sector: higher-spin current)` → `InconsistentIndex`; $j=\frac12$ hit → not an inconsistency: saved to `Theories` with the `SUSYenhanced` column filled |
| **C1′** (gap, new in step 7) | free *spinning* boundary content unchecked (only the $j=0$ decouple branch existed); no such theory has yet appeared — this is a trap for when one does | implemented; a hit that passes everything else → verdict `free sector` → new `FreeSector` table (never `Theories`), with an `IndexFlags` column recording which signal fired, at which $t$-power/spin, with what net multiplicity. When C1′ and C3 fire together, C3 wins (user decision 2026-08-19) |
| **F2** (gap/crash) | vanishing index (C4) unclassified: `Index()` crashed in Mathematica (`Exponent[0,y]`), theory misrouted to the error log as `index error` | detected in Python before wolframscript; verdict `inconsistent (vanishing index: possible SUSY breaking)` → `InconsistentIndex`, full record in the log |
| **F3** (latent defect) | `extractScalar` subtracted $SU(2)_y$ characters with original coefficients; same-parity overlap corrupts any content with top $y$-power ≥ 3 (symbolic `dim3`, failed exports) | iterative top-down peel in both mcode generators; identical output for $y$-top ≤ 2 (whole baseline), demonstrated corrupt-vs-clean on $t^6\chi_2$ input |
| **F4** (fragility) | coefficient rounding `(b_*c_):>Round[b,1]c` bound `b` to the first `Times` factor — safe only under the old `1.0*` float convention; integer-coefficient monomials became `Round[t^6,1]` junk | pattern constrained to `b_?NumericQ`; identical on well-formed terms, inert (correctly) on coefficient-1 monomials |
| **F5** (curation, resolved 2026-08-13) | 2 of the 19 curated-out baseline entries pass every implemented check and reproduce their old-run lines byte-identically | user: hand-deleted because their parents were later found inconsistent — confirmed in the data (both parents among the 17 rejected). CAVEAT for any re-enumeration: both are also queued by a *true-set* entry, so a fresh enumeration regenerates them; an acceptance or exclusion rule is needed (line 77 has $R(M_1)=1$ exactly with an $M_1^2$ mass term — a redundant description of the theory with $M_1$ integrated out) |

Cleared suspicions (step 4): fugacity-encoding round-off (worst
$3\times10^{-12}$), `rep_structure` assembly, `maxobjects` retry parse,
cache degradation path. Baseline provenance (step 7): the 19 curated-out
lines carry stored verdict `consistent` with C2-violating stored indices —
the 101-line file predates (or bypassed) the current C1/C2 enforcement;
the fresh replay's 17 rejections are the corrected verdicts.

## 4. The refactored pipeline (deliverable)

`refactor/` (fastmatch / conditions / mcode_v2 / glue + README with
integration instructions) + three surgical `charges2` patches (exact
strings in `calc/08_refactor.py` `PATCHES_V2`). What changed and what
deliberately did not:

- FORM stage untouched. **Proven**: the $t^9$ coefficient is already
  exact at `t_order = 9` (the encoding is linear and positive, so every
  product with $p\le9$ survives `t(: 4500)` at every Horner step) — C3 at
  $j=\frac32$ costs no order raise; machine-checked by order-9-vs-10
  bucket equality.
- The sympy/eval term decode replaced by an exact structured parser (no
  eval anywhere in the new path); character tables cached in memory; LiE
  chain order and LieCache keys preserved (warm caches stay valid);
  threads only over cold LiE chains; MATCH_TIMEOUT bounds each chain (the
  old per-term unit).
- Mathematica post-processing KEPT (it is the source of every stored
  string, so byte-identity is inherited), with only the F3/F4 fixes.
- New-condition scan logged per theory to `v2_scanlog.jsonl`.

**Regression (the step-8 verify):** all 101 baseline lines replayed
through the refactored pipeline give **101/101 outcome records
byte-identical to the step-5 replay** (success/log/error line lists
verbatim), and the new-condition scan fired **zero flags** — the 82 true
entries sit strictly inside the derived allowed region including the
newly-covered $t^9$ slot, closing the truncation-edge caveat of R7.

## 5. Performance

Idle-machine profile (step 6, R6): typical line ~24 s = FORM order-9
~65% + wolframscript 3 × ~1.2 s + pool overhead; flip-heavy line 100 =
202 s warm, of which 140 s was the sympy decode at 100% cache hit — the
top target. Step-8 measurements ran under heavy ambient load (~30), so
old/new were interleaved per benchmark; ratios are same-conditions:

| line | mode | old | new | ratio |
|---|---|---|---|---|
| 0 (seed) | warm | 68.8 s | 59.8 s | 1.15x |
| 23 (2-term) | warm | 77.7 s | 65.4 s | 1.19x |
| 77 (3-term) | warm | 70.6 s | 61.3 s | 1.15x |
| 100 (7-term, 4 X-flips) | warm | 561.2 s | 162.2 s | **3.5x** |
| 0 | cold | 78.7 s | 60.6 s | 1.30x |
| 100 | cold | 936.5 s | 689.2 s | 1.36x |

The replaced stage itself: 140 s (R6, idle) / 410.9 s (in-process, loaded)
→ 12.9-15.2 s on line 100's 177,124 terms. Typical lines are now
FORM-dominated, as R6 predicted. Remaining opportunities, recorded not
taken: persistent Wolfram kernel or Python post-processing (~4 s/theory
fixed cost; byte-identity risk — top candidate if scale demands it); FORM
itself (correct and near-optimal for this design).

## 6. Recommendations / open items for the user

1. **Re-enumeration rule** for the F5 pair before any fresh landscape run
   (accept, or exclude by an explicit criterion such as "flip field with
   $R=1$ and a mass term").
2. **Out-of-scope (d) items observed, report-only**: hardcoded Telegram
   bot token in the source (rotate it); O(N²) duplicate check re-reading
   the results file per success; per-call MySQL reconnects; `relevant`
   lists contain bare flip-field tadpoles ($M_1$) that the queue would
   submit as deformations; relevant deformations are skipped for theories
   with no flavor symmetry (consistent with the R-remixing requirement,
   but worth a deliberate sign-off).
3. **LLMwiki**: the Maldacena-Zhiboedov input used by C3's interpretation
   (1112.1016; 4d versions Alba-Diab 1307.8092) is not in the wiki —
   run `/wiki-ingest` in the LLMwiki project if it should be citable at
   equation level in any paper phase.
4. Production integration of `refactor/` per README (overlay + three
   charges2 patches); the FreeSector table is created on first use.
5. **Follow-up work item (user request 2026-08-19): generation-on-miss
   character store.** Unify the arxiv/ tables and the LieCache into one
   store that computes a missing entry on the spot (via lie — or the
   pure-Python singlet arithmetic — ) and persists it, instead of
   crashing on a missing table key. Motivation is portability/operations,
   not speed: running on another machine currently requires copying the
   arxiv/ directory (~193 MB for A2) and pointing at a MySQL instance
   (host is hardcoded 'localhost'); with generation-on-miss only the code
   needs to travel and the store bootstraps itself. Verification set
   exists: the 16,133 LieCache entries and the step-5 table spot-checks.

## Verification

This note is a synthesis; every claim carries its machine check in the
per-step notes: 01 (11/11), 02 (7/7), 03 (5/5), 04 (4/4), 05 (82/82 +
15/15 tables + 1466 singlet terms), 06 (6 profiled runs), 07 (52/52),
08 (scan-test 7/7, ab-match 4 lines all-equal incl. 177k terms, ab-mcode
3x3 identical, t9-check 2 lines, replay 101/101 byte-identical, bench 6
interleaved pairs). Verify criterion for this step: user sign-off.

## Interpretation

The project's two deliverables are met: (1) a verified account — the
pipeline implements the papers' prescriptions correctly, now anchored to
an independent derivation of the conditions, with every discrepancy
(F1-F5, C1′, one literature typo) reported and none silently fixed;
(2) a refactored pipeline that is byte-identical on the regression
baseline, measurably faster where it mattered (3.5x on the worst line;
the 140 s hot spot eliminated), and stronger than the original: the
proven C3/C1′/C4 conditions now run on every theory, through $t^9$, with
their hits routed to the tables the user chose.
