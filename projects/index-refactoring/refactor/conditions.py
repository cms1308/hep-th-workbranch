"""Reduced-index consistency scan: C1' / C3 / C4 (step-8 refactor).

Implements the conditions PROVEN in notes/07-consistency-conditions.md (R7)
that the production Mathematica check does not cover:

  C1' (boundary): net chiral-sign content (-1)^{2j} n_j > 0 at E = 2+2j with
      j >= 1/2 is exclusively free-field (left-saturated A1B1b) -> the theory
      contains a free spinning sector.  (j = 0 is the existing decouple
      branch and is NOT flagged here.)
  C3: net coefficient c > 0 of (-1)^{2j+1} t^{6+2j} chi_j(y) counts conserved
      current multiplets A1A2b[j,0,2j/3] net of chiral B1b partners;
      j >= 1 -> higher-spin current -> free sector (Maldacena-Zhiboedov);
      j = 1/2 -> extra supercurrent -> N >= 2 enhancement signal (NOT an
      inconsistency); j = 0 is the flavor-current count already in dim3.
  C4: a unitary N=1 SCFT has I = 1 + O(t^2) != 0.  Within this series
      pipeline the index always has constant term exactly 1, so the
      operational degenerate case is I == 1 identically within truncation
      (reduced index == 0) -- the input on which the old Index() crashed
      (finding F2).  It is classified instead of crashed on.

All checks act on the reduced index (1-t^3 y)(1-t^3/y)(I-1) with every
fugacity except (t, y) set to 1 ("net"), matching the derivation; exponents
live on the pipeline's 0.001 grid (integer "milli" units, t^9 = 9000).

The scan trusts buckets only up to E <= 1000*t_order: the FORM truncation
t(: 500*t_order) keeps every monomial of physical exponent <= t_order (the
encoding is linear and positive, so any product with true exponent <= t_order
has encoded t-power <= 500*t_order), hence the t^{t_order} coefficient is
exact and C3 at j = 3/2 (t^9 at the production t_order = 9) is covered
without raising the order.
"""
from collections import defaultdict
from fractions import Fraction
from typing import Dict, List, Tuple

# reduced = (1 - t^3 y)(1 - t^3/y)(I - 1): convolution kernel in (milli, ypow)
_KERNEL = ((0, 0, 1), (3000, 1, -1), (3000, -1, -1), (6000, 0, 1))


def refined_index_minus_one(records) -> Dict[tuple, Fraction]:
    """I - 1 collected on the (milli, ypow, fugacity-monomial) grid --
    exactly the grid on which Mathematica's Total[res] - 1 collects."""
    acc: Dict[tuple, Fraction] = defaultdict(Fraction)
    for term, mult in records:
        value = term.coeff * mult
        if value:
            acc[(term.milli, term.ypow, term.fug)] += value
    acc[(0, 0, ())] -= 1
    return {k: v for k, v in acc.items() if v}


def net_reduced(records) -> Dict[Tuple[int, int], Fraction]:
    """(1-t^3 y)(1-t^3/y)(I-1) with all fugacities except t, y set to 1."""
    base: Dict[Tuple[int, int], Fraction] = defaultdict(Fraction)
    for term, mult in records:
        value = term.coeff * mult
        if value:
            base[(term.milli, term.ypow)] += value
    base[(0, 0)] -= 1
    out: Dict[Tuple[int, int], Fraction] = defaultdict(Fraction)
    for (m, k), v in base.items():
        if v:
            for dm, dk, sign in _KERNEL:
                out[(m + dm, k + dk)] += sign * v
    return {k: v for k, v in out.items() if v}


def chi_multiplicities(reduced: Dict[Tuple[int, int], Fraction],
                       milli: int) -> Dict[int, Fraction]:
    """SU(2)_y character content at one t-exponent bucket.

    Returns {j2: n} with j2 = 2j, from n_{j} = c_{y^{2j}} - c_{y^{2j+2}}
    (iterative peel by parity -- the correct version of what extractScalar
    approximates)."""
    coeffs = {k: v for (m, k), v in reduced.items() if m == milli}
    if not coeffs:
        return {}
    top = max(abs(k) for k in coeffs)
    out: Dict[int, Fraction] = {}
    for j2 in range(top, -1, -1):
        n = coeffs.get(j2, Fraction(0)) - coeffs.get(j2 + 2, Fraction(0))
        if n:
            out[j2] = n
    return out


def scan(records, t_order: int) -> dict:
    """Run C1'/C3/C4 on the parsed, projected FORM terms of one theory.

    Returns a dict of findings; every list empty and c4 False on a theory
    that raises no flag."""
    max_milli = 1000 * t_order
    refined = refined_index_minus_one(records)
    reduced = net_reduced(records)

    flags = {
        "c4_vanishing": not refined,        # I == 1 identically (F2 input)
        "c1prime": [],                      # [(j2, n)] free spinning sector
        "c3_free": [],                      # [(j2, m)] higher-spin current
        "c3_enhance": [],                   # [(j2, m)] extra supercurrent
        "noninteger": [],                   # bucket contamination diagnostics
    }
    if flags["c4_vanishing"]:
        return flags

    # C1': E = 2 + 2j  <->  milli = 2000 + 1000*j2, j2 >= 1
    for j2 in range(1, (max_milli - 2000) // 1000 + 1):
        milli = 2000 + 1000 * j2
        n = chi_multiplicities(reduced, milli).get(j2)
        if n is None:
            continue
        if n.denominator != 1:
            flags["noninteger"].append((milli, j2, str(n)))
            continue
        chiral_sign_content = n if j2 % 2 == 0 else -n   # (-1)^{2j} * n
        if chiral_sign_content > 0:
            flags["c1prime"].append((j2, int(n)))

    # C3: E = 6 + 2j  <->  milli = 6000 + 1000*j2, j2 >= 1
    for j2 in range(1, (max_milli - 6000) // 1000 + 1):
        milli = 6000 + 1000 * j2
        n = chi_multiplicities(reduced, milli).get(j2)
        if n is None:
            continue
        if n.denominator != 1:
            flags["noninteger"].append((milli, j2, str(n)))
            continue
        m = -n if j2 % 2 == 0 else n                     # (-1)^{2j+1} * n
        if m > 0:
            if j2 == 1:
                flags["c3_enhance"].append((j2, int(m)))
            else:
                flags["c3_free"].append((j2, int(m)))
    return flags


def _g_part(fug) -> tuple:
    return tuple((name, e) for name, e in fug if name.startswith("g"))


def index2_grid(records) -> Dict[tuple, Fraction]:
    """index2 = reduced index with FIELD fugacities -> 1 and the true U(1)
    fugacities g_i kept, collected per (milli, ypow, g-monomial) — the grid
    the mcode consistency checks act on (fugRule keeps g's; R3)."""
    base: Dict[tuple, Fraction] = defaultdict(Fraction)
    for term, mult in records:
        v = term.coeff * mult
        if v:
            base[(term.milli, term.ypow, _g_part(term.fug))] += v
    base[(0, 0, ())] -= 1
    out: Dict[tuple, Fraction] = defaultdict(Fraction)
    for (m, k, g), v in base.items():
        if v:
            for dm, dk, sign in _KERNEL:
                out[(m + dm, k + dk, g)] += sign * v
    return {key: v for key, v in out.items() if v}


def mcode_consistency_violations(records, t_order: int) -> List[str]:
    """Python mirror of the mcode's C1/C2 consistency section (the three
    AnyTrue checks of generate_index_mcode) on the fastmatch records,
    restricted to buckets that are EXACT at this t_order (milli <
    1000*t_order, the FORM-truncation exactness of R8) — so any violation
    reported here is present verbatim in the full-order data and the
    Mathematica check at full order rejects the theory too (prefilter
    soundness). Used by the V2_PREFILTER stage (step 21); an empty list
    does NOT certify consistency (higher buckets unseen)."""
    max_milli = 1000 * t_order
    grid = index2_grid(records)
    viol: List[str] = []

    # check 1 (scalar): term of indexscalar with E < 6 and coefficient < 0.
    # indexscalar = y-peel of index2; per (milli, g) the scalar
    # multiplicity is n_0 = c_{y^0} - c_{y^2}.
    buckets: Dict[tuple, Dict[int, Fraction]] = defaultdict(dict)
    for (m, k, g), v in grid.items():
        if m < max_milli:
            buckets[(m, g)][k] = v
    for (m, g), coeffs in sorted(buckets.items()):
        if m < 6000:
            n0 = coeffs.get(0, Fraction(0)) - coeffs.get(2, Fraction(0))
            if n0 < 0:
                viol.append(f"scalar t^{m / 1000} g={g} coeff {n0} < 0")

    # check 2 (spinor window floor): for each y-power k >= 1, the minimal
    # t-exponent present in Coefficient[indexspinor, y^k] must be >= 2 + k.
    min_milli: Dict[int, int] = {}
    for (m, k, g), v in grid.items():
        if k >= 1 and m < max_milli:
            min_milli[k] = min(min_milli.get(k, m), m)
    for k, m in sorted(min_milli.items()):
        if m < 2000 + 1000 * k:
            viol.append(f"spinor y^{k}: content at t^{m / 1000} "
                        f"< 2+{k}")

    # check 3 (spinor sign in the window): term with E < 6 + |2j| whose
    # sign equals (-1)^{1+|2j|}.
    for (m, k, g), v in sorted(grid.items()):
        if k >= 1 and m < max_milli and m < 6000 + 1000 * k:
            bad_sign = -1 if (1 + k) % 2 else 1
            if (1 if v > 0 else -1) == bad_sign:
                viol.append(f"spinor sign t^{m / 1000} y^{k} g={g} "
                            f"coeff {v}")
    return viol


def describe(flags: dict) -> List[str]:
    """Human-readable one-liners for the log."""
    out = []
    if flags["c4_vanishing"]:
        out.append("C4: index == 1 identically within truncation "
                   "(no operators; possible SUSY breaking)")
    for j2, n in flags["c1prime"]:
        out.append(f"C1': free spinning sector signal at t^{2 + j2} "
                   f"chi_{j2}/2 (net chiral-sign multiplicity {abs(n)})")
    for j2, m in flags["c3_free"]:
        out.append(f"C3: higher-spin current signal at t^{6 + j2} "
                   f"chi_{j2}/2 (net multiplicity {m}) -> free sector")
    for j2, m in flags["c3_enhance"]:
        out.append(f"C3: extra supercurrent signal at t^7 chi_1/2 "
                   f"(net multiplicity {m}) -> N>=2 enhancement candidate")
    for milli, j2, n in flags["noninteger"]:
        out.append(f"WARNING: non-integer chi multiplicity {n} at "
                   f"t^{milli / 1000} j2={j2} (bucket contamination)")
    return out
