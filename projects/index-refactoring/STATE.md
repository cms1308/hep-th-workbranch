# STATE — index-refactoring

## Status

EXTENSION in progress — steps 10-15: generation-on-miss character store
(scope amendment in PROJECT.md, user 2026-08-19: the project includes the
infrastructure/speed work items that came out of the core, folded back in
rather than split off). Core steps 1-9 COMPLETE with user sign-off
2026-08-19 (notes/09-summary.md): physics verified correct and anchored
to the su(2,2|1) derivation (one typo found in 1708.08307's appendix),
defects F1-F5 + C1' resolved, `refactor/` pipeline 101/101
byte-identical on the baseline, 3.5x on the flip-heavy line. Extension:
steps 10-14 done — semantics lock (R9, 107/107), store module (R10,
10/10 unit tests), import (R11: A1/A2 + LieCache + registry for all 26
groups, every check exact), integration (R12: store-only 101-line replay
byte-identical, 0 flags, performance-neutral), bootstrap + portability
(R13: empty-store replay of lines 0/100 byte-identical with 100% cache
overlap agreement, C2 generation 198/198 vs Dropbox + live LiE on a
LiE-only PATH, self-contained portability run identical). Extension
CLOSED with user sign-off 2026-08-20 (notes/15-summary.md +
store/README.md). SECOND EXTENSION in progress — speed follow-ups,
steps 16-21 (scope in PROJECT.md). Steps 16-17 done: tform (R14:
byte-identical, gains only on the flip-heavy line, x1.33-1.39 of the
FORM stage there) and persistent lie REPL (R15: byte-identical
end-to-end, x1.14-1.18 on cold empty-store runs, inert on warm lines).
Steps 18 and 21 done: persistent Wolfram kernel (R16:
byte-identical on the full baseline, x1.14 overall) and the low-order
consistency prefilter (R17: 17/17 baseline rejections caught, accepted
set unchanged byte-identically; pays off above ~25-30% rejection rate
and on heavy theories). tform re-benched on FORM-stress theories at the
user's question — x1.4-1.6 at 9.7 MB, >= x3-4 + 600-s-timeout rescue at
585 MB (R14 addendum). Steps 19/20 (Python post-processing / pure-Python
singlet arithmetic) have ~no speed value after step 18 (Mathematica
compute = 2.5% of wall, FORM = 93%) — portability-only items, AWAITING
USER DECISION (decline recommended unless portability wanted) — last
updated 2026-08-20

## Plan

- [x] 1. Pipeline map: reconstruct the full data flow of the index pipeline (b)+(c) —
      fugacity encoding, FORM PE expansion, character substitution via LiE,
      Mathematica post-processing — and trace one toy example (single free chiral,
      trivial gauge charge) through every stage by hand. — verify: note documents each
      stage's exact input/output format with line references; toy example's index
      matches the analytic PE of a free chiral. PASSED 11/11 checks
      (calc/01_toy_trace.py). (→ notes/01-pipeline-map.md)
- [x] 2. Audit consistency checks: map every condition in `generate_index_mcode`
      (scalar positivity below $t^6$, spinor conditions, y-power bounds) to the stated
      prescription in 2408.02953/1806.08353 (read from LaTeX source). — verify: a
      condition-by-condition table paper ↔ code line; every mismatch listed with a
      minimal example, none silently fixed. DONE: C1/C2 faithfully implemented;
      findings F1-F4 (calc/02_consistency_audit.py, 7/7 as analyzed).
      (→ notes/02-consistency-audit.md)
- [x] 3. Audit operator extraction: decoupled ($t\le2$), fliped ($t<4$), relevant
      ($t<6$), marginal ($t^6$) thresholds, the F-term substitution (`wcond2`/`wcond3`),
      and the flip/recursion logic in `decouple`→`charges2`. — verify: same
      condition-by-condition table; thresholds tied to R-charge bounds in the papers.
      DONE: all thresholds and mechanisms match the paper; no new defects; 5/5
      (calc/03_extraction_audit.py). (→ notes/03-extraction-audit.md)
- [x] 4. Implementation-defect audit of (b): numeric encoding round-off in
      `single`/`match` (int truncation vs ROUND_HALF_UP), `rep_structure` extraction
      from sympy AST (`.args[-1].args` poking; multi-symbol same-letter terms), FORM
      output parsing (`result[:-1]`, string surgery), eval usage. — verify: each
      suspected defect either reproduced by a minimal failing input or explicitly
      cleared; findings reported to user before any fix. DONE: encoding,
      rep_structure, maxobjects-retry, cache-degradation all CLEARED; fragility
      list confirmed; 4/4 (calc/04_defect_audit.py). (→ notes/04-defect-audit.md)
- [x] 5. Regression harness (spec fixed by user 2026-08-12): replay the
      superpotentials from `refs/SU3s1S1nf2.txt` (101 lines; inconsistent theories
      mixed in) through the unmodified pipeline and check that
      `refs/SU3s1S1nf2_true.txt` (82 lines; the correct set) is reproduced —
      i.e. the pipeline, run fresh, must keep exactly the true entries and reject
      the rest. Character tables: use
      `/Users/cms1308/Library/CloudStorage/Dropbox/shared folder/classification/arxiv`
      directly (read-only; wire via cwd layout or symlink `arxiv/` → there).
      Theory: SU(3) w/ 2 flavors + S + Sb ⇒ GROUP="A", RANK="2", NC=3,
      GROUP_RANK="A2". Also spot-check stored A2 tables vs live LiE
      (singlet-first, key spacing). — verify: per-superpotential comparison of
      parsed result dicts (a, c, R-charges, consistency, relevant/marginal, index
      strings) against the matching _true line, modulo documented formatting
      normalization; discrepancy list empty or explained. DONE: 82/82 exact
      (byte-identical, zero numeric noise); 17/19 extras rejected as
      "inconsistent"; 2 extras survive all implemented checks = finding F5
      (reported, not fixed); A2 tables spot-checked 15/15 vs live LiE;
      singlet-first verified on 1466 terms. (→ notes/05-regression-harness.md)
- [x] 6. Profile the pipeline on baseline inputs: time per stage (FORM, per-term sympy
      eval, LiE subprocess chains + cache hit rate, wolframscript startup +
      post-processing). — verify: recorded per-stage wall-clock breakdown on named
      benchmark inputs. DONE: 6 runs (lines 0/23/77/100 × cold/warm) via PATH
      shims + instrumented stub; FORM@9 ≈ 65% of typical lines, sympy match
      dominates flip-heavy lines (140 s at 100% cache hit), LiE ≈ 21 s only
      when cold, wolframscript ≈ 4 s/theory fixed tax. (→ notes/06-profiling.md)
- [x] 7. Independent derivation of the index consistency conditions (user
      2026-08-12: do NOT trust the stated conditions in 2408.02953 OR in
      Evtikhiev-Rocek 1708.08307 — both may contain typos; prove them here from
      the papers' idea). Content: enumerate every 4d $\mathcal N=1$ short/
      semi-short superconformal multiplet's contribution to the reduced index
      $(1-t^3y)(1-t^3/y)(\mathcal I - 1)$ — which $(E, j)$ term, which sign —
      from the multiplet index formulas (Dolan-Osborn multiplet list; the
      recombination rules); then derive from scratch (i) the unitarity-allowed
      region = C1/C2 ranges and signs, (ii) the higher-spin-current statement
      = C3 term, sign, and $j$ range (input: a spin-$(j{+}1)$ conserved current
      sits in a specific short multiplet; higher-spin current ⇒ free sector,
      Maldacena-Zhiboedov). Cross-checks, all machine-verified in calc/:
      (a) free chiral and free vector multiplet indices computed exactly (sympy
      PE, and through the pipeline) must realize the derived C3 signal, with the
      derived sign, at $t^{6+2j}\chi_j$; (b) known-good interacting entries from
      SU3s1S1nf2_true.txt must sit strictly inside the derived allowed region;
      (c) compare the derived conditions against BOTH papers' statements and
      record any typo found, with the corrected form. — verify: derivation note
      reproduces C1/C2 as implemented (already validated against the landscape
      in steps 2-3) and fixes the exact form of C3; every multiplet contribution
      checked against an explicit character computation in calc/.
      DONE 2026-08-17: bounds + shortening from level-1/2 Gram matrices
      (U(1)_R coefficient fixed by super-Jacobi, not quoted); contribution
      table {B1b, A2b, A1b, L} verified three ways; C1/C1'/C2/C3/C4
      derived; free chiral/vector/hyper PE + pipeline front-end
      cross-checks; 82 true entries strictly inside the region; both
      papers' main-text statements confirmed typo-free, one typo found in
      1708.08307's appendix Hhat formula. 50/50 machine checks. Table
      corrected 2026-08-18 (user review): left-saturated A1B1b free fields
      carry an extra EOM residual term — see R7.
      Plan deviation: the free CHIRAL cannot realize the j>=1 C3 signal
      (no (j,0), Delta=2+j, R=2j/3 operator exists there); the free
      vector realizes it at j=3/2 (+t^9 chi_3/2, primary lambda_(a F_bc))
      — cross-check (a) adjusted accordingly.
      (→ notes/07-consistency-conditions.md)
- [x] 8. Refactor + optimize (b)+(c); implement F1 (proven C3 form incl. C1'
      boundary), F2 (C4), harden F3/F4; routing per user decisions
      (InconsistentIndex / FreeSector / SUSYenhanced). — verify: regression
      101/101 outcome records byte-identical to step-5; speedup measured
      per stage (same-load interleaved benches). DONE 2026-08-18, R8.
      (→ notes/08-refactor.md, refactor/, calc/08_refactor.py + work08/)
- [x] 9. Final write-up: findings (physics-correctness verdict + defect list +
      derived consistency conditions incl. any paper typos found) and
      before/after performance. — verify: user sign-off. DONE — report
      notes/09-summary.md (2026-08-19); USER SIGN-OFF 2026-08-19.

Extension: generation-on-miss character store (scope in PROJECT.md):

- [x] 10. Semantics lock: implement the on-miss recursion (Adams base case +
      lower-order tensor split, per `arxivGen 2.py`) standalone and reproduce
      EXISTING table entries with it. — verify: byte-identity on a ≥50-entry
      sample across species/orders incl. negative-multiplicity and `+-1X`
      entries. DONE 2026-08-19: 107/107 (67 step + 39 cone + phi32 spot), R9.
      (→ notes/10-semantics-lock.md, calc/10_semantics_lock.py)
- [x] 11. Store module: single-sqlite (WAL) store — char_decomp +
      tensor_cache (existing sha256 keys) + rep_registry, generation-on-miss
      via LiE, thread/Pool-safe. — verify: unit tests incl. cold generation
      vs Dropbox ground truth, maxobjects retry, concurrency hammers,
      auto-creation. DONE 2026-08-19: 10/10, R10.
      (→ notes/11-store-module.md, store/, calc/11_store_module.py)
- [x] 12. Import + cross-verification: per-group import (A1/A2 now, tool
      takes --group), registry for ALL 26 groups, LieCache. — verify:
      counts == source, registry == order-1 files, regen sample
      byte-identical, LieCache exhaustive. DONE 2026-08-19: all exact
      (A1 1,279,601 + A2 514,788 keys; 155 labels; 30/30 regen incl.
      order 44; 16,133/16,133), R11.
      (→ notes/12-import.md, calc/12_import.py, calc/work12/)
- [x] 13. Integration with refactor/: store wired via V2_CHARSTORE switch
      in glue.py (default path untouched); fork-safety added to CharStore.
      — verify: 101-line replay byte-identical, scans unchanged, no legacy
      source consulted. DONE 2026-08-20: 101/101 identical, 0 flags,
      0 generated rows, tensor_cache exactly the 16,133 imports, R12.
      (→ notes/13-integration.md, calc/13_integration.py, calc/work13/)
- [x] 14. Bootstrap + portability demonstration: (i) EMPTY-store replay of
      selected baseline lines (incl. line 0 and one flip-heavy line) — same
      outcomes; computed tensor-cache values must agree with the imported
      16,133 entries on every overlapping key; (ii) cross-group generation:
      on a group whose bulk data is NOT imported (e.g. C2), generate store
      entries for low-order keys and check byte-identity against the
      STORED Dropbox C2 tables (and live LiE); (iii) fresh
      directory with only code + empty store, no Dropbox symlink, no MySQL,
      no Wolfram — pipeline runs. — verify: (i) outcome equality + 100%
      agreement on overlapping cache keys; (ii) C2 sample matches live LiE;
      (iii) portability run completes with the expected outcome record.
      DONE 2026-08-20: all three PASS, R13 (Wolfram scope interpretation
      recorded in the note). (→ notes/14-bootstrap.md,
      calc/14_bootstrap.py, calc/work14/)
- [x] 15. Extension write-up + deliverable docs: store README (schema,
      integration, import, bootstrap behavior, limits), summary note. —
      verify: user sign-off. DONE — store/README.md + notes/15-summary.md;
      USER SIGN-OFF 2026-08-20.

Second extension: speed follow-ups (scope in PROJECT.md, user order
2026-08-19, sign-off to proceed 2026-08-20). Every item opt-in behind an
env switch, default path byte-untouched; byte-identity + interleaved
bench per item:

- [x] 16. tform (parallel FORM): V2_TFORM=<workers> switch in
      refactor/glue.py rebinding form() to `tform -w<N> -q`. — verify:
      form-output files byte-identical to `form` on lines 0/23/77/100 ×
      t_order 3/9; subset replay (same 4 lines) outcome records
      byte-identical to step-5; interleaved same-load bench of the FORM
      stage and per-line wall clock. DONE 2026-08-20: 8/8 byte-identical,
      4/4 replay identical, R14. (→ notes/16-tform.md, calc/16_tform.py,
      calc/work16/)
- [x] 17. Persistent lie REPL: long-lived LiE process(es) replacing
      per-call spawns in store/charstore.py and refactor/fastmatch.py,
      sentinel-framed I/O, timeout kill + respawn. — verify: outputs
      identical to subprocess mode on a large call sample incl. the
      maxobjects-retry path; empty-store line-100 replay byte-identical;
      measured spawn-overhead recovery (~50 s cold on the heaviest line).
      DONE 2026-08-20: 33/33 raw + 198/198 C2 + retry parity, 4/4 cold
      replays identical, x1.14-1.18 cold, R15. (→ notes/17-liepool.md,
      store/liepool.py, calc/17_liepool.py, calc/work17/)
- [x] 18. Persistent Wolfram kernel (~4 s/theory fixed cost; needs (d)
      pool changes, byte-identity risk per R8). — verify: design pass
      first; 101-line replay byte-identical; measured recovery.
      DONE 2026-08-20 (user decisions: full 3-call coverage incl.
      FindCharges patch; per-worker kernels licensed): smoke 4/4,
      bench 17/17 identical (2.4-3.1 s/theory saved), full replay
      101/101 identical in 32.2 min (vs 36.7), R16.
      (→ notes/18-wolfram.md, refactor/wolframpool.py,
      calc/18_wolfram.py, calc/work18/)
- [ ] 19. Python post-processing replacing Mathematica. Blocker to clear
      first: InputForm/dedup byte-identity (dedup compares 'index'
      STRINGS). — verify: result dicts byte-identical on the 101-line
      baseline, or blocker documented and item declined.
- [ ] 20. Pure-Python singlet arithmetic replacing lie. — verify: singlet
      multiplicities equal LiE's on the full tensor_cache + a generation
      sample; replay byte-identical; bench vs step-17 baseline.
- [x] 21. Staged lower-order pre-filter for early inconsistency
      rejection. — verify: design pass first (semantics could shift —
      user decision needed on any change to the accepted set); baseline
      outcome records unchanged; measured rejection-time saving.
      DONE 2026-08-20 (user decision: low-order records for rejected
      theories OK): V2_PREFILTER=6 — 17/17 baseline rejections caught,
      0 false positives, accepted set unchanged with 84/84 records
      byte-identical, guard test PASS; below break-even on this
      baseline (17% rejection; break-even ~25-30%), R17.
      (→ notes/21-prefilter.md, calc/21_prefilter.py, calc/work21/)

## Established results

- **(R1)** The index pipeline (FORM PE → match/LiE singlet projection →
  Mathematica post-processing) is fully mapped with per-stage I/O formats and
  reproduces the analytic PE on gauge-singlet toys at every stage: decoupling branch
  (free chiral at $r=2/3$ → decoupled `[X1]`), relevant/fliped extraction
  ($r=0.8$, order 3), and the unitarity-inconsistency verdict ($r=0.8$, order 5,
  from the $-X_1^{-1}t^{3.6}$ fermion term). 11/11 checks — verified by
  calc/01_toy_trace.py against hand-computed PE [notes/01-pipeline-map.md]
- **(R1a)** Two mechanism facts needed by later steps, established in the trace:
  the `1.0*` at line 482 is load-bearing (Float coefficient makes the
  `.args[-1].args` character-exponent extraction work); `Index()` strips all spaces
  before `ast.literal_eval`, so result keys are `fullindex` /
  `non-manifestsymmetry` (not "full index") [notes/01-pipeline-map.md]
- **(R2)** The consistency verdict logic implements paper conditions C1/C2
  (unitarity-violating terms in the reduced index) faithfully, resolved per
  $U(1)$-flavor charge; conditions C3 (higher-spin free-field signal at
  $t^{6+2j}$) and C4 (vanishing index = SUSY breaking) are NOT implemented.
  Findings: F1 = C3 gap (free-field candidates pass as consistent); F2 = C4 gap
  (vanishing index crashes `Index()` → misrouted to error log); F3 =
  `extractScalar` non-iterative character peel corrupts any content with top
  $y$-power ≥ 3 (latent below $t^9$); F4 = coefficient rounding relies on
  `match()`'s `1.0*` Float convention. All demonstrated end-to-end — verified by
  calc/02_consistency_audit.py (7/7) [notes/02-consistency-audit.md]
- **(R3)** Operator extraction implements the paper's deformation procedure
  exactly: decoupled $E\le2$ / fliped $E<4$ / relevant $0<E<6$ / marginal $E=6$
  thresholds = the R-charge bounds; `wcond2` F-term substitution reproduces the
  chiral-ring counting (F-term-eaten operators drop from `relevant`; one
  combination removed per F-term). KEY MECHANISM: consistency checks and `dim3`
  act on `index2` = reduced index with fictitious per-field fugacities → 1
  (true $U(1)$ fugacities `g_i` kept), so F-term-paired terms cancel numerically;
  the refined index is used only for operator identification — verified by
  calc/03_extraction_audit.py (5/5) [notes/03-extraction-audit.md]
- **(R4)** Scope-(b) internals audit: fugacity encoding (base-5000 positional
  expansion, worst round-trip error $3\times10^{-12}$), `rep_structure` Adams-key
  assembly (absolute positions, iteration-order safe), the `maxobjects` retry
  parse (maxobjects prints no banner), and the LiE-cache degradation path are
  all CORRECT. Remaining defect list for the refactor: F1 (C3 gap), F2 (C4
  gap/crash), F3 (`extractScalar` peel), F4 (Round binding), + format-coupling
  fragilities (FORM stdout surgery, `[53:]` banner slice, eval on tool output,
  `1.0*` convention) — verified by calc/04_defect_audit.py (4/4)
  [notes/04-defect-audit.md]

## Established results (continued)

- **(R5)** Regression (step 5, calc/05_regression.py + calc/work05/): the
  unmodified pipeline on this machine reproduces the old run EXACTLY —
  82/82 true entries byte-identical in every field (a, c to 30 digits,
  R-charges, global charge bases, index strings, dim3, operator lists).
  17/19 curated-out entries are rejected by the C1/C2 index check
  ("inconsistent"). Character tables (Dropbox A2) spot-checked 15/15
  against live LiE incl. negative Adams multiplicities; singlet-first
  assumption verified on 1466 singlet terms. DB fully stubbed (LiE cache →
  local sqlite, 16133 memoized tensor steps; all result INSERTs recorded to
  jsonl, none executed). Replay: 46 min total, mean 27 s/theory.
- **(F5, RESOLVED — user 2026-08-13)** 2 curated-out entries pass every
  implemented check and reproduce their old-run lines byte-identically:
  `['M1*q2*qb1','M1^2','M2*q1*qb2']` (R(M1)=1 exactly — M1² is a mass term)
  and `['M1*q2*qb1','M1*S1*Sb1','M2*q1*qb2']` (R(M1)≈0.875). User: these were
  hand-deleted from the true file because they descended from theories later
  found inconsistent — confirmed in data: their old-run parents (append-last
  order) are `['M1*q2*qb1','M1^2']` and `['M1*q2*qb1','M1*S1*Sb1']`, both
  among the 17 rejected. Step 5 = PASS. Carried to step 8: closure analysis
  shows both are ALSO queued by the true-set (consistent) entry
  `['M1*q2*qb1','M2*q1*qb2']` (relevant list contains `M1^2`, `M1*S1*Sb1`),
  so a fresh full enumeration would regenerate them — re-enumeration needs
  either acceptance or an exclusion rule (line 77 is a redundant description:
  massive M1 integrates out).

- **(R6)** Profiling (step 6, calc/06_profiling.py + calc/work06/): on a
  typical theory (~24 s) FORM order-9 PE expansion is ~65% (15–17 s),
  wolframscript a fixed ~1.2 s × 3 calls, decouple ~1.7 s; on the heaviest
  line (7 terms, 10 fields; 202 s warm) the Index-phase Mathcode/sympy term
  decode is 140 s WITH 100% cache hits and zero lie calls — sympy `eval`+
  `subs` decoding is the flip-heavy bottleneck, not LiE. Cold-cache LiE cost
  ≈ 21 s measured (15k calls) on that line, 90–96% hit rate even cold from
  within-run repeats; sqlite cache fully replaces MySQL. Refactor leverage
  order: (1) structured FORM-output parsing replacing per-term sympy
  eval/subs, (2) FORM-stage order bookkeeping, (3) keep LiE+cache design,
  (4) persistent Wolfram kernel or Python post-processing (~4 s/theory),
  (5) one shared pool instead of 2 spawns/theory. [notes/06-profiling.md]

- **(R7)** Independent derivation of the index consistency conditions
  (step 7, calc/07_*.py, 52/52 checks; notes/07-consistency-conditions.md).
  Conventions: $j_1=\bar\jmath$ (dotted), $j_2=j$ = the $\chi_j(y)$ spin;
  $\delta=\Delta-2\bar\jmath_3-\tfrac32R$. From su(2,2|1) Gram matrices
  (level 1: branches $2\Delta-3R+4\bar\jmath$ / $2\Delta-3R-4\bar\jmath-4$;
  level 2: $(2\Delta-3R)(2\Delta-3R-4)$; $U(1)_R$ coefficient in $\{Q,S\}$
  fixed by super-Jacobi): types $X\bar B_1/X\bar A_2/X\bar A_1/X\bar L$
  ($X$ = any unbarred type) contribute $(-1)^{2j}t^{3R}\chi_j$ /
  $(-1)^{2j+1}t^{6+3R}\chi_j$ /
  $(-1)^{2j+2\bar\jmath+1}t^{6+3R+6\bar\jmath}\chi_j$ / $0$, independent of
  $X$ with ONE exception (user finding 2026-08-18): left-saturated
  $A_1\bar B_1[j,0,R]$ ($3R=2+2j$, free spinning chiral) adds the EOM
  residual $(-1)^{2j+1}t^{3R+3}\chi_{j-1/2}$ ($\chi_{-1/2}\equiv0$: none
  for the $j=0$ free scalar; e.g. $[\lambda]$: $-t^3\chi_{1/2}+t^6$) —
  because $\bar Q(Q\psi)_{j-1/2}=2(P\psi)_{j-1/2}$ has a $\delta=0$
  component when the primary is chiral; for $X\bar A_{1,2}$ the analogous
  states are $\epsilon$-contractions with $\delta=2$, so current multiplets
  stay single-term. Verified by on-shell letter enumeration
  ($\chi_{n/2}\chi_j-\chi_{(n-1)/2}\chi_{j-1/2}=\chi_{n/2+j}$), the
  free-vector $t^6=3$ closure, and Evtikhiev's own reference list — which
  also exposed a TYPO in 1708.08307's appendix general
  $\hat{\mathcal H}_{(j,\bar\jmath)}$ formula (printed exponent
  $2+(\bar\jmath+2j)/3$; correct $2+(2\bar\jmath+4j)/3$ = our
  $E=6+2j+4\bar\jmath$ mirrored). Main-text conditions of both papers:
  typo-free. Derived: **C1** ($E<2+2j$ forbidden), **C1'** (content
  at $E=2+2j$ exactly = free fields; $j\ge\tfrac12$ spinning case unchecked
  by the code — NEW gap, extends F1), **C2** (wrong sign in
  $2+2j\le E<6+2j$ forbidden once free fields are removed; sole unitary
  source = free antichiral scalar at $E=4$), **C3** (net $c>0$ of
  $(-1)^{2j+1}t^{6+2j}\chi_j$ $\iff$ $c$ current multiplets
  $A_1\bar A_2[j,0,\tfrac{2j}3]$ net of chiral $\bar B_1$ partners; $j=0$
  flavor currents, $j=\tfrac12$ extra supercurrents ($t^7(y{+}1/y)$,
  $\mathcal N\ge2$ or free), $j\ge1$ higher-spin current $\Rightarrow$ free
  sector via Maldacena-Zhiboedov input), **C4** (all $E\ge2$ $\Rightarrow$
  $\mathcal I=1+O(t^2)\ne0$ for any unitary SCFT). Realizations: free
  chiral $\mathcal I_{\rm red}=t^2-t^9\chi_{1/2}+t^{10}\chi_1+\dots$
  (pipeline front end reproduces it exactly to $t^9$); free vector
  $-t^3\chi_{1/2}+3t^6+t^9(\chi_{3/2}-\chi_{1/2})$ — C1' boundary, the
  C3 signal at $j=\tfrac32$, and the $t^6=3$ closure requiring the EOM
  residual; free hyper $+t^7\chi_{1/2}$. Comparison: derived conditions =
  2408.02953 §2.3 = 1708.08307 main-text sanity checks after convention
  translation (typo-free); one appendix typo in 1708.08307 as above.
  Extra observations:
  82/82 true entries strictly inside the region (t_order-9 truncation
  covers C2 for $j\le1$, C3 at $t^6,t^7,t^8$; $j=\tfrac32$ at the edge);
  per-flavor C2 strictly stronger than the net check (real case: line 90);
  the 101-line baseline predates the current C1/C2 enforcement (its 19
  curated-out lines are stored 'consistent' with violating indices);
  $t^6=\,$marginal$-$currents fails in free-sector-bearing theories
  (antichiral-branch multiplets like $[\bar\lambda]$ and free-field EOM
  residuals both add $+t^6$); NO usable condition exists from current
  multiplets with $\bar\jmath\ge\tfrac12$ (stress tensor and all $j\ge1$,
  $\bar\jmath\ge1$ higher-spin currents): their slots
  $E=6+2j+4\bar\jmath$ are degenerate with unsaturated $X\bar A_2$
  (integer $\bar\jmath$) or ordinary chirals (half-odd $\bar\jmath$) —
  window-edge uniqueness, hence C3, exists only at $\bar\jmath=0$
  (calc part E, user question 2026-08-18).

- **(R8)** Refactored index pipeline (step 8, notes/08-refactor.md;
  deliverable `refactor/` + 3 surgical charges2 patches, harness
  calc/08_refactor.py + work08/). (a) `fastmatch`: sympy/eval term decode
  replaced by an exact structured parser of FORM output (Fraction/Decimal;
  tables in memory; LieCache keys and chain order preserved — warm caches
  stay valid; threads only over cold LiE chains; MATCH_TIMEOUT per chain =
  old per-term unit). (b) Mathematica post-processing KEPT for
  byte-identity, with F3 fixed (iterative extractScalar peel) and F4 fixed
  (`b_?NumericQ` rounding pattern) — both output-preserving on the
  baseline, demonstrated corrupting/clean on synthetic y-top≥3 input.
  (c) C1'/C3/C4 scan on the net reduced index in Python: C3 j≥1 →
  "inconsistent (free sector: higher-spin current)" → InconsistentIndex;
  C4 (I≡1 within truncation, the old F2 crash input; I=0 impossible —
  PE constant term is 1) → "inconsistent (vanishing index: possible SUSY
  breaking)" → InconsistentIndex, no wolframscript; C1' (E=2+2j, j≥1/2
  chiral-sign content) after passing all else → "free sector" → NEW
  FreeSector table; C3 j=1/2 → Theories with SUSYenhanced filled. Every
  Index() call logs its scan to v2_scanlog.jsonl. (d) PROVEN: the t^9
  coefficient is exact at t_order=9 (encoding is linear/positive ⇒ any
  product with p≤9 has Σd0≤4500 and survives `t(: 4500)` at every Horner
  step) — so C3 at j=3/2 (t^9 χ_{3/2}) is checked with NO order raise;
  machine-checked by FORM order-9-vs-10 bucket equality (lines 0, 77).
  Verification: scanner unit tests 7/7 (free vector realizes C1'+C3 with
  R7 coefficients; free chiral clean); ab-match = every term equal on
  lines 0/23/77/100 × orders 3/9 (line 100: 177,124 terms, in-process
  decode 411 s → 15 s); ab-mcode = {old,new express}×{old,new mcode}
  result dicts identical; FULL REPLAY: 101/101 outcome records
  byte-identical to step-5 (⊃ 82/82 true exact, 17 rejected, F5 pair
  kept), 0 scan flags fired — the t^9 slot is clean on the whole
  baseline, closing R7's truncation-edge caveat. Speedup (heavy ambient
  load ~30, old/new interleaved): warm 1.15-1.19x on FORM-dominated
  typical lines, 3.5x on the flip-heavy line 100 (561→162 s; the replaced
  stage 140 s → ~13 s), cold 1.3-1.4x. Declined with rationale: FORM
  order bookkeeping (t^9 proof shows current truncation minimal-complete)
  and persistent Wolfram kernel (~4 s/theory fixed cost vs byte-identity
  risk; top remaining optimization).

## Established results (extension)

- **(R9)** The arxivGen recursion (pure top Adams key → `Adams(N, rep, G)`;
  else split off the first nonzero Adams factor and `tensor` two strictly
  lower-order entries), run per-key with LiE subprocess calls only — no
  Wolfram, no Frobenius enumeration — reproduces the stored A1/A2 table
  entries byte-identically after the established normalization ([53:]
  banner slice, strip, remove newlines+spaces): 107/107 sampled entries
  (67 step mode with stored sub-entries, 39 cone-mode members regenerated
  from LiE alone, 1 phi32 high-order spot check — the largest table,
  50 MB/8349 keys), covering all 10 group×species pairs, orders 1-14 and
  32, 68 negative-multiplicity and 19 `+-1X` entries. Rep labels read off
  order-1 tables (A1: U=Ub=[3], phi=[2], q=qb=[1]; A2: S=[2,0], Sb=[0,2],
  phi=[1,1], q=[1,0], qb=[0,1]). Retry policy fixed: maxnodes+maxobjects
  9999999 preamble, grow maxobjects on `(`/`line` in output (never fired
  on this low-rank sample; DOES fire at higher rank per user) — verified
  by calc/10_semantics_lock.py (deterministic seed 20260819, results in
  calc/work10/results.jsonl) [notes/10-semantics-lock.md]

- **(R10)** Deliverable `store/` package (`store/charstore.py`): one
  auto-created sqlite file (WAL, busy_timeout 60 s) with
  `char_decomp(group_rank, species, key_vec str(list), value, source)`,
  `tensor_cache(ckey, result)` on the EXISTING sha256 LieCache keys (no
  key translation for step-13 integration; warm imports valid), and
  `rep_registry` seeded with the R9 labels (unregistered species → loud
  CharStoreError, labels never guessed). `decomp()` on a miss runs the R9
  recursion and persists exactly its cone; LiE conventions verbatim R9
  (banner sentinel per process, maxobjects grow-retry, polynomial-regex
  validation before persist, process-group kill). API matches fastmatch
  (`decomp`, `cache_get`/`cache_put`); bulk import APIs in place for step
  12. Verified 10/10 unit tests (calc/11_store_module.py, work11): cold
  generation on empty stores == Dropbox ground truth (28 entries, all 10
  group×species pairs, 13 negative-multiplicity, 10 pure-Adams), memo +
  reopen-persistence, retry incl. exhaustion, banner/validation loud
  failures, 8×200 thread and 4×250 spawn-process hammers with zero loss
  and integrity_check ok [notes/11-store-module.md]

- **(R11)** Imported per-group stores (user decisions: A1/A2 now,
  per-group files): `calc/work12/charstore_A1.sqlite` (644 MB, 1,279,601
  entries) and `charstore_A2.sqlite` (1.1 GB, 514,788 entries + the full
  16,133-entry LieCache in tensor_cache), every verification exact —
  per-species counts == source, 30/30 regeneration sample (seed 20260820)
  byte-identical INCLUDING orders up to 44, LieCache 16,133/16,133
  exhaustive. Registry: 155 species labels for all 26 groups read off the
  order-1 table files (`work12/labels.json`) and embedded as
  DEFAULT_LABELS in store/charstore.py — any group bootstraps with no
  Dropbox access. Source-data findings: D3/q uses the JSON indent=4
  format (reader falls back); A2 qb37.txt is truncated (1,517 keys vs
  17,977 at qb36) and holds 313 duplicate keys, ALL with byte-identical
  values (zero differing-value conflicts across all of A2) — import
  success is judged on conflicts, not raw duplicates
  [notes/12-import.md]

- **(R12)** Store-backed pipeline verified: with `V2_CHARSTORE=<file>` set,
  `refactor/glue.py` wires a CharStore as BOTH the tables object and the
  LieCache replacement (one switch in Engine.__init__; unset = original
  wiring byte-untouched). Full 101-line baseline replay with the store as
  the ONLY character source (work13: no arxiv symlink, legacy LieCache
  table never created): 101/101 outcome records byte-identical to step-5,
  0 scan flags, 0 generated rows (all lookups served by the import),
  tensor_cache unchanged at 16,133 (all LiE chains warm). Timing
  36.7 min / mean 21.8 s / max 69 s (line 100) — performance-neutral vs
  step-5 (46 min, 27 s mean). CharStore hardened fork-safe (`_db()`
  reopens on pid change; os.fork check + step-11 suite 10/10 re-run).
  Harness false alarm recorded: the pymysql stub creates an EMPTY
  liecache.sqlite on every connect(), so "legacy cache unused" = the
  LieCache table has no rows, not file absence [notes/13-integration.md]

- **(R13)** Bootstrap + portability (step 14, calc/14_bootstrap.py +
  work14/, all three parts PASS; notes/14-bootstrap.md): (i) EMPTY-store
  replay of lines 0 and 100 — outcome records byte-identical to step-5,
  0 scan flags, store confirmed to start empty; ALL 15,047 computed
  tensor_cache keys lie among the 16,133 step-5 imports with 0 value
  mismatches (100% overlap agreement), and all 1,524 generated
  char_decomp rows byte-match the Dropbox A2 tables (42 species/order
  files). Cost measured FAR below the feared tens of minutes: line 0
  cold 22.3 s (≈ its 24.7 s step-5 warm time; cone = 64 keys), line 100
  cold 139.1 s (vs 69 s step-13 warm / 202 s old-pipeline warm; cone =
  1,460 keys + 14,674 chains) — a single theory touches only its own
  field content's Adams cone, so import stays recommended seeding but is
  not required. (ii) Cross-group C2 from nothing: 198/198 keys (11
  species × orders 1-5 exhaustive) with generated = Dropbox C2 table =
  direct one-shot LiE fold (different evaluation order), run under
  PATH=/opt/local/bin:/usr/bin:/bin — no wolframscript, no form —
  proving the store subsystem needs only Python + LiE. (iii)
  Self-contained portability dir (refactor/ + store/ + module copy with
  overlay paths rewritten + pymysql stub + empty store; runner asserts
  every import resolves inside the dir, no arxiv): line 0 identical to
  step-5 in 22.0 s, cone generated on the fly (74 generation events →
  64 unique rows: concurrent-thread duplicates absorbed by INSERT OR
  IGNORE as designed). Scope interpretation recorded in the note: the
  plan's "no Wolfram" is demonstrated for the character-store subsystem
  (part ii); wolframscript remains a pipeline dependency for charge
  determination (scope (a)) and post-processing (kept by R8 for
  byte-identity), and the pymysql stub stands in for the RESULTS DB
  only, which stays MariaDB by scope.

- **(R14)** TFORM (step 16, calc/16_tform.py + work16/;
  notes/16-tform.md): `V2_TFORM=<workers>` in refactor/glue.py rebinds
  form() to `tform -w<N> -q` (makefrm + output surgery verbatim; default
  path untouched). Byte-identity: 8/8 form-output files identical
  (lines 0/23/77/100 × t_order 3/9, up to 13.9 MB); 4/4 subset-replay
  outcome records identical to step-5, 0 scan flags. Measured speedup
  (interleaved, load ~7/20 cores): typical lines x1.00-1.02 (NO gain —
  expressions too small for TFORM's distribution), line 100 x1.33 (-w4)
  / x1.39 (-w8), saturating at ~42 s = a ~40 s serial component; line
  100 end-to-end 58 s vs step-13's 69 s. ADDENDUM (user question
  2026-08-20, bench-heavy in notes/16): the weak gain IS an artifact of
  the baseline's moderate R-charges — on synthetic FORM-stress theories
  (small R-charges, per-flavor U(1) globals) the gain scales with
  workload: 9.7 MB output -> x1.40 (-w4) / x1.60 (-w8) byte-identical;
  585 MB output -> sequential form EXCEEDS its 600-s timeout (theory
  dropped as "stop") while tform -w8 finishes in 198 s and -w12 in
  148 s (>= x3-x4, and a timeout rescue). Recommendation updated: enable
  V2_TFORM for matter-rich / small-R-charge enumeration regimes, where
  it is both the largest FORM lever and a timeout rescue; keep unset for
  light warm replays.

- **(R15)** Persistent LiE REPL pool (step 17, store/liepool.py +
  calc/17_liepool.py + work17/; notes/17-liepool.md): `V2_LIEREPL=<size>`
  serves every LiE evaluation (fastmatch chains AND store generation)
  from a pool of long-lived processes; drop-in `lie_runner` for both call
  sites (SingletProjector gained the optional parameter, default
  unchanged). Framing parity proven: LiE prints no banner when piped —
  the 53-byte "banner" is the maxnodes-command response, re-emitted on
  every call since callers re-send their preamble; sentinel-integer
  framing; LiE line-flushes through pipes. Verified: 33/33 raw
  byte-identity on both lcode shapes; 198/198 C2 regeneration via a
  REPL-backed CharStore == the step-14 store (232 calls, 1 process);
  retry parity on a real maxobjects overflow; 4/4 interleaved cold
  empty-store line-100 replays byte-identical to step-5 (each: 15,020
  cache keys all among the 16,133 imports 0 bad, 1,510 table rows == 
  Dropbox, 0 flags). Speedup: cold line 100 spawn 152.9 s → repl
  133.7 s, x1.14 (x1.18 in the first bench pair) ≈ R6's ~21 s cold-LiE
  estimate; inert on warm lines (few LiE calls). Two REPL semantics
  facts, both unreachable downstream: error messages carry session line
  numbers (only the '('/'line' marker is read; error text never
  cached/persisted); LiE's object pool never shrinks, so a grown session
  can skip the maxobjects retry and return the identical polynomial
  directly. Harness gotcha for future benches: charges2's own duplicate
  check reads the SUCCESS file (a, c, index string) — repeated runs of
  the same theory must use isolated run dirs or they route to the log as
  '(duplicated)'. Recommendation: V2_LIEREPL=<CORE> for cold/first runs
  and cross-group generation; unset on warm replays (inert).

- **(R16)** Persistent Wolfram kernel pool (step 18,
  refactor/wolframpool.py + calc/18_wolfram.py + work18/;
  notes/18-wolfram.md; user decisions 2026-08-20: full 3-call coverage
  incl. the FindCharges call inside charges2 via surgical PATCH_18,
  per-worker kernels licensed). `V2_WOLFRAM=<size>` serves decouple/
  Index mcodes (glue._run_wolfram) and FindCharges (module-global hook
  _v2_wolfram_eval, always injected by install(); wolframscript-fallback
  when unset, so patched module + unset env == original). Byte-parity
  with wolframscript stdout needed three empirical fixes: OutputForm +
  PageWidth->Infinity session init (raw -noprompt prints InputForm and
  wraps at 78 cols — index strings are kB-long), base64 + suppressed
  ToExpression wrapping (raw kernel echoes unsuppressed top-level
  values; ClearAll isolates evaluations), and the trailing `Null\n`
  value echo. Verified: smoke 4/4 raw-identical; interleaved bench
  17/17 outcome records identical to step-5 in BOTH modes (ws mode =
  fallback-parity check); full 101-line replay 101/101 identical, 0
  flags, ONE kernel serving 297 calls. Speed: 2.4-3.1 s/theory saved —
  the fixed wolframscript tax — mean 21.8 -> 19.1 s, full replay 36.7 ->
  32.2 min (x1.14 overall; x1.12-1.14 typical lines, x1.04 line 100).
  First follow-up that pays on EVERY line. Production set: V2_WOLFRAM
  always + PATCH_18; V2_LIEREPL for cold runs; V2_TFORM for heavy
  batches.

- **(R17)** Low-order consistency prefilter (step 21,
  refactor/conditions.py mcode_consistency_violations +
  glue._prefilter_form + the Index false-positive guard;
  calc/21_prefilter.py + work21/; notes/21-prefilter.md; user decision
  2026-08-20: rejected theories may carry low-order index records).
  `V2_PREFILTER=<k>`: form() above order k expands at k first and scans
  with a Python mirror of the mcode C1/C2 checks on the (milli, ypow,
  g-monomial) index2 grid, exact below t^k (R8) hence SOUND; on a hit
  the low-order output is kept and the UNCHANGED Mathematica check in
  Index re-derives 'inconsistent' (the Python scan never issues a
  verdict); a hit that does not end 'inconsistent' — or ends in the
  truncation-unsound C4 verdict — triggers the guard: full order redone
  (false positives cost time, never correctness; machine-checked by a
  forced-violation test). Baseline (k=6): 17/17 rejections caught, 0
  false positives, accepted set unchanged with 84/84 accepted records
  byte-identical; rejected records differ only in index/fullindex;
  rejected lines ~20 s -> ~8 s, clean lines +4 s -> net LOSS on the
  17%-rejection baseline (40.0 vs 36.7 min), break-even ~25-30%
  rejection. Production case: high-rejection enumeration sweeps and
  heavy theories (form@k << form@9; composes with V2_TFORM where
  order-9 runs hit the 600-s timeout). k tunable; k=6 covers the full
  scalar E<6 window.

## Current step

Second extension: steps 16, 17, 18, 21 DONE (R14-R17); steps 19/20
AWAITING USER DECISION — after step 18 they have ~no speed value
(Mathematica compute 2.5% of wall, LiE warm ~0) and are portability-only
items (removing the Wolfram / LiE binary dependencies respectively);
recommendation is to decline both with rationale (R8 precedent) unless
the user wants the portability, in which case 19 starts with the
InputForm/dedup byte-identity design (validation set: the 101 baseline
index strings). Once decided, the second extension closes with a summary
write-up (R14-R17 + the production switch matrix: V2_WOLFRAM always,
V2_TFORM + V2_PREFILTER for heavy/high-rejection enumeration sweeps,
V2_LIEREPL for cold/first runs).

## Open questions / gotchas

- Audit-phase suspicions RESOLVED in steps 1-4 (see R1-R4): encoding round-off
  CLEARED; `rep_structure` assembly CLEARED; `maxobjects` retry banner CLEARED;
  cache degradation OK. Confirmed defects/gaps: F1 (C3 higher-spin free-field
  check missing), F2 (C4 vanishing index → crash/misrouted to error log), F3
  (`extractScalar` non-iterative character peel, latent for y-top ≥ 3), F4
  (coefficient `Round` binds to first Times factor — safe only under the `1.0*`
  Float convention).
- Fragile-but-working couplings to preserve or harden in the refactor: FORM stdout
  string surgery (`[:-1]`, `z`→`1`); LiE `[53:]` banner slice (this LiE build,
  `maxnodes 9999999` constant); singlet-listed-first assumption on decomposition
  strings; eval on tool output and in `d()`; `Index()` result keys are
  space-stripped (`fullindex`, `non-manifestsymmetry`); `Mathcode` nested
  `Pool(CORE)` per theory.
- Out-of-scope (d) items to report only: O(N²) duplicate check; per-call MySQL
  reconnects; hardcoded Telegram bot token (recommend rotation).
- Real character tables inspected (Dropbox A2, 2026-08-12): keys ARE
  `str(list)`-spaced (`'[0, 0, 1]'`) matching `picklines(str(key))`; species dirs
  S, Sb, phi, q, qb; decompositions contain NEGATIVE multiplicities (Adams
  virtual characters, e.g. `-1X[1,1]`) and a `+-1X[...]` sign-juxtaposition
  quirk; zero weight listed first in all sampled lines (singlet-first assumption
  holds there) — RESOLVED in step 5: 15/15 entries match live LiE (Adams
  virtual characters incl. negative multiplicities), singlet-first verified on
  1466 singlet terms (326 negative), sign parse confirmed on real terms.
- Baseline number-format normalization: RESOLVED in step 5 — no normalization
  needed; the fresh run reproduces the old strings byte-identically (the
  compare code still tolerates ≤1e-24 numeric noise on a/c/R-charges).
- Tool versions: RESOLVED in step 5 — byte-identical reproduction proves the
  installed FORM 4.3 / WolframScript 1.8.0 / LiE (/opt/local/bin) match the
  old-run behavior.
- Relevant deformations are not queued when the theory has no flavor symmetry
  (`charges2` line 1432) — consistent with the R-remixing requirement, but worth
  confirming with the user that this matches the intended enumeration.
- Consistency-condition provenance: RESOLVED in step 7 (R7) — conditions
  derived independently from su(2,2|1) representation theory; both papers'
  main-text statements confirmed typo-free by comparison (one typo found in
  1708.08307's appendix $\hat{\mathcal H}$ formula, corrected form in R7),
  so the derived forms can now be used with proof-level confidence.
- Maldacena-Zhiboedov input (higher-spin conserved current ⇒ free sector;
  1112.1016, 4d version Alba-Diab 1307.8092) is used in
  C3's physical interpretation as a plan-sanctioned input but is NOT in
  LLMwiki — suggest `/wiki-ingest` in the LLMwiki project if it should be
  citable at equation level in the paper phase.
- Step-8 user decisions RESOLVED (2026-08-18) and implemented in R8:
  (i) F1/F2 → InconsistentIndex; (ii) C1' hits passing all else → NEW
  FreeSector table (free spinning fields never yet seen — a trap for when
  one appears; j=0 keeps the flip/decouple branch); (iii) t_order stays 9
  — t^9 completeness PROVEN, so C3 at j=3/2 is checked at order 9.
- Step-8 implementation decisions RESOLVED on user review (2026-08-19):
  (i) REVERSED from first implementation — when C1' and C3 both fire, C3
  wins → InconsistentIndex; C1' alone → FreeSector (glue.py updated, both
  signals always recorded in index_flags); (ii) user confirmed index ≡ 0
  impossible here; the index ≡ 1 case routes as "inconsistent (vanishing
  index: possible SUSY breaking)" → InconsistentIndex, full record in the
  log file; (iii) IndexFlags = MEDIUMTEXT column in FreeSector holding the
  human-readable scan findings (condition, t-power, spin, net
  multiplicity), explained to the user.
- Step-8 benchmark caveat: all step-8 timings were taken under heavy
  ambient machine load (load average ~30, unrelated application); ratios
  are old/new interleaved and therefore fair, absolute times are inflated
  vs the idle-machine R6 table.
- SQL side effects: `charges2` writes to MySQL tables (Theories, Failures, ...)
  and result files on every outcome; the step-5 harness must intercept these
  (pymysql stub + scratch RESULTS_DIR) — never let a replay write into real DBs
  or Dropbox.
- FOLLOW-UP work items (user, 2026-08-19): (1) generation-on-miss
  character store — NOW IN PROGRESS as extension steps 10-15 (scope in
  PROJECT.md); (2) further speed candidates discussed with the user
  2026-08-19, in measured-leverage order: tform (parallel FORM),
  persistent lie REPL process (kills cold-cache spawn overhead ~50 s on
  the heaviest line), persistent Wolfram kernel (needs (d) pool changes),
  Python post-processing replacing Mathematica (InputForm/dedup
  byte-identity is the blocker — dedup compares 'index' STRINGS),
  pure-Python singlet arithmetic replacing lie, staged lower-order
  pre-filter for early inconsistency rejection — user intent 2026-08-19:
  these belong to THIS project (further extensions), not new projects.
- Extension gotchas (steps 10-15): LieCache values cannot be regenerated
  from their sha256 keys alone (preimage unknown) — tensor-cache
  regeneration verification happens in step 14(i) via overlapping-key
  comparison during an empty-store replay, not in step 12. The `[53:]`
  banner slice is build-specific — step-10 script validates it with a
  sentinel per run; the store must do the same per process (step 11).
  maxobjects retry fires for real at higher rank (products of several
  reps; user note 2026-08-19) — exercise the path in step-11 tests.
  CORRECTED 2026-08-19: ALL 26 group dirs are populated (~69 GB logical
  total; C2 ~26 GB, A5 ~14.6 GB) but almost entirely as Dropbox
  online-only placeholders — an earlier claim that non-A1/A2 dirs were
  empty misread `du` on-disk sizes. Only ~237 MB of A1/A2 is materialized;
  A1+A2 logical is 409+838 MB ≈ 1.25 GB, which step-12 import must budget
  for. Species lists vary per group (B2 adds sp/spb; C2 adds sp/spb/v/vb;
  C1/G2 have no S/Sb; D3 has only q) — registry seeding must come from
  each group's order-1 files, not from a fixed species list. Empty-store replay cost
  RESOLVED in step 14 (R13): minutes, not tens of minutes — a theory
  generates only its own field content's Adams cone (line 0: 64 keys,
  22.3 s; line 100: 1,460 keys, 139.1 s); import stays the recommended
  seeding but is not required.
  Dropbox originals and work05/06/08 artifacts are never mutated; all
  extension artifacts live under calc/work1x/.
