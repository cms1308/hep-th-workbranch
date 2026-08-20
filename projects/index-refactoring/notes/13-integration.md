# 13 — Integration: the refactor/ pipeline backed only by the character store

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/11-store-module.md (R10), notes/12-import.md (R11), notes/08-refactor.md (harness being reused)*

## Goal

Back `fastmatch` with the store — tables object AND LieCache replacement —
and prove nothing changed: the step-8 harness replay of all 101 baseline
lines must give outcome records byte-identical to the step-5/8 baseline with
the v2 scan logs unchanged, while no legacy character source (arxiv/ files,
stub LieCache) is consulted.

## Setup

Integration is one switch in `refactor/glue.py` (`Engine.__init__`): if the
environment variable `V2_CHARSTORE` names a store file, construct
`CharStore(path, GROUP_RANK, lie_timeout=LIE_TIMEOUT)` and pass it to
`SingletProjector` as BOTH `tables=` (the `decomp(species, key_vec)` API
matches `fastmatch.CharacterTables` by design, R10) and
`cache_get`/`cache_put` (same sha256 keys, R10/R11); unset, the original
wiring (CharacterTables on `ARXIV_DIR` + `LieCacheClient` on pymysql) is
byte-for-byte untouched, so the signed-off step-8 behavior is preserved.

Hardening added to `store/charstore.py` while wiring: all DB access now goes
through `_db()`, which reopens the sqlite connection when `os.getpid()`
changes — a forked Pool worker (production runs Pool over theories on
fork-start platforms) must not reuse the parent's connection. Verified by an
explicit `os.fork()` inheritance check plus the step-11 suite re-run (10/10).

## Derivation

`calc/13_integration.py` (work dir `calc/work13/`):

- `setup`: `landscape_A2_v2.py` copied verbatim from work08 (same module
  bytes, same PATCHES_V2), the pymysql stub (still needed — it records the
  Theories/Failures INSERTs), and a COPY of `work12/charstore_A2.sqlite`
  (work12 stays pristine). Deliberately absent: the `arxiv` symlink and any
  warm `liecache.sqlite` — a legacy table read would crash loudly, a legacy
  cache read would show up as rows.
- `replay [--start --end]`: the step-8 replay loop with
  `V2_CHARSTORE=work13/charstore_A2.sqlite`; outcomes per line in
  `work13/replay_outcomes.jsonl` (resumable).
- `compare`: byte-identity vs the step-5 outcome records, scan-flag count,
  store forensics, legacy-source check.

One false alarm during bring-up, kept for the record: the harness first
asserted that `liecache.sqlite` must not EXIST, and failed — but the pymysql
stub opens that sqlite file on EVERY `connect()` (including the ones that
only record Theories INSERTs), so an empty file appears as soon as charges2
logs anything. The meaningful invariant is that the `LieCache` TABLE inside
it is never created/used; the check now counts legacy LieCache rows (0).

## Result

$$\boxed{\text{101/101 outcome records byte-identical with the store as the ONLY character-data source; 0 scan flags; 0 generated rows; legacy sources untouched.}}$$

## Verification

`compare` PASS, all four parts:

- outcome records vs step-5: **101 identical, 0 differ** (success/log/error
  line lists verbatim — a superset of the 82/82-true + 17-rejected + F5-pair
  structure already established in steps 5/8);
- index scans: 101 runs, **0 flags fired** (v2 scan behavior unchanged);
- store forensics: **0 `generated` rows** (every table lookup was served by
  the import — no silent regeneration), tensor_cache still exactly the
  16,133 imported entries (every LiE chain hit the warm cache; `cache_put`
  added nothing);
- legacy sources: no `arxiv` symlink ever needed, legacy LieCache table
  never created.

Timing (sequential replay, same machine): 101 lines in 36.7 min, mean
21.8 s/line, max 69 s (line 100) — consistent with the step-5 46-min /
27 s-mean replay; the store's indexed point lookups are performance-neutral
as expected (FORM still dominates).

## Interpretation

The store is now the pipeline's sole character-data source under a switch
that leaves the default path untouched. What remains for the extension:
step 14 demonstrates the paths this baseline could NOT exercise — empty-store
bootstrap (misses actually generated), cross-group generation checked
against the stored C2 tables, and a portability run with no Dropbox, no
MySQL, no Wolfram — and step 15 writes the deliverable docs (README:
V2_CHARSTORE wiring, per-group store files, import tool usage).
