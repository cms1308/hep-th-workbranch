#!/usr/bin/env python3
"""Step 7 cross-check (a), pipeline half: the production FORM + match front end,
run on a single free chiral of R = 2/3 at t_order = 9, must reproduce the exact
sympy plethystic exponential -- including, after reduction, the multiplet
structure derived in 07_multiplet_index.py:

    I_red(free chiral) = t^2  -  t^9 chi_{1/2}(y)   (+ O(t^10))
                         ^^^     ^^^^^^^^^^^^^^^
                         free    stress-tensor multiplet A1A1b[1/2,1/2,0]
                         scalar

Method: makefrm() as in production, then the vector-multiplet term
`+sum_(j,1,N, Kvec(...)*phi(j)/j)` is deleted from the generated FORM source
(the free chiral has no gauge sector; this avoids needing character tables),
FORM is run with the production post-processing, and the real Mathcode()/match()
decodes every term. Comparison against the exact PE is term-by-term in (E, y),
with the fictitious fugacity X1 kept, then X1 -> 1 and reduction applied.

The free-vector C3 realization (+t^9 chi_3/2, 07_free_theory_check.py) cannot
be pushed through the pipeline front end: the pipeline's vector sector is tied
to a non-abelian gauge group and its character tables; a free U(1) vector is
outside its input space. That half of cross-check (a) is sympy-exact only.

Run:  python3 07_pipeline_free_chiral.py     (needs form on PATH)
"""
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import sympy
from sympy import Rational, symbols

HERE = Path(__file__).resolve().parent
WORK = HERE / "work07"
STUBS = WORK / "stubs"
REFS_DIR = HERE.parent / "refs"

WORK.mkdir(exist_ok=True)
STUBS.mkdir(exist_ok=True)
(STUBS / "pymysql.py").write_text(
    "class Error(Exception):\n    pass\n\n"
    "def connect(*a, **k):\n"
    "    raise RuntimeError('pymysql stub: DB disabled in calc checks')\n"
)
sys.path.insert(0, str(STUBS))
sys.path.insert(0, str(REFS_DIR))
os.chdir(WORK)

import landscape_refactored as L  # noqa: E402

t, y = L.t, L.y
X1 = symbols("X1")
PID = os.getpid()
T_ORDER = 9
N_MAX = 9

PASS = []


def check(label, ok, detail=""):
    PASS.append(bool(ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))


def full_rlist(x_charges, x_globals):
    names = ["X", "M", "q", "qb", "phi", "S", "Sb", "A", "Ab",
             "U", "Ub", "V", "Vb", "W", "Wb"]
    out = [["X", x_charges, x_globals]]
    out += [[nm, [], []] for nm in names[1:]]
    return out


def run_form_without_vector(rlist):
    assert L.makefrm(T_ORDER, PID, rlist) == "ok"
    frm = L.FRM_DIR / f"index{PID}.frm"
    src = frm.read_text()
    pat = re.compile(r"\+sum_\(j, 1, \d+, Kvec\(t\^j,y\^j\)\*phi\(j\)/j\)")
    src2, nsub = pat.subn("", src)
    assert nsub == 1, f"vector term substitution count = {nsub}"
    frm.write_text(src2)
    res = subprocess.run(["form", "-q", str(frm)], capture_output=True,
                         text=True, timeout=600)
    # identical post-processing to production form()
    result = (res.stdout.strip().replace("result", "").replace(" ", "")
              .replace("=", "").replace("\n", "").replace("z", "1")
              .replace("\\", ""))
    (L.FRM_DIR / f"form{PID}.txt").write_text(result[:-1])
    return "ok"


# ---- exact PE (same series algebra as 07_free_theory_check) ----------------
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


def exact_index_with_fugacity():
    tower = {}
    tower = defaultdict(lambda: sympy.S.Zero)
    for a in range(0, N_MAX // 3 + 1):
        for b in range(0, N_MAX // 3 + 1):
            if 3 * (a + b) <= N_MAX:
                tower[3 * (a + b)] += y ** (a - b)
    sl_num = {2: X1, 4: -1 / X1}
    single = smul(sl_num, dict(tower))
    pe = defaultdict(lambda: sympy.S.Zero)
    for n in range(1, N_MAX + 1):
        for a, c in single.items():
            if a * n <= N_MAX:
                pe[a * n] += c.subs([(y, y**n), (X1, X1**n)],
                                    simultaneous=True) / n
    return sexp(dict(pe))


def series_from_expr(expr):
    """sympy expr in t (float or int exponents), y, X1 -> {n: expr in y, X1}."""
    out = defaultdict(lambda: sympy.S.Zero)
    for term in sympy.Add.make_args(sympy.expand(expr)):
        c, e = term.as_independent(t)
        if e == 1:
            n = 0
        else:
            p = e.as_base_exp()[1]
            n = int(round(float(p)))
            assert abs(float(p) - n) < 1e-9, f"non-integer exponent {p}"
        out[n] += c
    return {n: sympy.expand(c) for n, c in out.items() if sympy.expand(c) != 0}


def chi_resolve(expr):
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
            out[Rational(k, 2)] = c
            for m in range(-k, k + 1, 2):
                d[m] = sympy.expand(d[m] - c)
    assert not any(sympy.expand(v) != 0 for v in d.values())
    return out


def main():
    rlist = full_rlist(["0.666666666666666666666666666667"], [[]])
    assert run_form_without_vector(rlist) == "ok"
    terms = L.Mathcode(T_ORDER, PID, ["t", "y", "X1"])
    check("pipeline: FORM + match ran, no dropped terms",
          all(x is not None for x in terms), f"{len(terms)} terms")
    I_pipe = sum(sympy.sympify(x) for x in terms)
    S_pipe = series_from_expr(I_pipe)
    S_exact = exact_index_with_fugacity()
    S_exact = {n: c for n, c in S_exact.items() if sympy.expand(c) != 0}

    ok = True
    for n in range(0, N_MAX + 1):
        diff = sympy.expand(S_pipe.get(n, 0) - S_exact.get(n, 0))
        diff = sympy.simplify(diff)
        if diff != 0:
            ok = False
            print(f"  MISMATCH at t^{n}: {diff}")
    check("pipeline index == exact PE, term-by-term in (t, y, X1), t^0..t^9",
          ok)

    # reduction: I_red = (1-t^3 y)(1-t^3/y)(I-1), X1 -> 1
    Im1 = {n: c.subs(X1, 1) for n, c in S_pipe.items() if n != 0}
    pref = {0: sympy.S.One, 3: -(y + 1 / y), 6: sympy.S.One}
    red = smul(pref, Im1)
    tab = {n: {j: sympy.nsimplify(c, rational=True)
               for j, c in chi_resolve(c0).items()}
           for n, c0 in red.items() if sympy.expand(c0) != 0}
    tab = {n: {j: c for j, c in v.items() if c != 0}
           for n, v in tab.items()}
    tab = {n: v for n, v in tab.items() if v}
    print(f"  pipeline I_red: { {n: dict(v) for n, v in sorted(tab.items())} }")
    check("pipeline I_red = t^2 (free scalar) - t^9 chi_1/2 (stress-tensor "
          "multiplet A1A1b[1/2,1/2,0]), nothing else through t^9",
          tab == {2: {0: sympy.S.One}, 9: {Rational(1, 2): sympy.S.NegativeOne}},
          str(tab))

    n = len(PASS)
    print(f"\n{'ALL PASS' if all(PASS) else 'FAILURES PRESENT'}: "
          f"{sum(PASS)}/{n}")
    return 0 if all(PASS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
