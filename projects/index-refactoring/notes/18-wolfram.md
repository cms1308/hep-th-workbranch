# 18 — Persistent Wolfram kernel pool behind the V2_WOLFRAM switch

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/06-profiling.md (R6: wolframscript ≈ 1.2 s × 3 calls/theory), notes/08-refactor.md (R8 declined this pending byte-identity proof), notes/17-liepool.md (REPL pool pattern)*

## Goal

Third speed follow-up (plan step 18; user decisions 2026-08-20: full
3-call coverage including FindCharges, per-worker kernels licensed).
Serve the pipeline's Mathematica evaluations from persistent WolframKernel
sessions instead of a ~1.2 s wolframscript spawn per call, opt-in behind
`V2_WOLFRAM=<pool size>`. Verify: outcome records byte-identical to step-5
on an interleaved bench set AND a full 101-line replay; the patched module
with the env unset behaves exactly like the unpatched one; measured
per-theory recovery.

## Setup

`refactor/wolframpool.py` (`WolframKernelPool`, the step-17 pool pattern):
`WolframKernel -noprompt` REPL with sentinel framing. Byte-parity with
`wolframscript -code` stdout required three empirical fixes, each pinned
down before implementation:

- raw `-noprompt` prints in InputForm (quoted/escaped strings) and wraps
  at 78 columns — fixed by session init
  `SetOptions[$Output, FormatType -> OutputForm, PageWidth -> Infinity]`
  (the index strings are thousands of characters; wrapping would break
  `ast.literal_eval`);
- the raw kernel echoes every unsuppressed top-level expression value
  (wolframscript echoes only the code's final value) — fixed by shipping
  each mcode base64-encoded and evaluating it as ONE suppressed statement
  `ClearAll["Global`*"]; ToExpression[ByteArrayToString[BaseDecode["…"]]];`
  (ClearAll also isolates evaluations; all three pipeline mcodes are
  self-contained scripts ending in Print with overall value Null);
- wolframscript appends the code's value echo `Null\n` after the Print
  payload — reproduced verbatim.

Wiring (`refactor/glue.py`): the Engine's `_run_wolfram` (decouple/Index
mcodes) uses the pool when set, and `install()` always injects the module
global `_v2_wolfram_eval(mcode, timeout) -> bytes` — pool-backed when set,
otherwise an exact replica of the original wolframscript
spawn+kill-on-timeout. The FindCharges call inside charges2 (scope (a)
call site; user-approved) is routed through that hook by ONE surgical
patch (`PATCH_18` in calc/18_wolfram.py, PATCHES_V2 style), so an
unpatched module or an unset env is byte-untouched.

## Derivation

Engineering step. Standalone smoke test before wiring: 4/4 mcode-shaped
cases byte-identical to wolframscript stdout (association ExportString,
2 kB single-line Print, the intermediate-echo trap, the pipeline's
`formatNum` 30-digit real), warm round-trip 5–10 ms vs wolframscript's
~1,073 ms — the recovered ~1.07 s/call × 3 calls/theory predicts
≈ 3.2 s/theory.

## Result

Kernel mode is byte-identical end-to-end on the whole baseline and
recovers the fixed wolframscript tax on every line: mean 21.8 s → 19.1 s
per theory (x1.14 overall; full 101-line replay 36.7 min → 32.2 min), with
ONE kernel serving all 297 evaluations of the run.

## Verification

All criteria pass (`calc/18_wolfram.py`, results in work18/):

- smoke: 4/4 synthetic mcode cases raw byte-identical (incl. the
  no-wrap and no-echo traps).
- `bench --lines 0,23,77,100 --reps 2` (interleaved, isolated run dirs;
  'ws' mode = the PATCHED module with env unset, so it doubles as the
  fallback-parity check): **17/17 outcome records byte-identical to
  step-5** across both modes; kernel saves 2.4–3.1 s/theory — line 0
  x1.14 (20.3→17.7 s), line 23 x1.12, line 77 x1.13, line 100 x1.04
  (72.4→69.3 s; FORM dominates there).
- `full-replay` + `compare` PASS: **101/101 outcome records
  byte-identical to step-5**, 0 scan flags, warm store, no arxiv; 32.2 min
  total, mean 19.1 s vs step-13's 36.7 min / 21.8 s; pool stats: 297
  calls, 1 spawn.

## Interpretation

This is the first follow-up that pays on EVERY line, warm or cold — the
~2.5 s/theory wolframscript tax R8 declined to touch is now removed under
a switch with byte-identity proven at full-baseline scale. Production
adoption: apply PATCH_18 alongside PATCHES_V2 and set `V2_WOLFRAM`;
per-worker kernels under Pool(CORE) are licensed per the user's decision
(the pool is fork-aware like the step-17 LiE pool: each worker spawns its
own kernel on first use). Composition note: V2_WOLFRAM + V2_LIEREPL +
V2_TFORM are independent switches; the natural production set is
V2_WOLFRAM always, V2_LIEREPL for cold/first runs, V2_TFORM for
heavy-superpotential batches. Next: step 19 (Python post-processing) —
if its InputForm/dedup byte-identity blocker clears it supersedes the
kernel pool for the 2 mcode calls (and removes the Wolfram dependency
from decouple/Index entirely), leaving FindCharges as the kernel pool's
remaining client.
