# Self-bootstrapping character store (extension steps 10–15)

One sqlite file per gauge group replaces BOTH precomputed character data
sources of the index pipeline: the `arxiv/<GROUP><RANK>/<species>/` table
files and the MySQL `LieCache` table. A key missing from the store is
computed on the spot via LiE subprocess calls (the `arxivGen 2.py`
recursion) and persisted, so a run never crashes on a key outside the
pregenerated orders and a fresh machine needs only Python + LiE — no
Dropbox tables, no MySQL, no Wolfram for character data.

Verified (calc/, notes/10–14): the generation recursion reproduces stored
table entries byte-identically (107/107 sampled, then 30/30 up to order 44
after import, then the full cold cones of two baseline lines); the
101-line regression replay is byte-identical to the signed-off baseline
with the store as the only character source; an EMPTY store regenerates
outcomes, cache values (15,047/15,047 overlapping keys), and table rows
(1,524/1,524) exactly; cross-group generation on C2 matches the stored
tables and an independent one-shot LiE evaluation 198/198 under a PATH
with no wolframscript and no form.

## Schema

One file, WAL journal, `busy_timeout` 60 s, auto-created when absent:

| table | columns | contents |
|---|---|---|
| `char_decomp` | `group_rank, species, key_vec, value, source` (PK: first three) | decomposition of $\prod_k \psi^k(\chi_{\rm rep})^{m_k}$ for `key_vec` = `str([m1,...,mN])` (spaced, as in the table files), as the normalized LiE virtual-character string; `source` is `'import'` or `'generated'` |
| `tensor_cache` | `ckey, result` | the LieCache replacement; `ckey` = the pipeline's existing sha256(`GROUP_RANK\|products\|decomp`) hex digest, so warm caches stay valid |
| `rep_registry` | `group_rank, species, dynkin` | species → Dynkin label, seeded on creation with the order-1 labels of all 26 landscape groups (`DEFAULT_LABELS`, read off the table files; species lists vary per group) |

Normalization of every stored/generated value: LiE stdout minus the 53-byte
banner, stripped, newlines and spaces removed — the same normalization the
table files carry, byte-verified in steps 10/12/14.

## Integration (refactor/ pipeline)

Set `V2_CHARSTORE=<path to charstore_<GROUP_RANK>.sqlite>` before importing
the landscape module. `refactor/glue.py` then constructs a `CharStore` and
passes it to `SingletProjector` as BOTH the tables object (`decomp(species,
key_vec)`, same API as `fastmatch.CharacterTables`) and the cache hooks
(`cache_get`/`cache_put`, same sha256 keys as `LieCacheClient`). Unset, the
original wiring — table files under `ARXIV_DIR` + LieCache over pymysql —
is byte-for-byte untouched.

Store files are per-group (`charstore_A1.sqlite`, `charstore_A2.sqlite`,
...): the portable unit stays small, and a `CharStore` instance is bound to
one `group_rank` anyway. The results database (Theories, Failures,
FreeSector, ...) is out of scope and stays in MariaDB; the store carries
character data only.

Concurrency: thread-safe within a process (one connection + lock); safe
across processes via WAL + busy_timeout + idempotent `INSERT OR IGNORE`
(generation is deterministic, so concurrent writers agree — duplicate
generation events are absorbed, verified by thread/process hammers in step
11 and observed live in step 14's portability run). Fork-safe: every DB
access reopens the connection when `os.getpid()` changes, so `Pool`
workers on fork-start platforms never reuse the parent's connection.

## Seeding by import (recommended, not required)

`calc/12_import.py` (Dropbox originals read-only; online-only files
materialize on read):

```
python3 calc/12_import.py labels            # order-1 labels of all 26 groups
python3 calc/12_import.py import --group A2 # bulk-import one group's tables
python3 calc/12_import.py liecache          # the 16,133 LieCache entries -> A2
python3 calc/12_import.py verify            # counts, regen sample, exhaustive cache
```

Imported so far: A1 (644 MB, 1,279,601 entries) and A2 (1.1 GB, 514,788
entries + the 16,133-entry LieCache), every verification exact. Import
success is judged on value CONFLICTS, not raw duplicates — A2's `qb37.txt`
is truncated and holds 313 duplicate keys, all with byte-identical values.
Groups without imported bulk data run on generation-on-miss (C2
demonstrated); with an empty store a theory generates only its own field
content's Adams cone, measured at 22 s (baseline line 0, 64 keys) to 139 s
(flip-heavy line 100, 1,460 keys + 14,674 LiE chains) — minutes, not the
tens of minutes the plan had budgeted for.

## Generation-on-miss behavior

`decomp()` on a miss runs the arxivGen recursion and persists exactly its
cone (`source='generated'`):

- pure top Adams key (`key[-1] == 1`) → `Adams(N, <label>, <group_rank>)`;
- otherwise split off the first nonzero Adams factor (`split_key`) and
  `tensor` two strictly-lower-order entries, each obtained through
  `decomp()` recursively.

LiE conventions (locked in step 10, byte-verified against the stored
tables): banner sentinel checked once per process before the first
evaluation — a different LiE build fails loudly instead of silently
mis-slicing; `maxnodes 9999999` + `maxobjects 9999999` preamble; on `(` or
`line` in the output, grow maxobjects and retry (up to 3 times — fires at
higher rank); output validated against a character-polynomial regex before
persisting; subprocess killed by process group on timeout (default 180 s
per call, the pipeline's `LIE_TIMEOUT`).

The registry never guesses: an unregistered species raises `CharStoreError`
listing the known species; add one explicitly with
`register_species(species, dynkin)`.

## Limits

- `tensor_cache` values cannot be regenerated from their sha256 keys alone
  (the preimage is not stored); regeneration correctness is instead
  established by the step-14 overlap check — every cold-computed chain
  reproduced its imported value.
- The 53-byte banner slice is specific to this LiE build; the per-process
  sentinel check turns a mismatch into a hard error, not corruption.
- Generation cost lives inside the projection chain budget
  (`MATCH_TIMEOUT`, 300 s per chain): a cold cone is generated during the
  first chains that need it. Measured cones fit with wide margin; a
  pathological theory whose single top key exceeds the budget would surface
  as `MatchTimeoutError` → the Failures routing, never as wrong data.
- The store does not delete or overwrite: rows are insert-only
  (`INSERT OR IGNORE`), matching the determinism assumption. Wiping a
  group's store file and letting it regrow is always safe.
