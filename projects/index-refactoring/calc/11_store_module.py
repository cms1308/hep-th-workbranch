#!/usr/bin/env python3
"""Step 11 unit tests for store/charstore.py.

Covers: auto-creation from nothing, registry seeding + loud unknown-species
failure, cold generation-on-miss against the Dropbox ground truth (keys from
the step-10 sample), memo idempotence, tensor-cache semantics, the maxobjects
retry path (fires for real at higher rank — user note 2026-08-19), banner
sentinel failure, output validation, and thread/process concurrency hammers.

Work dir calc/work11/ is recreated on every run. Exit 0 iff all tests pass.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import multiprocessing
import shutil
import sqlite3
import sys
import threading
import time
from pathlib import Path

CALC_DIR = Path(__file__).resolve().parent
WORK_DIR = CALC_DIR / "work11"
PROJECT_DIR = CALC_DIR.parent

sys.path.insert(0, str(PROJECT_DIR))
from store import CharStore, CharStoreError  # noqa: E402

# step-10 module: reuse its Dropbox table loader as ground truth
_spec = importlib.util.spec_from_file_location(
    "sl10", CALC_DIR / "10_semantics_lock.py")
sl10 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sl10)

COLD_KEYS_PER_GROUP = 6   # cold-generation sample size per group
COLD_MAX_ORDER = 8        # keep cone sizes (and LiE time) small
BANNER = "B" * 53         # fake-runner banner of the sliced length
N_THREADS, PUTS_PER_THREAD = 8, 200
N_PROCS, PUTS_PER_PROC = 4, 250

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'} {name}" + (f" — {detail}" if detail
                                                    and not ok else ""))


# --------------------------------------------------------------------------- #
# fake LiE runners (banner-compatible; sentinel answered correctly)
# --------------------------------------------------------------------------- #
class ScriptedRunner:
    """Returns scripted payloads for non-sentinel calls; records lcodes."""

    def __init__(self, payloads: list[str]):
        self.payloads = list(payloads)
        self.lcodes: list[str] = []

    def __call__(self, lcode: str, timeout: float) -> str:
        if "123456789" in lcode:
            return BANNER + "123456789"
        self.lcodes.append(lcode)
        if not self.payloads:
            raise AssertionError("ScriptedRunner exhausted")
        return BANNER + self.payloads.pop(0)


def bad_banner_runner(lcode: str, timeout: float) -> str:
    return "SHORT\n" + "123456789"


# --------------------------------------------------------------------------- #
# process-hammer child (top-level for spawn picklability)
# --------------------------------------------------------------------------- #
def _proc_child(store_path: str, proc_id: int, n_puts: int) -> None:
    store = CharStore(store_path, "A2")
    for i in range(n_puts):
        store.cache_put(f"proc{proc_id}-key{i}", f"value-{proc_id}-{i}")
        if i % 50 == 0:
            store.cache_get(f"proc{proc_id}-key0")
    store.close()


# --------------------------------------------------------------------------- #
def cold_generation_sample() -> list[tuple[str, str, list]]:
    """Step-mode keys from work10/results.jsonl with small orders, per group:
    at least one pure-Adams and one negative-multiplicity entry."""
    records = [json.loads(line)
               for line in open(CALC_DIR / "work10" / "results.jsonl")]
    by_species: dict[tuple[str, str], list[list]] = {}
    for r in records:
        if r["mode"] != "step":
            continue
        key = ast.literal_eval(r["key"])
        if len(key) <= COLD_MAX_ORDER:
            by_species.setdefault((r["group"], r["species"]), []).append(key)
    picks = [(group, species, key)
             for (group, species), keys in sorted(by_species.items())
             for key in keys[:2]]  # up to 2 per species — all species covered
    return picks


def main() -> int:
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
    WORK_DIR.mkdir()
    t0 = time.time()

    # t1: auto-creation from nothing
    path = WORK_DIR / "store_t1.sqlite"
    store = CharStore(path, "A2")
    tables = {r[0] for r in sqlite3.connect(path).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    check("t1 auto-create",
          path.exists() and
          {"char_decomp", "tensor_cache", "rep_registry"} <= tables)

    # t2: registry seeded; unknown species fails loudly
    ok = store.label("q") == "[1,0]" and store.label("phi") == "[1,1]"
    try:
        store.label("A")
        ok = False
    except CharStoreError as e:
        ok = ok and "register_species" in str(e)
    store.register_species("A", "[0,1]")
    check("t2 registry", ok and store.label("A") == "[0,1]")

    # t3: cold generation-on-miss == Dropbox ground truth; cone persisted
    picks = cold_generation_sample()
    stores = {g: CharStore(WORK_DIR / f"store_cold_{g}.sqlite", g)
              for g in ("A1", "A2")}
    mismatches = []
    for group, species, key in picks:
        got = stores[group].decomp(species, key)
        want = sl10.stored_value(group, species, key)
        if got != want:
            mismatches.append((group, species, key))
    a2_stats = stores["A2"].stats()
    check("t3 cold generation",
          not mismatches and
          a2_stats["char_decomp_generated"] == a2_stats["char_decomp"] > 0,
          f"mismatches={mismatches}, stats={a2_stats}")

    # t4: memo + persistence — repeat lookups cost no LiE calls; a fresh
    # instance on the same file finds everything without generating
    calls_before = stores["A2"].lie_calls
    for group, species, key in picks:
        if group == "A2":
            stores[group].decomp(species, key)
    reopened = CharStore(WORK_DIR / "store_cold_A2.sqlite", "A2",
                         lie_runner=bad_banner_runner)  # any LiE use would fail
    ok = stores["A2"].lie_calls == calls_before
    for group, species, key in picks:
        if group == "A2":
            ok = ok and reopened.decomp(species, key) == \
                sl10.stored_value(group, species, key)
    check("t4 memo+persistence", ok)

    # t5: tensor cache — roundtrip; INSERT OR IGNORE keeps the first value
    store.cache_put("k1", "v1")
    store.cache_put("k1", "v2")
    check("t5 tensor cache",
          store.cache_get("k1") == "v1" and store.cache_get("k404") is None)

    # t6: maxobjects retry — '(' then clean; 'line' then clean; exhaustion
    r = ScriptedRunner(["(error)", "1X[0,0]"])
    s6 = CharStore(WORK_DIR / "s6.sqlite", "A2", lie_runner=r)
    v = s6.decomp("q", [1])
    ok = (v == "1X[0,0]" and len(r.lcodes) == 2
          and "maxobjects 9999999\n" in r.lcodes[0]
          and "maxobjects 99999999\n" in r.lcodes[1])
    r2 = ScriptedRunner(["broke on line 2", "2X[1,0]"])
    s6b = CharStore(WORK_DIR / "s6b.sqlite", "A2", lie_runner=r2)
    ok = ok and s6b.decomp("qb", [1]) == "2X[1,0]" and len(r2.lcodes) == 2
    r3 = ScriptedRunner(["(bad)"] * 10)
    s6c = CharStore(WORK_DIR / "s6c.sqlite", "A2", lie_runner=r3)
    try:
        s6c.decomp("q", [1])
        ok = False
    except CharStoreError:
        ok = ok and len(r3.lcodes) == 4  # initial + MAX_OBJECTS_RETRIES
    check("t6 maxobjects retry", ok)

    # t7: banner sentinel fails loudly on a wrong build
    s7 = CharStore(WORK_DIR / "s7.sqlite", "A2", lie_runner=bad_banner_runner)
    try:
        s7.decomp("q", [1])
        check("t7 banner sentinel", False)
    except CharStoreError as e:
        check("t7 banner sentinel", "banner" in str(e))

    # t8: malformed LiE output rejected, nothing persisted
    s8 = CharStore(WORK_DIR / "s8.sqlite", "A2",
                   lie_runner=ScriptedRunner(["garbage!!"]))
    try:
        s8.decomp("q", [1])
        ok = False
    except CharStoreError as e:
        ok = "not a character polynomial" in str(e)
    check("t8 output validation",
          ok and s8.stats()["char_decomp"] == 0)

    # t9: thread hammer on one instance
    s9 = CharStore(WORK_DIR / "s9.sqlite", "A2")
    s9.put_decomp_many([("q", "[1]", "1X[1,0]")])
    errors: list[Exception] = []

    def worker(tid: int) -> None:
        try:
            for i in range(PUTS_PER_THREAD):
                s9.cache_put(f"t{tid}-{i}", f"v{tid}-{i}")
                if i % 20 == 0:
                    assert s9.decomp("q", [1]) == "1X[1,0]"
                    assert s9.cache_get(f"t{tid}-0") == f"v{tid}-0"
        except Exception as e:  # noqa: BLE001 — reported as test failure
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(t,))
               for t in range(N_THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    check("t9 thread hammer",
          not errors and
          s9.stats()["tensor_cache"] == N_THREADS * PUTS_PER_THREAD and
          s9.integrity_check() == "ok", f"errors={errors[:3]}")

    # t10: process hammer (spawn) on one file
    s10_path = str(WORK_DIR / "s10.sqlite")
    CharStore(s10_path, "A2").close()
    ctx = multiprocessing.get_context("spawn")
    procs = [ctx.Process(target=_proc_child,
                         args=(s10_path, p, PUTS_PER_PROC))
             for p in range(N_PROCS)]
    for p in procs:
        p.start()
    for p in procs:
        p.join()
    s10 = CharStore(s10_path, "A2")
    check("t10 process hammer",
          all(p.exitcode == 0 for p in procs) and
          s10.stats()["tensor_cache"] == N_PROCS * PUTS_PER_PROC and
          s10.integrity_check() == "ok")

    n_ok = sum(1 for _, ok, _ in _results if ok)
    print(f"\n{n_ok}/{len(_results)} tests passed ({time.time() - t0:.0f} s)")
    return 0 if n_ok == len(_results) else 1


if __name__ == "__main__":
    sys.exit(main())
