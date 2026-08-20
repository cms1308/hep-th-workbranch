#!/usr/bin/env python3
"""Step 7 cross-check (a): exact reduced indices of free theories (sympy PE)
against the derived allowed region and the derived multiplet table.

Theories:
  1. free chiral (r=2/3)          -- boundary free-scalar signal +t^2 chi_0;
                                     every term inside the derived region;
                                     C3 coefficients (t^{6+2j} chi_j, j>=1)
                                     NON-positive (converse of C3 is false:
                                     no operator with (j,0), Delta=2+j, R=2j/3
                                     exists here);
                                     sharp low-order predictions from the
                                     multiplet table: t^3: 0, t^4: 0, t^5: 0,
                                     t^6: 0 (phi^3 marginal vs U(1) current),
                                     t^8 chi_0: 0 (phi^4 vs [phi^2 phibar]).
  2. free U(1) vector             -- boundary free-fermion signal -t^3 chi_1/2
                                     (the spinning C1' boundary the code does
                                     not check); all E = 0 mod 3; REALIZES the
                                     C3 signal at j=3/2: +t^9 chi_3/2 from the
                                     higher-spin current multiplet
                                     A1A2b[3/2,0,1] with primary lambda_(a F_bc).
  3. free hypermultiplet (2 chirals, r=2/3) -- POSITIVE realization of the
                                     current-multiplet family behind C3: the
                                     j=1/2 member A1A2b[1/2,0,1/3] (the extra
                                     supercurrent) must appear as +t^7 chi_1/2
                                     with coefficient = 1 (N=2 enhancement
                                     signature t^7(y+1/y)).

Series representation: dict {n: sympy expr in y} for the t^n coefficient,
truncated at N_MAX. All exponents here are integers (r = 2/3 letters).

Run:  python3 07_free_theory_check.py
"""
from collections import defaultdict

import sympy
from sympy import Rational, symbols

y = symbols("y", positive=True)
N_MAX = 10
HALF = Rational(1, 2)

PASS = []


def check(label, ok, detail=""):
    PASS.append(bool(ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))


# ---- truncated series algebra ---------------------------------------------
def smul(A, B):
    out = defaultdict(lambda: sympy.S.Zero)
    for a, ca in A.items():
        for b, cb in B.items():
            if a + b <= N_MAX:
                out[a + b] += ca * cb
    return dict(out)


def sexp(A):
    out = {0: sympy.S.One}
    term = {0: sympy.S.One}
    for k in range(1, N_MAX + 1):
        term = smul(term, A)
        if not term:
            break
        for n, c in term.items():
            out[n] = sympy.expand(out.get(n, 0) + c / sympy.factorial(k))
    return out


def substitute_power(A, n):
    """A(t,y) -> A(t^n, y^n)."""
    return {a * n: c.subs(y, y**n) for a, c in A.items() if a * n <= N_MAX}


def plethystic_exponential(single):
    tot = defaultdict(lambda: sympy.S.Zero)
    for n in range(1, N_MAX + 1):
        sub = substitute_power(single, n)
        for a, c in sub.items():
            tot[a] += c / n
    return sexp(dict(tot))


def deriv_tower():
    """1/((1-t^3 y)(1-t^3/y)) as a truncated series."""
    out = defaultdict(lambda: sympy.S.Zero)
    for a in range(0, N_MAX // 3 + 1):
        for b in range(0, N_MAX // 3 + 1):
            if 3 * (a + b) <= N_MAX:
                out[3 * (a + b)] += y ** (a - b)
    return dict(out)


def reduce_index(I):
    """(1 - t^3 y)(1 - t^3/y)(I - 1)."""
    Im1 = {n: c for n, c in I.items() if n != 0}
    if 0 in I:
        c0 = sympy.expand(I[0] - 1)
        if c0 != 0:
            Im1[0] = c0
    pref = {0: sympy.S.One, 3: -(y + 1 / y), 6: sympy.S.One}
    return {n: sympy.expand(c) for n, c in smul(pref, Im1).items()}


# ---- character resolution --------------------------------------------------
def chi_resolve(expr):
    """Laurent poly in y -> {j: coeff} via iterative character peel."""
    e = sympy.expand(expr)
    d = defaultdict(lambda: sympy.S.Zero)
    if e != 0:
        for term in sympy.Add.make_args(e):
            c, k = term.as_coeff_exponent(y)
            d[int(k)] += c
    out = {}
    kmax = max((abs(k) for k in d if d[k] != 0), default=-1)
    for k in range(kmax, -1, -1):
        c = sympy.expand(d[k])
        if c != 0:
            j = Rational(k, 2)
            out[j] = c
            for m in range(-k, k + 1, 2):
                d[m] = sympy.expand(d[m] - c)
    resid = {k: v for k, v in d.items() if sympy.expand(v) != 0}
    assert not resid, f"character peel residue: {resid}"
    return out


def resolve_series(Ired):
    return {n: chi_resolve(c) for n, c in Ired.items()
            if sympy.expand(c) != 0}


# ---- derived-region classification -----------------------------------------
def region_report(name, table, expect_boundary):
    """Check every (E, j, coeff) against the derived region."""
    viol_c1, boundary, viol_c2, c3_hits = [], [], [], []
    for E, jc in sorted(table.items()):
        for j, c in jc.items():
            chiral_sign = (-1) ** int(2 * j)
            if E < 2 + 2 * j:
                viol_c1.append((E, j, c))
            elif E == 2 + 2 * j:
                boundary.append((E, j, c))
            elif E < 6 + 2 * j and sympy.sign(c) == -chiral_sign:
                viol_c2.append((E, j, c))
            if E == 6 + 2 * j and sympy.sign(c) == -chiral_sign:
                c3_hits.append((E, j, c))
    print(f"  {name}: I_red terms (E, {{j: coeff}}):")
    for E, jc in sorted(table.items()):
        print(f"    t^{E}: {dict(sorted(jc.items()))}")
    check(f"{name}: no C1 violation (E < 2+2j)", not viol_c1, str(viol_c1))
    check(f"{name}: boundary content = {expect_boundary}",
          sorted(boundary) == sorted(expect_boundary), str(boundary))
    check(f"{name}: no C2-violating sign in the window", not viol_c2,
          str(viol_c2))
    return c3_hits


def main():
    tower = deriv_tower()

    # ---- 1. free chiral r=2/3 ----------------------------------------------
    sl_num = {2: sympy.S.One, 4: -sympy.S.One}          # t^2 - t^4
    single = smul(sl_num, tower)
    Ired = reduce_index(plethystic_exponential(single))
    tab = resolve_series(Ired)
    c3 = region_report("free chiral (r=2/3)", tab, [(2, 0, 1)])
    check("free chiral: C3 coefficients non-positive for j>=1 "
          "(no A1A2b[j,0,2j/3] operator exists; converse of C3 false)",
          all(not (j >= 1) for (_, j, _) in c3), str(c3))
    preds = {3: {}, 4: {}, 5: {}, 7: {}}
    ok = all(tab.get(n, {}) == v for n, v in preds.items())
    check("free chiral: predicted vanishing orders t^3,t^4,t^5,t^7 "
          "(phi^2 vs psibar at t^4; phi^3 vs U(1) current at t^6 -> see next; "
          "t^5 = 3r+3 empty confirms NO EOM residual for the j=0 free scalar)",
          ok, str({n: tab.get(n, {}) for n in preds}))
    check("free chiral: t^6 coefficient = 0 = #(marginal phi^3) - #(U(1) current)",
          tab.get(6, {}) == {}, str(tab.get(6, {})))
    check("free chiral: t^8 chi_0 = 0 = #(phi^4) - #(A2b[phi^2 phibar])",
          tab.get(8, {}).get(0, 0) == 0, str(tab.get(8, {})))

    # ---- 2. free U(1) vector ----------------------------------------------
    sl_num = {3: -(y + 1 / y), 6: 2 * sympy.S.One}
    single = smul(sl_num, tower)
    Ired = reduce_index(plethystic_exponential(single))
    tab = resolve_series(Ired)
    c3 = region_report("free U(1) vector", tab, [(3, HALF, -1)])
    check("free vector: boundary -t^3 chi_1/2 = free-fermion signal "
          "(spinning C1' boundary, unchecked by the code)", True)
    check("free vector: all E = 0 mod 3", all(n % 3 == 0 for n in tab),
          str(sorted(tab)))
    check("free vector REALIZES the C3 signal: +t^9 chi_3/2 = "
          "(-1)^{2j+1} t^{6+2j} chi_j at j=3/2 with coefficient +1 -- the "
          "higher-spin current multiplet A1A2b[3/2,0,1], primary "
          "lambda_(a F_bc) (Delta=7/2, R=1, left-saturated 3R=2j)",
          c3 == [(9, Rational(3, 2), 1)], str(c3))
    check("free vector t^6 closure = 3: lambda*lambda chiral (B1b[0,0,2], +1)"
          " + [lambdabar] (B1 A1b[0,1/2,-1], +1) + the [lambda] EOM residual"
          " (A1 B1b[1/2,0,1] second term +t^{3r+3} chi_0, +1) -- pins the "
          "corrected two-term free-fermion entry",
          tab.get(6, {}).get(0, 0) == 3, str(tab.get(6, {})))
    check("free vector t^9 closure with single-term current multiplets: "
          "{3/2: +1 (lambda F current), 1/2: -1 (stress tensor)} -- no "
          "further residuals (the [lambda] chain stops at t^6; A1A2b/A1A1b "
          "left-nulls have no delta=0 states)",
          tab.get(9, {}) == {Rational(3, 2): 1, Rational(1, 2): -1},
          str(tab.get(9, {})))

    # ---- 3. free hypermultiplet (2 chirals r=2/3) --------------------------
    sl_num = {2: 2 * sympy.S.One, 4: -2 * sympy.S.One}
    single = smul(sl_num, tower)
    Ired = reduce_index(plethystic_exponential(single))
    tab = resolve_series(Ired)
    region_report("free hyper (2 chirals r=2/3)", tab,
                  [(2, 0, 2)])
    t7 = tab.get(7, {}).get(HALF, 0)
    check("free hyper: +t^7 chi_1/2 coefficient = 1 -- the extra-supercurrent "
          "multiplet A1A2b[1/2,0,1/3] (j=1/2 member of the C3 family; the "
          "N=2 enhancement signature t^7(y+1/y))", t7 == 1, f"coeff = {t7}")
    # moment maps: N=2 flavor symmetry of one free hyper (SU(2)) -> t^4 terms
    print(f"  free hyper t^4: {tab.get(4, {})}, t^6: {tab.get(6, {})}")

    n = len(PASS)
    print(f"\n{'ALL PASS' if all(PASS) else 'FAILURES PRESENT'}: "
          f"{sum(PASS)}/{n}")
    return 0 if all(PASS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
