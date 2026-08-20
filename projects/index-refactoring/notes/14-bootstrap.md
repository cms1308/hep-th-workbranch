# 14 — Bootstrap + portability: the store generates its data from nothing

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/10-semantics-lock.md (R9 recursion), notes/11-store-module.md (R10), notes/12-import.md (R11), notes/13-integration.md (R12)*

## Goal

Demonstrate the three paths the step-13 baseline replay could not exercise,
per the plan's verify criteria: (i) an EMPTY-store replay of baseline lines
(line 0 and the flip-heavy line 100) with outcome equality vs the step-5
records, 100% agreement on tensor-cache keys overlapping the 16,133 imports,
and byte-identity of every generated char_decomp row against the Dropbox A2
tables; (ii) cross-group generation on C2 (no imported bulk data) matching
both the stored Dropbox C2 tables and live LiE; (iii) a portability run from
a fresh directory holding only the code packages and an empty store — no
Dropbox symlink, no MySQL, no warm cache — completing with the expected
outcome record.

**Scope interpretation, recorded before running:** the plan's "no Wolfram"
applies to the character-store subsystem. The store's generation path is
proven Wolfram-free (and FORM-free) in part (ii) by running under a PATH
that contains `lie` but neither `wolframscript` nor `form`. The pipeline as
a whole still shells out to `wolframscript` for charge determination (scope
(a), untouched by this project) and for index post-processing (kept for
byte-identity by the signed-off step-8 decision, R8), and to `form` for the
PE expansion — so the portability run (iii) uses those tools from PATH while
proving that no Dropbox tables, no MySQL, and no pre-seeded character data
are needed. The pymysql stub in the portable directory stands in for the
RESULTS database only (Theories/Failures/FreeSector INSERT recording), which
by the extension scope stays in MariaDB; character data touches no DB server.

## Setup

Harness `calc/14_bootstrap.py`, work dir `calc/work14/`:

- `setup`: `landscape_A2_v2.py` copied verbatim from work08 (same module
  bytes as steps 8/13), the pymysql stub, NO arxiv symlink, NO warm
  liecache, no store file — the store auto-creates empty on first wiring.
- `replay --lines 0,100`: the step-13 replay loop with
  `V2_CHARSTORE=work14/charstore_A2_empty.sqlite`; per line it records the
  outcome, wall-clock, and the store's row-count deltas.
- `verify-replay`: outcome byte-identity vs step-5, scan flags, the
  empty-start check (every char_decomp row has source='generated'), the
  tensor-cache overlap comparison against `work05/liecache.sqlite`, and the
  byte-comparison of every generated char_decomp row against
  `arxiv/A2/<species>/<species><order>.txt`.
- `crossgroup --max-order 5`: sets `PATH=/opt/local/bin:/usr/bin:/bin`
  (asserts `lie` present, `wolframscript` and `form` absent), builds
  `charstore_C2.sqlite` from nothing, and for all 11 C2 species × all keys
  of orders 1–5 (198 keys = 11 × Σ_{n≤5} p(n)) compares three values:
  the store's generated entry, the Dropbox C2 table entry (only the small
  low-order files materialize), and a DIRECT one-shot LiE evaluation of
  $\prod_k \mathrm{Adams}(k,\mathrm{rep})^{m_k}$ as a left-nested `tensor`
  fold — a different evaluation order than the arxivGen recursion.
- `portability --line 0`: builds `work14/portable/` containing only
  `refactor/*.py`, `store/*.py`, the module copy (its overlay's two
  project-path references rewritten to the portable dir — asserted exactly
  2 occurrences), the pymysql stub, a generated runner, and the input line;
  runs the line in a fresh subprocess whose runner asserts every import
  (pymysql, refactor, store) resolves inside the portable dir and that no
  `arxiv` exists, then compares the outcome record to step-5.

## Derivation

Engineering step — no algebra. The one cost estimate that needed data: the
STATE.md cost note feared "tens of minutes" for an empty-store line 0; the
measured cone is far smaller (64 table keys for line 0, 1,460 more for
line 100), because a single theory at t_order 9 touches only the Adams keys
its own field content produces, not the whole order range of the bulk
tables.

## Result

$$\boxed{\text{The store bootstraps from zero: cold generation reproduces outcomes, cache values, and table entries byte-identically — on A2 (empty-store replay), on C2 (no imported data, LiE-only PATH), and from a self-contained directory.}}$$

## Verification

All three verify criteria pass:

- **(i) empty-store replay** (`replay` + `verify-replay` PASS): lines 0 and
  100 outcome records **byte-identical to step-5**; 2 index scans, 0 flags;
  store confirmed to start empty (0 non-generated rows). Line 0: 22.3 s,
  64 table rows generated, 373 tensor-cache entries; line 100 (flip-heavy):
  139.1 s, +1,460 table rows, +14,674 tensor-cache entries. Overlap check:
  **all 15,047 computed tensor_cache keys are among the 16,133 step-5
  imports, 0 value mismatches** (100% agreement on every overlapping key —
  the regenerated LiE chains reproduce the old cache exactly). Table check:
  **all 1,524 generated char_decomp rows byte-match the Dropbox A2 tables**
  (42 species/order files, orders spanning the theories' full cone). Legacy
  sources untouched (no arxiv symlink; legacy LieCache 0 rows).
- **(ii) cross-group C2** (`crossgroup` PASS): **198/198 keys** (11 species
  × orders 1–5, exhaustive) with generated value = Dropbox C2 table entry =
  direct one-shot LiE evaluation, all byte-identical; 38 s, 396 LiE calls,
  under the restricted PATH with **no wolframscript and no form** —
  machine-checked proof that the store subsystem needs only Python + LiE.
- **(iii) portability** (`portability` PASS): fresh
  `work14/portable/` (code packages + module copy + stub + empty store,
  no Dropbox, no MySQL, no warm cache); runner subprocess asserts all
  imports resolve inside the directory; line 0 completes in 22.0 s with
  the **outcome record identical to step-5**, generating its 64 table rows
  and 373 cache entries on the fly (74 LiE calls; 74 generation events vs
  64 unique rows = concurrent threads generating overlapping cone keys,
  deduplicated by INSERT OR IGNORE as designed in R10).

Cost record (STATE.md asked for measurement): empty-store cold cost is
**minutes, not tens of minutes** — line 0 cold (22.3 s) is comparable to its
step-5 warm time (24.7 s); line 100 cold is 139.1 s vs 69 s in the step-13
warm-store replay and 202 s in the old pipeline warm (R6). Generation-on-miss
is therefore viable even with no seeding; bulk import remains the
recommended seeding where the tables exist, purely to avoid the first-run
cost.

## Interpretation

All four extension success criteria of PROJECT.md are now demonstrated:
generation reproduces stored entries byte-identically (R9, R11, and now
cold from empty); the 101-line baseline replay is byte-identical reading
only the store (R12); empty-store bootstrap and a no-table group (C2) work
(this step); and the portability run needs no Dropbox, no MySQL, and no
pre-seeded data (this step, with the Wolfram scope interpretation recorded
above). What remains is step 15: the deliverable README (schema, V2_CHARSTORE
wiring, import tool, bootstrap behavior and limits) and the extension
summary note for user sign-off.
