# 11 — Store module: self-bootstrapping sqlite character store

*Date: 2026-08-19 · wiki pages used: — (engineering step) · references: notes/10-semantics-lock.md (R9), refactor/fastmatch.py (integration API), `classification/landscape_refactored.py:414-450` (LieCache schema being replaced)*

## Goal

Build the deliverable store module: a single sqlite file (WAL) holding the
character decompositions, the tensor-step cache, and the species→Dynkin-label
registry, with generation-on-miss via the R9-locked LiE recursion and safe
concurrent access. Verify criterion: unit tests — cold store generates
step-10-sampled keys identically to the Dropbox ground truth; the maxobjects
retry path exercised (it fires for real at higher rank — user note
2026-08-19); concurrent hammering loses no writes; store file auto-created
from nothing.

## Setup

Deliverable location decision: `store/` package beside `refactor/`
(`store/charstore.py` + `store/__init__.py`) — the signed-off step-8
`refactor/` package stays untouched until the step-13 wiring. API shaped for
that wiring: `CharStore.decomp(species, key_vec)` matches
`fastmatch.CharacterTables.decomp`, and `CharStore.cache_get/cache_put` match
the callables `SingletProjector` already takes.

Schema (one sqlite file, `PRAGMA journal_mode=WAL`, `busy_timeout` 60 s,
`synchronous=NORMAL`):

- `char_decomp(group_rank, species, key_vec, value, source)` — key_vec is
  `str(list)` exactly as the old table files and `picklines` keys; `source` ∈
  {import, generated} for auditability.
- `tensor_cache(ckey, result)` — the LieCache replacement; ckey is the
  pipeline's existing sha256(`GROUP_RANK|products|decomp`) hex digest, so the
  16,133 warm entries import unchanged (step 12) and step-13 integration
  needs no key translation.
- `rep_registry(group_rank, species, dynkin)` — seeded with the R9-verified
  A1/A2 labels; any other group/species must be registered explicitly
  (`register_species`), and an unregistered lookup raises `CharStoreError`
  naming the fix — labels are never guessed.

Generation-on-miss: `decomp()` on a missing key runs the R9 recursion
(`Adams(N, rep, G)` base case; else `split_key` → two lower-order `decomp()`
calls → `tensor`), so one miss persists exactly its recursion cone. LiE
conventions are R9's verbatim: maxnodes+maxobjects 9999999 preamble, [53:]
banner slice with a per-process sentinel check that fails loudly on a
different LiE build, normalization strip/de-space, retry growing maxobjects
on `(`/`line` (max 3), Popen + process-group kill on timeout (fastmatch
`run_lie` semantics). Generated output must match a character-polynomial
regex before it is persisted — malformed LiE output raises instead of
poisoning the store.

Concurrency: one connection + `threading.Lock` per instance (the lock is
NOT held during LiE calls); across processes WAL + busy_timeout + idempotent
`INSERT OR IGNORE` (generation is deterministic, so concurrent writers
agree; first write wins harmlessly). The LiE runner is injectable
(`lie_runner`), which is how the retry/banner/validation paths are unit
tested without a contrived giant computation.

## Derivation

`store/charstore.py` (~300 lines). Test harness `calc/11_store_module.py`
(work dir `calc/work11/`, recreated per run), 10 tests:

| test | what it proves |
|---|---|
| t1 | store file + all three tables auto-created from nothing |
| t2 | registry seeded (q=[1,0], phi=[1,1], ...); unknown species → loud `CharStoreError` naming `register_species`; registration works |
| t3 | cold generation == Dropbox ground truth: step-10 sample keys (order ≤ 8, up to 2 per species) on EMPTY stores — 28 entries generated across all 10 group×species pairs (A1: 17, A2: 11; 13 with negative multiplicities, 10 pure-Adams; every entry `source='generated'`), all byte-identical to stored values |
| t4 | in-process memo (repeat lookups cost 0 LiE calls) and persistence (fresh instance on the same file, wired to a poisoned LiE runner, serves everything from sqlite) |
| t5 | tensor cache roundtrip; duplicate `cache_put` keeps the first value (INSERT OR IGNORE) |
| t6 | maxobjects retry: `(`-output → rerun with maxobjects 99999999 (grown), clean result; `line`-output likewise; permanently bad output → `CharStoreError` after initial + 3 retries |
| t7 | banner sentinel: wrong-build banner → loud `CharStoreError` before any computation |
| t8 | malformed (non-polynomial) LiE output → `CharStoreError`, nothing persisted |
| t9 | 8 threads × 200 mixed put/get/decomp on one instance: 1600/1600 rows, no errors, `integrity_check` ok |
| t10 | 4 spawned processes × 250 puts on one file: 1000/1000 rows, all exit 0, `integrity_check` ok |

## Result

$$\boxed{\text{store/ package: one auto-created sqlite file serves tables + LieCache with proven-identical on-miss generation; 10/10 unit tests.}}$$

## Verification

10/10 tests (1 s wall clock; cold generation is fast at these orders — the
LiE cost sits in the subprocess spawn, ~50 ms/call). The t3 ground truth is
the same Dropbox data R9 validated against; t6 exercises the exact retry
policy R9 fixed, including exhaustion; t10 uses spawn (macOS default) so the
harness pattern matches the production `Pool` usage.

## Interpretation

The store is now a drop-in data source for step-13 integration: `decomp` and
`cache_get/cache_put` slot into `fastmatch` without key translation. Step 12
fills it with the full A1/A2 tables and the 16,133 LieCache entries (bulk
APIs `put_decomp_many`/`cache_put_many` are in place) and cross-verifies a
fresh sample; step 14 then demonstrates the empty-store and C2 bootstrap
paths that t3 prototyped at small scale.
