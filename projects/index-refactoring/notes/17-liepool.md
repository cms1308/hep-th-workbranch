# 17 — Persistent LiE REPL pool behind the V2_LIEREPL switch

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/06-profiling.md (R6: cold LiE ≈ 21 s / 15k calls), notes/10-semantics-lock.md (R9 LiE conventions), notes/14-bootstrap.md (empty-store replay baseline)*

## Goal

Second speed follow-up (plan step 17): serve every LiE evaluation — the
fastmatch projection chains AND the store's generation recursion — from a
pool of long-lived LiE processes instead of one subprocess spawn per call,
opt-in behind `V2_LIEREPL=<pool size>`, default path untouched. Verify:
(a) outputs identical to one-shot mode on a large real call sample
including the maxobjects-retry path; (b) the empty-store line-100 replay
(max LiE exercise: every chain and table key cold) byte-identical;
(c) measured spawn-overhead recovery, interleaved.

## Setup

`store/liepool.py` (`LieREPLPool`): a thread-safe pool of at most N live
`lie` processes; `run(lcode, timeout)` is signature-compatible with the
one-shot `run_lie` of both call sites. Wiring: `refactor/glue.py` builds
the pool when `V2_LIEREPL` is set and passes `pool.run` as `lie_runner`
into `CharStore` (existing constructor parameter) and `SingletProjector`
(new optional parameter, default = the module's own `run_lie` — the
default path is unchanged). Fork parity: a forked child abandons inherited
processes (they belong to the parent) and spawns its own.

Framing parity — the load-bearing observations, established empirically
before building:

- LiE prints NO startup banner when piped; the 53-byte prefix every caller
  slices off is the RESPONSE to the `maxnodes 9999999` command each lcode
  sends first (and `maxobjects` prints nothing, R4). Since callers re-send
  their full preamble on every call, replaying an lcode into a live
  session produces byte-identical stdout to a fresh process; each call is
  delimited by a sentinel integer expression whose echo marks
  end-of-output.
- LiE line-flushes through a pipe (no pty needed), and sessions survive
  errors.

Failure parity: a timeout kills the process group and raises
`subprocess.TimeoutExpired` (what both callers catch); a died process
returns its partial output like the one-shot `communicate()` and is
respawned on the next borrow.

## Derivation

Two REPL-vs-one-shot semantic differences surfaced and were pinned down;
neither can reach any persisted or compared value:

1. **Error messages carry session line numbers** ("(in tensor at line N of
   file stdin)"): byte parity for ERROR outputs holds on a fresh process's
   first call and drifts on reused processes. The retry logic reads only
   the '('/'line' marker (invariant), and error text is never cached (the
   'X'-and-no-'line' gate in fastmatch) nor persisted (the polynomial
   regex in the store).
2. **LiE's object pool does not shrink once grown**: a session retains the
   largest `maxobjects` seen, so an lcode that would overflow in one-shot
   mode can succeed immediately on a grown session — with the identical
   (deterministic) polynomial the one-shot retry ends at. Net effect: same
   value, fewer error round-trips.

The harness bug worth remembering (first bench run): repeating the SAME
theory into one results dir routes runs 2+ to the log as
`... (duplicated)` — that is charges2's own duplicate check (it reads the
success file and compares a, c, and the index string), not a pipeline
difference; the bench now isolates each run in its own run dir.

## Result

REPL mode is verified byte-identical end-to-end and recovers the spawn
overhead on cold runs: the cold empty-store line-100 replay drops from
152.9 s (one-shot spawns) to 133.7 s (pool of 6 serving ~16,570 calls,
6 spawns total) — x1.14 interleaved (x1.18 in a second bench pair; the
recovered ~19–24 s matches R6's ~21 s cold-LiE estimate for ~15k calls).

## Verification

All three criteria pass (`calc/17_liepool.py`, results in work17/):

- `ab-sample` PASS: **33/33 raw byte-identity** of `pool.run` vs one-shot
  `run_lie` on real lcodes of both call-site shapes (charstore-style
  Adams/tensor with `maxobjects` preamble; fastmatch-style
  `res=…;print(res);`), plus a **full C2 regeneration (198/198 keys)
  through a REPL-backed CharStore** identical to the step-14
  triple-verified store — 232 calls served by ONE process.
- `retry-test` PASS: a real maxobjects overflow (marker parity + raw
  identity on a fresh process), the grown-maxobjects retry on the same
  post-error process raw-identical to one-shot, and the
  overflow-lcode-on-grown-session case returning the identical final
  polynomial (difference 2 above, machine-checked).
- `bench --reps 2` + `verify` PASS: 4 interleaved cold empty-store
  line-100 runs (spawn0/repl0/spawn1/repl1, isolated run dirs) — **4/4
  outcome records byte-identical to step-5**, each store's 15,020
  tensor-cache keys ALL among the 16,133 imports with 0 value mismatches,
  each store's 1,510 generated table rows byte-matching the Dropbox A2
  tables, 0 scan flags. Timing: spawn 150.3/155.4 s, repl 134.8/132.6 s.

## Interpretation

The switch is safe (byte-identical, opt-in) and its lever is exactly where
R6 predicted: LiE process-spawn overhead, which only matters when LiE runs
a lot — cold caches, empty-store bootstrap, cross-group generation. On
warm-cache production lines LiE calls are rare and the pool changes
nothing. Recommendation: set `V2_LIEREPL=<CORE>` for first runs on new
groups/machines (where it combines with generation-on-miss) and leave it
unset for warm replays where it is inert anyway. Remaining items: step 18
(persistent Wolfram kernel — the ~4 s/theory fixed cost on EVERY line,
warm or cold, is now the largest untouched overhead), then 19-21.
