# 08 — Refactor + optimize the index pipeline; implement F1/F2, C1'; harden F3/F4

*Date: 2026-08-18 · wiki pages used: — (implementation; conditions from notes/07) · references: notes/02, 04, 05, 06, 07; refactor/ (deliverable); calc/08_refactor.py + calc/work08/*

## Goal

Refactor scope (b)+(c) guided by the R6 leverage order; implement F1 with the
step-7 PROVEN C3 form including the new C1' boundary check, fix F2 (C4), and
harden F3/F4. Verify criterion: the step-5 regression harness passes on all
baseline inputs (82/82 byte-identical), speedup measured per stage.

User decisions wired in (2026-08-18): F1/F2 hits → `InconsistentIndex` (never
`Theories`); C1' free-spinning hits that pass every other check → new
`FreeSector` table; t_order stays 9 — the $t^9$ coefficient was PROVEN exact
at the current truncation (below), so C3 at $j=\tfrac32$ is checked without
raising the order.

## The deliverable: `refactor/` + three charges2 patches

`refactor/` (fastmatch.py, conditions.py, mcode_v2.py, glue.py, README.md)
plugs into the landscape module by an appended overlay
(`from refactor.glue import install; install(globals())`) that rebinds
`decouple()` and `Index()`; `charges2` gets three surgical textual edits
(exact patch strings in `calc/08_refactor.py` `PATCHES_V2`, asserted unique
at apply time). Everything else — charge determination, `makefrm`/`form`,
orchestration — is untouched. The harness copy is
`calc/work08/landscape_A2_v2.py`; the printed diff is exactly the three
patches plus the overlay.

### 1. fastmatch: structured FORM-output parsing (leverage 1)

The old `Mathcode`/`match` path `eval`ed every FORM term into sympy, decoded
the fugacity encoding by three chained `subs`, extracted character exponents
from the expression tree (`.args[-1].args`, the load-bearing `1.0*`), and
re-scanned the character-table file per term (`picklines`), all under a
nested `Pool(CORE)` spawned per theory. `fastmatch.py` replaces this with a
direct parser of the cleaned FORM output — no sympy, no `eval`, exact
`Fraction` coefficients, exact `Decimal` decode of
$t^{d_0}s^{d_1}r^{d_2}\to d_0/500+d_1/2.5\times10^6+d_2/1.25\times10^{10}$
quantized to 0.001 (ROUND_HALF_UP), character tables loaded once into
memory, a per-signature projection memo, and a thread pool only for LiE
tensor chains (subprocess waits release the GIL). Preserved exactly:
species chain order (LieCache keys — the warm cache stays valid), the
singlet-first read of decomposition strings, the lie invocation strings /
`[53:]` banner slice / `maxobjects` retry, and MatchTimeoutError routing (MATCH_TIMEOUT bounds
each projection chain — the unit the old per-term SIGALRM bounded; a first
implementation capped the WHOLE call instead, which misrouted the
cold-cache line 100 to Failures under heavy ambient load — caught by the
interleaved benchmark, fixed, and re-verified).

The express file for Mathematica is emitted directly with exact rational
coefficients and 3-decimal real $t$-exponents; Mathematica's `Total` +
`Round` normalization then produces values identical to the old float path
(verified by A/B below).

### 2. Mathematica post-processing kept, F3/F4 fixed (mcode_v2)

The final result strings ('index', 'fullindex', operator lists, dim3, the
C1/C2 verdict) still come from the same generated Mathematica code, so
byte-identity is inherited rather than re-implemented. Two fixes:

- **F3**: `extractScalar` now peels $SU(2)_y$ characters iteratively
  (top-down, coefficient recomputed after each subtraction). Identical for
  content with top $y$-power ≤ 2 (parity separation) — which covers the
  whole baseline — and correct for $y$-top ≥ 3, where the old
  one-shot subtraction over-subtracted (notes/02 case G).
- **F4**: the coefficient-rounding rule is now `(b_?NumericQ * c_) :>
  Round[b,1]*c`. On well-formed terms it binds exactly as before; a
  monomial with no explicit numeric coefficient is left unchanged instead
  of turning into unevaluated `Round[t^6.,1]` junk.

Demonstrations (2026-08-18, ad-hoc runs recorded here): feeding
$+t^6\chi_2(y)$ content (top $y$-power 4) plus a $t^4$ relevant scalar
through the OLD mcode yields the corrupted symbolic
`dim3 = -1-y^2-y^{-2}` and a failed PythonExpression export (F3), and with
coefficient-1 exact monomials the OLD rounding rule injects literal
`Round[t^6.,1]` factors into the index string and flips the verdict (F4);
the NEW mcode returns a clean consistent result with `dim3 = 0` on the same
inputs.

### 3. Python-side condition scan: C1', C3, C4 (conditions.py)

`Index()` now also scans the net reduced index (all fugacities → 1 except
$t,y$), assembled exactly from the parsed terms with Fraction arithmetic on
the 0.001 exponent grid, decomposed into $\chi_j$ multiplicities by the
correct iterative peel $n_j = c_{2j}-c_{2j+2}$:

- **C1'** ($E=2+2j$, $j\ge\tfrac12$, net chiral-sign content): free
  spinning sector. Verdict `free sector` → `FreeSector` table, only after
  the Mathematica C1/C2 verdict came back consistent. ($j=0$ remains the
  existing decouple/flip branch.)
- **C3** ($E=6+2j$, net wrong-sign coefficient $c>0$): $j\ge1$ → verdict
  `inconsistent (free sector: higher-spin current)` → `InconsistentIndex`
  (= F1, in the proven form); $j=\tfrac12$ → NOT an inconsistency: theory
  saved to `Theories` with the previously always-empty `SUSYenhanced`
  column set to `candidate (t^7 chi_1/2 supercurrent signal in index)`.
  When C1' and C3 both fire, C3 wins → `InconsistentIndex` (user decision
  2026-08-19; the first implementation had C1' winning, reversed on user
  review). Both signals are recorded in `index_flags` either way.
- **C4**: the reduced index ≡ 0 within truncation (the input on which the
  old `Index()` crashed in Mathematica — finding F2) is classified as
  `inconsistent (vanishing index: possible SUSY breaking)` →
  `InconsistentIndex`, skipping wolframscript. Within this series pipeline
  the index always has constant term exactly 1 (the PE's leading 1 is a
  gauge singlet), so a literally-zero index cannot occur; the operational
  C4 signal is $\mathcal I = 1$ identically, i.e. no operator contribution
  below the truncation — which the papers' "vanishing index ⇒ SUSY broken"
  bullet (2408.02953 §2.3) is read as, and which is in any case the input
  class that crashed the old code.

Every `Index()` call appends its scan record to `v2_scanlog.jsonl`
(`fired: false` on clean theories), so a landscape run leaves an audit
trail of the new conditions.

### 4. $t^9$ exactness — why C3 at $j=\tfrac32$ needs no order raise

The fugacity encoding is linear and positive: under multiplication the
digit exponents $(d_0,d_1,d_2)$ add componentwise (the decode is
positional, no carries), and every letter has $d_0\le 500\,p$ with $p>0$.
Hence a product of letters with true total exponent $p\le9$ has
$\sum d_0\le 4500$, and since partial products never exceed the final
exponent, it survives the FORM truncation `t(: 4500)` at every Horner
step. The expansion orders (`get_order` per species, Horner `max_order`,
`vec_order`, and the descendant sum $J$) are chosen to reach
$t^{t_{\rm order}}$ for the smallest letter, so every such product is
generated. Therefore the $t^9$ coefficient of $\mathcal I$ — and of
$\mathcal I_{\rm red}$, which needs $\mathcal I$ only up to $t^9$ — is
EXACT at t_order 9, and the $j=\tfrac32$ C3 slot ($t^9\chi_{3/2}$, the
free-vector signal of R7) is inside the trusted window. The scan trusts
buckets up to $1000\,t_{\rm order}$ milli-units generally, so lowered-order
retries shrink the window consistently.

Machine check: `08_refactor.py t9-check` runs FORM at t_order 9 and 10 on
the same theory and compares every refined bucket
$(E\le9,\,y\text{-power},\,\text{fugacity monomial})$ after projection —
identical on line 0 (151 buckets) and the flip-carrying line 77
(329 buckets).

## Verification

- **scan-test 7/7**: exact synthetic indices through the scanner — the free
  vector realizes C1' at $-t^3\chi_{1/2}$ AND C3 at $+t^9\chi_{3/2}$
  (coefficients from R7); the free chiral ($t^2-t^9\chi_{1/2}$) raises NO
  flag (stress tensor is not a C3 slot — converse-of-C3 guard); the free
  hyper signal $+t^7\chi_{1/2}$ → enhancement; audit case E
  ($-3t^8\chi_1$) → higher-spin flag with multiplicity 3; $E=4$ chiral-sign
  $\chi_1$ → C1'; $\mathcal I=1$ → C4; a fractional multiplicity →
  contamination warning, no verdict.
- **ab-match PASS** (lines 0, 23, 77, 100 × orders 3 and 9): every term of
  the old sympy `match` equals the fastmatch record — coefficient (≤1e-9
  rel., in practice one ulp), decoded exponent (bit-equal), fugacity
  monomial, singlet multiplicity. Line 100 order 9: 177,124 terms, 0
  mismatches — old in-process decode 410.9 s vs fastmatch 15.2 s
  (same machine, same load).
- **ab-mcode PASS** (lines 0, 23, 77 × both generators): parsed result
  dicts of {old express + old mcode}, {new express + new mcode}, and
  {old express + new mcode} are ALL identical — isolating both the exact-
  rational express change and the F3/F4 patches as output-preserving on
  real data.
- **t9-check PASS** (lines 0, 77) as above.
- **F3/F4 demonstrations** as in §2.
- **Full regression replay PASS** (calc/08_refactor.py replay/compare,
  work08/replay_outcomes.jsonl): all 101 baseline lines through the
  refactored pipeline — **101/101 outcome records byte-identical to the
  step-5 replay** (success, log, and error line lists compared verbatim),
  which subsumes the step-5 criteria: 82/82 true entries exact
  (0 numeric-noise, 0 mismatches), 17/19 curated-out entries rejected as
  `inconsistent`, the F5 pair kept exactly as before. The C1'/C3/C4 scan
  ran on all 101 index computations and **fired zero flags** — in
  particular the newly-covered $t^9\chi_{3/2}$ C3 slot is clean on the
  whole baseline, closing the truncation-edge caveat of R7's cross-check
  (b) as well.
- **Speedup** (calc/08_refactor.py bench-all, work08/bench_results.jsonl).
  The machine carried heavy ambient load during step 8 (load average ~30
  from an unrelated application), so old and new pipelines were run
  INTERLEAVED per benchmark — each ratio is same-conditions; absolute
  times are inflated relative to the idle-machine step-6 table (R6).

  | line | mode | old wall | new wall | ratio |
  |---|---|---|---|---|
  | 0 (seed) | warm | 68.8 s | 59.8 s | 1.15x |
  | 23 (2-term) | warm | 77.7 s | 65.4 s | 1.19x |
  | 77 (3-term) | warm | 70.6 s | 61.3 s | 1.15x |
  | 100 (7-term, 4 X-flips) | warm | 561.2 s | 162.2 s | **3.5x** |
  | 0 | cold | 78.7 s | 60.6 s | 1.30x |
  | 100 | cold | 936.5 s | 689.2 s | 1.36x |

  Phase isolation: the replaced stage itself (term decode + projection,
  the R6 top target measured at 140 s warm on line 100) is now 12.9 s
  under the same load — and the in-process A/B (identical form file,
  identical machine state) gives 410.9 s → 15.2 s on line 100's 177,124
  terms, 27x. On typical lines the pipeline is now FORM-dominated
  (form ≈ 30 s of a 60 s line under load; 15-17 s of ~24 s idle per R6),
  i.e. the profile R6 predicted after removing leverage item 1.

  The cold line-100 benchmark initially FAILED (misrouted to Failures):
  the first fastmatch implementation budgeted MATCH_TIMEOUT per call
  rather than per chain (see §1), and 15k cold LiE chains exceeded 300 s
  under load. After restoring the old per-unit semantics the cold run
  completes and reproduces the old-run line-100 entry exactly
  (verdict consistent, dim3 = -4, index strings equal), populating the
  same 15,020 LieCache entries.

## Leverage items not taken (deliberate, with rationale)

- **L2 (FORM order bookkeeping)**: the $t^9$ analysis above shows
  `t(: 500 t_order)` with the current `get_order`/Horner orders is already
  the minimal complete truncation — nothing to tighten without losing
  exactness. FORM itself stays (R6: correct and hard to beat for the PE).
- **L4 (persistent Wolfram kernel / Python post-processing)**: NOT
  implemented. The remaining wolframscript cost is a fixed ~3 calls/theory
  (~4 s idle); replacing Mathematica's InputForm output path in Python
  would put the byte-identity of every stored index string at risk for a
  ~15% typical-line gain. Recorded as the top remaining optimization if
  the fixed cost ever matters at scale.
- **L5 (pool reuse)**: the per-theory nested `Pool(CORE)` spawns are gone
  (fastmatch threads only over cold LiE chains); the outer
  `MyPool(maxtasksperchild=1)` lives in out-of-scope (d) orchestration and
  is untouched.

## Result

$$\boxed{\begin{array}{l}\text{Refactored pipeline: 101/101 baseline outcome records byte-identical;}\\[2pt] \text{decode+projection } 140\,\mathrm{s}\to\lesssim 13\,\mathrm{s on the heaviest line (same-load } 3.5\times\text{ end-to-end);}\\[2pt] \text{C1}'/\text{C3}/\text{C4 implemented in the proven form, exact through } t^9 \text{ at } t_{\rm order}=9.\end{array}}$$

## Interpretation

The index pipeline now computes the same numbers with the sympy/eval layer
replaced by an exact parser, the two audit-confirmed latent defects (F3,
F4) fixed, and the two physics gaps (F1 = C3, F2 = C4) plus the step-7 C1'
boundary closed in exactly the proven form — with routing per the user's
decisions (InconsistentIndex for F1/F2, FreeSector for C1', SUSYenhanced
for the $j=\tfrac12$ signal). The $t^9$ exactness proof means the C3
$j=\tfrac32$ check costs nothing: no order raise, no new FORM work. On the
whole baseline no new condition fires, which both preserves regression and
strengthens R7's conclusion that the 82 true entries sit strictly inside
the allowed region — now including the $t^9$ slot. Implementation decisions after user review 2026-08-19: (i) when C1' and
C3 both fire, C3 wins → InconsistentIndex; C1' alone → FreeSector
(user-decided; the step's first implementation had C1' winning and was
reversed accordingly); (ii) C4's operational trigger is
$\mathcal I \equiv 1$ within truncation — the user confirmed a
literally-zero index is impossible here (PE constant term 1); the
$\mathcal I=1$ case is routed as
`inconsistent (vanishing index: possible SUSY breaking)` →
InconsistentIndex with the full record in the log file; (iii) the
FreeSector table schema mirrors InconsistentIndex plus an IndexFlags
column holding the human-readable scan findings (which condition fired,
at which $t$-power and spin, with what net multiplicity) — explained to
the user.

