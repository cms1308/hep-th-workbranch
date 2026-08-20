# 16 — TFORM: parallel FORM behind the V2_TFORM switch

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/06-profiling.md (R6: FORM@9 ≈ 65% of a typical line), notes/08-refactor.md (R8 harness), notes/13-integration.md (work13 pattern)*

## Goal

First speed follow-up (second extension, plan step 16): run the PE
expansion with TFORM (multithreaded FORM) instead of sequential FORM,
opt-in behind `V2_TFORM=<workers>`, default path untouched. Verify:
form-output files byte-identical to `form` on lines 0/23/77/100 ×
t_order 3/9; subset replay outcome records byte-identical to step-5;
interleaved same-load bench.

## Setup

TFORM 4.3 (same build date as the FORM 4.3 binary) at
`/usr/local/bin/tform`. Implementation in `refactor/glue.py`:
`install()` rebinds the module-global `form` when `V2_TFORM` is set to a
copy of the module's `form()` body that invokes `tform -w<N> -q` — makefrm
and the output-string surgery are reused verbatim, and the `V2_TIMINGS`
wrapper applies on top. Harness `calc/16_tform.py`, work dir
`calc/work16/` (work13 pattern: module copy byte-identical to steps
8/13/14, pymysql stub, warm A2 store copy — character data is not the
variable here; no arxiv symlink).

## Derivation

Engineering step. The one physics-relevant fact: FORM's sorted output is
canonical, so if the printed `result` expression is byte-identical, every
downstream stage (fastmatch parse, projection, mcode) is unchanged by
construction — the outcome replay is a belt-and-suspenders end-to-end
check on top.

## Result

TFORM output is byte-identical to FORM's everywhere tested, and the switch
is verified end-to-end; the measured speedup is confined to the heaviest
line: typical order-9 lines gain nothing (x1.00–1.02), line 100 gains
x1.33 at `-w4` (58.8 s → 44.2 s) and x1.39 at `-w8` (→ 42.0 s) —
saturation at ~42 s shows a ~40 s serial component dominating that run, so
more workers cannot help further.

## Verification

All three criteria pass (`calc/16_tform.py`, results in work16/):

- `ab-form`: **8/8 byte-identical** output files (lines 0/23/77/100 ×
  t_order 3/9; sizes 316 B – 13.9 MB), form and `tform -w4` interleaved.
- `replay --lines 0,23,77,100 --workers 4` + `compare`: **4/4 outcome
  records byte-identical to step-5**, 0 scan flags. Line 100 end-to-end
  58.0 s vs 69 s in the step-13 replay (≈ x1.19 line-level).
- `bench` (interleaved, ambient load ~7 on 20 logical cores): line 0
  x1.02, line 23 x1.00, line 77 x1.00 (FORM stage ≈ 15–17 s unchanged);
  line 100 x1.33 (`-w4`, 2+1 reps), x1.39 (`-w8`, 2 reps).

## Addendum (2026-08-20, user question): FORM-stress theories

Is the weak typical-line gain an artifact of the baseline's moderate
R-charges? Yes. `bench-heavy` (same harness) measures synthetic
FORM-stress theories — SU(3) with nf small-R-charge flavors, each with
its own U(1) global (so nf g-fugacities), plus one S/Sb pair — where
small R-charges mean many more letters below the t_order-9 cutoff:

- **A_nf2_r0.30** (form output 9.7 MB — ~50x a typical baseline line):
  form 22.1 s, tform -w4 15.8 s (**x1.40**), -w8 13.8 s (**x1.60**), all
  byte-identical, 2 reps interleaved.
- **B_nf4_r0.25** (output 585 MB): sequential form exceeds its own 600-s
  timeout (charges2 would drop the theory as "stop"); **tform -w8
  finishes in 198 s, -w12 in 148 s** — at least x3-x4, and it converts a
  timeout-dropped theory into a completed one. (w8 and w12 outputs agree
  in size; byte-identity could not be checked against sequential form
  here since form never finished — spec A's byte-identity plus the
  baseline 8/8 stand as the parity evidence.)

So the step's main-text conclusion is refined: tform's gain scales with
the actual FORM workload. The baseline lines (~0.2 MB output) are simply
too small for TFORM's distribution to engage; on matter-rich,
small-R-charge theories — the expensive regime of a production
enumeration — tform is a x1.4-x4+ lever and a timeout rescue, exactly
where it is needed most.

## Interpretation

The switch is free and safe (byte-identical, opt-in, default untouched),
but TFORM is NOT the lever R6's "FORM@9 ≈ 65%" suggested: on typical lines
the expansion's cost is not in parallelizable term-crunching (the
expressions are too small for TFORM's distribution to engage), and even on
the flip-heavy line a serial component caps the gain at ~1.4x of the FORM
stage. Recommendation: enable `V2_TFORM` for runs dominated by heavy
superpotentials (many fields / large indices), where the FORM stage is
both large and partially parallel; leave it unset otherwise — under the
production `Pool(CORE)` over theories, extra worker threads on no-gain
lines are pure oversubscription. Next lever by measured order: step 17,
the persistent lie REPL (cold-chain spawn overhead, ~50 s on the heaviest
cold line).
