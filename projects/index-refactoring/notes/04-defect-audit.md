# 04 — Implementation-defect audit of the FORM/LiE stage (scope (b))

*Date: 2026-08-12 · wiki pages used: — (pure implementation audit) · references: notes/01-pipeline-map.md*

## Goal

Settle every suspected implementation defect in the index-computation stage with a
minimal reproducing input or an explicit clearing. Verify criterion: each suspicion
either reproduced or cleared; findings reported, none silently fixed.

## Verdicts (`calc/04_defect_audit.py`, 4/4 groups as analyzed)

**Cleared (suspicions from the first read that turned out fine):**

- **Encoding round-off asymmetry** (`single()`, lines 149-171): $d_0,d_1$ use
  `int()` truncation while $d_2$ uses ROUND_HALF_UP. This is a base-5000
  positional expansion of $500p$ — truncating a leading digit passes the
  remainder to the next digit, so only the last digit's rounding matters.
  Round-trip error over 8 cases including digit-boundary and carry edges:
  worst $3\times10^{-12}$, far below the $5\times10^{-4}$ threshold where
  `match()`'s 0.001 quantization could misround.
- **`rep_structure` assembly** (`_match_impl`, 505-509): entry $k{-}1$ of the
  per-species vector = multiplicity of Adams$_k$, zero-padded to total degree
  $\sum_k k\,m_k$; positions are absolute, so sympy's arbitrary
  `free_symbols` iteration order cannot corrupt the key. Verified through the
  real `match()` with fake tables: $\phi_1^2\to$ `[2,0]`, $\phi_2\to$ `[0,1]`,
  $\phi_1\phi_2\to$ `[1,1,0]`, each hitting the intended table line.
- **`maxobjects` retry banner** (550-557; step-1 suspicion): live LiE shows
  `maxobjects` prints *no* banner — only `maxnodes` does, and its banner+newline
  is exactly the 53 characters the `[53:]` slice removes (for the constant
  `9999999` and this LiE build). The retry parse is clean.
- **Multi-species LiE chain with cache degradation**: with `pymysql`
  unavailable (stubbed), `_lie_cache_get/put` swallow the failure and the chain
  recomputes via live `lie`; $4\otimes4$ of $C_2$ correctly yields singlet
  multiplicity 1. The graceful-degradation path works.

**Confirmed fragilities (carried to the step-7 refactor list; no wrong numbers
produced in the paths exercised):**

- The `1.0*` at line 482 is load-bearing for the `.args[-1].args`
  character-exponent extraction (established in step 1, R1a) — an exact-integer
  coefficient would raise IndexError or silently give exponent 1.
- Coefficient rounding in both mcode generators binds `Round` to the first
  `Times` factor — safe only because of the same `1.0*` convention (F4, step 2).
- `form()` output handling is string surgery (`replace`, `[:-1]`) on FORM's
  stdout with no structural validation; a FORM warning line would corrupt the
  expression file silently.
- `eval` on FORM output terms and `eval` inside `d()` (`Fraction(eval(num), ...)`)
  execute arbitrary expressions from tool output and table files; trusted today,
  but a hardening item (ast.literal_eval / direct parsing suffice).
- The LiE banner slice `[53:]` and the singlet-first assumption on decomposition
  strings (zero weight listed first — true for LiE's ascending weight order,
  confirmed live) are version/format-coupled; the stored `arxiv/` tables must be
  spot-checked against them when provided (step 5).
- Dead code / cleanups: identical `if/else` branches in `makefrm` (216-219);
  `_match_impl`'s unused `t_order` parameter; `Mathcode` spawns a nested
  `Pool(CORE)` per theory under `maxtasksperchild=1` (cost, step 6).

**Out-of-scope (d) items already flagged to the user:** hardcoded Telegram bot
token (rotate it); O(N²) duplicate check re-reading the results file per success;
per-call MySQL reconnects.

## Interpretation

Scope (b) computes correct numbers in every path we could exercise without the
real character tables; the risks are concentrated in *format coupling* (FORM
stdout, LiE banner, table layout) and *convention coupling* (the Float-coefficient
trick), not in the arithmetic. The audit phase (steps 2-4) is complete: the
defect list going into the refactor is F1 (C3 gap), F2 (C4 gap/crash), F3
(`extractScalar` peel), F4 (Round binding), plus the fragility list above.
Steps 5-6 (regression harness, profiling) now wait on the user's old-run results
and `arxiv/` character tables.
