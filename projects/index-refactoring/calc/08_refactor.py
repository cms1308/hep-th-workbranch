#!/usr/bin/env python3
"""Step 8 harness: refactored index pipeline (refactor/) -- build, verify, bench.

work08/ holds a patched module copy landscape_A2_v2.py built from
work05/landscape_A2.py (the step-5 A2 configuration copy) by:
  - LF-normalizing line endings (the source is CRLF),
  - three surgical charges2 edits (PATCHES_V2): startswith('inconsistent')
    routing, the FreeSector branch (user decision 2026-08-18), and the
    SUSYenhanced column fill,
  - the refactor overlay inserted before the __main__ block: it rebinds
    decouple()/Index() to the fastmatch/mcode_v2/conditions pipeline.
Everything else (charge determination, form(), orchestration) is untouched.
No real DB is touched (same pymysql stub as step 5); character tables are
read-only through the arxiv symlink; the warm LiE cache is a COPY of
work05/liecache.sqlite, so step-5 artifacts are never mutated.

Subcommands:
  setup      build work08 (patched module, stubs, symlink, warm cache copy)
  ab-match   [--line N ...] old sympy match vs fastmatch, term by term
  ab-mcode   [--line N ...] {old,new} express x {old,new} mcode -> equal dicts
  t9-check   [--line N] FORM t_order 9 vs 10: buckets <= t^9 must be identical
  scan-test  unit tests of the C1'/C3/C4 scanner on exact synthetic indices
  replay     [--start I] [--end J] sequential replay of all 101 baseline lines
  compare    replay outcomes vs SU3s1S1nf2_true.txt AND vs step-5 outcomes
  bench      [--line N --mode warm|cold] one timed charges2 run in isolation
  bench-all  the 6 runs of the step-6 table (lines 0/23/77/100)

Run from anywhere: python3 calc/08_refactor.py <subcommand>
"""
import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from collections import Counter
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
if str(PROJ) not in sys.path:
    sys.path.insert(0, str(PROJ))
WORK05 = HERE / "work05"
WORK08 = HERE / "work08"
STUBS = WORK08 / "stubs"
REFS_DIR = PROJ / "refs"
BASELINE = REFS_DIR / "SU3s1S1nf2.txt"
TRUE_SET = REFS_DIR / "SU3s1S1nf2_true.txt"
OUTCOMES = WORK08 / "replay_outcomes.jsonl"
OUTCOMES05 = WORK05 / "replay_outcomes.jsonl"
DROPBOX_ARXIV = Path(
    "/Users/cms1308/Library/CloudStorage/Dropbox/shared folder/classification/arxiv")

FILENAME = "SU3s1S1nf2_replay"
NAME_LIST = ['X', 'M', 'q', 'qb', 'phi', 'S', 'Sb', 'A', 'Ab',
             'U', 'Ub', 'V', 'Vb', 'W', 'Wb']
T_ORDER = 9
COUNTS = 1
NC = 3

# --------------------------------------------------------------------------- #
# charges2 patches (applied to the LF-normalized work05 module copy).
# Each old string must occur exactly once.
# --------------------------------------------------------------------------- #
_FREESECTOR_BRANCH = '''\
                elif ind.get('consistency') == 'free sector':
                    # step-8 (user decision 2026-08-18): free spinning sector
                    # (C1' boundary) that passes every other check -> stored
                    # in FreeSector, never in Theories.
                    with pymysql.connect(host='localhost', user='root', password='', db='landscape', charset='utf8') as conn:
                        with conn.cursor() as cur:
                            cur.execute("CREATE TABLE IF NOT EXISTS `FreeSector` (`Name` TEXT,`GaugeGroup` TEXT,`Superpotentials` MEDIUMTEXT,`Length` INT,`CentralChargeA` TEXT,`CentralChargeC` TEXT,`CentralChargeRatio` TEXT,`Rcharges` MEDIUMTEXT,`GlobalCharges` MEDIUMTEXT,`SCI` MEDIUMTEXT,`RefinedSCI` MEDIUMTEXT,`Rational` MEDIUMTEXT,`IndexFlags` MEDIUMTEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8")
                            sql = "INSERT INTO `FreeSector` (`Name`,`GaugeGroup`, `Superpotentials`,`Length`, `CentralChargeA`,`CentralChargeC`, `CentralChargeRatio` ,`Rcharges`,`GlobalCharges`, `SCI`, `RefinedSCI`,`Rational`,`IndexFlags`) Values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                            cur.execute(sql, (
                                SQLNAME, GROUP_RANK, str(result.get("w", "")).replace("'", ""), len(result.get("w", [])) - n[0],
                                str(result.get("a", 0)),
                                str(result.get("c", 0)), str(Decimal(str(result.get("a", 0))) / Decimal(str(result.get("c", 1)))),
                                str(list(str(i[0]) + ":" + str([float(Decimal(str(elem)).quantize(Decimal('0.0001'),rounding=ROUND_HALF_UP)) for elem in i[1]]) for i in r_list if len(i[1])!=0)).replace("'", ""),
                                str(list(str(i[0]) + ":" + str(i[2]) for i in r_list if len(i[2])!=0)).replace("'", ""), result.get("index", 0),
                                result.get("fullindex", 0), str(result.get("rational", "")).replace("'", ""),
                                str(result.get("index_flags", ""))))
                            conn.commit()

                    with open(RESULTS_DIR / f"{FILENAME}_log.txt", "a") as f:
                        f.write(json.dumps(result | {"nw": nw}) + "\\n")
                    with open(RESULTS_DIR / f"{FILENAME}_done{counts - 1}.txt", "a") as f:
                        f.write(json.dumps(nw) + "\\n")
                    return

'''

_OVERLAY = f'''\
# ---------------------------------------------------------------------------
# Step-8 index-pipeline refactor overlay (projects/index-refactoring/refactor/)
import sys as _sys
if "{PROJ}" not in _sys.path:
    _sys.path.insert(0, "{PROJ}")
from refactor.glue import install as _v2_install
_v2_install(globals())
# ---------------------------------------------------------------------------

'''

PATCHES_V2 = [
    # P1: route every 'inconsistent (...)' verdict to InconsistentIndex
    ("                if ind.get('consistency') == 'inconsistent':\n",
     "                if str(ind.get('consistency', '')).startswith('inconsistent'):\n"),
    # P2: FreeSector branch between the InconsistentIndex block and the else
    ("                else:\n"
     "                    if new_order != t_order:\n",
     _FREESECTOR_BRANCH
     + "                else:\n"
     "                    if new_order != t_order:\n"),
    # P3: fill the (already existing, previously always-empty) SUSYenhanced
    #     column of Theories from the C3 j=1/2 enhancement signal
    ('                                    str(result.get("rational")).replace("\'", ""), \'\'))\n',
     '                                    str(result.get("rational")).replace("\'", ""), str(result.get("SUSYenhanced", \'\'))))\n'),
    # P4: overlay before the __main__ block
    ("if __name__ == '__main__':\n",
     _OVERLAY + "if __name__ == '__main__':\n"),
]


# --------------------------------------------------------------------------- #
# setup
# --------------------------------------------------------------------------- #
def do_setup(verbose=True):
    assert (WORK05 / "landscape_A2.py").exists(), "run 05_regression.py setup first"
    WORK08.mkdir(exist_ok=True)
    STUBS.mkdir(exist_ok=True)
    shutil.copyfile(WORK05 / "stubs" / "pymysql.py", STUBS / "pymysql.py")

    with open(WORK05 / "landscape_A2.py", newline='') as f:
        src = f.read().replace("\r\n", "\n")
    for old, new in PATCHES_V2:
        n = src.count(old)
        assert n == 1, f"patch anchor not unique ({n} hits): {old[:60]!r}"
        src = src.replace(old, new)
    (WORK08 / "landscape_A2_v2.py").write_text(src)

    link = WORK08 / "arxiv"
    if not link.exists():
        assert DROPBOX_ARXIV.is_dir(), f"missing tables: {DROPBOX_ARXIV}"
        link.symlink_to(DROPBOX_ARXIV)
    assert (link / "A2" / "q" / "q1.txt").exists()

    warm = WORK08 / "liecache.sqlite"
    if not warm.exists():
        shutil.copyfile(WORK05 / "liecache.sqlite", warm)

    if verbose:
        diff = subprocess.run(
            ["diff", "--strip-trailing-cr", str(WORK05 / "landscape_A2.py"),
             str(WORK08 / "landscape_A2_v2.py")],
            capture_output=True, text=True)
        print(diff.stdout)
        print("setup OK (diff above = the three charges2 patches + overlay)")


def import_v2():
    do_setup(verbose=False)
    sys.path.insert(0, str(STUBS))
    sys.path.insert(0, str(WORK08))
    sys.path.insert(0, str(WORK05))
    sys.path.insert(0, str(PROJ))
    os.chdir(WORK08)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert L2.GROUP_RANK == "A2" and hasattr(L2, "_v2_engine")
    return L2


def import_old():
    """The unmodified step-5 module, running in work08 (shared warm cache)."""
    import landscape_A2 as L
    return L


# --------------------------------------------------------------------------- #
# baseline-line helpers
# --------------------------------------------------------------------------- #
def baseline_lines():
    return [json.loads(l) for l in open(BASELINE)]


def r_list_from_line(d):
    """Rebuild charges2's r_list from a baseline line (labels + global)."""
    n = d["n"]
    r_list = []
    for i in range(len(n)):
        r1, g1 = [], []
        for j in range(n[i]):
            label = NAME_LIST[i] + str(j + 1)
            if label in d:
                r1.append(d[label])
                g1.append([int(x) for x in d.get("global", {}).get(label, [])])
        r_list.append([NAME_LIST[i], r1, g1])
    return r_list


def vars_list_of(rlist):
    vars_list = ["t", "y"]
    u1 = []
    for item in rlist:
        for j in range(len(item[1])):
            vars_list.append(f"{item[0]}{j + 1}")
        if item[2]:
            u1.append(len(item[2][0]))
    if u1:
        for i in range(max(u1)):
            vars_list.append(f"g{i + 1}")
    return vars_list


def w2_of(d):
    return str(list(d["w"])).replace("[", "{").replace("]", "}").replace("'", '"')


# --------------------------------------------------------------------------- #
# ab-match: old sympy match vs fastmatch
# --------------------------------------------------------------------------- #
def _old_term_data(L, expr):
    """(coeff float, {symbol-name: exponent}) of one old match() result."""
    import sympy
    if expr == 0:
        return (0.0, {})
    if expr == 1:
        return (1.0, {})
    coeff, rest = expr.as_coeff_Mul()
    powers = {}
    for sym, e in rest.as_powers_dict().items():
        powers[str(sym)] = e
    return (float(coeff), powers)


def _new_term_data(term, mult):
    value = term.coeff * mult
    if value == 0:
        return (0.0, {})
    powers = {}
    if term.milli:
        powers["t"] = term.milli / 1000.0
    if term.ypow:
        powers["y"] = term.ypow
    for name, e in term.fug:
        powers[name] = e
    if value == 1 and not powers:
        return (1.0, {})
    return (float(value), powers)


def do_ab_match(line_nos):
    from refactor import fastmatch
    L2 = import_v2()
    L = import_old()
    eng = L2._v2_engine
    lines = baseline_lines()
    pid = os.getpid()
    total_bad = 0
    for ln in line_nos:
        d = lines[ln]
        rl = r_list_from_line(d)
        vl = vars_list_of(rl)
        for t_order in (3, 9):
            assert L.form(t_order, pid, rl) == "ok"
            form_file = Path(L.FRM_DIR) / f"form{pid}.txt"
            shutil.copyfile(form_file,
                            WORK08 / f"ab_form_line{ln}_o{t_order}.txt")
            t0 = time.time()
            ans_old = L.Mathcode(t_order, pid, vl)
            t_old = time.time() - t0
            t0 = time.time()
            express, records = fastmatch.process_form_output(
                form_file, eng._projector, L2.CORE, L2.MATCH_TIMEOUT,
                L2.MatchTimeoutError)
            t_new = time.time() - t0
            assert len(ans_old) == len(records), \
                f"term count differs: {len(ans_old)} vs {len(records)}"
            bad = 0
            for i, (o, (term, mult)) in enumerate(zip(ans_old, records)):
                co, po = _old_term_data(L, o)
                cn, pn = _new_term_data(term, mult)
                ok_c = abs(co - cn) <= 1e-9 * max(1.0, abs(co), abs(cn))
                ok_p = ({k: float(v) for k, v in po.items()}
                        == {k: float(v) for k, v in pn.items()})
                if not (ok_c and ok_p):
                    bad += 1
                    if bad <= 5:
                        print(f"  [line {ln} o{t_order} term {i}] OLD "
                              f"{co} {po}  NEW {cn} {pn}")
            total_bad += bad
            print(f"[line {ln} o{t_order}] {len(records)} terms, "
                  f"{bad} mismatches; old {t_old:.1f}s -> new {t_new:.1f}s")
    print(f"ab-match: {'PASS' if total_bad == 0 else 'FAIL'} "
          f"({total_bad} mismatching terms)")
    return total_bad == 0


# --------------------------------------------------------------------------- #
# ab-mcode: {old,new} express x {old,new} mcode must give identical dicts
# --------------------------------------------------------------------------- #
def _run_mcode(L, pid, mcode):
    import ast
    proc = subprocess.run(['wolframscript', '-code', mcode],
                          capture_output=True, text=True)
    out = proc.stdout.replace("Null", "").strip().replace(" ", "")
    try:
        return ast.literal_eval(out)
    except Exception as e:
        return {"__parse_error__": f"{e}", "__stdout__": proc.stdout[:400]}


def do_ab_mcode(line_nos):
    from refactor import fastmatch, mcode_v2
    L2 = import_v2()
    L = import_old()
    eng = L2._v2_engine
    lines = baseline_lines()
    pid = os.getpid()
    n_bad = 0
    for ln in line_nos:
        d = lines[ln]
        rl = r_list_from_line(d)
        vl = vars_list_of(rl)
        w2 = w2_of(d)
        vars_str = "{" + ", ".join(set(vl)) + "}"
        for t_order, gen_old, gen_new in (
                (3, L.generate_decouple_mcode, mcode_v2.generate_decouple_mcode),
                (9, L.generate_index_mcode, mcode_v2.generate_index_mcode)):
            assert L.form(t_order, pid, rl) == "ok"
            form_file = Path(L.FRM_DIR) / f"form{pid}.txt"
            ans_old = L.Mathcode(t_order, pid, vl)
            express_old = (str(ans_old).replace("e", "*10^")
                           .replace("[", "{").replace("]", "}")
                           .replace("**", "^"))
            express_new, _ = fastmatch.process_form_output(
                form_file, eng._projector, L2.CORE, L2.MATCH_TIMEOUT,
                L2.MatchTimeoutError)
            express_file = Path(L.FRM_DIR) / f"express{pid}.txt"
            results = {}
            for tag, express, gen in (
                    ("old/old", express_old,
                     lambda: gen_old(pid, vars_str, t_order, w2)),
                    ("new/new", express_new,
                     lambda: gen_new(pid, vars_str, t_order, w2, L.USER_DIR)),
                    ("old/new", express_old,
                     lambda: gen_new(pid, vars_str, t_order, w2, L.USER_DIR))):
                express_file.write_text(express)
                results[tag] = _run_mcode(L, pid, gen())
            ref = results["old/old"]
            for tag in ("new/new", "old/new"):
                if results[tag] != ref:
                    n_bad += 1
                    print(f"[line {ln} o{t_order}] {tag} DIFFERS from old/old:")
                    keys = set(ref) | set(results[tag])
                    for k in sorted(keys):
                        if ref.get(k) != results[tag].get(k):
                            print(f"    {k}: old/old={str(ref.get(k))[:140]!r}")
                            print(f"    {'':>{len(k)}}  {tag}="
                                  f"{str(results[tag].get(k))[:140]!r}")
            print(f"[line {ln} o{t_order}] old/old == new/new: "
                  f"{results['new/new'] == ref}; old/old == old/new: "
                  f"{results['old/new'] == ref}")
    print(f"ab-mcode: {'PASS' if n_bad == 0 else 'FAIL'}")
    return n_bad == 0


# --------------------------------------------------------------------------- #
# t9-check: FORM order 9 vs order 10 agree on every bucket <= t^9
# --------------------------------------------------------------------------- #
def do_t9_check(ln):
    from refactor import fastmatch
    from refactor.conditions import refined_index_minus_one
    L2 = import_v2()
    L = import_old()
    eng = L2._v2_engine
    d = baseline_lines()[ln]
    rl = r_list_from_line(d)
    pid = os.getpid()
    acc = {}
    for t_order in (9, 10):
        rv = L.form(t_order, pid, rl)
        assert rv == "ok", f"form({t_order}) -> {rv}"
        _, records = fastmatch.process_form_output(
            Path(L.FRM_DIR) / f"form{pid}.txt", eng._projector,
            L2.CORE, 3 * L2.MATCH_TIMEOUT, L2.MatchTimeoutError)
        refined = refined_index_minus_one(records)
        acc[t_order] = {k: v for k, v in refined.items() if k[0] <= 9000}
        print(f"order {t_order}: {len(records)} terms, "
              f"{len(acc[t_order])} refined buckets <= t^9")
    only9 = {k: v for k, v in acc[9].items() if acc[10].get(k) != v}
    only10 = {k: v for k, v in acc[10].items() if acc[9].get(k) != v}
    for k in list(only9)[:5]:
        print(f"  mismatch {k}: o9={acc[9].get(k)} o10={acc[10].get(k)}")
    ok = not only9 and not only10
    print(f"t9-check line {ln}: "
          f"{'PASS -- t^9 coefficients are complete at t_order=9' if ok else f'FAIL ({len(only9)}/{len(only10)} bucket diffs)'}")
    return ok


# --------------------------------------------------------------------------- #
# scan-test: exact synthetic indices through the C1'/C3/C4 scanner
# --------------------------------------------------------------------------- #
def _records_from_reduced(reduced, cutoff=9000):
    """Invert reduced = (1-t^3 y)(1-t^3/y)(I-1): divide by the kernel as an
    exact series up to t^cutoff, then package I as TermRecords."""
    from refactor.fastmatch import TermRecord
    inv = dict(reduced)
    # multiply by sum_{a,b>=0} (t^3 y)^a (t^3/y)^b  == 1/[(1-t^3y)(1-t^3/y)]
    out = {}
    for (m, k), v in inv.items():
        a = 0
        while m + 3000 * a <= cutoff:
            b = 0
            while m + 3000 * (a + b) <= cutoff:
                key = (m + 3000 * (a + b), k + a - b)
                out[key] = out.get(key, Fraction(0)) + v
                b += 1
            a += 1
    out[(0, 0)] = out.get((0, 0), Fraction(0)) + 1  # I = 1 + (I-1)
    records = []
    for (m, k), v in out.items():
        if v:
            records.append((TermRecord(coeff=v, milli=m, ypow=k,
                                       fug=(), chars=()), 1))
    return records


def do_scan_test():
    from refactor.conditions import scan, net_reduced
    F = Fraction
    checks = []

    def case(name, reduced, expect):
        records = _records_from_reduced(reduced)
        # round-trip guard: net_reduced(records) must reproduce the input
        back = {k: v for k, v in net_reduced(records).items() if k[0] <= 9000}
        rt = back == {k: v for k, v in reduced.items() if v}
        flags = scan(records, 9)
        got = {k: flags[k] for k in expect}
        ok = rt and got == expect
        checks.append(ok)
        print(f"[{'OK' if ok else 'FAIL'}] {name}: roundtrip={rt} flags={got}"
              + ("" if ok else f" expected {expect}"))

    # free U(1) vector: -t^3 chi_{1/2} + 3 t^6 + t^9(chi_{3/2} - chi_{1/2})
    case("free vector", {
        (3000, 1): F(-1), (3000, -1): F(-1),
        (6000, 0): F(3),
        (9000, 3): F(1), (9000, 1): F(0), (9000, -1): F(0), (9000, -3): F(1),
    }, {"c4_vanishing": False, "c1prime": [(1, -1)],
        "c3_free": [(3, 1)], "c3_enhance": []})
    # NB (9000, +-1): chi_{3/2} - chi_{1/2} has y^{+-1} coefficient 1-1=0.

    # free chiral r=2/3: t^2 - t^9 chi_{1/2}  (stress tensor; NOT a C3 hit)
    case("free chiral", {
        (2000, 0): F(1), (9000, 1): F(-1), (9000, -1): F(-1),
    }, {"c4_vanishing": False, "c1prime": [], "c3_free": [],
        "c3_enhance": []})

    # free hypermultiplet signal: + t^7 chi_{1/2} -> N>=2 enhancement
    case("t^7 supercurrent", {
        (7000, 1): F(1), (7000, -1): F(1),
    }, {"c4_vanishing": False, "c1prime": [], "c3_free": [],
        "c3_enhance": [(1, 1)]})

    # C3 at j=1: audit case E was -3 t^8 chi_1 -- the signal carries the
    # wrong sign (-1)^{2j+1} = -1 for j=1, so the reduced-index term is
    # NEGATIVE with net multiplicity 3
    case("t^8 chi_1 higher-spin", {
        (8000, 2): F(-3), (8000, 0): F(-3), (8000, -2): F(-3),
    }, {"c4_vanishing": False, "c1prime": [], "c3_free": [(2, 3)],
        "c3_enhance": []})

    # C1' at j=1: chiral-sign chi_1 content exactly at E=4
    case("E=4 chi_1 free spinning", {
        (4000, 2): F(2), (4000, 0): F(2), (4000, -2): F(2),
    }, {"c4_vanishing": False, "c1prime": [(2, 2)], "c3_free": [],
        "c3_enhance": []})

    # C4: I == 1 identically
    case("vanishing (I=1)", {}, {"c4_vanishing": True})

    # contamination diagnostic: fractional chi multiplicity
    case("non-integer bucket", {
        (8000, 2): F(1, 2), (8000, 0): F(1, 2), (8000, -2): F(1, 2),
    }, {"c4_vanishing": False, "c3_free": [],
        "noninteger": [(8000, 2, "1/2")]})

    ok = all(checks)
    print(f"scan-test: {sum(checks)}/{len(checks)} "
          f"{'PASS' if ok else 'FAIL'}")
    return ok


# --------------------------------------------------------------------------- #
# replay / compare (mirrors step 5)
# --------------------------------------------------------------------------- #
def _appended(path, old_size):
    if not path.exists():
        return []
    with open(path) as f:
        f.seek(old_size)
        return [l.rstrip("\n") for l in f if l.strip()]


def do_replay(start, end):
    os.environ["V2_TIMINGS"] = "1"
    L2 = import_v2()
    results_dir = L2.RESULTS_DIR
    files = {
        "success": results_dir / f"{FILENAME}.txt",
        "log": results_dir / f"{FILENAME}_log.txt",
        "error": results_dir / f"{FILENAME}_error.txt",
    }
    done = set()
    if OUTCOMES.exists():
        for l in open(OUTCOMES):
            done.add(json.loads(l)["line"])
    lines = baseline_lines()
    end = min(end, len(lines))
    todo = [i for i in range(start, end) if i not in done]
    print(f"replaying {len(todo)} lines ({len(done)} already done)", flush=True)
    for i in todo:
        d = lines[i]
        nw = [list(d["n"]), list(d["w"])]
        sizes = {k: (p.stat().st_size if p.exists() else 0)
                 for k, p in files.items()}
        t0 = time.time()
        err = None
        try:
            L2.charges2(T_ORDER, COUNTS, NC, list(NAME_LIST), nw)
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        dt = time.time() - t0
        rec = {"line": i, "w": d["w"], "seconds": round(dt, 1),
               "exception": err}
        for k, p in files.items():
            rec[k] = _appended(p, sizes[k])
        with open(OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else
                   f"exception:{err}" if err else "NO-OUTPUT")
        print(f"[{i}] {dt:.1f}s {outcome}  w={d['w']}", flush=True)
    print("replay complete", flush=True)


def do_compare():
    reg05 = _load_reg05()
    outs = [json.loads(l) for l in open(OUTCOMES)]
    outs.sort(key=lambda r: r["line"])

    # (1) against the true set -- same criteria as step 5
    true_by_w = {json.dumps(json.loads(l)["w"]): json.loads(l)
                 for l in open(TRUE_SET)}
    n_exact = n_noise = n_mismatch = n_extra = 0
    kept_extras, rejected_true, verdicts = [], [], Counter()
    for rec in outs:
        wkey = json.dumps(rec["w"])
        is_true = wkey in true_by_w
        success = [json.loads(s) for s in rec["success"]]
        if is_true:
            if not success:
                rejected_true.append(rec)
                print(f"[line {rec['line']}] TRUE entry NOT reproduced: "
                      f"w={rec['w']}")
                continue
            diffs = reg05._diff_fields(success[0], true_by_w[wkey])
            hard = [x for x in diffs if x[1] == "DIFF"]
            if not diffs:
                n_exact += 1
            elif not hard:
                n_noise += 1
            else:
                n_mismatch += 1
                print(f"[line {rec['line']}] mismatches w={rec['w']}:")
                for k, kind, v1, v2 in hard:
                    print(f"    {k}: fresh={str(v1)[:120]!r}")
                    print(f"    {'':>{len(k)}}  base ={str(v2)[:120]!r}")
        else:
            n_extra += 1
            if success:
                kept_extras.append(rec)
                print(f"[line {rec['line']}] EXTRA kept: w={rec['w']}")
            else:
                for s in rec["log"]:
                    verdicts[json.loads(s).get("consistency", "?")] += 1
                for s in rec["error"]:
                    verdicts["error: " + json.loads(s).get("consistency", "?")] += 1
                if rec.get("exception"):
                    verdicts[f"exception: {rec['exception']}"] += 1

    # (2) byte-level against the step-5 outcomes
    outs05 = {json.loads(l)["line"]: json.loads(l) for l in open(OUTCOMES05)}
    n_same = n_diff = 0
    for rec in outs:
        old = outs05.get(rec["line"])
        if old is None:
            continue
        same = all(rec[k] == old[k] for k in ("success", "log", "error"))
        if same:
            n_same += 1
        else:
            n_diff += 1
            print(f"[line {rec['line']}] outcome differs from step-5 replay:")
            for k in ("success", "log", "error"):
                if rec[k] != old[k]:
                    print(f"    {k}: v2 ={str(rec[k])[:160]!r}")
                    print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")

    # (3) scan log: no C1'/C3/C4 flag may fire on the baseline
    scanlog = WORK08 / "v2_scanlog.jsonl"
    n_scans = n_fired = 0
    if scanlog.exists():
        for l in open(scanlog):
            n_scans += 1
            if json.loads(l)["fired"]:
                n_fired += 1
                print(f"  scan flag fired: {l.strip()[:200]}")

    print("\n=== summary ===")
    print(f"replayed lines            : {len(outs)}")
    print(f"true entries              : {n_exact} exact, {n_noise} noise, "
          f"{n_mismatch} mismatch, {len(rejected_true)} rejected")
    print(f"extra entries             : {n_extra} replayed, "
          f"{n_extra - len(kept_extras)} rejected, {len(kept_extras)} kept "
          f"(expected kept: 2, the F5 pair)")
    print(f"vs step-5 outcome records : {n_same} identical, {n_diff} differ")
    print(f"index scans               : {n_scans} runs, {n_fired} flags fired")
    if verdicts:
        for v, c in verdicts.most_common():
            print(f"  {c:3d}  {v}")
    ok = (n_mismatch == 0 and not rejected_true and len(kept_extras) == 2
          and n_diff == 0 and n_fired == 0)
    print("compare:", "PASS" if ok else "FAIL")
    return ok


def _load_reg05():
    spec = importlib.util.spec_from_file_location(
        "reg05", HERE / "05_regression.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# --------------------------------------------------------------------------- #
# bench
# --------------------------------------------------------------------------- #
def do_bench(line, mode, pipeline="new"):
    """One charges2 run in an isolated dir (fresh subprocess)."""
    bdir = WORK08 / "bench" / f"line{line}_{mode}_{pipeline}"
    if bdir.exists():
        shutil.rmtree(bdir)
    bdir.mkdir(parents=True)
    (bdir / "arxiv").symlink_to(DROPBOX_ARXIV)
    if mode == "warm":
        shutil.copyfile(WORK05 / "liecache.sqlite", bdir / "liecache.sqlite")
    if pipeline == "new":
        modname = "landscape_A2_v2"
        shutil.copyfile(WORK08 / "landscape_A2_v2.py", bdir / f"{modname}.py")
    else:
        modname = "landscape_A2"
        shutil.copyfile(WORK05 / "landscape_A2.py", bdir / f"{modname}.py")
    (bdir / "stubs").mkdir()
    shutil.copyfile(STUBS / "pymysql.py", bdir / "stubs" / "pymysql.py")

    runner = f"""
import json, os, sys, time
sys.path.insert(0, r"{bdir}/stubs")
sys.path.insert(0, r"{bdir}")
sys.path.insert(0, r"{PROJ}")
os.chdir(r"{bdir}")
os.environ["V2_TIMINGS"] = "1"
import {modname} as L
d = json.loads(open(r"{BASELINE}").readlines()[{line}])
t0 = time.time()
L.charges2({T_ORDER}, {COUNTS}, {NC}, {NAME_LIST!r}, [list(d["n"]), list(d["w"])])
print(json.dumps({{"line": {line}, "mode": "{mode}",
                   "total_s": round(time.time() - t0, 1)}}))
"""
    t0 = time.time()
    proc = subprocess.run([sys.executable, "-c", runner],
                          capture_output=True, text=True, timeout=3600)
    wall = time.time() - t0
    phases = []
    tf = bdir / "v2_timings.jsonl"
    if tf.exists():
        phases = [json.loads(l) for l in open(tf)]
    summary = {"line": line, "mode": mode, "pipeline": pipeline,
               "wall_s": round(wall, 1),
               "phases": phases, "stdout_tail": proc.stdout[-300:]}
    with open(WORK08 / "bench_results.jsonl", "a") as f:
        f.write(json.dumps(summary) + "\n")
    form_s = sum(p["seconds"] for p in phases if p["phase"] == "form")
    fm_s = sum(p["fastmatch_s"] for p in phases if "fastmatch_s" in p)
    ws_s = sum(p["wolfram_s"] for p in phases if "wolfram_s" in p)
    print(f"[line {line} {mode} {pipeline}] wall {wall:.1f}s | "
          f"form {form_s:.1f}s | fastmatch {fm_s:.1f}s | "
          f"wolframscript(index) {ws_s:.1f}s")
    return summary


def do_bench_all():
    """Old and new pipeline interleaved per benchmark, so ambient machine
    load affects both sides of each comparison equally."""
    for line, mode in ((0, "warm"), (23, "warm"), (77, "warm"),
                       (100, "warm"), (0, "cold"), (100, "cold")):
        do_bench(line, mode, "old")
        do_bench(line, mode, "new")


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["setup", "ab-match", "ab-mcode",
                                    "t9-check", "scan-test", "replay",
                                    "compare", "bench", "bench-all"])
    ap.add_argument("--line", type=int, action="append")
    ap.add_argument("--mode", default="warm", choices=["warm", "cold"])
    ap.add_argument("--pipeline", default="new", choices=["old", "new"])
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=101)
    a = ap.parse_args()
    if a.cmd == "setup":
        do_setup()
    elif a.cmd == "ab-match":
        sys.exit(0 if do_ab_match(a.line or [0, 23, 77]) else 1)
    elif a.cmd == "ab-mcode":
        sys.exit(0 if do_ab_mcode(a.line or [0, 23, 77]) else 1)
    elif a.cmd == "t9-check":
        sys.exit(0 if do_t9_check((a.line or [0])[0]) else 1)
    elif a.cmd == "scan-test":
        sys.exit(0 if do_scan_test() else 1)
    elif a.cmd == "replay":
        do_replay(a.start, a.end)
    elif a.cmd == "compare":
        sys.exit(0 if do_compare() else 1)
    elif a.cmd == "bench":
        do_bench((a.line or [0])[0], a.mode, a.pipeline)
    elif a.cmd == "bench-all":
        do_bench_all()


if __name__ == "__main__":
    main()
