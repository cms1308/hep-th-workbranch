#!/usr/bin/env python3
"""Step 4: implementation-defect audit of the scope-(b) internals.

 (i)   Fugacity encoding round-trip: single() writes the exponent p = 3r (and
       6-3r) as t^d0 s^d1 r^d2 with d0,d1 int-truncated and d2 ROUND_HALF_UP.
       Truncation on leading digits of a positional (base-5000) expansion is
       correct by construction; only the last digit rounds. Expect: decode error
       < 5e-4 (the match() 0.001 quantization threshold) for all r, including
       carry edge cases -> suspicion CLEARED or reproduced.
 (ii)  rep_structure assembly in _match_impl for multi-Adams / multiplicity>1
       character products: positions are absolute (entry k-1 = multiplicity of
       Adams_k, zero-padded to total degree), so symbol iteration order must not
       matter. Verify with fake tables.
 (iii) Multi-species branch: chained real LiE tensor() calls with the pymysql
       stub (cache degrades to recompute, must not fail).
 (iv)  Step-1 suspicion: the maxobjects retry path (lines 550-557) might prepend
       an extra LiE banner line that the fixed [53:] slice does not remove.
       Live lie shows `maxobjects` prints NO banner (only `maxnodes` does, and
       its banner + newline is exactly 53 chars for the constant 9999999), so
       the retry parse is SAFE -> suspicion CLEARED.

Run:  python3 04_defect_audit.py   (needs lie; no wolframscript/FORM required)
"""
import os
import re
import sys
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work01"
sys.path.insert(0, str(WORK / "stubs"))
sys.path.insert(0, str(HERE.parent / "refs"))
os.chdir(WORK)

import landscape_refactored as L  # noqa: E402


def check(label, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))
    return ok


# ---------------------------------------------------------------------------
# (i) encoding round-trip
# ---------------------------------------------------------------------------
def decode_powers(letter: str, name: str):
    """Extract (t,s,r) powers of each letter monomial and decode to a float
    exponent, exactly as match() does (t^(1/500), s^(1/2500000), ...)."""
    out = []
    for m in re.finditer(rf"{name}1(?:\^\(-1\))?\*t\^(\d+)\*s\^(\d+)\*r\^(\d+)", letter):
        d0, d1, d2 = map(int, m.groups())
        out.append(d0 / 500 + d1 / 2_500_000 + d2 / 12_500_000_000)
    return out


def test_encoding():
    ok_all = True
    cases = [
        "0.666666666666666666666666666667",   # 2/3: exact t-digit
        "0.8", "0.5", "1.5",
        "0.123456789012345678901234567890",   # generic
        "0.399999999999999999999999999999",   # near-exact from below
        "0.400000000000000000000000000001",   # near-exact from above
        "1.99999966666666666666666666667",    # 6-3r near digit boundary
        "0.000666666666666666666666666667",   # tiny r-charge (big s/r digits)
    ]
    worst = 0.0
    for r_str in cases:
        letters = L.single("X", [r_str], [[]])
        p_plus = decode_powers(letters[0], "X")
        p_minus = decode_powers(letters[1], "X")
        r_dec = Decimal(r_str)
        for got, want in zip(p_plus + p_minus,
                             [float(3 * r_dec), float(6 - 3 * r_dec)]):
            err = abs(got - want)
            worst = max(worst, err)
            if err >= 5e-4:
                ok_all = False
                print(f"        r={r_str}: decoded {got} vs {want} (err {err:.2e})")
    return check("(i) encoding round-trip < 5e-4 for all cases", ok_all,
                 f"worst error {worst:.3e}")


# ---------------------------------------------------------------------------
# (ii) rep_structure assembly via _match_impl with fake tables
# ---------------------------------------------------------------------------
def test_rep_structure():
    phi_dir = WORK / "arxiv" / "C2" / "phi"
    phi_dir.mkdir(parents=True, exist_ok=True)
    # Adams multiplicity vectors, zero-padded to total degree sum(k*m_k):
    (phi_dir / "phi2.txt").write_text("{'[2, 0]': '3X[0,0] +1X[2,0]'}\n"
                                      "{'[0, 1]': '5X[0,0] +1X[0,1]'}\n")
    (phi_dir / "phi3.txt").write_text("{'[1, 1, 0]': '7X[0,0] +1X[2,0]'}\n")

    ok = True
    # phi(1)^2 -> key [2,0] -> singlet multiplicity 3
    res = L.match(9, "d('1,1')*t**2000*phi('1')**2", ["t", "y"])
    ok &= check("(ii) phi_1^2 -> key [2,0], singlet 3",
                str(res) == "3.0*t**4.0", f"got {res}")
    # phi(2) alone -> key [0,1] -> singlet 5
    res = L.match(9, "d('1,1')*t**2000*phi('2')", ["t", "y"])
    ok &= check("(ii) phi_2 -> key [0,1], singlet 5",
                str(res) == "5.0*t**4.0", f"got {res}")
    # phi(1)*phi(2) -> key [1,1,0] (padded to degree 3) -> singlet 7
    res = L.match(9, "d('1,1')*t**3000*phi('1')*phi('2')", ["t", "y"])
    ok &= check("(ii) phi_1*phi_2 -> key [1,1,0], singlet 7",
                str(res) == "7.0*t**6.0", f"got {res}")
    return ok


# ---------------------------------------------------------------------------
# (iii) multi-species chain with real lie + cache degradation
# ---------------------------------------------------------------------------
def test_multispecies():
    for name in ("phi", "q"):
        d = WORK / "arxiv" / "C2" / name
        d.mkdir(parents=True, exist_ok=True)
        # both species' Adams-1 "decomposition" = one C2 fundamental
        (d / f"{name}1.txt").write_text("{'[1]': '1X[1,0]'}\n")
    # fund x fund of C2 contains exactly one singlet -> result 1 * non-char part
    res = L.match(9, "d('1,1')*t**3000*phi('1')*q('1')", ["t", "y"])
    return check("(iii) multi-species LiE chain (4 x 4 of C2 -> 1 singlet), "
                 "cache degraded to recompute", str(res) == "1.0*t**6.0",
                 f"got {res}")


# ---------------------------------------------------------------------------
# (iv) maxobjects retry banner corruption
# ---------------------------------------------------------------------------
def test_retry_banner():
    lcode = ("maxobjects 9999999 \n maxnodes 9999999 \n "
             "res=tensor(1X[1,0],1X[1,0],C2);\nprint(res);")
    out = L._run_lie(lcode, 30)
    sliced = out[53:].strip().replace("\n", "").replace(" ", "")
    # the retry path stores `sliced` as `products`; maxobjects prints no banner,
    # so the parse must be clean:
    return check("(iv) maxobjects retry parse is clean (suspicion CLEARED)",
                 sliced == "1X[0,0]+1X[0,1]+1X[2,0]",
                 f"sliced = {sliced!r}")


def main():
    results = [test_encoding(), test_rep_structure(), test_multispecies(),
               test_retry_banner()]
    print()
    print(f"{sum(results)}/{len(results)} defect-audit groups behaved as analyzed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
