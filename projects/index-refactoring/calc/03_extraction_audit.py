#!/usr/bin/env python3
"""Step 3: audit the gauge-invariant-operator extraction of generate_index_mcode
against the deformation procedure of arXiv:2408.02953 (sec. 2):

  decoupled: scalar at t-exponent E <= 2 (R <= 2/3, unitarity bound) -> flip X, redo
  relevant:  R < 2 strict  -> E < 6            (queued as delta W = O)
  fliped:    R < 4/3 strict -> E < 4           (queued as delta W = M O)
  marginal:  E = 6; dim3 = net t^6 coeff = #marginal - #currents  (paper eq. (t6))
  F-term:    wcond2 replaces negative fugacity powers f^-1 -> (wMatch/f), i.e.
             identifies psibar_f with dW/df, so F-term-eaten operators drop out
             of the relevant list (chiral-ring relations).

Same harness as step 2 (synthetic reduced indices through the REAL generated
Mathematica code). PASS = code behaves as the paper/procedure analysis predicts.

Run:  python3 03_extraction_audit.py   (needs wolframscript)
"""
import ast
import os
import subprocess
import sys
from pathlib import Path

import sympy

HERE = Path(__file__).resolve().parent
WORK = HERE / "work01"
sys.path.insert(0, str(WORK / "stubs"))
sys.path.insert(0, str(HERE.parent / "refs"))
os.chdir(WORK)

import landscape_refactored as L  # noqa: E402

PID = os.getpid()
T_ORDER = 9
TMAX = 12

t, y = L.t, L.y
q1, q2, M1, g1 = sympy.symbols("q1 q2 M1 g1")


def desc(expr):
    total = sympy.S.Zero
    for term in sympy.Add.make_args(sympy.expand(expr)):
        e0 = float(term.as_powers_dict().get(t, 0))
        n = int((TMAX - e0) // 3)
        for a in range(n + 1):
            for b in range(n + 1 - a):
                total += term * (t**3 * y) ** a * (t**3 / y) ** b
    return sympy.expand(total)


def to_wl(expr):
    out = []
    for x in sympy.Add.make_args(sympy.expand(expr)):
        c, r = x.as_coeff_Mul()
        out.append(str(sympy.Float(c, 15) * r).replace("**", "^"))
    return "{" + ", ".join(out) + "}"


def run(content, vars_str, w2):
    (L.FRM_DIR / f"express{PID}.txt").write_text(to_wl(content))
    mcode = L.generate_index_mcode(PID, vars_str, T_ORDER, w2)
    proc = subprocess.run(["wolframscript", "-code", mcode],
                          capture_output=True, text=True, timeout=600)
    out = proc.stdout.replace("Null", "").strip().replace(" ", "")
    try:
        return ast.literal_eval(out)
    except Exception:
        return {"__unparseable__": out[:400]}


def report(label, res, expect_desc, ok):
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"        expected: {expect_desc}")
    print(f"        got: {res}")
    return ok


def main():
    results = []

    # FLIP1: W = M1*q1 (R_O = R_M = 1). Reduced-index content: O at t^3 q1,
    # M at t^3 M1, psibar_M at -t^3/M1. F-term pairing must (i) cancel in the
    # unrefined index -> consistent, (ii) remove the eaten operator q1 from the
    # relevant list, leaving the generator M1 (the H0*-type chiral-ring count).
    res = run(1 + desc(t**3 * q1 + t**3 * M1 - t**3 / M1),
              "{t, y, q1, M1}", '{"M1*q1"}')
    results.append(report(
        "FLIP1 single flip: consistent, relevant=[M1], fliped=[M1]", res,
        "consistent / relevant ['M1'] / fliped ['M1']",
        res.get("consistency") == "consistent"
        and res.get("relevant") == ["M1"] and res.get("fliped") == ["M1"]))

    # FLIP2: W = M1*q1 + M1*q2 (dW/dM1 = q1 + q2). SelectFirst picks q1;
    # exactly ONE combination is removed from the ring: relevant = {M1, q2}.
    res = run(1 + desc(t**3 * q1 + t**3 * q2 + t**3 * M1 - t**3 / M1),
              "{t, y, q1, q2, M1}", '{"M1*q1", "M1*q2"}')
    results.append(report(
        "FLIP2 multi-partner F-term: one combination removed", res,
        "consistent / relevant {M1,q2}",
        res.get("consistency") == "consistent"
        and sorted(res.get("relevant") or []) == ["M1", "q2"]))

    # THRESH: operators at E=3.9 (relevant+flippable), E=4.2 (relevant only,
    # 4 <= E), t^6 net +1 (2 marginal - 1 current): dim3 = 1, no W.
    res = run(1 + desc(t**3.9 * q1 + t**4.2 * q2 + 2 * t**6 - t**6),
              "{t, y, q1, q2}", "{}")
    results.append(report(
        "THRESH relevant<6, fliped<4 strict, dim3=1", res,
        "relevant {q1,q2} / fliped [q1] / dim3 1",
        res.get("consistency") == "consistent"
        and sorted(res.get("relevant") or []) == ["q1", "q2"]
        and res.get("fliped") == ["q1"] and res.get("dim3") == 1))

    # DEC1: scalar at E=1.8 <= 2 (below unitarity bound) next to a normal
    # relevant op: decoupled branch must fire and report only q1.
    res = run(1 + desc(t**1.8 * q1 + t**3 * M1),
              "{t, y, q1, M1}", "{}")
    results.append(report(
        "DEC1 decoupled scalar at t^1.8 -> decoupled=[q1]", res,
        "decoupled ['q1']",
        res.get("decoupled") == ["q1"]))

    # DEC2: same but the decoupled operator carries a U(1) flavor charge
    # (g1^2 survives in indexscalar). Probes the unsorted `exponents` list in
    # generate_index_mcode (Plus canonical ordering with g-monomials).
    res = run(1 + desc(t**1.8 * q1 * g1**2 + t**3 * M1),
              "{t, y, q1, M1, g1}", "{}")
    results.append(report(
        "DEC2 decoupled scalar with g-charge -> decoupled=[q1] (ordering probe)",
        res, "decoupled ['q1'] if exponent ordering robust",
        res.get("decoupled") == ["q1"]))

    print()
    print(f"{sum(results)}/{len(results)} extraction cases behaved as analyzed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
