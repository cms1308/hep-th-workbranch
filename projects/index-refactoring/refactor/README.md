# Refactored index pipeline (step 8)

Drop-in replacement for the index post-processing of the landscape module
(`Mathcode`/`match` → `fastmatch`, `generate_*_mcode` → `mcode_v2`,
plus the C1'/C3/C4 condition scan in `conditions`), verified byte-identical
on the SU3s1S1nf2 regression baseline (calc/08_refactor.py).

## What changes, what stays

| stage | old | new |
|---|---|---|
| FORM PE expansion | `makefrm`/`form` | unchanged |
| term decode + singlet projection | sympy `eval` + chained `subs` per term, per-term file scans, nested `Pool(CORE)`, MySQL-only LiE cache | pure-Python structured parser (no sympy, no eval), in-memory character tables, per-signature projection memo, thread pool only for LiE chains |
| Mathematica post-processing | `generate_decouple_mcode` / `generate_index_mcode` | same code with two fixes: F3 (iterative `extractScalar` peel) and F4 (`b_?NumericQ` in the rounding rule) |
| consistency conditions | C1/C2 (per-flavor) in Mathematica | unchanged, plus a Python-side scan of the net reduced index: C1' free-spinning boundary, C3 higher-spin/supercurrent signal (through t^9 — exact at t_order 9, see below), C4 vanishing index (fixes the F2 crash) |
| verdict routing (`charges2`) | — | three surgical edits: `startswith('inconsistent')`, a `FreeSector` branch, `SUSYenhanced` column fill |

## Integration into a production module

1. Copy `refactor/` somewhere importable.
2. Append to the landscape module, BEFORE the `if __name__ == '__main__':`
   block:

   ```python
   import sys as _sys
   _sys.path.insert(0, "<dir containing refactor/>")
   from refactor.glue import install as _v2_install
   _v2_install(globals())
   ```

3. Apply the three `charges2` edits — exact patch strings in
   `calc/08_refactor.py` (`PATCHES_V2`):
   - `if ind.get('consistency') == 'inconsistent':` →
     `if str(ind.get('consistency', '')).startswith('inconsistent'):`
   - insert the `elif ind.get('consistency') == 'free sector':` branch
     (INSERT into `FreeSector`; created on first use) before the final
     `else:`
   - Theories INSERT: fill the `SUSYenhanced` column from
     `result.get("SUSYenhanced", '')` instead of `''`.

New verdict routing (user decisions 2026-08-18):
- C3 hit with j >= 1 (higher-spin current ⇒ free sector) →
  `consistency = "inconsistent (free sector: higher-spin current)"` →
  `InconsistentIndex`.
- C4 hit (index ≡ 1 within truncation; the input that used to crash
  `Index()`) → `consistency = "inconsistent (vanishing index: possible SUSY
  breaking)"` → `InconsistentIndex`, without calling wolframscript.
- C1' hit (free spinning boundary at E = 2+2j, j >= 1/2) on a theory that
  passes everything else → `consistency = "free sector"` → `FreeSector`
  table (never `Theories`). When C1' and C3 fire together, C3 takes
  precedence (→ `InconsistentIndex`; user decision 2026-08-19); both
  signals are recorded in `index_flags` either way.
- C3 hit at j = 1/2 only (extra supercurrent, NOT an inconsistency) →
  theory saved to `Theories` as usual with
  `SUSYenhanced = "candidate (t^7 chi_1/2 supercurrent signal in index)"`.

## t^9 exactness (why the scan may use E = 9 at t_order = 9)

The fugacity encoding t^{d0} s^{d1} r^{d2} is linear and positive: encoded
digits add under multiplication (no carries are needed — the decode
d0/500 + d1/2.5e6 + d2/1.25e10 is positional), and d0 <= 500*p for every
letter. Hence any product of letters with true physical exponent p <= 9 has
total d0 <= 4500 and survives the FORM truncation `t(: 4500)` at every
intermediate step (all letters have positive exponents, so partial products
never exceed the final exponent). The expansion orders (`get_order`, Horner
`max_order`, `vec_order`) are chosen to reach t^{t_order} for the smallest
letter, so every contributing product is generated. Therefore the t^9
coefficient of the index — and of the reduced index, which needs I only up
to t^9 — is exact, and C3 at j = 3/2 (t^9 chi_{3/2}) is checkable without
raising t_order. Machine-checked by `calc/08_refactor.py t9-check` (FORM
runs at t_order 9 and 10 agree on every bucket <= t^9).

## Notes

- Logs: `./v2_scanlog.jsonl` (every Index() scan; `fired: false` on clean
  theories). With env `V2_TIMINGS=1`, `./v2_timings.jsonl` gets per-phase
  wall clocks (form / fastmatch / wolframscript).
- Timeouts: LIE_TIMEOUT applies per lie subprocess as before; MATCH_TIMEOUT
  bounds each projection chain (the unit the old per-term SIGALRM bounded)
  and surfaces as MatchTimeoutError → the Failures routing in charges2.
  It does NOT cap the whole theory: a cold-cache theory legitimately runs
  thousands of chains.
- The LieCache table, its sha256 keys, and the species chain order are
  unchanged: existing warm caches remain valid.
- The express file now carries exact rational coefficients (the old sympy
  path wrote floats); Mathematica's Total + the (patched) Round rule produce
  identical downstream values, verified by the old/new mcode A/B and the
  byte-identical baseline replay.
