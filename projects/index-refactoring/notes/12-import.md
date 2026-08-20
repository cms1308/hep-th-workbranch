# 12 — Import + cross-verification: A1/A2 into per-group stores, registry for all 26 groups

*Date: 2026-08-19 · wiki pages used: — (engineering step) · references: notes/10-semantics-lock.md (R9), notes/11-store-module.md (R10)*

## Goal

Fill the store with the existing verified data and prove the import faithful:
(a) per-group bulk import, run now for A1/A2 (user decision 2026-08-19:
A1/A2 now, other groups later by the same tool or generation-on-miss;
per-group store files so the portable unit stays small); (b) species→Dynkin
registry for ALL 26 groups (user: all groups must eventually be covered);
(c) the 16,133-entry LieCache. Verify criterion: row counts equal source
counts (dedup documented); registry labels = order-1 entries for all groups;
a fresh random sample of imported entries regenerated via LiE matches
byte-identically; LieCache import preserves key→value exactly (exhaustive).

## Setup

Corrected picture of the source data (this step's recon; PROJECT.md
amended): ALL 26 group dirs (A1-A9, B2-B4, C1-C8, D3-D8, G2) are populated —
~69 GB logical in total (C2 ~26 GB, A5 ~14.6 GB) — but almost entirely as
Dropbox online-only placeholders; an earlier claim that non-A1/A2 dirs were
empty had misread `du` (on-disk) for logical size. Species lists vary per
group: B2 adds sp/spb, C2 adds sp/spb/v/vb, C1/C6/C8/G2 lack S/Sb, D3 has
only q (3 files). Store files: `calc/work12/charstore_<G>.sqlite`.

## Derivation

`calc/12_import.py` subcommands (work dir `calc/work12/`):

- `labels`: reads every group's `<species>1.txt` (entry `[1]` =
  `1X[label]`), writes `work12/labels.json` (155 labels, 26 groups) and
  prints the `DEFAULT_LABELS` literal now embedded in `store/charstore.py` —
  every fresh store of ANY landscape group is bootstrap-ready with no
  Dropbox access; labels are read from the data, never guessed.
- `import --group G`: streams every table file of G, one
  `put_decomp_many` transaction per file (`source='import'`),
  per-file report in `work12/import_report_<G>.jsonl`.
  A1: 151 files, 1,279,601 keys, 54 s → charstore_A1.sqlite 644 MB.
  A2: 171 files, 514,788 keys, 62 s → charstore_A2.sqlite 1.1 GB
  (incl. tensor_cache).
- `liecache`: the step-5 harness sqlite (`work05/liecache.sqlite`,
  `LieCache(ckey, result)`) → `tensor_cache` of the A2 store via
  `cache_put_many`: 16,133/16,133 added.
- `verify`: see below.

Source-format findings (documented, importer handles both):

1. **D3/q uses the JSON indent=4 variant** (arxivGen's commented-out
   `json.dump` path) instead of the standard one-dict-literal-per-line
   format; the reader falls back to a whole-file JSON parse on SyntaxError.
2. **qb37.txt (A2) contains 313 duplicate keys — all with byte-identical
   values** (checked exhaustively across all A2 files; zero
   differing-value conflicts anywhere), so old `picklines`
   (first match) and the import (last wins) agree. The file is also
   visibly truncated (1,517 keys vs 17,977 at qb36) — an interrupted
   generation run; exactly the kind of hard edge generation-on-miss
   removes. Import success is judged on *conflicts* (differing-value
   duplicates), which must be 0.

## Result

$$\boxed{\text{A1 + A2 fully imported (1{,}794{,}389 entries) + LieCache 16{,}133 + registry for all 26 groups (155 labels); every verification exact.}}$$

## Verification

`verify` PASSED, all four parts:

- **Counts**: per-species store rows == source key counts, all 10 species
  (A1: U/Ub 138 each, phi 376,325, q/qb 451,500 each; A2: S/Sb 28,628 each,
  phi 43,819, q 313,064, qb 100,649).
- **Labels**: `DEFAULT_LABELS` (module) == `labels.json` (files), 155/155.
- **Regeneration sample** (seed 20260820, distinct from step 10): 3 random
  entries per species with order > 4, i.e. 30 entries, recomputed via LiE
  with sub-entries from the store — 30/30 byte-identical, including
  orders up to 44 (A1/q) and 42 (A2/q, A1/phi): the R9 semantics holds at
  the top of the imported range, not just at the step-10 sampled orders.
- **LieCache**: exhaustive 16,133/16,133 key→value identical.

## Interpretation

The A2 store now contains everything the step-13 integration needs — the
full character tables AND the warm LieCache — in one 1.1 GB file; A1 rides
along at 644 MB. The registry embedded in the module makes any other group
usable immediately through generation-on-miss (with per-group bulk import
available when the group's tables are worth materializing). Step 13 backs
`fastmatch` with these stores and must reproduce the 101/101 baseline replay
byte-identically; the qb37 truncation is a live reminder of why the miss
path must stay first-class even for "imported" groups.
