#!/usr/bin/env python3
"""Step 6: per-stage wall-clock profile of the index pipeline on named
baseline inputs (SU3s1S1nf2 lines), with LiE-cache hit rates.

Method (pipeline module unmodified — measurement is external):
  - PATH shims wrap the real `lie`, `form`, `wolframscript` binaries with
    `/usr/bin/time -a -o work06/tool_<name>.log -p`, giving one real/user/sys
    record per external-tool invocation, parent or Pool-child alike.
  - The pymysql stub (same no-DB design as step 5) additionally appends one
    JSON line per LiE-cache get/put to work06/cache_stats.jsonl (hit/miss).
  - In the driver process, `form`, `decouple`, `Index` are wrapped with timers
    that snapshot the tool logs before/after, attributing tool calls to the
    pipeline phase that spawned them. The a-maximization wolframscript call
    (inline Popen in charges2) is whatever wolframscript time falls outside
    the decouple/Index windows.
  - Each (line, cache-mode) benchmark runs in a fresh subprocess with its own
    results dir; cold = empty liecache.sqlite, warm = copy of the step-5
    cache (work05/liecache.sqlite, 16k entries).

Subcommands:
  setup                       build work06 (shims, stubs, module copy, symlink)
  run-one --line N --mode M   run one benchmark (M = cold|warm), append summary
                              to work06/profile_results.jsonl
  report                      print the collected profiles as a table

Benchmark set used for the note: line 0 (seed, W=0) cold+warm; lines 23
(2-term M-flip), 77 (3-term), 100 (7-term, 4 X-flips) warm; line 100 cold.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK5 = HERE / "work05"
WORK = HERE / "work06"
STUBS = WORK / "stubs"
BIN = WORK / "bin"
REFS_DIR = HERE.parent / "refs"
BASELINE = REFS_DIR / "SU3s1S1nf2.txt"
PROFILES = WORK / "profile_results.jsonl"
CACHE_STATS = WORK / "cache_stats.jsonl"

TOOLS = ["lie", "form", "wolframscript"]
FILENAME = "SU3s1S1nf2_replay"
NAME_LIST = ['X', 'M', 'q', 'qb', 'phi', 'S', 'Sb', 'A', 'Ab',
             'U', 'Ub', 'V', 'Vb', 'W', 'Wb']
T_ORDER, COUNTS, NC = 9, 1, 3

CACHE_STATS_SNIPPET = '''
_STATS = Path.cwd() / "cache_stats.jsonl"


def _stat(rec):
    with open(_STATS, "a") as f:
        f.write(json.dumps(rec) + "\\n")
'''


def do_setup():
    assert (WORK5 / "landscape_A2.py").exists(), "run 05_regression.py setup first"
    WORK.mkdir(exist_ok=True)
    STUBS.mkdir(exist_ok=True)
    BIN.mkdir(exist_ok=True)
    shutil.copy(WORK5 / "landscape_A2.py", WORK / "landscape_A2.py")

    # stats-instrumented copy of the step-5 pymysql stub: same behavior, plus
    # one JSON line per LieCache get (hit/miss) and put.
    stub = (WORK5 / "stubs" / "pymysql.py").read_text()
    stub = stub.replace('_LOG = Path.cwd() / "sql_inserts.jsonl"',
                        '_LOG = Path.cwd() / "sql_inserts.jsonl"\n'
                        + CACHE_STATS_SNIPPET)
    needle = ('                self._row = self._conn.execute(\n'
              '                    "SELECT result FROM LieCache WHERE ckey=?", params\n'
              '                ).fetchone()')
    assert needle in stub, "step-5 stub layout changed; update 06 instrumentation"
    stub = stub.replace(needle, needle +
                        '\n                _stat({"op": "get", '
                        '"hit": self._row is not None})')
    needle2 = ('                    "INSERT OR IGNORE INTO LieCache (ckey,result) VALUES (?,?)",\n'
               '                    params)')
    assert needle2 in stub, "step-5 stub layout changed (put); update 06"
    stub = stub.replace(needle2, needle2 + '\n                _stat({"op": "put"})')
    (STUBS / "pymysql.py").write_text(stub)

    link = WORK / "arxiv"
    if not link.exists():
        link.symlink_to((WORK5 / "arxiv").resolve())

    for tool in TOOLS:
        real = shutil.which(tool)
        assert real and str(BIN) not in real, f"cannot resolve real {tool}"
        shim = BIN / tool
        shim.write_text(
            "#!/bin/sh\n"
            f'exec /usr/bin/time -a -o "{WORK}/tool_{tool}.log" -p '
            f'"{real}" "$@"\n')
        shim.chmod(0o755)
    print(f"setup OK: shims for {TOOLS}, stats stub, module copy, arxiv link")


# --------------------------------------------------------------------------- #
def _log_path(tool):
    return WORK / f"tool_{tool}.log"


def _tool_snapshot():
    return {t: (_log_path(t).stat().st_size if _log_path(t).exists() else 0)
            for t in TOOLS} | {
            "cache": CACHE_STATS.stat().st_size if CACHE_STATS.exists() else 0}


def _parse_segment(tool, start, end=None):
    p = _log_path(tool)
    if not p.exists():
        return []
    with open(p) as f:
        f.seek(start)
        text = f.read() if end is None else f.read(end - start)
    return [float(m.group(1)) for m in re.finditer(r"^real +([\d.]+)",
                                                   text, re.M)]


def _cache_segment(start, end=None):
    if not CACHE_STATS.exists():
        return {"gets": 0, "hits": 0, "puts": 0}
    with open(CACHE_STATS) as f:
        f.seek(start)
        text = f.read() if end is None else f.read(end - start)
    gets = hits = puts = 0
    for line in text.splitlines():
        r = json.loads(line)
        if r["op"] == "get":
            gets += 1
            hits += bool(r["hit"])
        else:
            puts += 1
    return {"gets": gets, "hits": hits, "puts": puts}


def run_one(line_no, mode):
    assert mode in ("cold", "warm")
    os.environ["PATH"] = f"{BIN}:{os.environ['PATH']}"
    os.chdir(WORK)

    # fresh per-run cache/logs/results
    cache = WORK / "liecache.sqlite"
    for p in [cache, CACHE_STATS, *(_log_path(t) for t in TOOLS)]:
        if p.exists():
            p.unlink()
    if mode == "warm":
        shutil.copy(WORK5 / "liecache.sqlite", cache)
    results_dir = WORK / "results" / "Sp" / FILENAME
    if results_dir.exists():
        shutil.rmtree(results_dir)

    sys.path.insert(0, str(STUBS))
    sys.path.insert(0, str(WORK))
    import landscape_A2 as L
    import pymysql
    assert "stubs" in pymysql.__file__

    phases = []

    def timed(name, fn):
        def wrapper(*args, **kwargs):
            snap0, t0 = _tool_snapshot(), time.time()
            out = fn(*args, **kwargs)
            snap1, t1 = _tool_snapshot(), time.time()
            rec = {"phase": name, "wall": round(t1 - t0, 2)}
            for t in TOOLS:
                seg = _parse_segment(t, snap0[t], snap1[t])
                if seg:
                    rec[t] = {"calls": len(seg), "sum": round(sum(seg), 2)}
            rec["cache"] = _cache_segment(snap0["cache"], snap1["cache"])
            phases.append(rec)
            return out
        return wrapper

    L.form = timed("form", L.form)
    L.decouple = timed("decouple", L.decouple)
    L.Index = timed("Index", L.Index)

    d = json.loads(open(BASELINE).readlines()[line_no])
    t0 = time.time()
    L.charges2(T_ORDER, COUNTS, NC, list(NAME_LIST), [list(d["n"]), list(d["w"])])
    total = time.time() - t0

    # a-maximization wolframscript = ws calls outside the wrapped phases
    all_ws = _parse_segment("wolframscript", 0)
    phase_ws = sum(p.get("wolframscript", {}).get("sum", 0) for p in phases)
    summary = {
        "line": line_no, "mode": mode, "w": d["w"], "n_terms": len(d["w"]),
        "total_wall": round(total, 1),
        "charges_ws": round(sum(all_ws) - phase_ws, 2),
        "phases": phases,
        "lie_total": {"calls": len(_parse_segment("lie", 0)),
                      "sum": round(sum(_parse_segment("lie", 0)), 2)},
        "cache_total": _cache_segment(0),
    }
    with open(PROFILES, "a") as f:
        f.write(json.dumps(summary) + "\n")
    print(json.dumps(summary, indent=1))


def report():
    rows = [json.loads(l) for l in open(PROFILES)]
    hdr = (f"{'line':>4} {'mode':>5} {'terms':>5} {'total':>7} {'a-max ws':>8} "
           f"{'form':>7} {'decouple':>9} {'Index':>7} {'lie calls':>9} "
           f"{'lie sum':>7} {'cache hit%':>10}")
    print(hdr)
    for r in rows:
        by = {p["phase"]: p for p in r["phases"]}
        form_s = sum(p["wall"] for p in r["phases"] if p["phase"] == "form")
        ct = r["cache_total"]
        hitpct = f"{100 * ct['hits'] / ct['gets']:.0f}%" if ct["gets"] else "—"
        print(f"{r['line']:>4} {r['mode']:>5} {r['n_terms']:>5} "
              f"{r['total_wall']:>7.1f} {r['charges_ws']:>8.2f} "
              f"{form_s:>7.2f} {by.get('decouple', {}).get('wall', 0):>9.2f} "
              f"{by.get('Index', {}).get('wall', 0):>7.2f} "
              f"{r['lie_total']['calls']:>9} {r['lie_total']['sum']:>7.2f} "
              f"{hitpct:>10}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["setup", "run-one", "report"])
    ap.add_argument("--line", type=int)
    ap.add_argument("--mode", choices=["cold", "warm"])
    a = ap.parse_args()
    if a.cmd == "setup":
        do_setup()
    elif a.cmd == "run-one":
        run_one(a.line, a.mode)
    else:
        report()


if __name__ == "__main__":
    main()
