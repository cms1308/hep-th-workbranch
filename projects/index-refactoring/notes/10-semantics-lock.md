# 10 — Semantics lock: the on-miss recursion reproduces the stored tables

*Date: 2026-08-19 · wiki pages used: — (engineering step; ground truth is LiE + the stored tables) · references: `classification/arxivGen 2.py`, notes/01-pipeline-map.md + notes/05-regression-harness.md*

## Goal

Prove, before building the store, that the generation path the store will use
on a cache miss — the `arxivGen 2.py` recursion, run per-key with LiE
subprocess calls only (no Wolfram, no whole-order Frobenius enumeration) —
reproduces the existing arxiv table entries byte-identically. Verify criterion:
a random sample of ≥ 50 stored A1/A2 entries across all species and orders,
including negative-multiplicity and `+-1X` entries, each recomputed and
compared byte-wise after the established normalization.

## Setup

- Table semantics (notes/01-pipeline-map.md): entry of
  `arxiv/<G><r>/<species>/<species>N.txt` maps key `[m1,...,mN]`
  ($\sum_k k\,m_k = N$) to the LiE virtual-character polynomial for
  $\prod_k \psi^k(\chi_{\rm rep})^{m_k}$.
- Recursion (from `arxivGen 2.py`): key with $m_N=1$ (pure top Adams term)
  → `Adams(N, rep_label, GROUP)`; otherwise split off the FIRST nonzero Adams
  factor: `frob1 = key[:len(key)-fn-1]` with `frob1[fn] -= 1` (order
  $N-(fn{+}1)$), `frob2 = [0]*fn + [1]` (order $fn{+}1$, pure Adams), and
  `tensor(pol1, pol2, GROUP)` of their two polynomials. Both factors are
  strictly lower order, so per-key recursion terminates at Adams base cases —
  the Wolfram-side Frobenius enumeration is needed only for whole-order batch
  generation and drops out.
- Rep labels are read off the order-1 tables themselves (entry `[1]` is
  `1X[label]`, the rep): A1: U=Ub=`[3]`, phi=`[2]`, q=qb=`[1]`;
  A2: S=`[2,0]`, Sb=`[0,2]`, phi=`[1,1]`, q=`[1,0]`, qb=`[0,1]`. The store
  will carry this registry explicitly (PROJECT.md conventions).
- Normalization (matches arxivGen and the pipeline): stdout banner slice
  `[53:]`, `strip()`, newlines and all spaces removed. A sentinel check
  (`print` of a known literal) validates the 53-char slice once per run and
  fails loudly on a different LiE build.
- Retry policy decision (STATE open question, resolved): adopt arxivGen's —
  preamble `maxnodes 9999999\n maxobjects 9999999`, regenerate with `maxobjects`
  grown by an appended digit while the sliced output contains `(` or `line`
  (the pipeline's `_run_lie` trigger), max 3 retries. No retry fired anywhere
  in this run, so the stored A1/A2 entries are insensitive to the policy
  difference between arxivGen and `_run_lie`.

## Derivation

`calc/10_semantics_lock.py` (re-runnable; deterministic sampling, seed
20260819; Dropbox tables read-only; results in `calc/work10/results.jsonl`).
Two modes:

- **step** (67 entries): recompute the sampled entry's own generation step,
  with the two sub-entries taken from the stored tables. Sample: per
  (group, species) the order-1 base `[1]`, one pure-Adams key `[0,...,0,1]`,
  and 5 random keys from random orders ≤ 14 (file-size cap 3 MB — higher-order
  q/qb/S/Sb files are Dropbox online-only placeholders), topped up with
  targeted negative-multiplicity and `+-1X` entries.
- **cone** (10 root keys, 39 computed members): regenerate sampled order-4..6
  keys from NOTHING but LiE — full recursion, memoized — and compare every
  cone member against its stored value (end-to-end check of the recursion,
  including its base cases).
- **step-high** (1 entry, run ad hoc on top of the module, appended to
  results.jsonl): a random non-pure-Adams key of `A2/phi/phi32.txt` — the
  largest table in the data set (50 MB, 8349 keys, value length 7831 here) —
  loaded whole and recomputed. Load 0.2 s, tensor step 0.2 s.

Hand pre-checks before the script (both byte-identical): `Adams(3,[1,0],A2)`
vs stored q3 `[0,0,1]`; the split of q3 `[3,0,0]` → tensor of q2 `[2,0]` with
q1 `[1]` vs stored.

## Result

$$\boxed{\text{107/107 sampled entries byte-identical: the arxivGen recursion, run per-key with LiE alone, IS the stored tables' semantics.}}$$

Breakdown: 67 step + 39 cone + 1 step-high; 68 entries with negative
multiplicities, 19 with the `+-1X` juxtaposition; all 10 (group × species)
pairs, orders 1–14 plus 32; wall clock ~10 s.

## Verification

- Byte-identity against stored values on all 107 comparisons (the step
  criterion; ≥ 50 met with margin).
- Special cases covered: order-1 identity entries, pure-Adams base keys,
  negative multiplicities (Adams virtual characters), `+-1X` sign
  juxtaposition, deepest available table (phi32).
- Banner sentinel passed (53-char slice valid on this LiE build,
  `/opt/local/bin/lie`).
- Cone mode independently re-verifies the recursion's sub-results, not just
  the final entries (39 members from 10 roots).

## Interpretation

The generation-on-miss path is proven correct against the production data it
must be compatible with, before any store code exists. Step 11 can now build
the sqlite store around exactly this recursion (same preamble, slice,
normalization, retry policy) with the guarantee that generated and imported
entries are indistinguishable. The Dropbox online-only placeholders (large
q/qb high-order files) also confirm the portability motivation: even on THIS
machine, part of the table set is not really local.
