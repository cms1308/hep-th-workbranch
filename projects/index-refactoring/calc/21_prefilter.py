#!/usr/bin/env python3
"""Step 21: low-order consistency prefilter behind the V2_PREFILTER switch.

Semantics (user decision 2026-08-20): a theory the prefilter catches is
rejected from the LOW-ORDER expansion — its log record carries the
low-order index strings; the accepted set and every accepted record must
stay byte-identical to step-5 (prefilter rejections are sound because
low-order coefficients are exact, R8), and the false-positive guard in
glue redoes the full order whenever a prefilter hit does not end
'inconsistent'.

work21/ = plain work08 module + stubs + warm A2 store (no PATCH_18 — the
prefilter is isolated from the other switches here).

Subcommands:
  setup
  smoke            line 0 (clean: no hit, byte-identical) and line 19
                   (known-rejected: expect a prefilter hit) in isolated dirs
  guard-test       force a fake violation on clean line 0 — the guard must
                   redo full order and the outcome stay byte-identical
  replay [--start --end]   all 101 lines with V2_PREFILTER (shared dir)
  compare          success lines byte-identical; log lines: same routing +
                   equal consistency/a/c/w, low-order records itemized;
                   prefilter hit/false-positive counts; timing vs step-13
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK08 = HERE / "work08"
WORK12 = HERE / "work12"
WORK21 = HERE / "work21"
STUBS21 = WORK21 / "stubs"
FULL_DIR = WORK21 / "full"
OUTCOMES = WORK21 / "replay_outcomes.jsonl"
PREFILTER_ORDER = 6

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)

# step-13 reference timings (same machine class, warm store, no prefilter)
OUTCOMES13 = HERE / "work13" / "replay_outcomes.jsonl"


def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    WORK21.mkdir(exist_ok=True)
    STUBS21.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS21 / "pymysql.py")
    shutil.copyfile(WORK08 / "landscape_A2_v2.py",
                    WORK21 / "landscape_A2_v2.py")
    if not (WORK21 / "charstore_A2.sqlite").exists():
        shutil.copyfile(WORK12 / "charstore_A2.sqlite",
                        WORK21 / "charstore_A2.sqlite")
    assert not (WORK21 / "arxiv").exists()
    print("setup OK")


def import_module(rundir: Path):
    do_setup()
    os.environ["V2_CHARSTORE"] = str(WORK21 / "charstore_A2.sqlite")
    os.environ["V2_TIMINGS"] = "1"
    os.environ["V2_PREFILTER"] = str(PREFILTER_ORDER)
    rundir.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(STUBS21))
    sys.path.insert(0, str(WORK21))
    sys.path.insert(0, str(PROJ))
    os.chdir(rundir)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert L2._v2_engine._prefilter_order == PREFILTER_ORDER
    return L2


def run_line(L2, line_no: int) -> dict:
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
           "exception": err}
    for k, p in files.items():
        rec[k] = sl08._appended(p, sizes[k])
    return rec


def scanlog_events(rundir: Path) -> tuple[int, int]:
    hits = fps = 0
    scanlog = rundir / "v2_scanlog.jsonl"
    if scanlog.exists():
        for line in open(scanlog):
            rec = json.loads(line)
            hits += bool(rec.get("prefilter_hit"))
            fps += bool(rec.get("prefilter_false_positive"))
    return hits, fps


def outcomes05() -> dict:
    return {json.loads(l)["line"]: json.loads(l)
            for l in open(sl08.OUTCOMES05)}


def do_smoke() -> bool:
    L2 = import_module(WORK21 / "run_smoke")
    old = outcomes05()
    ok = True
    for line_no, expect_hit in ((0, False), (19, True)):
        rec = run_line(L2, line_no)
        hits, fps = scanlog_events(WORK21 / "run_smoke")
        same = all(rec[k] == old[line_no][k]
                   for k in ("success", "log", "error"))
        if expect_hit:
            got_low = (bool(rec["log"]) and json.loads(rec["log"][0])
                       .get("consistency") == "inconsistent")
            print(f"line {line_no}: {rec['seconds']}s prefilter hits so far "
                  f"{hits}, verdict-inconsistent={got_low}, "
                  f"record-low-order={'yes' if not same else 'NO (same)'}")
            ok &= got_low and hits >= 1 and fps == 0
        else:
            print(f"line {line_no}: {rec['seconds']}s byte-identical={same}, "
                  f"hits={hits}, false-positives={fps}")
            ok &= same and hits == 0 and fps == 0
    print("smoke:", "PASS" if ok else "FAIL")
    return ok


def do_guard_test() -> bool:
    L2 = import_module(WORK21 / "run_guard")
    from refactor import conditions, glue  # noqa: F401
    real = conditions.mcode_consistency_violations
    conditions.mcode_consistency_violations = (
        lambda records, t_order: ["FORCED fake violation (guard test)"])
    try:
        rec = run_line(L2, 0)
    finally:
        conditions.mcode_consistency_violations = real
    hits, fps = scanlog_events(WORK21 / "run_guard")
    old = outcomes05()[0]
    same = all(rec[k] == old[k] for k in ("success", "log", "error"))
    print(f"forced-violation line 0: {rec['seconds']}s hit={hits}, "
          f"guard fired={fps}, outcome byte-identical={same}")
    ok = hits >= 1 and fps >= 1 and same
    print("guard-test:", "PASS" if ok else "FAIL")
    return ok


def do_replay(start: int, end: int) -> None:
    L2 = import_module(FULL_DIR)
    done = set()
    if OUTCOMES.exists():
        for line in open(OUTCOMES):
            done.add(json.loads(line)["line"])
    todo = [i for i in range(start, min(end, 101)) if i not in done]
    print(f"prefilter(@{PREFILTER_ORDER}) replay: {len(todo)} lines "
          f"({len(done)} done)", flush=True)
    for i in todo:
        rec = run_line(L2, i)
        with open(OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else "NO-OUTPUT")
        print(f"[{i}] {rec['seconds']}s {outcome}", flush=True)
    print("replay complete", flush=True)


def do_compare() -> bool:
    old = outcomes05()
    outs = sorted((json.loads(l) for l in open(OUTCOMES)),
                  key=lambda r: r["line"])
    ref13 = {json.loads(l)["line"]: json.loads(l)["seconds"]
             for l in open(OUTCOMES13)} if OUTCOMES13.exists() else {}
    failures, low_order = [], []
    for rec in outs:
        o = old[rec["line"]]
        same = all(rec[k] == o[k] for k in ("success", "log", "error"))
        if same:
            continue
        # allowed divergence: log-routed line whose record is the
        # low-order one — same routing, same verdict, same a/c/w
        routing_new = [k for k in ("success", "log", "error") if rec[k]]
        routing_old = [k for k in ("success", "log", "error") if o[k]]
        if routing_new != routing_old or routing_new != ["log"]:
            failures.append(f"line {rec['line']}: routing {routing_old} -> "
                            f"{routing_new}")
            continue
        try:
            new_d = json.loads(rec["log"][0])
            old_d = json.loads(o["log"][0])
        except Exception:
            failures.append(f"line {rec['line']}: unparseable log")
            continue
        keys_equal = all(new_d.get(k) == old_d.get(k)
                         for k in ("consistency", "a", "c", "w", "nw"))
        if keys_equal and len(rec["log"]) == len(o["log"]):
            diff_keys = sorted(k for k in set(new_d) | set(old_d)
                               if new_d.get(k) != old_d.get(k))
            low_order.append((rec["line"], diff_keys))
        else:
            failures.append(f"line {rec['line']}: log dict differs beyond "
                            f"index fields")
    hits, fps = scanlog_events(FULL_DIR)
    n_ident = len(outs) - len(low_order) - len(failures)
    t_new = sum(r["seconds"] for r in outs)
    t_ref = sum(ref13.get(r["line"], 0) for r in outs)
    print(f"outcomes: {n_ident} byte-identical, {len(low_order)} low-order "
          f"records (expected semantics), {len(failures)} FAILURES")
    for line_no, keys in low_order:
        print(f"  low-order record line {line_no}: differing keys {keys}")
    for f_ in failures:
        print(f"  {f_}")
    print(f"prefilter hits {hits}, false positives {fps}")
    print(f"time: {t_new/60:.1f} min vs step-13 reference "
          f"{t_ref/60:.1f} min for the same lines")
    # success set must be exactly step-5's
    succ_new = {r["line"] for r in outs if r["success"]}
    succ_old = {i for i, o in old.items() if o["success"]}
    if succ_new != succ_old:
        failures.append(f"accepted set changed: {succ_new ^ succ_old}")
        print(f"ACCEPTED SET CHANGED: {sorted(succ_new ^ succ_old)}")
    else:
        print(f"accepted set unchanged ({len(succ_new)} theories)")
    ok = not failures and len(outs) == 101
    print("compare:", "PASS" if ok else "FAIL")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    sub.add_parser("smoke")
    sub.add_parser("guard-test")
    p_r = sub.add_parser("replay")
    p_r.add_argument("--start", type=int, default=0)
    p_r.add_argument("--end", type=int, default=101)
    sub.add_parser("compare")
    args = parser.parse_args()
    if args.cmd == "setup":
        do_setup()
        return 0
    if args.cmd == "smoke":
        return 0 if do_smoke() else 1
    if args.cmd == "guard-test":
        return 0 if do_guard_test() else 1
    if args.cmd == "replay":
        do_replay(args.start, args.end)
        return 0
    return 0 if do_compare() else 1


if __name__ == "__main__":
    sys.exit(main())
