#!/usr/bin/env python3
"""Step 16: parallel FORM (TFORM) behind the V2_TFORM switch.

work16/ = the work13 pattern: module copy (same bytes as steps 8/13/14),
pymysql stub, a COPY of the imported A2 store (warm — this step isolates
the FORM stage; character data is not the variable). No arxiv symlink.

Subcommands:
  setup                       build work16/
  ab-form [--lines 0,23,77,100 --orders 3,9 --workers 4]
        run the module's form() and the glue _tform_form() on the same
        rlist and byte-compare the form{pid}.txt output files
  bench [--lines 0,23,77,100 --order 9 --workers 4 --reps 3]
        interleaved form/tform wall-clock on the FORM stage
  replay [--lines 0,23,77,100 --workers 4]
        end-to-end charges2 with V2_TFORM set (resumable)
  compare                     replay outcomes vs the step-5 records
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import sqlite3
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK08 = HERE / "work08"
WORK12 = HERE / "work12"
WORK16 = HERE / "work16"
STUBS16 = WORK16 / "stubs"
OUTCOMES = WORK16 / "replay_outcomes.jsonl"
STORE_FILE = WORK16 / "charstore_A2.sqlite"
DEFAULT_LINES = "0,23,77,100"

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)


def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    assert (WORK12 / "charstore_A2.sqlite").exists(), "run 12_import.py first"
    WORK16.mkdir(exist_ok=True)
    STUBS16.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS16 / "pymysql.py")
    shutil.copyfile(WORK08 / "landscape_A2_v2.py",
                    WORK16 / "landscape_A2_v2.py")
    if not STORE_FILE.exists():
        shutil.copyfile(WORK12 / "charstore_A2.sqlite", STORE_FILE)
    assert not (WORK16 / "arxiv").exists(), "work16 must have NO arxiv link"
    print("setup OK: module + stubs + warm store copy; no arxiv")


def import_module(tform_workers: int | None, timings: bool):
    do_setup()
    os.environ["V2_CHARSTORE"] = str(STORE_FILE)
    if tform_workers:
        os.environ["V2_TFORM"] = str(tform_workers)
    else:
        os.environ.pop("V2_TFORM", None)
    if timings:
        os.environ["V2_TIMINGS"] = "1"
    sys.path.insert(0, str(STUBS16))
    sys.path.insert(0, str(WORK16))
    sys.path.insert(0, str(PROJ))
    os.chdir(WORK16)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert L2.GROUP_RANK == "A2" and hasattr(L2, "_v2_engine")
    return L2


def form_output(L2, form_fn, t_order: int, rlist) -> tuple[bytes, float]:
    pid = os.getpid()
    out_file = L2.FRM_DIR / f"form{pid}.txt"
    if out_file.exists():
        out_file.unlink()
    t0 = time.time()
    rv = form_fn(t_order, pid, rlist)
    dt = time.time() - t0
    assert rv == "ok", f"form returned {rv!r}"
    return out_file.read_bytes(), dt


def do_ab_form(line_numbers: list[int], orders: list[int],
               workers: int) -> bool:
    # V2_TFORM stays UNSET: L2.form is the module's own; the tform variant
    # is built directly from the glue factory on the module's globals.
    L2 = import_module(tform_workers=None, timings=False)
    from refactor.glue import _tform_form
    tform_fn = _tform_form(L2.__dict__, workers)
    lines = sl08.baseline_lines()
    n_bad = 0
    for i in line_numbers:
        rlist = sl08.r_list_from_line(lines[i])
        for order in orders:
            out_form, dt_f = form_output(L2, L2.form, order, rlist)
            out_tform, dt_t = form_output(L2, tform_fn, order, rlist)
            same = out_form == out_tform
            n_bad += not same
            print(f"line {i} t_order {order}: "
                  f"{'byte-identical' if same else 'DIFFER'} "
                  f"({len(out_form)} bytes; form {dt_f:.1f}s, "
                  f"tform -w{workers} {dt_t:.1f}s)", flush=True)
            if not same:
                print(f"    form : {out_form[:120]!r}")
                print(f"    tform: {out_tform[:120]!r}")
    print(f"\nab-form: {'PASS' if n_bad == 0 else f'FAIL ({n_bad} differ)'}")
    return n_bad == 0


def do_bench(line_numbers: list[int], order: int, workers: int,
             reps: int) -> None:
    L2 = import_module(tform_workers=None, timings=False)
    from refactor.glue import _tform_form
    tform_fn = _tform_form(L2.__dict__, workers)
    lines = sl08.baseline_lines()
    times: dict[tuple[int, str], list[float]] = {}
    for rep in range(reps):
        for i in line_numbers:
            rlist = sl08.r_list_from_line(lines[i])
            for name, fn in (("form", L2.form),
                             (f"tform-w{workers}", tform_fn)):
                _, dt = form_output(L2, fn, order, rlist)
                times.setdefault((i, name), []).append(dt)
                print(f"rep {rep} line {i} {name}: {dt:.2f}s", flush=True)
    print(f"\n=== bench (t_order {order}, {reps} reps, interleaved) ===")
    for i in line_numbers:
        t_form = times[(i, "form")]
        t_tform = times[(i, f"tform-w{workers}")]
        mf, mt = statistics.mean(t_form), statistics.mean(t_tform)
        print(f"line {i}: form {mf:.2f}s (min {min(t_form):.2f}) | "
              f"tform -w{workers} {mt:.2f}s (min {min(t_tform):.2f}) | "
              f"speedup x{mf / mt:.2f}")


def synthetic_rlist(nf: int, r_q: float, r_s: float) -> list:
    """FORM-stress theory: SU(3) with nf flavors of small-R-charge q/qb
    (each with its own U(1) global basis vector -> nf g-fugacities) plus
    one S/Sb pair. Not anomaly-consistent — form() only expands the PE,
    so only positive R-charges matter for the stress test."""
    zeros = [0] * nf
    basis = [[1 if j == i else 0 for j in range(nf)] for i in range(nf)]
    rlist = []
    for name in sl08.NAME_LIST[:9]:
        if name == "q":
            rlist.append(["q", [r_q] * nf, basis])
        elif name == "qb":
            rlist.append(["qb", [r_q] * nf, [[-x for x in b] for b in basis]])
        elif name == "S":
            rlist.append(["S", [r_s], [zeros]])
        elif name == "Sb":
            rlist.append(["Sb", [r_s], [zeros]])
        else:
            rlist.append([name, [], []])
    return rlist


HEAVY_SPECS = [
    ("A_nf2_r0.30", 2, 0.30, 0.30),
    ("B_nf4_r0.25", 4, 0.25, 0.30),
    ("C_nf6_r0.20", 6, 0.20, 0.25),
]


def do_bench_heavy(order: int, workers_list: list[int], reps: int) -> None:
    L2 = import_module(tform_workers=None, timings=False)
    from refactor.glue import _tform_form
    tforms = {w: _tform_form(L2.__dict__, w) for w in workers_list}

    # ladder: find the heaviest spec form() finishes in reasonable time
    target = None
    for name, nf, r_q, r_s in HEAVY_SPECS:
        rlist = synthetic_rlist(nf, r_q, r_s)
        t0 = time.time()
        try:
            out, dt = form_output(L2, L2.form, order, rlist)
        except AssertionError:
            print(f"{name}: form TIMEOUT/stop after {time.time()-t0:.0f}s "
                  f"— ladder ends", flush=True)
            break
        print(f"{name}: form {dt:.1f}s ({len(out)/1e6:.1f} MB output)",
              flush=True)
        target = (name, rlist, out)
        if dt > 400:
            break
    if target is None:
        print("no feasible spec")
        return
    name, rlist, ref = target
    print(f"\ninterleaved bench on {name} (t_order {order}):", flush=True)
    times: dict[str, list[float]] = {}
    for rep in range(reps):
        _, dt = form_output(L2, L2.form, order, rlist)
        times.setdefault("form", []).append(dt)
        print(f"rep {rep} form: {dt:.1f}s", flush=True)
        for w, fn in tforms.items():
            out_t, dt = form_output(L2, fn, order, rlist)
            times.setdefault(f"tform-w{w}", []).append(dt)
            print(f"rep {rep} tform-w{w}: {dt:.1f}s "
                  f"({'byte-identical' if out_t == ref else 'DIFFER!'})",
                  flush=True)
    mf = statistics.mean(times["form"])
    print(f"\n=== bench-heavy {name} ===")
    for key, ts in times.items():
        print(f"{key}: mean {statistics.mean(ts):.1f}s (min {min(ts):.1f})"
              + ("" if key == "form"
                 else f"  speedup x{mf / statistics.mean(ts):.2f}"))


def do_replay(line_numbers: list[int], workers: int) -> None:
    L2 = import_module(tform_workers=workers, timings=True)
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
    print(f"tform replay (-w{workers}) of lines {todo} "
          f"({sorted(done)} already done)", flush=True)
    for i in todo:
        d = lines[i]
        nw = [list(d["n"]), list(d["w"])]
        sizes = {k: (p.stat().st_size if p.exists() else 0)
                 for k, p in files.items()}
        t0 = time.time()
        err = None
        try:
            L2.charges2(sl08.T_ORDER, sl08.COUNTS, sl08.NC,
                        list(sl08.NAME_LIST), nw)
        except Exception as e:  # noqa: BLE001 — recorded per line
            err = f"{type(e).__name__}: {e}"
        dt = time.time() - t0
        rec = {"line": i, "w": d["w"], "seconds": round(dt, 1),
               "workers": workers, "exception": err}
        for k, p in files.items():
            rec[k] = sl08._appended(p, sizes[k])
        with open(OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else
                   f"exception:{err}" if err else "NO-OUTPUT")
        print(f"[{i}] {dt:.1f}s {outcome}  w={d['w']}", flush=True)
    print("replay complete", flush=True)


def do_compare() -> bool:
    outs = sorted((json.loads(l) for l in open(OUTCOMES)),
                  key=lambda r: r["line"])
    outs05 = {json.loads(l)["line"]: json.loads(l)
              for l in open(sl08.OUTCOMES05)}
    n_diff = 0
    for rec in outs:
        old = outs05[rec["line"]]
        same = all(rec[k] == old[k] for k in ("success", "log", "error"))
        n_diff += not same
        print(f"line {rec['line']}: outcome vs step-5 "
              f"{'identical' if same else 'DIFFERS'} ({rec['seconds']} s)")
        if not same:
            for k in ("success", "log", "error"):
                if rec[k] != old[k]:
                    print(f"    {k}: v16={str(rec[k])[:160]!r}")
                    print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")
    n_fired = 0
    scanlog = WORK16 / "v2_scanlog.jsonl"
    if scanlog.exists():
        n_fired = sum(bool(json.loads(l)["fired"]) for l in open(scanlog))
    print(f"scan flags fired: {n_fired}")
    ok = n_diff == 0 and n_fired == 0 and outs
    print("compare:", "PASS" if ok else "FAIL")
    return bool(ok)


def _ints(s: str) -> list[int]:
    return [int(x) for x in s.split(",")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    p_ab = sub.add_parser("ab-form")
    p_ab.add_argument("--lines", default=DEFAULT_LINES)
    p_ab.add_argument("--orders", default="3,9")
    p_ab.add_argument("--workers", type=int, default=4)
    p_b = sub.add_parser("bench")
    p_b.add_argument("--lines", default=DEFAULT_LINES)
    p_b.add_argument("--order", type=int, default=9)
    p_b.add_argument("--workers", type=int, default=4)
    p_b.add_argument("--reps", type=int, default=3)
    p_r = sub.add_parser("replay")
    p_r.add_argument("--lines", default=DEFAULT_LINES)
    p_r.add_argument("--workers", type=int, default=4)
    p_h = sub.add_parser("bench-heavy")
    p_h.add_argument("--order", type=int, default=9)
    p_h.add_argument("--workers", default="4,8")
    p_h.add_argument("--reps", type=int, default=2)
    sub.add_parser("compare")
    args = parser.parse_args()
    if args.cmd == "bench-heavy":
        do_bench_heavy(args.order, _ints(args.workers), args.reps)
        return 0
    if args.cmd == "setup":
        do_setup()
        return 0
    if args.cmd == "ab-form":
        return 0 if do_ab_form(_ints(args.lines), _ints(args.orders),
                               args.workers) else 1
    if args.cmd == "bench":
        do_bench(_ints(args.lines), args.order, args.workers, args.reps)
        return 0
    if args.cmd == "replay":
        do_replay(_ints(args.lines), args.workers)
        return 0
    return 0 if do_compare() else 1


if __name__ == "__main__":
    sys.exit(main())
