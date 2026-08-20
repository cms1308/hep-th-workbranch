#!/usr/bin/env python3
"""Step 13: refactor/ pipeline backed ONLY by the character store.

work13/ = the step-8 setup minus every legacy character-data source:
  - landscape_A2_v2.py copied verbatim from work08 (same module bytes),
  - stubs/pymysql.py (still needed for the Theories/Failures INSERT
    recording; its LieCache path must stay UNUSED),
  - charstore_A2.sqlite COPIED from work12 (work12 stays pristine),
  - NO arxiv symlink, NO liecache.sqlite: any legacy read fails loudly.
The store is wired via V2_CHARSTORE (refactor/glue.py step-13 extension).

Subcommands:
  setup           build work13/
  replay [--start N --end M]   replay baseline lines (resumable)
  compare         101/101 byte-identity vs the step-5 outcomes, zero scan
                  flags, zero generated store rows, no legacy files touched
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import sqlite3
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK08 = HERE / "work08"
WORK12 = HERE / "work12"
WORK13 = HERE / "work13"
STUBS13 = WORK13 / "stubs"
OUTCOMES = WORK13 / "replay_outcomes.jsonl"
STORE_FILE = WORK13 / "charstore_A2.sqlite"

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)


def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    assert (WORK12 / "charstore_A2.sqlite").exists(), "run 12_import.py first"
    WORK13.mkdir(exist_ok=True)
    STUBS13.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS13 / "pymysql.py")
    shutil.copyfile(WORK08 / "landscape_A2_v2.py",
                    WORK13 / "landscape_A2_v2.py")
    if not STORE_FILE.exists():
        shutil.copyfile(WORK12 / "charstore_A2.sqlite", STORE_FILE)
    assert not (WORK13 / "arxiv").exists(), "work13 must have NO arxiv link"
    # NOTE: the pymysql stub opens liecache.sqlite on EVERY connect() (also
    # for the Theories/Failures INSERT recording), so the FILE may exist;
    # "legacy LieCache unused" means the LieCache TABLE inside it stays
    # absent/empty — checked by legacy_liecache_rows() in compare.
    assert legacy_liecache_rows() == 0, "legacy LieCache has rows"
    print("setup OK: module + stubs + store copy; no arxiv, "
          "legacy LieCache empty")


def legacy_liecache_rows() -> int:
    path = WORK13 / "liecache.sqlite"
    if not path.exists():
        return 0
    try:
        return sqlite3.connect(path).execute(
            "SELECT COUNT(*) FROM LieCache").fetchone()[0]
    except sqlite3.OperationalError:  # no LieCache table -> never touched
        return 0


def import_v2_store():
    do_setup()
    os.environ["V2_CHARSTORE"] = str(STORE_FILE)
    os.environ["V2_TIMINGS"] = "1"
    sys.path.insert(0, str(STUBS13))
    sys.path.insert(0, str(WORK13))
    sys.path.insert(0, str(PROJ))
    os.chdir(WORK13)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert L2.GROUP_RANK == "A2" and hasattr(L2, "_v2_engine")
    assert L2._v2_engine.charstore is not None, "store not wired"
    return L2


def do_replay(start: int, end: int) -> None:
    L2 = import_v2_store()
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
    end = min(end, len(lines))
    todo = [i for i in range(start, end) if i not in done]
    print(f"replaying {len(todo)} lines ({len(done)} already done)",
          flush=True)
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
               "exception": err}
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

    # (1) byte-identity of every outcome record vs the step-5 replay
    n_same = n_diff = 0
    for rec in outs:
        old = outs05.get(rec["line"])
        if old is None:
            continue
        if all(rec[k] == old[k] for k in ("success", "log", "error")):
            n_same += 1
        else:
            n_diff += 1
            print(f"[line {rec['line']}] differs from step-5:")
            for k in ("success", "log", "error"):
                if rec[k] != old[k]:
                    print(f"    {k}: v13={str(rec[k])[:160]!r}")
                    print(f"    {'':>{len(k)}}  old={str(old[k])[:160]!r}")

    # (2) scan flags must not fire on the baseline
    n_scans = n_fired = 0
    scanlog = WORK13 / "v2_scanlog.jsonl"
    if scanlog.exists():
        for line in open(scanlog):
            n_scans += 1
            n_fired += bool(json.loads(line)["fired"])

    # (3) store forensics: no generation, tensor cache growth reported;
    #     no legacy character sources appeared
    db = sqlite3.connect(STORE_FILE)
    n_generated = db.execute("SELECT COUNT(*) FROM char_decomp "
                             "WHERE source='generated'").fetchone()[0]
    n_cache = db.execute("SELECT COUNT(*) FROM tensor_cache").fetchone()[0]
    no_legacy = (not (WORK13 / "arxiv").exists()
                 and legacy_liecache_rows() == 0)

    print("\n=== summary ===")
    print(f"outcome records vs step-5 : {n_same} identical, {n_diff} differ")
    print(f"index scans               : {n_scans} runs, {n_fired} flags fired")
    print(f"store                     : {n_generated} generated rows, "
          f"tensor_cache {n_cache} (imported 16133)")
    print(f"legacy sources absent     : {no_legacy}")
    ok = (n_same == len(outs) == 101 and n_diff == 0 and n_fired == 0
          and n_generated == 0 and no_legacy)
    print("compare:", "PASS" if ok else "FAIL")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    p_replay = sub.add_parser("replay")
    p_replay.add_argument("--start", type=int, default=0)
    p_replay.add_argument("--end", type=int, default=101)
    sub.add_parser("compare")
    args = parser.parse_args()
    if args.cmd == "setup":
        do_setup()
        return 0
    if args.cmd == "replay":
        do_replay(args.start, args.end)
        return 0
    return 0 if do_compare() else 1


if __name__ == "__main__":
    sys.exit(main())
