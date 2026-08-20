# Refactoring the superconformal-index pipeline of the 4d N=1 landscape code

*Created: 2026-08-12*

## Problem

The user's 4d $\mathcal N=1$ landscape-generation code (`refs/landscape_refactored.py`,
1652 lines, the computational engine behind the program described in
[[2408.02953|Cho-Maruyoshi-Nardoni-Song 2024]]) takes a matter content, R-charges, and
$U(1)$ flavor charges and (i) computes the superconformal index as a series, (ii)
extracts gauge-invariant operators (decoupled / relevant / flipped / marginal), and
(iii) checks consistency of the candidate fixed point via unitarity conditions on the
index. The computation expands the plethystic exponential in FORM and replaces the
products of gauge-group characters in each term by tensor-product decompositions
computed with LiE; post-processing (operator extraction, consistency checks) runs in
Mathematica via `wolframscript`.

This project covers the **index pipeline only** — parts (b) and (c) below; scope fixed
with the user on 2026-08-12:

- (b) index computation: `makefrm` / `form` / `Mathcode` / `match` + the LiE cache
  (`_run_lie`, `_lie_cache_*`) — FORM PE expansion, character substitution.
- (c) index post-processing: `generate_index_mcode` / `generate_decouple_mcode` /
  `Index` / `decouple` — consistency checks and operator extraction.

Out of scope (interfaces preserved, code untouched except where a defect crosses the
boundary): (a) charge determination / a-maximization inside `charges2`, and (d)
orchestration, SQL logging, deduplication, and the main loop.

The deliverables are:

1. A verified account of **what the pipeline actually computes** and whether the
   consistency checks and gauge-invariant-operator extraction implement the
   prescriptions of the landscape papers correctly — every discrepancy found is
   reported to the user, none silently fixed.
2. A refactored index pipeline that reproduces the current outputs on a regression
   baseline (old run results, provided by the user) and on analytically known cases,
   with measured performance improvements. External tools (FORM, LiE, Mathematica,
   MySQL) may be replaced only when output equivalence is verified on the baseline.

### Extension (2026-08-19): generation-on-miss character store

Scope amendment on user clarification: the project's intent was never only the
refactor of (b)+(c) — it includes the supporting-infrastructure work items that
came out of it (character/LieCache storage, further speed work). First extension,
steps 10-15 (plan in STATE.md): unify the two precomputed character data sets —
the `arxiv/<GROUP><RANK>/<species>/<species>N.txt` tables (key `[m1,...,mN]`,
$\sum_k k\,m_k=N$ ↦ decomposition of $\prod_k\psi^k(\chi_{\rm rep})^{m_k}$ as a
LiE virtual-character string) and the `LieCache` tensor-step cache (sha256 keys,
currently a table in the same localhost MariaDB as the results tables) — into
**one self-bootstrapping sqlite file**, auto-created when absent, which on a
missing key computes the entry on the spot via LiE subprocess (the
`arxivGen 2.py` recursion: `Adams(N, rep, G)` base case, else one `tensor` of
two strictly-lower-order entries — no Wolfram, no whole-order enumeration) and
persists it.

Motivation (notes/09 §6.5): the table set is huge and not really local — all
26 group dirs (A1-A9, B2-B4, C1-C8, D3-D8, G2) are populated, ~69 GB logical
in total (C2 alone ~26 GB, A5 ~14.6 GB), but almost everything is a Dropbox
online-only placeholder; only ~237 MB of A1/A2 is materialized on this
machine. [Correction 2026-08-19: an earlier version of this section claimed
the non-A1/A2 dirs were empty — that misread `du` (on-disk) for logical
size.] Running elsewhere requires the relevant group's tables (up to ~26 GB)
plus a localhost MariaDB. A batch-generated key set also has a hard edge: a
key outside the pregenerated orders crashes the run; generation-on-miss
removes the edge. The external target machine is outside the home LAN (user
2026-08-19), so a remote-DB variant was rejected. All groups must eventually
be covered (user 2026-08-19): the registry is seeded for every group (labels
read off the order-1 table files, as in R9), the import tool is per-group,
and groups without imported bulk data run on generation-on-miss.

Extension scope decisions (user 2026-08-19): backend = single sqlite file
(WAL), requirement is that the code runs externally with only Python + LiE;
generation engine = LiE subprocess (pure-Python character arithmetic stays a
possible later extension); integration target = `refactor/` only
(`fastmatch.CharacterTables` + `SingletProjector` cache hooks); existing data =
one-time import of A1/A2 tables + the 16,133 LieCache entries AND
random-sample regeneration against stored values. The results DB (Theories,
Failures, FreeSector, ...) stays in MariaDB, untouched. Extension success
criteria: (i) generation path reproduces stored entries byte-identically;
(ii) 101/101 baseline replay stays byte-identical reading only the store;
(iii) empty-store bootstrap and a no-table group (C2) demonstrated;
(iv) portability run without Dropbox/MySQL/Wolfram.

Extension conventions: store = one sqlite file (WAL), auto-created; character
decompositions keyed (group_rank, species, `str(list)` key vec); tensor-step
cache keyed by the EXISTING sha256(`GROUP_RANK|products|decomp`) digest (warm
caches stay valid); species→Dynkin-label registry stored explicitly (read off
order-1 tables: A1 U=Ub=[3], phi=[2], q=qb=[1]; A2 S=[2,0], Sb=[0,2],
phi=[1,1], q=[1,0], qb=[0,1]); LiE normalization and invocation per R9
([53:] slice + banner sentinel, maxnodes+maxobjects 9999999 preamble, grow
maxobjects on `(`/`line`, process-group kill on timeout); Dropbox originals
read-only, all new artifacts under calc/work1x/.

### Second extension (2026-08-20): pipeline speed follow-ups

The character-store extension closed with user sign-off 2026-08-20
(notes/15-summary.md). The speed work items from the 2026-08-19 discussion
continue in this project (user intent 2026-08-19), in measured-leverage
order — STATE.md plan steps 16-21: tform (parallel FORM), persistent lie
REPL, persistent Wolfram kernel, Python post-processing replacing
Mathematica, pure-Python singlet arithmetic replacing lie, staged
lower-order pre-filter for early inconsistency rejection.

Second-extension conventions: every change is opt-in behind an environment
switch with the default path byte-untouched (the V2_CHARSTORE pattern);
success criterion per item = byte-identity on the regression baseline (or
outcome-record equality where a stage's raw output cannot be byte-compared)
plus a same-load interleaved speedup measurement; an item whose
byte-identity blocker cannot be cleared is recorded and declined with
rationale, as in R8. Steps 18-21 get their detailed design (and any user
decisions on semantics) when started.

## Success criteria

- Every consistency condition and operator-extraction rule in the Mathematica code is
  mapped to a stated prescription in the landscape papers (2408.02953, 1806.08353,
  1610.05311), or flagged as a discrepancy with a minimal reproducing example.
- The refactored pipeline reproduces the baseline outputs (user-provided old run
  results + analytic unit cases) exactly (up to documented formatting/precision
  normalization).
- A profiling-backed statement of where time goes, and a measured speedup (or a
  justified conclusion that a given stage is already optimal).

## Background

The landscape program ([[4d-n1-scft-landscape]]) enumerates 4d $\mathcal N=1$
fixed-point candidates by deforming seed gauge theories and, at each step, computing
central charges by [[a-maximization]] and the [[superconformal-index|superconformal
index]] as consistency filter and fingerprint.

Index convention (the $(t,y)$ convention of 2408.02953, see [[superconformal-index]]):
$\mathcal I(t,y;x)=\mathrm{Tr}\,(-1)^F t^{3(R+2j_1)}y^{2j_2}x^f$. A chiral multiplet of
R-charge $r$ contributes single letters $t^{3r}$ (scalar) and $-t^{3(2-r)}$ (conjugate
fermion), the vector multiplet contributes $-t^3 y - t^3/y + 2t^6$ per Cartan
direction, and the full index is a Plethystic exponential of the single-letter index,
projected onto gauge singlets. The **reduced index**
$\mathcal I_{\rm red}=(1-t^3y)(1-t^3/y)(\mathcal I-1)$ strips descendants; its $t^6$
coefficient counts marginal operators minus conserved currents. Unitarity requires
scalar terms below $t^6$ to have non-negative coefficients; a coefficient at
$t^{3r}\le t^2$ signals an operator hitting the unitarity bound $R\le 2/3$ that
decouples as a free field (Kutasov-Parnachev-Sahakyan prescription) — the code's
"decoupled" branch, which triggers a flip field and recursion.

Implementation scheme in the code: FORM requires integer exponents, so a fractional
$t$-power $p$ is encoded as $t^{\lfloor 500p\rfloor}s^{\dots}r^{\dots}$ with two
base-5000 "digit" symbols $s,r$; `match` decodes this back in sympy. Gauge-character
products in each PE term are recognized from symbols `phi_k, q_k, qb_k, S_k, ...`
(Adams operation index $k$), looked up in precomputed character tables
(`arxiv/<GROUP><RANK>/`), and multiplied out by chained LiE `tensor()` calls; only the
singlet multiplicity is kept. A MySQL-backed cache memoizes LiE tensor steps.

The precise consistency/extraction prescriptions are taken from the papers' LaTeX
sources, available locally in `LLMwiki/sources/arxiv/` (2408.02953, 1806.08353,
1610.05311, 2308.01717) — no wiki ingest needed.

## References

- [arXiv:2408.02953] Cho-Maruyoshi-Nardoni-Song — the landscape program this code
  implements; source of the consistency/extraction prescriptions (in wiki: yes)
- [arXiv:1806.08353] Maruyoshi-Nardoni-Song — pilot landscape ($SU(2)$ adjoint SQCD);
  origin of the index-based consistency filter (in wiki: yes)
- [arXiv:1610.05311] Agarwal-Maruyoshi-Song — decoupled-operator division
  prescription validated on Kutasov-Schwimmer duality (in wiki: yes)
- [arXiv:2308.01717] Cho-Choi-Lee-Song — conventions companion (in wiki: yes)
- [arXiv:hep-th/0304128] Intriligator-Wecht — a-maximization (context only; out of
  scope) (in wiki: yes)

## Conventions

- Index: $\mathcal I(t,y)=\mathrm{Tr}(-1)^F t^{3(R+2j_1)}y^{2j_2}$; reduced index
  $(1-t^3y)(1-t^3/y)(\mathcal I-1)$; marginal operators at $t^6$.
- Code fugacity encoding: exponent $p$ of $t$ stored as
  $t^{500p_{\rm int}}s^{d_1}r^{d_2}$, $d_i$ base-5000 digits of the fractional part;
  `t_order` counts in units where $t^{3r}\leftrightarrow$ FORM $t^{1500r}$.
- Matter species labels (positions in `MU_DICT`/`DIM_DICT`): `X, M` gauge singlets
  (flip fields), `q, qb` fundamental/antifundamental, `phi` adjoint (vector-multiplet
  rep), `S, Sb` symmetric, `A, Ab` antisymmetric (+ `U,V,W` variants per group).
- Gauge group set by globals `GROUP`/`RANK`/`NC` (current file: $Sp(2)=C_2$).
- Equivalence testing compares parsed result dictionaries (rational/decimal values
  normalized), not raw stdout strings.
