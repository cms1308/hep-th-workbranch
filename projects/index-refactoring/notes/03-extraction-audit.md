# 03 — Audit: gauge-invariant-operator extraction vs. the deformation procedure

*Date: 2026-08-12 · wiki pages used: [[4d-n1-scft-landscape]], [[flip-deformation]] (via topic page), [[superconformal-index]] · references: [arXiv:2408.02953] (sec. 2.1-2.3), [arXiv:1806.08353] (H0*/H1* worked indices)*

## Goal

Map the operator-extraction rules of `generate_index_mcode`/`generate_decouple_mcode`
and the flip/recursion logic in `charges2` to the deformation procedure of
2408.02953, with each threshold tied to an R-charge bound. Verify criterion: a
condition-by-condition table; every threshold justified; mechanism checks pass on
synthetic indices.

## Setup

Paper procedure (main.tex lines 262, 325-336, 349, 366-390): at each fixed point,
(i) operators that decouple ($R<\frac23$, plus free operators at the bound) are
flipped with $X$ fields and the charges recomputed; (ii) relevant deformations
$\delta W=\mathcal O$ require $R(\mathcal O)<2$ strictly (marginal is never
relevant); (iii) flip deformations $\delta W=M\mathcal O$ require
$R(\mathcal O)<\frac43$ strictly; (iv) the $t^6$ coefficient
$\alpha=\#\text{marginal}-\#\text{currents}$ (eq. (t6)); a surplus of currents over
the manifest rank signals hidden symmetry. Chiral-ring relations from F-terms
determine which operators actually appear in the counting (worked H0*/H1* examples
in 1806.08353: F-term-eaten operators are absent from the index generators).

Mechanism fact established here (correcting the initial reading in note 02):
`index2` — the object all consistency checks and `dim3` act on — has the
fictitious per-field fugacities set to 1 (`fugRule`, line 692) while true $U(1)$
fugacities `g_i` survive. F-term-paired contributions ($\bar\psi_M$ against
$\partial W/\partial M$, equal $E$, equal true flavor charge) therefore cancel
numerically before any check. The *refined* index (`fullscalar`, per-field
fugacities kept) is used only for operator identification, where the
`wcond2`/`wcond3` substitution $f^{-1}\to W_{\rm match}/f$ implements the same
pairing at the level of monomials.

## Condition-by-condition table

| paper | code (line) | test | verdict |
|---|---|---|---|
| decouple $R\le\frac23$ → flip $X\mathcal O_d$, redo charges | `decouple` 649 / `Index` 754 ($E\le2$); `charges2` recursion adds `X*op` to $W$ (1233-1236), one operator per pass | DEC1, DEC2; step-1 toy 1 | **match** ($\le$ includes bound-saturating free operators — the paper flips those too, "modulo flipping free operators") |
| relevant $R<2$ strict | `exponents` filter $0<E<6$ (713-715) | THRESH: $E=4.2$ kept, $t^6$ excluded | **match** |
| flip candidates $R<\frac43$ strict | $E<4$ gates `fliped` (768, 773) | THRESH: $E=3.9$ in, $E=4.2$ out | **match** |
| queue $\delta W=\mathcal O$ / $\delta W=M\mathcal O$ | `charges2` 1436-1445 (`w+[op]`, `w+["M{k}*op"]`) | by reading | **match**; relevant deformations are skipped when the theory has no flavor symmetry (1432) — consistent with the paper's requirement that $\mathcal O$ be $U(1)$-charged for the R-symmetry to re-mix (flavor-neutral deformations would land in the "too many superpotentials" dead end) |
| F-term relations remove eaten operators from the counting | `wcond2` (742-752): for each field fugacity $f$ with negative powers among the extraction-range terms, substitute $f^{j}\to(W_{\rm match}/f)^{-j}$, $j<0$; then keep positive-coefficient terms | FLIP1: $W=M_1q_1$ → relevant `[M1]`, $q_1$ eaten; FLIP2: $W=M_1q_1+M_1q_2$ → exactly one combination removed, relevant `[M1,q2]` | **match** (`SelectFirst` uses the first $W$ term containing $f$; removing a single combination per F-term is the correct ring count) |
| marginal counting, $\alpha=\#\text{marg}-\#\text{currents}$ | `exponents2` ($E=6$, 716), `coef`/`marginal` split by `g`-charge (796-805), `dim3` (806) | step-2 case A; THRESH ($2t^6-t^6$ → dim3 = 1) | **match** |
| hidden-symmetry flag | `gsym + Total[coef] < 0` → `non-manifest symmetry: yes` (809-810): more currents than the manifest $U(1)^{\rm gsym}$ | by reading; healthy path in A/THRESH ("no") | **match** (necessary-condition flag, matches paper's enhancement diagnosis) |

`calc/03_extraction_audit.py`: 5/5 cases behave as analyzed.

## Findings

No new defects. Hardening items for step 7 (not bugs in the cases probed):

- `generate_index_mcode` builds `exponents` from `toList[indexscalar]` without an
  explicit `Sort` (713), relying on Mathematica's canonical `Plus` ordering to put
  the smallest $t$-exponent first for the `exponents[[1,2]] <= 2` decoupled gate;
  `generate_decouple_mcode` does sort (629). Probed with a $g$-charged decoupled
  operator (DEC2) — ordering held — but it is not a documented guarantee.
  Low impact: `decouple()` (sorted) is the authoritative decoupling detector in
  `charges2`; the `Index()` branch is a re-derivation.
- `wcond2` substitutes via the *first* superpotential term containing $f$; correct
  for the counting, but silent — a refactor should assert that the substituted
  partner monomial actually occurs.
- `_match_impl`'s `t_order` parameter is unused (minor cleanup).

## Interpretation

The extraction side implements the paper's deformation procedure faithfully:
thresholds are exactly the R-charge bounds, the F-term substitution reproduces the
chiral-ring counting of the worked examples in 1806.08353, and the flip/recursion
plumbing in `charges2` matches Steps 2-3 of the procedure. Combined with note 02,
the physics-correctness audit of scope (c) is complete: the only substantive gaps
are F1 (higher-spin free-field condition C3) and F2 (vanishing index C4), both on
the consistency side. Step 4 turns to the numeric/parsing internals of scope (b).
