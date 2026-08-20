#!/usr/bin/env python3
"""Step 14: bootstrap + portability of the character store.

Three demonstrations the step-13 baseline replay could NOT exercise:

(i)   EMPTY-store replay (work14/): lines 0 and 100 rerun with a store that
      starts with ZERO character data — every table key and every LiE chain
      is generated/computed cold. Outcomes must equal the step-5 records;
      afterwards every tensor_cache row whose ckey is among the 16,133
      step-5 LieCache imports must carry the identical value, and every
      generated char_decomp row must byte-match the Dropbox A2 tables.
(ii)  Cross-group generation (charstore_C2.sqlite): C2 has NO imported bulk
      data — generate all keys of orders 1..MAX_ORDER for all 11 species
      and byte-check each against (a) the stored Dropbox C2 tables
      (materializing only the small low-order files) and (b) a DIRECT
      one-shot LiE evaluation of prod_k Adams(k,rep)^{m_k} (a different
      evaluation order than the arxivGen recursion). Runs under a PATH
      with NO wolframscript and NO form — the store subsystem needs only
      Python + LiE.
(iii) Portability (work14/portable/): a self-contained directory holding
      only the code packages (refactor/, store/), the module copy, the
      pymysql stub (stands in for the RESULTS DB, which by scope stays
      MariaDB — character data needs no DB at all), and an empty store;
      no arxiv symlink, no warm cache. One baseline line runs end-to-end
      in a fresh subprocess whose imports all resolve inside that
      directory; the outcome record must equal the step-5 record.
      NOTE (scope interpretation, recorded in notes/14): "no Wolfram"
      applies to the character-store subsystem, proven in (ii); the
      pipeline itself still shells out to wolframscript for charge
      determination (scope (a), untouched) and index post-processing
      (kept for byte-identity by the signed-off step-8 decision).

Subcommands:
  setup                 build work14/ (module copy, stubs, no arxiv link)
  replay [--lines 0,100]     part (i) empty-store replay (resumable)
  verify-replay         part (i) checks: outcomes, cache overlap, tables
  crossgroup [--max-order 5]  part (ii), restricted-PATH C2 generation
  portability [--line 0]      part (iii) build + run + compare
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK05 = HERE / "work05"
WORK08 = HERE / "work08"
WORK14 = HERE / "work14"
STUBS14 = WORK14 / "stubs"
PORT = WORK14 / "portable"
OUTCOMES = WORK14 / "replay_outcomes.jsonl"
EMPTY_STORE = WORK14 / "charstore_A2_empty.sqlite"
C2_STORE = WORK14 / "charstore_C2.sqlite"
CROSSLOG = WORK14 / "crossgroup_results.jsonl"
LIECACHE05 = WORK05 / "liecache.sqlite"

# LiE lives in /opt/local/bin; wolframscript and form live in
# /usr/local/bin, which this PATH deliberately omits (part ii).
LIE_ONLY_PATH = "/opt/local/bin:/usr/bin:/bin"

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)
_spec12 = importlib.util.spec_from_file_location("s12", HERE / "12_import.py")
s12 = importlib.util.module_from_spec(_spec12)
_spec12.loader.exec_module(s12)

if str(PROJ) not in sys.path:
    sys.path.insert(0, str(PROJ))
from store.charstore import DEFAULT_LABELS, CharStore  # noqa: E402


# --------------------------------------------------------------------------- #
# setup + shared helpers
# --------------------------------------------------------------------------- #
def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    WORK14.mkdir(exist_ok=True)
    STUBS14.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS14 / "pymysql.py")
    shutil.copyfile(WORK08 / "landscape_A2_v2.py",
                    WORK14 / "landscape_A2_v2.py")
    assert not (WORK14 / "arxiv").exists(), "work14 must have NO arxiv link"
    assert legacy_liecache_rows(WORK14) == 0, "legacy LieCache has rows"
    print("setup OK: module + stubs; no arxiv link, no warm cache, "
          "store starts empty")


def legacy_liecache_rows(workdir: Path) -> int:
    path = workdir / "liecache.sqlite"
    if not path.exists():
        return 0
    try:
        return sqlite3.connect(path).execute(
            "SELECT COUNT(*) FROM LieCache").fetchone()[0]
    except sqlite3.OperationalError:  # no LieCache table -> never touched
        return 0


def store_counts(path: Path) -> dict:
    if not path.exists():
        return {"char_decomp": 0, "generated": 0, "tensor_cache": 0}
    db = sqlite3.connect(path)
    decomp, generated = db.execute(
        "SELECT COUNT(*), COALESCE(SUM(source='generated'),0) "
        "FROM char_decomp").fetchone()
    cache = db.execute("SELECT COUNT(*) FROM tensor_cache").fetchone()[0]
    db.close()
    return {"char_decomp": decomp, "generated": generated,
            "tensor_cache": cache}


# --------------------------------------------------------------------------- #
# part (i): empty-store replay
# --------------------------------------------------------------------------- #
def import_v2_empty():
    do_setup()
    os.environ["V2_CHARSTORE"] = str(EMPTY_STORE)
    os.environ["V2_TIMINGS"] = "1"
    sys.path.insert(0, str(STUBS14))
    sys.path.insert(0, str(WORK14))
    os.chdir(WORK14)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert L2.GROUP_RANK == "A2" and L2._v2_engine.charstore is not None
    return L2


def do_replay(line_numbers: list[int]) -> None:
    L2 = import_v2_empty()
    results_dir = L2.RESULTS_DIR
    files = {
        "success": results_dir / f"{sl08.FILENAME}.txt",
        "log": results_dir / f"{sl08.FILENAME}_log.txt",
        "error": results_dir / f"{sl08.FILENAME}_error.txt",
    }
    done = set()
    if OUTCOMES.exists():
        for line in open(OUTCOMES):
            done.add(json.loads(line)["line"])
    lines = sl08.baseline_lines()
    todo = [i for i in line_numbers if i not in done]
    print(f"empty-store replay of lines {todo} ({sorted(done)} already done); "
          f"store starts at {store_counts(EMPTY_STORE)}", flush=True)
    for i in todo:
        d = lines[i]
        nw = [list(d["n"]), list(d["w"])]
        sizes = {k: (p.stat().st_size if p.exists() else 0)
                 for k, p in files.items()}
        before = store_counts(EMPTY_STORE)
        t0 = time.time()
        err = None
        try:
            L2.charges2(sl08.T_ORDER, sl08.COUNTS, sl08.NC,
                        list(sl08.NAME_LIST), nw)
        except Exception as e:  # noqa: BLE001 — recorded per line
            err = f"{type(e).__name__}: {e}"
        dt = time.time() - t0
        after = store_counts(EMPTY_STORE)
        rec = {"line": i, "w": d["w"], "seconds": round(dt, 1),
               "exception": err,
               "store_before": before, "store_after": after}
        for k, p in files.items():
            rec[k] = sl08._appended(p, sizes[k])
        with open(OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else
                   f"exception:{err}" if err else "NO-OUTPUT")
        print(f"[{i}] {dt:.1f}s {outcome}  generated "
              f"{after['generated'] - before['generated']} table rows, "
              f"tensor_cache +{after['tensor_cache'] - before['tensor_cache']}"
              f"  w={d['w']}", flush=True)
    print("replay complete", flush=True)


def do_verify_replay() -> bool:
    outs = sorted((json.loads(l) for l in open(OUTCOMES)),
                  key=lambda r: r["line"])
    outs05 = {json.loads(l)["line"]: json.loads(l)
              for l in open(sl08.OUTCOMES05)}
    failures = []

    # (1) outcome byte-identity vs the step-5 records
    for rec in outs:
        old = outs05[rec["line"]]
        same = all(rec[k] == old[k] for k in ("success", "log", "error"))
        print(f"line {rec['line']}: outcome vs step-5 "
              f"{'identical' if same else 'DIFFERS'} ({rec['seconds']} s, "
              f"generated {rec['store_after']['generated']} rows total)")
        if not same:
            failures.append(f"line {rec['line']} outcome differs")
            for k in ("success", "log", "error"):
                if rec[k] != old[k]:
                    print(f"    {k}: v14={str(rec[k])[:160]!r}")
                    print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")

    # (2) scan flags must not fire
    n_scans = n_fired = 0
    scanlog = WORK14 / "v2_scanlog.jsonl"
    if scanlog.exists():
        for line in open(scanlog):
            n_scans += 1
            n_fired += bool(json.loads(line)["fired"])
    print(f"index scans: {n_scans} runs, {n_fired} flags fired")
    if n_fired:
        failures.append(f"{n_fired} scan flags fired")

    # (3) the store really started empty: every char_decomp row is generated
    db = sqlite3.connect(EMPTY_STORE)
    n_import = db.execute("SELECT COUNT(*) FROM char_decomp WHERE "
                          "source!='generated'").fetchone()[0]
    if n_import:
        failures.append(f"{n_import} non-generated char_decomp rows")
    print(f"store: every char_decomp row generated ({n_import} imports)")

    # (4) tensor_cache overlap vs the 16,133 step-5 LieCache entries
    src = dict(sqlite3.connect(LIECACHE05).execute(
        "SELECT ckey, result FROM LieCache"))
    new = dict(db.execute("SELECT ckey, result FROM tensor_cache"))
    overlap = set(src) & set(new)
    bad = [k for k in overlap if src[k] != new[k]]
    print(f"tensor_cache: {len(new)} computed, {len(overlap)} overlap the "
          f"16,133 imports, {len(bad)} value mismatches")
    if bad:
        failures.append(f"{len(bad)} tensor_cache value mismatches")
    if not overlap:
        failures.append("no overlapping tensor_cache keys (vacuous check)")

    # (5) generated char_decomp rows vs the Dropbox A2 tables, byte-wise
    rows = db.execute("SELECT species, key_vec, value FROM char_decomp "
                      "WHERE source='generated'").fetchall()
    by_file: dict[tuple[str, int], list] = {}
    for species, key_str, value in rows:
        order = len(ast.literal_eval(key_str))
        by_file.setdefault((species, order), []).append((key_str, value))
    n_checked = n_bad = 0
    for (species, order), entries in sorted(by_file.items()):
        path = s12.ARXIV_DIR / "A2" / species / f"{species}{order}.txt"
        table, _, _ = s12.read_table_file(path)
        for key_str, value in entries:
            n_checked += 1
            if table.get(key_str) != value:
                n_bad += 1
                failures.append(f"table mismatch A2/{species} {key_str}")
    print(f"generated rows vs Dropbox A2 tables: {n_checked} checked, "
          f"{n_bad} mismatches (across {len(by_file)} species/order files)")

    # (6) legacy sources untouched
    no_legacy = (not (WORK14 / "arxiv").exists()
                 and legacy_liecache_rows(WORK14) == 0)
    print(f"legacy sources absent: {no_legacy}")
    if not no_legacy:
        failures.append("legacy source touched")

    print(f"\nverify-replay: {'PASS' if not failures else 'FAIL'}")
    for f_ in failures:
        print(f"  {f_}")
    return not failures


# --------------------------------------------------------------------------- #
# part (ii): cross-group generation on C2 (no wolframscript, no form on PATH)
# --------------------------------------------------------------------------- #
def partitions(n: int, max_part: int | None = None):
    if max_part is None:
        max_part = n
    if n == 0:
        yield []
        return
    for p in range(min(n, max_part), 0, -1):
        for rest in partitions(n - p, p):
            yield [p] + rest


def keys_of_order(n: int) -> list[list[int]]:
    keys = []
    for part in partitions(n):
        m = [0] * n
        for p in part:
            m[p - 1] += 1
        keys.append(m)
    return keys


def direct_expr(key: list[int], label: str) -> str:
    """One-shot LiE evaluation of prod_k Adams(k,rep)^{m_k} — an evaluation
    order different from the arxivGen recursion the store runs."""
    factors = []
    for k, mult in enumerate(key, start=1):
        factors.extend([f"Adams({k},{label},C2)"] * mult)
    expr = factors[0]
    for factor in factors[1:]:
        expr = f"tensor({expr},{factor},C2)"
    return expr


def do_crossgroup(max_order: int) -> bool:
    WORK14.mkdir(exist_ok=True)
    os.environ["PATH"] = LIE_ONLY_PATH
    assert shutil.which("lie"), "lie not on the restricted PATH"
    assert shutil.which("wolframscript") is None, "wolframscript still on PATH"
    assert shutil.which("form") is None, "form still on PATH"
    print(f"restricted PATH={LIE_ONLY_PATH} (lie only; no wolframscript, "
          f"no form)")

    species_list = sorted(s for (g, s) in DEFAULT_LABELS if g == "C2")
    store = CharStore(C2_STORE, "C2")
    n_ok = n_bad = 0
    t0 = time.time()
    with open(CROSSLOG, "w") as logf:
        for species in species_list:
            label = DEFAULT_LABELS[("C2", species)]
            for order in range(1, max_order + 1):
                path = (s12.ARXIV_DIR / "C2" / species /
                        f"{species}{order}.txt")
                table, _, _ = s12.read_table_file(path)
                for key in keys_of_order(order):
                    got = store.decomp(species, key)
                    want_file = table.get(str(key))
                    want_lie = store._lie_eval(direct_expr(key, label))
                    ok = got == want_file == want_lie
                    n_ok += ok
                    n_bad += not ok
                    logf.write(json.dumps(
                        {"species": species, "key": key, "ok": ok,
                         "generated": got,
                         "dropbox_equal": got == want_file,
                         "direct_lie_equal": got == want_lie}) + "\n")
                    if not ok:
                        print(f"MISMATCH C2/{species} {key}:\n"
                              f"  generated {got[:120]!r}\n"
                              f"  dropbox   {str(want_file)[:120]!r}\n"
                              f"  direct    {want_lie[:120]!r}")
            print(f"C2/{species}: orders 1..{max_order} done", flush=True)
    print(f"\ncrossgroup: {n_ok} keys identical across generated/Dropbox/"
          f"direct-LiE, {n_bad} mismatches; {len(species_list)} species, "
          f"orders 1..{max_order}; {time.time() - t0:.0f} s; "
          f"stats={store.stats()}")
    print("crossgroup:", "PASS" if n_bad == 0 and n_ok else "FAIL")
    return n_bad == 0 and n_ok > 0


# --------------------------------------------------------------------------- #
# part (iii): portability run in a self-contained directory
# --------------------------------------------------------------------------- #
RUNNER = '''\
"""Self-contained portability runner (written by 14_bootstrap.py).

Everything importable must resolve inside this directory; the character
store starts empty and bootstraps itself. External tools used: form, lie,
wolframscript (the latter for charge determination / post-processing,
which are outside the character-store scope)."""
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
sys.path.insert(0, str(HERE / "stubs"))
sys.path.insert(0, str(HERE))
os.environ["V2_CHARSTORE"] = str(HERE / "charstore_A2_empty.sqlite")
os.environ["V2_TIMINGS"] = "1"
assert not (HERE / "arxiv").exists(), "no Dropbox symlink allowed"

import pymysql            # noqa: E402  (results-DB stand-in)
import landscape_A2_v2 as L2  # noqa: E402
import refactor           # noqa: E402
import store as storepkg  # noqa: E402

for mod in (pymysql, refactor, storepkg):
    p = Path(mod.__file__).resolve()
    assert str(p).startswith(str(HERE)), f"{mod.__name__} leaked: {p}"
assert L2._v2_engine.charstore is not None, "store not wired"

NAME_LIST = ['X', 'M', 'q', 'qb', 'phi', 'S', 'Sb', 'A', 'Ab',
             'U', 'Ub', 'V', 'Vb', 'W', 'Wb']
T_ORDER, COUNTS, NC = 9, 1, 3

d = json.load(open(HERE / "line.json"))
files = {
    "success": L2.RESULTS_DIR / f"{L2.FILENAME}.txt",
    "log": L2.RESULTS_DIR / f"{L2.FILENAME}_log.txt",
    "error": L2.RESULTS_DIR / f"{L2.FILENAME}_error.txt",
}
sizes = {k: (p.stat().st_size if p.exists() else 0)
         for k, p in files.items()}
t0 = time.time()
err = None
try:
    L2.charges2(T_ORDER, COUNTS, NC, list(NAME_LIST),
                [list(d["n"]), list(d["w"])])
except Exception as e:  # noqa: BLE001 — recorded in the outcome
    err = f"{type(e).__name__}: {e}"
rec = {"line": d["line"], "w": d["w"],
       "seconds": round(time.time() - t0, 1), "exception": err,
       "store_stats": L2._v2_engine.charstore.stats()}
for k, p in files.items():
    lines = []
    if p.exists():
        with open(p) as f:
            f.seek(sizes[k])
            lines = [l.rstrip("\\n") for l in f if l.strip()]
    rec[k] = lines
with open(HERE / "outcome.json", "w") as f:
    json.dump(rec, f)
print("portability run finished:", rec["seconds"], "s;",
      rec["store_stats"], flush=True)
'''


def build_portable() -> None:
    do_setup()
    if PORT.exists():
        shutil.rmtree(PORT)
    (PORT / "stubs").mkdir(parents=True)
    for pkg in ("refactor", "store"):
        (PORT / pkg).mkdir()
        for py in (PROJ / pkg).glob("*.py"):
            shutil.copyfile(py, PORT / pkg / py.name)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py",
                    PORT / "stubs" / "pymysql.py")
    src = (WORK08 / "landscape_A2_v2.py").read_text()
    n = src.count(str(PROJ))
    assert n == 2, f"expected the overlay's 2 project-path refs, found {n}"
    (PORT / "landscape_A2_v2.py").write_text(src.replace(str(PROJ),
                                                         str(PORT)))
    (PORT / "run_line.py").write_text(RUNNER)
    print(f"portable dir built: {PORT} (refactor/, store/, module copy with "
          f"overlay path -> portable, pymysql stub, runner; no store file, "
          f"no arxiv)")


def do_portability(line_no: int) -> bool:
    build_portable()
    d = sl08.baseline_lines()[line_no]
    with open(PORT / "line.json", "w") as f:
        json.dump({"line": line_no, "n": d["n"], "w": d["w"]}, f)
    t0 = time.time()
    proc = subprocess.run([sys.executable, str(PORT / "run_line.py")],
                          cwd=PORT, text=True, capture_output=True)
    print(proc.stdout)
    if proc.returncode != 0:
        print(proc.stderr[-3000:])
        print("portability: FAIL (runner exited nonzero)")
        return False
    rec = json.load(open(PORT / "outcome.json"))
    old = {json.loads(l)["line"]: json.loads(l)
           for l in open(sl08.OUTCOMES05)}[line_no]
    same = all(rec[k] == old[k] for k in ("success", "log", "error"))
    generated = rec["store_stats"]["char_decomp_generated"]
    print(f"line {line_no}: outcome vs step-5 "
          f"{'identical' if same else 'DIFFERS'}; {rec['seconds']} s "
          f"(wall {time.time() - t0:.0f} s); store generated {generated} "
          f"table rows, tensor_cache {rec['store_stats']['tensor_cache']}")
    if not same:
        for k in ("success", "log", "error"):
            if rec[k] != old[k]:
                print(f"    {k}: port={str(rec[k])[:160]!r}")
                print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")
    ok = same and generated > 0
    print("portability:", "PASS" if ok else "FAIL")
    return ok


# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    p_replay = sub.add_parser("replay")
    p_replay.add_argument("--lines", default="0,100")
    sub.add_parser("verify-replay")
    p_cross = sub.add_parser("crossgroup")
    p_cross.add_argument("--max-order", type=int, default=5)
    p_port = sub.add_parser("portability")
    p_port.add_argument("--line", type=int, default=0)
    args = parser.parse_args()
    if args.cmd == "setup":
        do_setup()
        return 0
    if args.cmd == "replay":
        do_replay([int(x) for x in args.lines.split(",")])
        return 0
    if args.cmd == "verify-replay":
        return 0 if do_verify_replay() else 1
    if args.cmd == "crossgroup":
        return 0 if do_crossgroup(args.max_order) else 1
    return 0 if do_portability(args.line) else 1


if __name__ == "__main__":
    sys.exit(main())
