#!/usr/bin/env python3
"""Step 2: audit the consistency checks of generate_index_mcode against the
prescriptions of arXiv:2408.02953 (sec. "Testing Unitarity via the Superconformal
Index", quoting Evtikhiev-Rocek arXiv:1708.08307):

  C1: a term t^E chi_j(y) with E < 2+2j                  -> unitarity violating
  C2: a term (-1)^(2j+1) t^E chi_j(y), 2+2j <= E < 6+2j  -> unitarity violating
  C3: coeff of (-1)^(2j+1) t^(6+2j) chi_j(y) (j>=1) positive -> free field present
  C4: vanishing index -> SUSY broken, exclude

Method: feed synthetic indices with known classification through the REAL
generated Mathematica code (write express{pid}.txt directly, run wolframscript,
parse exactly as Index() does). Synthetic I must look like real pipeline output:
identity term 1 + each operator DRESSED with its derivative-descendant tower
1/((1-t^3 y)(1-t^3/y)), so that the reduced index equals the injected content.
Expected verdicts are derived from the paper conditions by hand; PASS means the
code behaved as the audit analysis predicts (including predicted-wrong behavior
for the GAP/DEFECT findings).

Run:  python3 02_consistency_audit.py   (needs wolframscript)
"""
import ast
import os
import subprocess
import sys
from pathlib import Path

import sympy

HERE = Path(__file__).resolve().parent
WORK = HERE / "work01"          # reuse step-1 work dir (stubs, cwd layout)
sys.path.insert(0, str(WORK / "stubs"))
sys.path.insert(0, str(HERE.parent / "refs"))
os.chdir(WORK)

import landscape_refactored as L  # noqa: E402

PID = os.getpid()
T_ORDER = 9
TMAX = T_ORDER + 3              # generate descendants a bit past the truncation
VARS = "{t, y, q1}"

t, y = sympy.symbols("t y")
q1 = sympy.symbols("q1")


def desc(expr):
    """Dress every operator in expr with its derivative-descendant tower,
    truncated at t^TMAX: expr * sum_{a,b} (t^3 y)^a (t^3/y)^b."""
    total = sympy.S.Zero
    for term in sympy.Add.make_args(sympy.expand(expr)):
        e0 = float(term.as_powers_dict().get(t, 0))
        nmax = int((TMAX - e0) // 3)
        for a in range(nmax + 1):
            for b in range(nmax + 1 - a):
                total += term * (t**3 * y) ** a * (t**3 / y) ** b
    return sympy.expand(total)


def to_wl(expr):
    """sympy expression -> one Mathematica list string {term, term, ...}.

    Every term gets an explicit Float coefficient (as match()'s `1.0*` guarantees
    in production): the generated mcode's coefficient rounding
    Replace[..., (b_*c_) :> Round[b,1]*c] binds b_ to the FIRST factor of Times,
    which is the numeric coefficient only if one is explicitly present."""
    terms = []
    for x in sympy.Add.make_args(sympy.expand(expr)):
        coeff, rest = x.as_coeff_Mul()
        terms.append(str(sympy.Float(coeff, 15) * rest).replace("**", "^"))
    return "{" + ", ".join(terms) + "}"


def run_index_mcode(express_terms: str):
    """Write express{pid}.txt and run the real generate_index_mcode, parsing
    the output exactly as Index() does (including the space-stripping)."""
    (L.FRM_DIR / f"express{PID}.txt").write_text(express_terms)
    mcode = L.generate_index_mcode(PID, VARS, T_ORDER, "{}")
    proc = subprocess.run(["wolframscript", "-code", mcode],
                          capture_output=True, text=True, timeout=600)
    out = proc.stdout.replace("Null", "").strip().replace(" ", "")
    try:
        return ast.literal_eval(out)
    except Exception:
        return {"__unparseable__": out[:400], "__stderr__": proc.stderr[-300:]}


def report(label, res, expect_desc, ok):
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"        expected: {expect_desc}")
    if "__unparseable__" in res:
        print(f"        got: UNPARSEABLE OUTPUT {res['__unparseable__']!r}")
    else:
        print(f"        got: consistency={res.get('consistency')!r} "
              f"relevant={res.get('relevant')!r} dim3={res.get('dim3')!r} "
              f"non-manifest={res.get('non-manifestsymmetry')!r}")
    return ok


chi1 = y**2 + 1 + y**-2            # SU(2) spin-1 character in y = fugacity^(2 j2)
chi2 = y**4 + y**2 + 1 + y**-2 + y**-4  # spin-2


def main():
    results = []

    # A. healthy index: relevant scalar q1 at t^3, net t^6 coefficient +1.
    res = run_index_mcode(to_wl(1 + desc(2 * t**3 * q1 + t**6)))
    results.append(report(
        "A legit index -> consistent, relevant=[q1], dim3=1", res,
        "consistent / ['q1'] / 1",
        res.get("consistency") == "consistent"
        and res.get("relevant") == ["q1"] and res.get("dim3") == 1))

    # B. C2, j=0: negative scalar in 2 <= E < 6.
    res = run_index_mcode(to_wl(1 + desc(-t**4.5 / q1)))
    results.append(report(
        "B neg scalar t^4.5 (C2, j=0) -> inconsistent", res, "inconsistent",
        res.get("consistency") == "inconsistent"))

    # C. C1, j=1/2: spinor term below E = 2+2j = 3.
    res = run_index_mcode(to_wl(1 + desc(t**2.5 * y * q1)))
    results.append(report(
        "C spinor t^2.5 chi_{1/2} (C1) -> inconsistent", res, "inconsistent",
        res.get("consistency") == "inconsistent"))

    # D. C2, j=1/2: wrong-sign (+) spinor in 3 <= E < 7.
    res = run_index_mcode(to_wl(1 + desc(t**5 * y * q1)))
    results.append(report(
        "D +t^5 chi_{1/2} (C2, j=1/2) -> inconsistent", res, "inconsistent",
        res.get("consistency") == "inconsistent"))

    # E. C3 (j=1): -3 t^8 chi_1(y) = free-field signal per the paper.
    #    The code has NO such check -> expect (wrong) "consistent". GAP F1.
    res = run_index_mcode(to_wl(1 + desc(-3 * t**8 * chi1)))
    results.append(report(
        "E -3 t^8 chi_1 (C3 free-field signal) -> code says consistent [GAP F1]",
        res, "code: consistent (paper: free field present -> should be flagged)",
        res.get("consistency") == "consistent"))

    # F. C4: identically vanishing reduced index (I = 1 to computed order).
    #    Expect: NOT flagged as SUSY-broken (paper: exclude); the generated code
    #    either calls it consistent or crashes on Exponent[0, y].
    res = run_index_mcode("{1}")
    results.append(report(
        "F vanishing reduced index (C4) -> not flagged as SUSY-broken [GAP F2]",
        res, "code: consistent-or-crash (paper: SUSY broken -> exclude)",
        "__unparseable__" in res or res.get("consistency") == "consistent"))

    # G. extractScalar defect: full spin-2 character +t^6 chi_2 alongside a
    #    relevant scalar. Correct: dim3 = 0 (a spin-2 char has no scalar
    #    content), marginal = {}. The non-iterative character peel
    #    over-subtracts, leaving indexscalar = 2 t^3 q1 - t^6 chi_1(y);
    #    dim3 becomes y-dependent junk -> the PythonExpression export is
    #    unparseable (production would log "index error"). DEFECT F3.
    res = run_index_mcode(to_wl(1 + desc(2 * t**3 * q1 + t**6 * chi2)))
    results.append(report(
        "G +t^6 chi_2 (spin-2 char) -> dim3 corrupted/unparseable [DEFECT F3]",
        res, "correct: dim3=0; code: y-dependent dim3 -> unparseable output",
        "__unparseable__" in res or res.get("dim3") != 0))

    print()
    print(f"{sum(results)}/{len(results)} audit cases behaved as analyzed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
