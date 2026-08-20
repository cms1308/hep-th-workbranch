# 21 — Low-order consistency prefilter behind the V2_PREFILTER switch

*Date: 2026-08-20 · wiki pages used: — (engineering step) · references: notes/07-consistency-conditions.md (R7: the conditions), notes/08-refactor.md (R8: low-order exactness), notes/18-wolfram.md (post-18 cost structure: FORM = 93% of wall)*

## Goal

Last speed follow-up implemented (plan step 21; user decision 2026-08-20:
early-rejected inconsistent theories MAY carry the low-order index in
their record). Reject inconsistent theories from a cheap low-order
expansion before paying the full-order FORM run — after step 18, FORM is
93% of wall time and the only remaining lever. Verify: accepted set
unchanged on the baseline with every accepted record byte-identical;
rejected theories keep the 'inconsistent' verdict with low-order index
strings; hit/false-positive accounting and measured cost.

## Setup

Design (three pieces, `V2_PREFILTER=<order>`, default path untouched):

1. `conditions.mcode_consistency_violations(records, k)`: a Python mirror
   of the mcode's C1/C2 consistency section (the three AnyTrue checks of
   `generate_index_mcode`) on the (milli, y-power, g-monomial) grid of
   `index2` — field fugacities set to 1, true U(1) fugacities kept, the
   grid the Mathematica check acts on (R3). Restricted to buckets with
   milli < 1000k, which are EXACT at order k (the R8 linear-positive
   encoding argument at any order), so every reported violation is
   present verbatim in the full-order data — prefilter rejections are
   sound by construction. An empty list certifies nothing.
2. `glue._prefilter_form`: form() calls above the prefilter order first
   expand at order k and scan; on a violation the low-order output file
   is KEPT and form returns — the subsequent Index() call re-derives the
   'inconsistent' verdict from that data via the UNCHANGED Mathematica
   check (no verdict is ever issued by the Python scan itself), so the
   record carries the low-order index strings. Clean or failed scans fall
   through to the full-order expansion (byte-identical path).
3. False-positive guard in `Engine.Index`: if a prefilter hit does not
   end with an 'inconsistent' verdict — or ends with the C4
   vanishing-index verdict, which is NOT sound on truncated data — the
   full-order expansion is run and Index redone. A Python-scan false
   positive can cost time, never correctness. The condition scan's
   exactness horizon follows the actual data order on a prefilter hit
   (C3 at j >= 1 needs milli >= 8000 and cannot fire on order-6 data).

## Derivation

Soundness argument, recorded once: the FORM truncation keeps every
monomial of physical exponent <= k exactly (encoding linear and positive,
R8), so any coefficient the order-k scan reads below t^k equals the
order-9 coefficient; the Mathematica check at order 9 examines a superset
of those terms with the same conditions, hence rejects every theory the
prefilter flags. The converse direction needs no argument — a prefilter
miss just falls through to the unchanged full computation.

## Result

On the 101-line baseline with `V2_PREFILTER=6`: the prefilter caught
ALL 17 rejected theories (17/17 hits, 0 false positives), the accepted
set is unchanged with all 84 accepted records byte-identical, and each
rejected record differs from step-5 ONLY in `index`/`fullindex` (the
low-order strings; consistency/a/c/w/nw identical). Rejected lines drop
from ~20 s to ~8 s; clean lines pay ~+4 s (the order-6 expansion), so the
baseline's 17% rejection rate sits below break-even: 40.0 min vs the
36.7-min step-13 reference.

## Verification

All checks pass (`calc/21_prefilter.py`, results in work21/):

- `smoke` PASS: clean line 0 — no hit, outcome byte-identical (24.9 s,
  the +4 s order-6 overhead visible); rejected line 19 — prefilter hit,
  Index re-derives 'inconsistent' from the order-6 data, 7.7 s.
- `guard-test` PASS: a FORCED fake violation on clean line 0 fires the
  guard (logged), the full order is redone, and the outcome is
  byte-identical to step-5 — the false-positive path is exercised
  end-to-end.
- `replay` + `compare` PASS: 101 lines — 84 byte-identical, 17 low-order
  records with differing keys exactly {index, fullindex}, accepted set
  unchanged, 17 hits / 0 false positives, 40.0 min total.

## Interpretation

The switch works and is exactly as safe as designed, but on THIS baseline
it is a net loss: break-even sits at a rejection rate of roughly
4.3/(4.3+12) ≈ 25–30% against the baseline's 17%. Its production case is
the regimes where the two factors improve together: enumeration sweeps
with high inconsistency rates, and heavy theories where form@k ≪ form@9
grows steeply (the notes/16 addendum measured a 585 MB order-9 run
timing out at 600 s — an order-6 prefilter rejection there saves
minutes, not seconds, and composes with V2_TFORM). Recommendation:
enable V2_PREFILTER for large enumeration sweeps and matter-rich
regimes; leave it unset for small warm replays. The prefilter order is
tunable; k=6 covers the full scalar window E<6 (all 17 baseline
rejections fire there) — lower k catches less, higher k pays more.
