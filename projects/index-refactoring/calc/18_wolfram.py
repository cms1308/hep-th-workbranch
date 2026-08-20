#!/usr/bin/env python3
"""Step 18: persistent Wolfram kernel pool behind the V2_WOLFRAM switch.

work18/ = the work13/16 pattern (module + stubs + warm A2 store copy, no
arxiv) with ONE additional surgical charges2 patch (PATCH_18, user
decision 2026-08-20: full 3-call coverage): the FindCharges wolframscript
spawn is routed through the overlay hook _v2_wolfram_eval, which uses the
kernel pool when V2_WOLFRAM is set and reproduces the original
spawn+kill-on-timeout semantics when unset — so 'ws' mode below doubles
as the patched-module/unset-env parity check.

Subcommands:
  setup                        build work18/ (patched module, stubs, store)
  replay-one --line N --mode kernel|ws --tag X   one line, isolated run dir
  bench [--lines 0,23,77,100 --reps 2]  interleaved ws/kernel wall clocks
  full-replay [--start --end]  all 101 lines, kernel mode, shared run dir
  compare                      bench + full-replay outcomes vs step-5,
                               scan flags
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK08 = HERE / "work08"
WORK12 = HERE / "work12"
WORK18 = HERE / "work18"
STUBS18 = WORK18 / "stubs"
FULL_DIR = WORK18 / "full"
BENCH_OUTCOMES = WORK18 / "bench_outcomes.jsonl"
FULL_OUTCOMES = WORK18 / "full_outcomes.jsonl"
STORE_MASTER = WORK12 / "charstore_A2.sqlite"

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)

# The FindCharges wolframscript spawn inside charges2 (scope (a) call
# site), routed through the overlay hook. Applied on top of the step-8
# module copy; anchor must be unique.
PATCH_18 = (
    """    proc = subprocess.Popen(['wolframscript', '-code', mcode], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        (out, err) = proc.communicate(timeout=3600)

    except subprocess.TimeoutExpired:
        subprocess.call(['kill', '-9', str(proc.pid)])
        print("timeout expired (computing central charges)")
""",
    """    try:
        out = _v2_wolfram_eval(mcode, 3600)

    except subprocess.TimeoutExpired:
        print("timeout expired (computing central charges)")
""",
)


def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    assert STORE_MASTER.exists(), "run 12_import.py first"
    WORK18.mkdir(exist_ok=True)
    STUBS18.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS18 / "pymysql.py")
    src = (WORK08 / "landscape_A2_v2.py").read_text()
    old, new = PATCH_18
    n = src.count(old)
    assert n == 1, f"PATCH_18 anchor not unique ({n} hits)"
    (WORK18 / "landscape_A2_v2.py").write_text(src.replace(old, new))
    if not (WORK18 / "charstore_A2.sqlite").exists():
        shutil.copyfile(STORE_MASTER, WORK18 / "charstore_A2.sqlite")
    assert not (WORK18 / "arxiv").exists(), "work18 must have NO arxiv link"
    print("setup OK: PATCH_18 module + stubs + warm store; no arxiv")


def import_module(mode: str, rundir: Path):
    do_setup()
    os.environ["V2_CHARSTORE"] = str(WORK18 / "charstore_A2.sqlite")
    os.environ["V2_TIMINGS"] = "1"
    if mode == "kernel":
        os.environ["V2_WOLFRAM"] = "1"
    else:
        os.environ.pop("V2_WOLFRAM", None)
    rundir.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(STUBS18))
    sys.path.insert(0, str(WORK18))
    sys.path.insert(0, str(PROJ))
    os.chdir(rundir)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert hasattr(L2, "_v2_wolfram_eval"), "overlay hook missing"
    assert (L2._v2_engine.wolframpool is not None) == (mode == "kernel")
    return L2


def run_line(L2, line_no: int, extra: dict) -> dict:
    d = sl08.baseline_lines()[line_no]
    files = {
        "success": L2.RESULTS_DIR / f"{sl08.FILENAME}.txt",
        "log": L2.RESULTS_DIR / f"{sl08.FILENAME}_log.txt",
        "error": L2.RESULTS_DIR / f"{sl08.FILENAME}_error.txt",
    }
    sizes = {k: (p.stat().st_size if p.exists() else 0)
             for k, p in files.items()}
    t0 = time.time()
    err = None
    try:
        L2.charges2(sl08.T_ORDER, sl08.COUNTS, sl08.NC,
                    list(sl08.NAME_LIST), [list(d["n"]), list(d["w"])])
    except Exception as e:  # noqa: BLE001 — recorded
        err = f"{type(e).__name__}: {e}"
    rec = {"line": line_no, "seconds": round(time.time() - t0, 1),
           "exception": err, **extra}
    for k, p in files.items():
        rec[k] = sl08._appended(p, sizes[k])
    return rec


def do_replay_one(line_no: int, mode: str, tag: str) -> None:
    L2 = import_module(mode, WORK18 / f"run_{tag}")
    rec = run_line(L2, line_no, {"mode": mode, "tag": tag})
    pool = L2._v2_engine.wolframpool
    rec["wolframpool"] = pool.stats() if pool else None
    with open(BENCH_OUTCOMES, "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(f"[{tag}] line {line_no} {mode}: {rec['seconds']}s "
          f"pool={rec['wolframpool']}", flush=True)


def do_bench(line_numbers: list[int], reps: int) -> None:
    for rep in range(reps):
        for mode in ("ws", "kernel"):
            for i in line_numbers:
                tag = f"{mode}{rep}_l{i}"
                cmd = [sys.executable, str(HERE / "18_wolfram.py"),
                       "replay-one", "--line", str(i), "--mode", mode,
                       "--tag", tag]
                proc = subprocess.run(cmd, text=True, capture_output=True)
                print(proc.stdout.strip().splitlines()[-1] if proc.stdout
                      else f"[{tag}] NO OUTPUT", flush=True)
                if proc.returncode != 0:
                    print(proc.stderr[-2000:])
                    return
    times: dict[tuple[int, str], list[float]] = {}
    for line in open(BENCH_OUTCOMES):
        rec = json.loads(line)
        times.setdefault((rec["line"], rec["mode"]), []).append(
            rec["seconds"])
    print("\n=== bench (warm store, interleaved, per full theory) ===")
    for i in line_numbers:
        ws = times.get((i, "ws"), [])
        kr = times.get((i, "kernel"), [])
        if ws and kr:
            mw, mk = statistics.mean(ws), statistics.mean(kr)
            print(f"line {i}: ws {mw:.1f}s | kernel {mk:.1f}s | "
                  f"x{mw / mk:.2f} (saved {mw - mk:.1f}s)")


def do_full_replay(start: int, end: int) -> None:
    L2 = import_module("kernel", FULL_DIR)
    done = set()
    if FULL_OUTCOMES.exists():
        for line in open(FULL_OUTCOMES):
            done.add(json.loads(line)["line"])
    todo = [i for i in range(start, min(end, 101)) if i not in done]
    print(f"kernel-mode full replay: {len(todo)} lines "
          f"({len(done)} already done)", flush=True)
    for i in todo:
        rec = run_line(L2, i, {"mode": "kernel"})
        with open(FULL_OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else "NO-OUTPUT")
        print(f"[{i}] {rec['seconds']}s {outcome}", flush=True)
    print(f"full replay complete; pool "
          f"{L2._v2_engine.wolframpool.stats()}", flush=True)


def _compare_records(outs: list[dict], outs05: dict) -> int:
    n_diff = 0
    for rec in outs:
        old = outs05[rec["line"]]
        if not all(rec[k] == old[k] for k in ("success", "log", "error")):
            n_diff += 1
            print(f"line {rec['line']} ({rec.get('tag', 'full')}) DIFFERS:")
            for k in ("success", "log", "error"):
                if rec[k] != old[k]:
                    print(f"    {k}: v18={str(rec[k])[:160]!r}")
                    print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")
    return n_diff


def do_compare() -> bool:
    outs05 = {json.loads(l)["line"]: json.loads(l)
              for l in open(sl08.OUTCOMES05)}
    n_bench = n_full = 0
    n_diff = 0
    if BENCH_OUTCOMES.exists():
        bench = [json.loads(l) for l in open(BENCH_OUTCOMES)]
        n_bench = len(bench)
        n_diff += _compare_records(bench, outs05)
    if FULL_OUTCOMES.exists():
        full = sorted((json.loads(l) for l in open(FULL_OUTCOMES)),
                      key=lambda r: r["line"])
        n_full = len(full)
        n_diff += _compare_records(full, outs05)
    n_fired = 0
    for scanlog in WORK18.glob("*/v2_scanlog.jsonl"):
        n_fired += sum(bool(json.loads(l)["fired"]) for l in open(scanlog))
    print(f"bench records: {n_bench}; full-replay records: {n_full}; "
          f"differing: {n_diff}; scan flags fired: {n_fired}")
    ok = n_diff == 0 and n_fired == 0 and n_full == 101 and n_bench > 0
    print("compare:", "PASS" if ok else "FAIL")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    p_one = sub.add_parser("replay-one")
    p_one.add_argument("--line", type=int, required=True)
    p_one.add_argument("--mode", choices=("kernel", "ws"), required=True)
    p_one.add_argument("--tag", required=True)
    p_b = sub.add_parser("bench")
    p_b.add_argument("--lines", default="0,23,77,100")
    p_b.add_argument("--reps", type=int, default=2)
    p_f = sub.add_parser("full-replay")
    p_f.add_argument("--start", type=int, default=0)
    p_f.add_argument("--end", type=int, default=101)
    sub.add_parser("compare")
    args = parser.parse_args()
    if args.cmd == "setup":
        do_setup()
        return 0
    if args.cmd == "replay-one":
        do_replay_one(args.line, args.mode, args.tag)
        return 0
    if args.cmd == "bench":
        do_bench([int(x) for x in args.lines.split(",")], args.reps)
        return 0
    if args.cmd == "full-replay":
        do_full_replay(args.start, args.end)
        return 0
    return 0 if do_compare() else 1


if __name__ == "__main__":
    sys.exit(main())
