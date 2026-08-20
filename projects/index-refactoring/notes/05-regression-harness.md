# 05 — Regression harness: SU3s1S1nf2 baseline replay

*Date: 2026-08-12 · wiki pages used: — (implementation) · references: notes/01–04, refs/SU3s1S1nf2.txt, refs/SU3s1S1nf2_true.txt*

## Goal

Replay the 101 superpotentials of `refs/SU3s1S1nf2.txt` through the unmodified
pipeline (SU(3), 2 flavors + S + Sb ⇒ GROUP="A", RANK="2", NC=3) and check that
exactly the 82 entries of `refs/SU3s1S1nf2_true.txt` survive. Verify criterion:
per-superpotential comparison of parsed result dicts; discrepancy list empty or
explained.

## Harness (`calc/05_regression.py`, work dir `calc/work05/`)

- Module copy `work05/landscape_A2.py`: generated from
  `refs/landscape_refactored.py` with ONLY the 4 config lines changed
  (GROUP="A", NC=3, FILENAME/SQLNAME="SU3s1S1nf2_replay"); the generator
  asserts each substitution hits exactly once and diffs the result (the
  source has CRLF line endings — the copy preserves them byte-for-byte).
- No real database touched: `pymysql` shadowed by a stub that serves the
  LiE-cache SELECT/INSERT from a local sqlite file (`work05/liecache.sqlite`,
  memoization semantics preserved) and records every other INSERT to
  `work05/sql_inserts.jsonl` without executing it.
- Character tables read-only via symlink `work05/arxiv` → Dropbox
  `classification/arxiv`; result files land under `work05/results/`.
- Inputs: each baseline line carries its own `n` (9-vector [X,M,q,qb,phi,S,Sb,A,Ab]);
  `verify-n` checks `n` against the line's R-charge field labels — 101/101
  consistent. Replay is sequential in file order (duplicate check depends on
  output-file accumulation), resumable via `replay_outcomes.jsonl`.

## Pre-checks (all passed)

- **Table spot-check vs live LiE** (owed from step 4): 15/15 sampled A2 entries
  (q, qb, S, Sb, phi; Adams keys up to degree 3) equal live `tensor`/`Adams`
  recomputation, including negative multiplicities of Adams virtual characters
  (e.g. q2[0,1] = `-1X[0,1]+1X[2,0]` = ψ²(fund)). Singlet-first assumption
  verified on 1466 singlet terms across the sampled files (326 with negative
  multiplicity — the `int(decomp[:find("X")])` parse handles the sign).
- LiE syntax note: `Adams(n, X[...], A2)` (group argument required in batch mode).

## Result (replay 46.2 min total; mean 27.4 s/line, max 205 s for the 7-term X-flip line)

- **82/82 true entries reproduced EXACTLY** — every field byte-identical
  (a, c to 30 digits, all R-charges, global charge bases, index/shortindex/
  fullindex strings, dim3, relevant/fliped/marginal, n). Zero numeric noise:
  the Mathematica/FORM/LiE stack on this machine reproduces the old run's
  formatting and values precisely.
- **17/19 excluded entries rejected**, all with `consistency = "inconsistent"`
  (the C1/C2 index check). Cross-check via recorded SQL: 84 Theories inserts,
  17 InconsistentIndex inserts.
- **2 excluded entries still pass every implemented check (finding F5)**:
  - line 77 `['M1*q2*qb1', 'M1^2', 'M2*q1*qb2']` — R(M1) = 1 exactly
    (M1² is a mass term; the theory is IR-equivalent to integrating M1 out)
  - line 86 `['M1*q2*qb1', 'M1*S1*Sb1', 'M2*q1*qb2']` — R(M1) ≈ 0.875,
    no mass term
  Both reproduce their old-run entries byte-identically and are saved as
  consistent.

## Enumeration-closure analysis of F5

Simulating the production enumeration with the fresh verdicts (children =
`w+[relevant op]` and `w+[M_{k}·flipped op]` of consistent theories only;
matching by the production WL weighted hash; X-flip lines matched via their
X-stripped input form): exactly 84 of the 101 theories are reachable and
consistent = the 82 true entries + the same 2 survivors. Both are queued by
the *true-set* entry `['M1*q2*qb1', 'M2*q1*qb2']`, whose (exactly reproduced)
`relevant` list contains `M1^2` and `M1*S1*Sb1`. Therefore a full fresh
enumeration with the current code necessarily visits and keeps both.

Exclusion mechanisms ruled out one by one:

- **Duplicate check**: no other theory among the 84 fresh successes shares
  their (a, c, index).
- **Input-level dedup**: no WL-hash collision between the survivors and any
  true entry (and none inside the true set).
- **"Flip field repeated in W" rule**: 11/82 true entries also have an M field
  in ≥ 2 terms (all 19 extras do), so this does not separate.
- **"Mass term for a flip" rule**: the true set itself contains
  `['M1*S1*Sb1','M1^2']` and `['M1*q2*qb1','M2*q1*qb2','M1*M2']`, both with
  R(M) = 1 exactly.

Conclusion: `SU3s1S1nf2_true.txt` cannot be the plain output of the current
code's enumeration — its production involved either an additional criterion
not present in the code or manual curation. **Reported to the user; not
fixed.**

**RESOLVED (user, 2026-08-13):** the two entries were removed *by hand*
because they descended from theories later found inconsistent. This matches
the data exactly: by the append-last queue order, line 77's old-run parent is
`['M1*q2*qb1','M1^2']` and line 86's is `['M1*q2*qb1','M1*S1*Sb1']` — both
among the 17 now rejected. The deletion is confirmed correct, and the replay
reproduces the intended set. **Step 5 verdict: PASS** (82/82 exact; 17/19
rejected by the code; 2/19 removed by documented hand-curation).

Residual subtlety carried to step 8: the closure analysis above shows both
theories are *also* queued by the true-set (consistent) entry
`['M1*q2*qb1','M2*q1*qb2']`, so a full fresh enumeration with the current
code would regenerate them (with term order `[..., 'M1^2']` appended last)
and save them as consistent. If the landscape is ever re-enumerated, either
they are accepted as legitimate entries or an exclusion rule is needed
(note line 77 has R(M1) = 1 exactly with a M1² mass term — a redundant
description of the theory with M1 integrated out).

Side observation (out-of-scope (d), report only): `relevant` lists contain
bare flip fields (`M1`, `M2`) — linear tadpole superpotential terms — which
the production queue would submit as deformations.

## Interpretation

The index pipeline itself is fully regression-clean: on identical inputs it
reproduces the old run exactly, and the C1/C2 consistency filter accounts for
17 of the 19 curated-out entries. The remaining 2 are a property of the
enumeration/curation layer, not of the index computation — precisely the kind
of discrepancy this project is meant to surface (F5), now waiting on the
user's account of how the true file was produced.
