#!/usr/bin/env python3
"""Step 7 cross-check (b): every entry of the regression baseline against the
DERIVED allowed region (07_multiplet_index.py), using the stored reduced-index
strings ('index' field: flavor fugacities -> 1, characters in y, t-exponents
printed to 3 decimals).

For the 82 true entries (refs/SU3s1S1nf2_true.txt) the assertions are:
  - no C1 hit:     term t^E chi_j with E < 2+2j
  - no boundary:   |E - (2+2j)| <= tol  (would mean undetected free fields)
  - no C2 hit:     wrong-sign term with 2+2j < E < 6+2j
  - no C3 hit:     wrong-sign term at E = 6+2j with j >= 1 (free sector, F1)
Reported (not asserted): the t^7 chi_1/2 coefficient (extra-supercurrent /
N=2 enhancement signature), the t^6 coefficient (marginal - currents), and the
same scan over the 19 curated-out entries of refs/SU3s1S1nf2.txt.

Truncation caveat: index strings run to E < 9, so the scan covers the full C2
windows for j <= 1 and the C3 terms t^6 (j=0), t^7 (j=1/2), t^8 (j=1); the
j=3/2 C3 term t^9 lies at the truncation edge and is not visible here.

Run:  python3 07_true_entries_check.py
"""
import json
from collections import defaultdict
from pathlib import Path

import sympy
from sympy import Rational, symbols

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "refs"
t, y = symbols("t y", positive=True)
TOL = 2e-3

PASS = []


def check(label, ok, detail=""):
    PASS.append(bool(ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))


def parse_index(s):
    """index string -> {E(float): {j: coeff}} via character peel."""
    expr = sympy.sympify(s.replace("^", "**"), locals={"t": t, "y": y})
    groups = defaultdict(lambda: sympy.S.Zero)
    for term in sympy.Add.make_args(sympy.expand(expr)):
        rest, tpow = term.as_independent(t)
        E = 0.0 if tpow == 1 else float(tpow.as_base_exp()[1])
        groups[round(E, 3)] += rest
    out = {}
    for E, ypoly in groups.items():
        d = defaultdict(lambda: sympy.S.Zero)
        for term in sympy.Add.make_args(sympy.expand(ypoly)):
            c, k = term.as_coeff_exponent(y)
            d[int(k)] += c
        jc = {}
        kmax = max((abs(k) for k in d if d[k] != 0), default=-1)
        for k in range(kmax, -1, -1):
            c = sympy.expand(d[k])
            if c != 0:
                jc[Rational(k, 2)] = c
                for m in range(-k, k + 1, 2):
                    d[m] = sympy.expand(d[m] - c)
        assert not any(sympy.expand(v) != 0 for v in d.values()), \
            f"character peel residue at t^{E}"
        if jc:
            out[E] = jc
    return out


def classify(table):
    hits = {"C1": [], "boundary": [], "C2": [], "C3": [], "t7": [], "t6": []}
    for E, jc in table.items():
        for j, c in jc.items():
            chiral_sign = (-1) ** int(2 * j)
            edge_low = 2 + 2 * float(j)
            edge_hi = 6 + 2 * float(j)
            wrong = sympy.sign(c) == -chiral_sign
            if E < edge_low - TOL:
                hits["C1"].append((E, j, c))
            elif abs(E - edge_low) <= TOL:
                hits["boundary"].append((E, j, c))
            elif E < edge_hi - TOL and wrong:
                hits["C2"].append((E, j, c))
            elif abs(E - edge_hi) <= TOL and wrong:
                if j >= 1:
                    hits["C3"].append((E, j, c))
                elif j == Rational(1, 2):
                    hits["t7"].append((E, j, c))
                else:
                    hits["t6"].append((E, j, c))
    return hits


def scan(path, label, assert_clean):
    lines = [json.loads(x) for x in Path(path).read_text().splitlines() if x.strip()]
    agg = defaultdict(list)
    n_scanned = 0
    for i, d in enumerate(lines):
        s = d.get("index", "")
        if not s:
            agg["no-index"].append(i)
            continue
        n_scanned += 1
        hits = classify(parse_index(s))
        for k, v in hits.items():
            if v:
                agg[k].append((i, d.get("w"), v))
    print(f"\n== {label}: {n_scanned}/{len(lines)} entries scanned ==")
    for k in ("C1", "boundary", "C2", "C3"):
        entries = agg[k]
        msg = f"{len(entries)} entries" + (f", e.g. {entries[:2]}" if entries else "")
        if assert_clean:
            check(f"{label}: no {k} hits", not entries, msg)
        else:
            print(f"  {k}: {msg}")
    print(f"  t^7 chi_1/2 (enhancement signature): {len(agg['t7'])} entries")
    for i, w, v in agg["t7"]:
        print(f"    line {i}: W = {w}, terms {v}")
    negs = [x for x in agg["t6"]]
    print(f"  negative t^6 chi_0 (currents > marginals): {len(negs)} entries")
    return agg


def provenance_scan():
    """Reproduces the two step-7 observations recorded in notes/07:
    (i) the 19 curated-out lines of the 101-file carry stored verdict
        'consistent' although their own stored indices violate C2 (16 net);
    (ii) line 90 is rejected by the fresh replay (per-flavor C2) while its
        fugacities->1 net index is violation-free -- per-flavor refinement
        strictly stronger than the net check.
    Needs calc/work05/replay_outcomes.jsonl (step-5 replay)."""
    import sympy
    replay = HERE / "work05" / "replay_outcomes.jsonl"
    if not replay.exists():
        print("\n== provenance scan skipped (no work05 replay outcomes) ==")
        return
    lines = [json.loads(x) for x in
             (REFS / "SU3s1S1nf2.txt").read_text().splitlines() if x.strip()]
    true_ws = {json.dumps(json.loads(x)["w"]) for x in
               (REFS / "SU3s1S1nf2_true.txt").read_text().splitlines()
               if x.strip()}
    curated_out = [(i, d) for i, d in enumerate(lines)
                   if json.dumps(d["w"]) not in true_ws]
    stored_consistent = [i for i, d in curated_out
                         if d.get("consistency") == "consistent"]
    net_violating = [i for i, d in curated_out
                     if d.get("index") and classify(parse_index(d["index"]))["C2"]]
    print(f"\n== provenance scan (19 curated-out lines) ==")
    check("provenance: all 19 curated-out lines stored as 'consistent'",
          len(stored_consistent) == len(curated_out) == 19,
          f"{len(stored_consistent)}/{len(curated_out)}")
    check("provenance: 16 of them have net-C2-violating STORED indices",
          len(net_violating) == 16, str(net_violating))
    # fresh replay verdicts + line-90 net scan of the FRESH index
    fresh = {r["line"]: json.loads(r["log"][0]) for r in
             (json.loads(x) for x in replay.read_text().splitlines())
             if r.get("log")}
    gs = sympy.symbols("g1:8")
    t_, y_ = sympy.symbols("t y", positive=True)
    loc = {"t": t_, "y": y_, **{f"g{i}": g for i, g in enumerate(gs, 1)}}
    def net_hits(line_no):
        full = fresh[line_no]["fullindex"]
        expr = sympy.sympify(full.replace("^", "**"), locals=loc)
        net = str(expr.subs({g: 1 for g in gs})).replace("**", "^")
        return classify(parse_index(net))["C2"]
    check("provenance: line 19 fresh verdict inconsistent WITH net C2 hit",
          fresh[19]["consistency"] == "inconsistent" and net_hits(19),
          str(net_hits(19)))
    check("provenance: line 90 fresh verdict inconsistent WITHOUT net C2 hit "
          "(violation visible only per-U(1)-flavor charge)",
          fresh[90]["consistency"] == "inconsistent" and not net_hits(90))


def main():
    scan(REFS / "SU3s1S1nf2_true.txt", "true entries (82)", assert_clean=True)
    scan(REFS / "SU3s1S1nf2.txt", "full baseline (101, incl. curated-out)",
         assert_clean=False)
    provenance_scan()
    n = len(PASS)
    print(f"\n{'ALL PASS' if all(PASS) else 'FAILURES PRESENT'}: "
          f"{sum(PASS)}/{n}")
    return 0 if all(PASS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
