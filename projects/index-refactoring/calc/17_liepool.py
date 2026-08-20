#!/usr/bin/env python3
"""Step 17: persistent LiE REPL pool behind the V2_LIEREPL switch.

Verify (STATE plan): (a) REPL outputs identical to one-shot subprocess mode
on a large real call sample including the maxobjects-retry path; (b) the
empty-store line-100 replay stays byte-identical (max LiE exercise: every
chain and every table key cold); (c) measured spawn-overhead recovery on
that cold line, interleaved.

Subcommands:
  ab-sample     raw byte-parity run_lie vs LieREPLPool.run on real lcodes
                (charstore-style Adams/tensor + fastmatch-style res=/print),
                plus a full C2 regeneration (198 keys) through a REPL-backed
                CharStore compared against the step-14 verified store
  retry-test    error framing parity (tiny maxobjects -> retry marker) and
                session survival after an error on the SAME pool process
  replay-one --line 100 --mode repl|spawn --tag X
                one cold empty-store line in this process (fresh store)
  bench [--reps 2]   interleaved spawn/repl cold runs of line 100 in fresh
                subprocesses; wall clocks + summary
  verify        outcomes vs step-5, scan flags, and per-store forensics
                (cache overlap vs the 16,133 imports, generated rows vs
                the Dropbox A2 tables) for every bench store
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import os
import shutil
import sqlite3
import statistics
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
WORK05 = HERE / "work05"
WORK08 = HERE / "work08"
WORK14 = HERE / "work14"
WORK17 = HERE / "work17"
STUBS17 = WORK17 / "stubs"
OUTCOMES = WORK17 / "replay_outcomes.jsonl"
LIECACHE05 = WORK05 / "liecache.sqlite"
C2_TRUTH = WORK14 / "charstore_C2.sqlite"
POOL_SIZE = 6  # = CORE, the fastmatch chain-thread count
LIE_TIMEOUT = 180.0

_spec = importlib.util.spec_from_file_location("sl08", HERE / "08_refactor.py")
sl08 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl08)
_spec14 = importlib.util.spec_from_file_location("s14",
                                                 HERE / "14_bootstrap.py")
s14 = importlib.util.module_from_spec(_spec14)
_spec14.loader.exec_module(s14)

if str(PROJ) not in sys.path:
    sys.path.insert(0, str(PROJ))
from store.charstore import CharStore, run_lie  # noqa: E402
from store.liepool import LieREPLPool  # noqa: E402


def do_setup() -> None:
    assert (WORK08 / "landscape_A2_v2.py").exists(), "run 08_refactor.py setup"
    WORK17.mkdir(exist_ok=True)
    STUBS17.mkdir(exist_ok=True)
    shutil.copyfile(WORK08 / "stubs" / "pymysql.py", STUBS17 / "pymysql.py")
    shutil.copyfile(WORK08 / "landscape_A2_v2.py",
                    WORK17 / "landscape_A2_v2.py")
    assert not (WORK17 / "arxiv").exists(), "work17 must have NO arxiv link"


# --------------------------------------------------------------------------- #
# (a) raw parity + C2 regeneration through the pool
# --------------------------------------------------------------------------- #
def sample_lcodes() -> list[str]:
    """Real lcodes of both call-site shapes, drawn from verified C2 data."""
    truth = sqlite3.connect(C2_TRUTH)
    rows = truth.execute(
        "SELECT species, key_vec, value FROM char_decomp "
        "ORDER BY species, key_vec").fetchall()
    by_species: dict[str, list[tuple[str, str]]] = {}
    for species, key_str, value in rows:
        by_species.setdefault(species, []).append((key_str, value))
    lcodes = []
    for species, entries in sorted(by_species.items()):
        # charstore-style: pure Adams + a tensor of two stored entries
        top_key, _ = max(entries, key=lambda e: len(ast.literal_eval(e[0])))
        order = len(ast.literal_eval(top_key))
        label = {"A": "[0,1]", "Ab": "[0,1]", "S": "[2,0]", "Sb": "[2,0]",
                 "phi": "[2,0]", "q": "[1,0]", "qb": "[1,0]", "sp": "[0,2]",
                 "spb": "[0,2]", "v": "[0,1]", "vb": "[0,1]"}[species]
        lcodes.append(f"maxnodes 9999999\n maxobjects 9999999\n "
                      f"Adams({order}, {label}, C2)")
        pol1 = entries[-1][1]
        pol2 = entries[0][1]
        lcodes.append(f"maxnodes 9999999\n maxobjects 9999999\n "
                      f"tensor({pol1},{pol2},C2)")
        # fastmatch-style: res= / print framing on the same product
        lcodes.append(f"maxnodes 9999999 \n res=tensor({pol1},{pol2},C2);"
                      f"\nprint(res);")
    return lcodes


def do_ab_sample() -> bool:
    pool = LieREPLPool(POOL_SIZE)
    failures = []

    lcodes = sample_lcodes()
    for n, lcode in enumerate(lcodes):
        want = run_lie(lcode, LIE_TIMEOUT)
        got = pool.run(lcode, LIE_TIMEOUT)
        if want != got:
            failures.append(f"raw lcode #{n}")
            print(f"RAW DIFFER #{n}: {lcode[:80]!r}\n"
                  f"  spawn {want[:120]!r}\n  repl  {got[:120]!r}")
    print(f"raw parity: {len(lcodes) - len(failures)}/{len(lcodes)} "
          f"byte-identical (both call-site shapes)")

    # full C2 regeneration through a REPL-backed CharStore vs step-14 truth
    repl_store_path = WORK17 / "c2_repl.sqlite"
    if repl_store_path.exists():
        repl_store_path.unlink()
    WORK17.mkdir(exist_ok=True)
    store = CharStore(repl_store_path, "C2", lie_timeout=LIE_TIMEOUT,
                      lie_runner=pool.run)
    truth = dict(sqlite3.connect(C2_TRUTH).execute(
        "SELECT species || '|' || key_vec, value FROM char_decomp"))
    n_ok = 0
    for species in sorted({k.split("|")[0] for k in truth}):
        for order in range(1, 6):
            for key in s14.keys_of_order(order):
                got = store.decomp(species, key)
                if got == truth[f"{species}|{key}"]:
                    n_ok += 1
                else:
                    failures.append(f"C2 regen {species} {key}")
    print(f"C2 regeneration via REPL-backed CharStore: {n_ok}/{len(truth)} "
          f"identical to the step-14 verified store; "
          f"pool stats {pool.stats()}")
    pool.close()
    ok = not failures and n_ok == len(truth)
    print("ab-sample:", "PASS" if ok else f"FAIL ({failures[:5]})")
    return ok


def do_retry_test() -> bool:
    """maxobjects-overflow parity. The overflow prints '(in tensor at line N
    of file stdin)' where N is the CUMULATIVE session line number, so raw
    byte parity for ERROR outputs holds only on a fresh process's first
    call; on a reused process only the retry MARKER ('('/'line') is
    invariant — which is all the retry logic reads, and error text is never
    cached (the 'X'-and-no-'line' gate) nor persisted (the polynomial
    regex). Clean outputs are raw-identical regardless."""
    pool = LieREPLPool(1)  # ONE process: errors and retries share it
    big = run_lie("maxnodes 9999999\n maxobjects 9999999\n "
                  "Adams(10, [2,2], C2)", LIE_TIMEOUT)[53:].strip()
    big = big.replace("\n", "").replace(" ", "")
    err_lcode = (f"maxobjects 100\n maxnodes 9999999\n "
                 f"tensor({big},{big},C2)")
    marker = lambda s: "(" in s[53:] or "line" in s[53:]  # noqa: E731

    want = run_lie(err_lcode, LIE_TIMEOUT)
    got = pool.run(err_lcode, LIE_TIMEOUT)  # first call on a fresh process
    print(f"error, fresh process: spawn marker={marker(want)}, "
          f"repl marker={marker(got)}, raw-identical={want == got}")

    # retry path: grown maxobjects on the SAME (post-error) process
    clean_lcode = err_lcode.replace("maxobjects 100", "maxobjects 9999999")
    want2 = run_lie(clean_lcode, LIE_TIMEOUT)
    got2 = pool.run(clean_lcode, LIE_TIMEOUT)
    print(f"post-error retry on the same REPL process: "
          f"raw-identical={want2 == got2}, clean={not marker(got2)}")

    # the overflow lcode AGAIN on the reused process: LiE's object pool
    # does not shrink once grown, so the session retains the largest
    # maxobjects seen and the call now SUCCEEDS on the first try — with
    # the identical (deterministic) polynomial the one-shot retry ends at.
    # Net effect vs one-shot mode: same value, fewer error round-trips.
    norm = lambda s: s[53:].strip().replace("\n", "").replace(" ", "")  # noqa: E731
    got3 = pool.run(err_lcode, LIE_TIMEOUT)
    print(f"overflow lcode on the grown session: clean={not marker(got3)}, "
          f"value == one-shot retry value: {norm(got3) == norm(want2)}, "
          f"pool stats {pool.stats()}")
    pool.close()
    ok = (marker(want) and marker(got) and want == got
          and want2 == got2 and not marker(got2)
          and not marker(got3) and norm(got3) == norm(want2))
    print("retry-test:", "PASS" if ok else "FAIL")
    return ok


# --------------------------------------------------------------------------- #
# (b)+(c) cold empty-store replay of line 100, spawn vs repl
# --------------------------------------------------------------------------- #
def store_file(tag: str) -> Path:
    return WORK17 / f"charstore_A2_{tag}.sqlite"


def do_replay_one(line_no: int, mode: str, tag: str) -> None:
    do_setup()
    sfile = store_file(tag)
    if sfile.exists():
        sfile.unlink()
    os.environ["V2_CHARSTORE"] = str(sfile)
    os.environ["V2_TIMINGS"] = "1"
    if mode == "repl":
        os.environ["V2_LIEREPL"] = str(POOL_SIZE)
    else:
        os.environ.pop("V2_LIEREPL", None)
    # Isolated run dir: charges2's own duplicate check reads the SUCCESS
    # file under RESULTS_DIR (= cwd/results/...) and re-routes a repeat of
    # the same theory to the log as '... (duplicated)' — so repeated bench
    # runs must not share a results dir.
    rundir = WORK17 / f"run_{tag}"
    rundir.mkdir(exist_ok=True)
    sys.path.insert(0, str(STUBS17))
    sys.path.insert(0, str(WORK17))
    os.chdir(rundir)
    import landscape_A2_v2 as L2
    import pymysql
    assert "stubs" in pymysql.__file__
    assert (L2._v2_engine.liepool is not None) == (mode == "repl")
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
    dt = time.time() - t0
    pool = L2._v2_engine.liepool
    rec = {"line": line_no, "mode": mode, "tag": tag,
           "seconds": round(dt, 1), "exception": err,
           "pool": pool.stats() if pool else None,
           "store": s14.store_counts(sfile)}
    for k, p in files.items():
        rec[k] = sl08._appended(p, sizes[k])
    with open(OUTCOMES, "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(f"[{tag}] line {line_no} {mode}: {dt:.1f}s "
          f"store={rec['store']} pool={rec['pool']}", flush=True)


def do_bench(line_no: int, reps: int) -> None:
    for rep in range(reps):
        for mode in ("spawn", "repl"):
            tag = f"{mode}{rep}"
            cmd = [sys.executable, str(HERE / "17_liepool.py"), "replay-one",
                   "--line", str(line_no), "--mode", mode, "--tag", tag]
            t0 = time.time()
            proc = subprocess.run(cmd, text=True, capture_output=True)
            print(proc.stdout.strip().splitlines()[-1] if proc.stdout
                  else f"[{tag}] NO OUTPUT", flush=True)
            if proc.returncode != 0:
                print(proc.stderr[-2000:])
                return
            print(f"    wall {time.time() - t0:.1f}s")
    by_mode: dict[str, list[float]] = {}
    for line in open(OUTCOMES):
        rec = json.loads(line)
        if rec["line"] == line_no and rec["tag"].rstrip("0123456789") == \
                rec["mode"]:
            by_mode.setdefault(rec["mode"], []).append(rec["seconds"])
    print(f"\n=== bench (cold empty-store line {line_no}, interleaved) ===")
    for mode, ts in sorted(by_mode.items()):
        print(f"{mode}: mean {statistics.mean(ts):.1f}s  runs {ts}")
    if len(by_mode) == 2:
        print(f"speedup x{statistics.mean(by_mode['spawn']) / statistics.mean(by_mode['repl']):.2f}")


def do_verify() -> bool:
    outs = [json.loads(l) for l in open(OUTCOMES)]
    outs05 = {json.loads(l)["line"]: json.loads(l)
              for l in open(sl08.OUTCOMES05)}
    failures = []
    src16133 = dict(sqlite3.connect(LIECACHE05).execute(
        "SELECT ckey, result FROM LieCache"))
    table_memo: dict[tuple[str, int], dict] = {}
    for rec in outs:
        old = outs05[rec["line"]]
        same = all(rec[k] == old[k] for k in ("success", "log", "error"))
        if not same:
            failures.append(f"{rec['tag']} outcome differs")
        line = f"[{rec['tag']}] outcome {'identical' if same else 'DIFFERS'}"
        sfile = store_file(rec["tag"])
        if sfile.exists():
            db = sqlite3.connect(sfile)
            new = dict(db.execute("SELECT ckey, result FROM tensor_cache"))
            overlap = set(src16133) & set(new)
            bad = sum(1 for k in overlap if src16133[k] != new[k])
            if bad or not overlap:
                failures.append(f"{rec['tag']} cache overlap bad={bad}")
            n_rows = n_badrow = 0
            for species, key_str, value in db.execute(
                    "SELECT species, key_vec, value FROM char_decomp "
                    "WHERE source='generated'"):
                order = len(ast.literal_eval(key_str))
                if (species, order) not in table_memo:
                    table_memo[(species, order)] = s14.s12.read_table_file(
                        s14.s12.ARXIV_DIR / "A2" / species /
                        f"{species}{order}.txt")[0]
                n_rows += 1
                n_badrow += table_memo[(species, order)].get(key_str) != value
            if n_badrow:
                failures.append(f"{rec['tag']} {n_badrow} table mismatches")
            line += (f"; cache {len(new)} ({len(overlap)} overlap, {bad} bad)"
                     f"; tables {n_rows} rows, {n_badrow} bad")
        print(line)
    n_fired = 0
    for scanlog in WORK17.glob("run_*/v2_scanlog.jsonl"):
        n_fired += sum(bool(json.loads(l)["fired"]) for l in open(scanlog))
    print(f"scan flags fired: {n_fired}")
    if n_fired:
        failures.append("scan flags fired")
    ok = not failures and outs
    print("verify:", "PASS" if ok else f"FAIL ({failures})")
    return bool(ok)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ab-sample")
    sub.add_parser("retry-test")
    p_one = sub.add_parser("replay-one")
    p_one.add_argument("--line", type=int, default=100)
    p_one.add_argument("--mode", choices=("repl", "spawn"), required=True)
    p_one.add_argument("--tag", required=True)
    p_b = sub.add_parser("bench")
    p_b.add_argument("--line", type=int, default=100)
    p_b.add_argument("--reps", type=int, default=2)
    sub.add_parser("verify")
    args = parser.parse_args()
    if args.cmd == "ab-sample":
        return 0 if do_ab_sample() else 1
    if args.cmd == "retry-test":
        return 0 if do_retry_test() else 1
    if args.cmd == "replay-one":
        do_replay_one(args.line, args.mode, args.tag)
        return 0
    if args.cmd == "bench":
        do_bench(args.line, args.reps)
        return 0
    return 0 if do_verify() else 1


if __name__ == "__main__":
    sys.exit(main())
