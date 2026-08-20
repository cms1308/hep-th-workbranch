#!/usr/bin/env python3
"""Step 1 toy traces through the index pipeline of refs/landscape_refactored.py.

Stages exercised (the actual production functions, unmodified):
    makefrm/form  -- FORM plethystic-exponential expansion
    Mathcode/match -- sympy decode of FORM output + character -> singlet projection
    decouple/Index -- wolframscript post-processing (consistency + operator extraction)

Toy theory: one gauge-singlet chiral X1 of R-charge r, plus the always-present
Sp(2)=C2 vector multiplet. The vector multiplet's adjoint characters are projected
out via a minimal structural stand-in character table (arxiv/C2/phi/phi1.txt):
Adams vector [1] of the adjoint -> the adjoint itself (non-singlet) -> match returns 0.

Toy 1: r=2/3, t_order=3 -> index 1 + X1 t^2;   decouple() flags X1 as decoupled.
Toy 2: r=4/5, t_order=3 -> index 1 + X1 t^2.4; Index() -> relevant=[X1], fliped=[X1].
Toy 3: r=4/5, t_order=5 -> conjugate fermion -X1^-1 t^3.6 enters -> "inconsistent"
       (physically correct: a W=0 chiral with r != 2/3 is not an SCFT).

Verify criterion (STATE step 1): decoded Mathcode output equals the analytic
plethystic exponential term-by-term; decouple/Index outputs match hand-derived
expectations.

Run:  python3 01_toy_trace.py   (needs form, lie, wolframscript on PATH)
"""
import os
import sys
from pathlib import Path

import sympy

HERE = Path(__file__).resolve().parent
WORK = HERE / "work01"
STUBS = WORK / "stubs"
REFS_DIR = HERE.parent / "refs"

# --- isolated work dir -------------------------------------------------------
(WORK / "arxiv" / "C2" / "phi").mkdir(parents=True, exist_ok=True)
STUBS.mkdir(exist_ok=True)
# Structural stand-in for the real character table (format inferred from
# picklines/match usage): one dict-literal line keyed by the Adams multiplicity
# vector. '1X[2,0]' = one copy of a non-singlet highest weight -> projected to 0.
(WORK / "arxiv" / "C2" / "phi" / "phi1.txt").write_text("{'[1]': '1X[2,0]'}\n")
# pymysql is imported at module top but only used by the LiE cache / SQL logging,
# neither of which the toys reach. Stub it so spawn-children can import too.
(STUBS / "pymysql.py").write_text(
    "class Error(Exception):\n    pass\n\n"
    "def connect(*a, **k):\n"
    "    raise RuntimeError('pymysql stub: DB disabled in calc toys')\n"
)
sys.path.insert(0, str(STUBS))
sys.path.insert(0, str(REFS_DIR))
os.chdir(WORK)  # module derives ARXIV_DIR / RESULTS_DIR from cwd at import time

import landscape_refactored as L  # noqa: E402

t, y = L.t, L.y
X1 = sympy.symbols("X1")
PID = os.getpid()


def form_and_decode(t_order, rlist):
    """Run makefrm+form, then decode every FORM term through the real match()."""
    assert L.form(t_order, PID, rlist) == "ok", "FORM stage failed"
    raw = (L.FRM_DIR / f"form{PID}.txt").read_text()
    terms = L.Mathcode(t_order, PID, ["t", "y", "X1"])
    total = sympy.expand(sum(sympy.sympify(x) for x in terms))
    return raw, terms, total


def check(label, got, expected_zero_diff=None, equal=None):
    if expected_zero_diff is not None:
        diff = sympy.simplify(sympy.expand(got - expected_zero_diff))
        ok = diff == 0 or getattr(diff, "is_zero", False)
        detail = f"decoded - analytic = {diff}"
    else:
        ok = got == equal
        detail = f"got {got!r}, expected {equal!r}"
    print(f"[{'PASS' if ok else 'FAIL'}] {label}: {detail}")
    return ok


def main():
    results = []
    # each rlist entry: [name, [R-charges...], [U(1)-flavor charge vector per field]]
    # g_list must be parallel to the R-charge list; [[]] = one field, no U(1) charges.
    # charges2 always passes ALL species names (empty for absent matter) -- makefrm
    # declares FORM CF symbols from these names, and the vector-multiplet term needs
    # 'phi' declared, so the full list is required.
    def full_rlist(x_charges, x_globals):
        names = ["X", "M", "q", "qb", "phi", "S", "Sb", "A", "Ab",
                 "U", "Ub", "V", "Vb", "W", "Wb"]
        out = [["X", x_charges, x_globals]]
        out += [[nm, [], []] for nm in names[1:]]
        return out

    rlist1 = full_rlist(["0.666666666666666666666666666667"], [[]])
    rlist2 = full_rlist(["0.8"], [[]])

    # ---- Toy 1: r=2/3, t_order=3 -------------------------------------------
    raw1, terms1, tot1 = form_and_decode(3, rlist1)
    print("--- toy1 raw FORM output:", raw1)
    print("--- toy1 match results:", terms1)
    # analytic: I = PE[(t^2 X1 - t^4/X1 + vec)J]_{<= t^3, singlet} = 1 + X1 t^2
    results.append(check("toy1 index == 1 + X1*t^2", tot1, 1 + X1 * t**2.0))
    n_char_dropped = sum(1 for x in terms1 if x == 0)
    results.append(check("toy1 vector-multiplet terms projected out (2 of them)",
                         n_char_dropped, equal=2))
    dec1 = L.decouple(3, "{}", "{}", "{}", rlist1)
    print("--- toy1 decouple():", dec1)
    results.append(check("toy1 decoupled == ['X1']", dec1.get("decoupled"), equal=["X1"]))
    results.append(check("toy1 consistency", dec1.get("consistency"), equal="consistent"))

    # ---- Toy 2: r=4/5, t_order=3 -------------------------------------------
    raw2, terms2, tot2 = form_and_decode(3, rlist2)
    print("--- toy2 match results:", terms2)
    results.append(check("toy2 index == 1 + X1*t^2.4", tot2, 1 + X1 * t**2.4))
    ind2 = L.Index(3, "{}", rlist2)
    print("--- toy2 Index():", ind2)
    results.append(check("toy2 consistency", ind2.get("consistency"), equal="consistent"))
    results.append(check("toy2 decoupled == []", ind2.get("decoupled"), equal=[]))
    results.append(check("toy2 relevant == ['X1']", ind2.get("relevant"), equal=["X1"]))
    results.append(check("toy2 fliped == ['X1']", ind2.get("fliped"), equal=["X1"]))

    # ---- Toy 3: r=4/5, t_order=5 -------------------------------------------
    raw3, terms3, tot3 = form_and_decode(5, rlist2)
    print("--- toy3 match results:", terms3)
    expected3 = 1 + X1 * t**2.4 - t**3.6 / X1 + X1**2 * t**4.8
    results.append(check("toy3 index == 1 + X1 t^2.4 - X1^-1 t^3.6 + X1^2 t^4.8",
                         tot3, expected3))
    ind3 = L.Index(5, "{}", rlist2)
    print("--- toy3 Index():", ind3)
    results.append(check("toy3 consistency == inconsistent",
                         ind3.get("consistency"), equal="inconsistent"))

    print()
    print(f"{sum(results)}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
