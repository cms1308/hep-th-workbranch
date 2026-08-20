# 02 — Audit: index consistency checks vs. the paper prescriptions

*Date: 2026-08-12 · wiki pages used: [[superconformal-index]], [[4d-n1-scft-landscape]] · references: [arXiv:2408.02953] (sec. 2.3 "Testing Unitarity via the Superconformal Index"), [arXiv:1708.08307] (origin of the conditions, cited there as Evtikhiev:2017heo; not read directly — the audit target is the 2408.02953 statement, which is what this code implements)*

## Goal

Map every consistency condition in `generate_index_mcode` (lines 719-732 of
`refs/landscape_refactored.py`) to the stated prescription in 2408.02953, listing
every mismatch with a minimal reproducing example. Verify criterion: a
condition-by-condition table paper ↔ code; mismatches demonstrated, none silently
fixed.

## Setup

Paper conditions on the reduced index $\mathcal I_{\rm red}$ (2408.02953, lines
429-443 of `main.tex`; $E$ = $t$-exponent, $\chi_j(y)$ = $SU(2)$ spin-$j$ character
in $y^{2j_2}$):

- **C1**: a term $t^{E}\chi_j(y)$ with $E<2+2j$ → unitarity-violating operator.
  ($j=0$: the decoupled free field $\mathcal O_d$, handled by the flip/redo
  procedure rather than by discarding the theory.)
- **C2**: a term $(-1)^{2j+1}t^{E}\chi_j(y)$ with $2+2j\le E<6+2j$ →
  unitarity-violating operator.
- **C3**: coefficient of $(-1)^{2j+1}t^{6+2j}\chi_j(y)$, $j\ge1$, positive → a
  higher-spin current, so the theory is free or contains a free sector.
- **C4**: vanishing index → supersymmetry broken; exclude the candidate.

Code objects: `index2` is the truncated reduced index with all *fictitious
per-field fugacities set to 1* (line 692, `reduced2 /. fugRule`) while the true
$U(1)$-flavor fugacities `g_i` are kept — so the consistency conditions act on
net coefficients per $(E,\ y\text{-power},\ U(1)\text{-flavor charge})$, and
F-term-paired contributions (e.g. a flip field's $\bar\psi_M$ against
$\partial W/\partial M$) cancel numerically before any check, as the physics
requires (verified end-to-end in step 3, calc/03_extraction_audit.py FLIP cases).
`indexscalar` = `extractScalar[index2, power]` ($y$-singlet part via character
subtraction), `indexspinor` = $\sum_{k\ge1}(\text{coeff of }y^k)\,y^k$
(positive-$y$-power part, cumulative coefficients).

## Audit method

Synthetic reduced indices with known classification were pushed through the *real*
generated Mathematica code (`calc/02_consistency_audit.py` writes
`express{pid}.txt` in production format — identity term + descendant-dressed
operators + explicit Float coefficients — and runs `wolframscript` exactly as
`Index()` does). 7/7 cases behaved as the analysis predicts.

## Condition-by-condition table

| paper | code (line) | test case | verdict |
|---|---|---|---|
| C1, $j=0$, positive coeff ($E\le2$ free/violating scalar) | not in the consistency check; routed to the `decoupled` branch (754, and `decouple`'s 649) → flip & redo in `charges2` (1233) | toy 1 of step 1 | **match** (procedure-level; code uses $E\le2$ incl. bound saturation, paper $E<2$ — deliberate: a free field at $R=2/3$ also decouples) |
| C1, $j\ge\frac12$ | 724: for each $y$-power $k$: min $t$-exponent of `indexspinor` coeff $<2+k$ | C: $+t^{2.5}\chi_{1/2}$ → inconsistent | **match** |
| C2, $j=0$ | 720: any `indexscalar` monomial with $E<6$ and negative value at fugacities→1 | B: $-t^{4.5}q_1^{-1}$ → inconsistent | **match** (range extended to $E<2$ negatives — still genuine violations; resolution is per $U(1)$-flavor charge since only the `g` fugacities survive in `index2`) |
| C2, $j\ge\frac12$ | 727: monomial with $E<6+|k|$ and sign $(-1)^{1+|k|}$ | D: $+t^{5}\chi_{1/2}$ → inconsistent | **match** (lower bound $2+2j\le E$ unnecessary in code: any-sign terms with $E<2+2j$ already fire line 724) |
| **C3** | — absent — | E: $-3t^{8}\chi_1$ → code says `consistent` | **GAP (F1)** |
| **C4** | — absent — | F: $\mathcal I=1$ → Mathematica `Range[-Infinity,1,-1]` crash → unparseable output | **GAP (F2)** |

## Findings

- **F1 (gap)**: the higher-spin-current condition C3 is not implemented. A
  candidate whose index contains $-c\,t^{8}\chi_1(y)$, $c>0$ (free-field signal;
  the reason the paper computes to $t^8$, `main.tex` line 2356) passes as
  `consistent`. Demonstrated by case E.
- **F2 (gap/crash)**: a vanishing reduced index (SUSY breaking per C4) is not
  classified. `decouple()` explicitly returns `consistent` for `reduced === 0`
  (line 591); `Index()` crashes on `Exponent[0,y] = -Infinity` (line 701 →
  `Range[-Infinity,1,-1]`), so `charges2` catches the parse failure and logs the
  theory to the error file as `index error` — it is neither excluded as
  SUSY-broken nor recorded, with a misleading reason. Demonstrated by case F.
- **F3 (defect, latent)**: `extractScalar[poly,p] = poly - Σ_{k=p}^{1}
  c_k(poly)\,\chi_k` (lines 620, 705) subtracts characters using the *original*
  coefficients, not iteratively. Characters overlap in $y$-powers of the same
  parity, so any content with top $y$-power $\ge3$ is over-subtracted. Case G:
  a spin-2 character $+t^6\chi_2$ (whose correct scalar content is zero) leaves
  `indexscalar` $\supset -t^6\chi_1(y)$; `dim3` becomes the symbolic
  $-1-y^2-y^{-2}$, the PythonExpression export fails, and the theory lands in the
  error log. For legitimate spin-$\frac32$ content at $5\le E<t_{\rm order}$ the
  verdict survives but the relevant/marginal extraction is contaminated with
  $y$-dependent junk. Latent in practice: within the $t^{<9}$ truncation,
  $y$-top $\ge3$ content is rare (first generic appearance $t^9\chi_{3/2}$, at
  the truncation edge) — but it is exactly the exotic-candidate region where the
  check matters.
- **F4 (fragility, refactor item)**: the coefficient rounding
  `Replace[..., (b_*c_) :> Round[b,1]*c]` (679, 596) binds `b_` to the first
  factor of `Times`, which is the numeric coefficient only because `match()`
  attaches an explicit Float `1.0*` to every term. Any producer emitting an
  integer-coefficient monomial (e.g. bare `t^6*y^2`) yields unevaluated
  `Round[t^6,1]` and silently corrupts everything downstream. Found while
  constructing the audit inputs.
- Cancellation blind spot (not a defect): all conditions act on net coefficients
  per $(E, y\text{-power}, \text{flavor monomial})$; operators with identical
  quantum numbers can cancel between multiplets. This is the recombination
  ambiguity the paper itself acknowledges.
- Truncation coverage (no defect): checks run on `Exponent < t_order` (9), which
  contains the full C1/C2 ranges for $j\le1$ and the C3 $j=1$ term at $t^8$;
  when `charges2` lowers the order after FORM failures, the weakened check is
  not trusted — such theories go to the `Failures` table (1344-1361).

## Verification

`calc/02_consistency_audit.py`: 7/7 synthetic cases behave exactly as the
analysis predicts (4 implemented-condition matches A-D, 2 gap demonstrations E-F,
1 defect demonstration G). Case A additionally validates the healthy-path
extraction (relevant `[q1]`, `dim3 = 1`, non-manifest `no`).

## Interpretation

The implemented consistency logic is a faithful (indeed per-flavor-refined)
implementation of C1 and C2 — the two conditions that actually decide
inconsistency verdicts in the landscape. C3 and C4 are missing: F1 lets
free-field-containing candidates through as consistent SCFTs, and F2 misroutes
SUSY-broken candidates into the error log. Both are user-facing findings, not
silent fixes: whether to add C3/C4 (and how to classify their hits) is a step-7
decision with the user. F3/F4 are implementation defects to harden in the
refactor. Step 3 audits the operator-extraction side (thresholds + F-term
substitution).
