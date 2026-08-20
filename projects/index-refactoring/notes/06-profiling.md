# 06 — Profiling the index pipeline on baseline inputs

*Date: 2026-08-13 · wiki pages used: — (implementation) · references: notes/05-regression-harness.md, calc/06_profiling.py, calc/work06/*

## Goal

Per-stage wall-clock breakdown on named benchmark inputs, with LiE-cache hit
rates. Verify criterion: recorded per-stage wall-clock breakdown on named
benchmark inputs.

## Method (`calc/06_profiling.py`, work dir `calc/work06/`)

Pipeline module unmodified; measurement is external:

- PATH shims wrap the real `lie`/`form`/`wolframscript` with
  `/usr/bin/time -a -o … -p` → one real-time record per external invocation,
  in the driver and in Pool children alike (10 ms resolution; per-call lie
  times are therefore lower bounds, sums indicative).
- The step-5 pymysql stub, instrumented to log every LiE-cache get (hit/miss)
  and put.
- In the driver, `form`/`decouple`/`Index` wrapped with timers that snapshot
  the tool logs before/after → tool time attributed to the phase that spawned
  it; the a-maximization wolframscript call is the remainder.
- Each (line, cache-mode) benchmark in a fresh subprocess: cold = empty
  `liecache.sqlite`, warm = copy of the step-5 cache (16 133 entries);
  fresh results dir per run (no duplicate-check short-circuit).

Benchmarks (SU3s1S1nf2 lines): 0 (seed, W=0), 23 (2-term M-flip),
77 (3-term), 100 (7-term, 4 X-flips — the heaviest of the 101).

## Results

```
line  mode terms   total a-max-ws    form  decouple   Index lie-calls lie-sum cache-hit
   0  warm     0    23.4s    1.36s  16.02s     1.66s   3.16s        0   0.00s     100%
  23  warm     2    24.5s    1.17s  17.40s     1.73s   4.16s        0   0.00s     100%
  77  warm     3    22.7s    1.13s  14.89s     1.76s   4.93s        0   0.00s     100%
   0  cold     0    24.0s    1.14s  15.44s     1.77s   5.51s      377   0.27s      90%
 100  warm     7   201.6s    1.20s  57.65s     1.69s  140.62s       0   0.00s     100%
 100  cold     7   273.7s    1.10s  57.75s     1.99s  212.41s   15 024  20.99s      96%
```

(`form` = both FORM invocations, order 3 + order 9; order 3 is ~1 s, order 9
is the rest. `decouple`/`Index` walls include their wolframscript call
(~1.1–1.2 s each) and the Mathcode stage: FORM-output decode, Pool(6) spawn,
per-term sympy `match`, LiE chains.)

## Where the time goes

1. **FORM order-9 PE expansion dominates typical theories**: 15–17 s of
   ~24 s (≈ 65 %). It grows with field content: 58 s for the 10-field line
   100. Per-theory, unavoidable in the current design (R-charges differ per
   theory, so no cross-theory reuse).
2. **Mathcode (sympy side) explodes on term-rich theories**: line 100's
   Index phase is 140 s *with a 100 % cache hit rate and zero lie calls* —
   the cost is Python: eval of each FORM term, `subs`-based decoding,
   character extraction, table lookups (4 862 cache gets at line 23 → tens of
   thousands of sympy term-objects at line 100). This is the top refactor
   target for flip-heavy theories.
3. **LiE subprocesses are NOT the bottleneck once cached**: cold line 100
   makes 15 024 lie calls totalling ≈ 21 s measured (plus spawn overhead —
   the warm-vs-cold Index difference is ≈ 72 s); warm runs make zero calls.
   Within-run repetition alone gives 90–96 % hit rates even cold. The
   sqlite-backed cache (step-5 stub) fully replaces the MySQL LieCache.
4. **wolframscript startup is a fixed ~1.1–1.4 s tax, 3 calls per theory**
   (a-max, decouple, Index) ≈ 3.5–4 s/theory ≈ 15 % of a typical line —
   the case for a persistent kernel or Python post-processing at scale.
5. **Pool overhead**: each theory spawns two `Pool(6)`s (decouple + Index
   Mathcode); on warm seed-like lines the Index wall minus wolframscript and
   near-zero match work leaves ≈ 2 s — mostly worker spawn + sympy import.
   (`Mathcode`'s nested-per-theory pools were already flagged in step 4.)

## Consequences for step 8 (refactor targets, in order of measured leverage)

1. Replace/accelerate the sympy term decode in `match` (structured parsing of
   FORM output instead of `eval` + chained `subs`; batch table lookups) —
   biggest win on flip-heavy theories (140 s → the term loop is
   embarrassingly parallel and mostly string work).
2. FORM stage: keep FORM (correct and hard to beat for the PE expansion) but
   revisit the expansion order bookkeeping (`get_order` per species) and the
   `t(: 4500)` truncation; any win here is ~65 % of typical lines.
3. Keep the LiE cache design (sqlite or in-process dict); LiE itself is fine.
4. Persistent wolframscript kernel or Python post-processing: ~4 s/theory.
5. Reuse one process pool across the run instead of two spawns per theory.

## Verification

- Verify criterion met: per-stage breakdown recorded on 4 named inputs ×
  cold/warm (6 runs), machine-generated into `calc/work06/profile_results.jsonl`
  by `calc/06_profiling.py` (re-runnable; `report` reprints the table).
- Cross-checks: phase walls sum to within ~1.5 s of each run's total (module
  import + result bookkeeping); warm-cache totals for lines 0/23/77/100
  match the step-5 replay times (24/25/23/205 s) — instrumentation overhead
  is negligible.
