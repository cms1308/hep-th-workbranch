# 15 — Extension summary: the generation-on-miss character store

*Date: 2026-08-20 · wiki pages used: — (synthesis) · references: notes/10-semantics-lock.md, notes/11-store-module.md, notes/12-import.md, notes/13-integration.md, notes/14-bootstrap.md; scope in PROJECT.md (extension, 2026-08-19)*

## Goal

Close extension steps 10–15 with the deliverable documentation and a
summary the user can sign off: what was built, what was proven, and what
the extension deliberately did not change.

## Setup

Scope (PROJECT.md amendment, user 2026-08-19): unify the two precomputed
character data sets — the `arxiv/<GROUP><RANK>/` table files (~69 GB
logical across 26 groups, mostly Dropbox online-only placeholders) and the
16,133-entry MySQL `LieCache` — into one self-bootstrapping sqlite file per
group that computes a missing key on the spot via LiE (the `arxivGen 2.py`
recursion) and persists it. Requirement: the code runs externally with only
Python + LiE for character data; integration target `refactor/` only; the
results DB stays in MariaDB, untouched. Motivation is
portability/operations, not speed (notes/09 §6.5): previously another
machine needed the group's tables (up to ~26 GB) plus a localhost MariaDB,
and any key outside the pregenerated orders crashed the run.

## Derivation

What was built, step by step:

1. **Semantics lock (step 10, R9).** The arxivGen recursion — pure top
   Adams key → `Adams(N, rep, G)`, else split off the first nonzero Adams
   factor and `tensor` two strictly-lower-order entries — implemented
   standalone with LiE subprocess calls only, reproduced existing table
   entries byte-identically: 107/107 across all 10 A1/A2 group×species
   pairs, orders 1–14 and 32, including 68 negative-multiplicity and 19
   `+-1X` entries. LiE invocation conventions locked: per-process banner
   sentinel for the `[53:]` slice, `maxnodes`/`maxobjects 9999999`
   preamble, grow-maxobjects retry, process-group kill.
2. **Store module (step 11, R10).** `store/charstore.py`: one WAL sqlite
   file with `char_decomp` + `tensor_cache` (the pipeline's existing
   sha256 keys — warm caches stay valid) + `rep_registry` (labels never
   guessed; unregistered species fail loudly). `decomp()` on a miss runs
   the R9 recursion and persists exactly its cone. 10/10 unit tests
   including cold generation vs Dropbox ground truth, retry exhaustion,
   and thread/process hammers with zero loss.
3. **Import + cross-verification (step 12, R11).** Per-group import tool;
   A1 (1,279,601 entries) and A2 (514,788 + the full 16,133-entry
   LieCache) imported with every check exact: counts == source, 30/30
   regeneration sample byte-identical up to order 44, LieCache
   16,133/16,133 exhaustive. Registry seeded for ALL 26 groups from the
   order-1 table files (155 labels, embedded as `DEFAULT_LABELS`).
4. **Integration (step 13, R12).** One switch in `refactor/glue.py`:
   `V2_CHARSTORE=<file>` wires the store as BOTH the tables object and the
   LieCache replacement; unset leaves the original wiring byte-untouched.
   Full 101-line baseline replay with the store as the ONLY character
   source: 101/101 outcome records byte-identical to step-5, 0 scan
   flags, 0 generated rows, performance-neutral (36.7 min vs step-5's
   46 min). CharStore hardened fork-safe for Pool workers.
5. **Bootstrap + portability (step 14, R13).** (i) EMPTY-store replay of
   lines 0/100: outcomes byte-identical; all 15,047 cold-computed
   tensor-cache keys agree with the imports (0 mismatches); all 1,524
   generated table rows byte-match the Dropbox tables. (ii) C2 — a group
   with NO imported data — 198/198 keys equal to the stored tables AND an
   independent one-shot LiE evaluation, under a PATH with no wolframscript
   and no form. (iii) A self-contained directory (code packages + module
   copy + pymysql stub + empty store; no Dropbox, no MySQL, no warm cache)
   runs a baseline line end-to-end with the step-5 outcome record.
6. **Deliverable docs (this step).** `store/README.md`: schema,
   integration, import tool, generation-on-miss behavior, limits, measured
   bootstrap costs.

Deliverables: `store/` (module + README), the `V2_CHARSTORE` switch in
`refactor/glue.py`, the import tool `calc/12_import.py`, and the per-group
store files `calc/work12/charstore_A1.sqlite` / `charstore_A2.sqlite`.

## Result

All four extension success criteria of PROJECT.md hold: byte-identical generation, byte-identical store-only baseline replay, empty-store and no-table-group bootstrap, and a portability run with no Dropbox, no MySQL, and no pre-seeded character data.

## Verification

Every claim above carries its machine check in the per-step notes: 10
(107/107), 11 (10/10), 12 (counts exact + 30/30 + 16,133/16,133), 13
(101/101, 0 flags, 0 generated rows), 14 (outcomes identical +
15,047/15,047 overlap + 1,524/1,524 tables + 198/198 C2 + portability
PASS). Verify criterion for this step: user sign-off.

One scope interpretation is on record (notes/14): the plan's "no Wolfram"
is demonstrated for the character-store subsystem (step 14(ii) runs with no
wolframscript on PATH); the pipeline as a whole still uses wolframscript
for charge determination (scope (a), untouched) and index post-processing
(kept for byte-identity, R8), and `form` for the PE expansion. The pymysql
stub in harness/portable runs stands in for the RESULTS database only,
which stays MariaDB by scope.

## Interpretation

The extension's operational goal is met: character data is now one
auto-created sqlite file per group, valid warm from the existing caches,
correct cold from nothing, and the hard edge (a key outside the
pregenerated orders crashes the run) is gone. Production adoption =
`refactor/README.md` integration + `V2_CHARSTORE` pointing at a per-group
store file, seeded by import where the tables exist. Remaining follow-up
work items recorded in STATE.md (user list 2026-08-19, all within this
project as further extensions): tform, persistent lie REPL, persistent
Wolfram kernel, Python post-processing, pure-Python singlet arithmetic,
staged lower-order pre-filter.
