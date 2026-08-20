#!/usr/bin/env python3
"""Step 10 (semantics lock): prove the on-miss generation recursion.

Recomputes existing arxiv table entries via the arxivGen recursion
(`Adams(N, rep, G)` base case; otherwise one `tensor` of two strictly-
lower-order entries) using ONLY LiE subprocess calls — no Wolfram, no
Frobenius enumeration — and compares byte-wise against the stored values.

Modes, run in sequence:
  step  — sampled entries recomputed with sub-entries taken from the stored
          tables (verifies each entry's own generation step);
  cone  — sampled low-order entries regenerated from NOTHING but LiE
          (recursive, memoized), every cone member compared to its stored
          value (verifies the recursion end-to-end).

Sampling is deterministic (--seed). Dropbox tables are read-only; results
go to calc/work10/results.jsonl. Exit code 0 iff every comparison matches.
"""

from __future__ import annotations

import argparse
import ast
import json
import random
import shutil
import subprocess
import sys
import time
from pathlib import Path

ARXIV_DIR = Path(
    "/Users/cms1308/Library/CloudStorage/Dropbox/shared folder/"
    "classification/arxiv")
GROUPS = ["A1", "A2"]
WORK_DIR = Path(__file__).resolve().parent / "work10"

MAX_STEP_ORDER = 14      # step-mode sampling ceiling (file sizes stay modest)
CONE_ORDER_RANGE = (4, 6)  # cone-mode key orders (full recursion from LiE)
PER_SPECIES_RANDOM = 5   # random step-mode keys per (group, species)
TARGET_NEGATIVE = 5      # entries with negative multiplicities
TARGET_PLUSMINUS = 5     # entries with the '+-1X' juxtaposition
FILE_SIZE_CAP = 3_000_000  # skip whole-file loads above this (online-only files)
LIE_TIMEOUT_S = 300
MAX_OBJECTS_RETRIES = 3
BANNER_SLICE = 53        # LiE startup banner length (verified by sentinel)

_lie_path = shutil.which("lie")
LIE_COMMAND = ["/bin/sh", _lie_path] if _lie_path else ["lie"]


# --------------------------------------------------------------------------- #
# LiE invocation (arxivGen conventions: maxnodes+maxobjects preamble,
# [53:] banner slice, grow maxobjects on suspicious output)
# --------------------------------------------------------------------------- #
def lie_eval(expr: str) -> str:
    max_objects = "9999999"
    for attempt in range(MAX_OBJECTS_RETRIES + 1):
        lcode = f"maxnodes 9999999\n maxobjects {max_objects}\n {expr}"
        proc = subprocess.run(LIE_COMMAND, input=lcode, capture_output=True,
                              encoding="UTF-8", timeout=LIE_TIMEOUT_S)
        out = proc.stdout[BANNER_SLICE:].strip()
        out = out.replace("\n", "").replace(" ", "")
        if "(" not in out and "line" not in out:
            return out
        max_objects += "9"  # arxivGen retry policy: grow maxobjects
    raise RuntimeError(f"LiE gave no clean output for: {expr[:120]}...")


def check_banner() -> None:
    proc = subprocess.run(LIE_COMMAND, input="maxnodes 9999999\n 123456789",
                          capture_output=True, encoding="UTF-8",
                          timeout=LIE_TIMEOUT_S)
    sliced = proc.stdout[BANNER_SLICE:].strip()
    if sliced != "123456789":
        raise RuntimeError(
            f"banner slice [{BANNER_SLICE}:] failed on this LiE build; "
            f"got {sliced!r} from {proc.stdout[:90]!r}")


# --------------------------------------------------------------------------- #
# Stored tables (read-only)
# --------------------------------------------------------------------------- #
_table_cache: dict[tuple[str, str, int], dict[str, str]] = {}


def table_path(group: str, species: str, order: int) -> Path:
    return ARXIV_DIR / group / species / f"{species}{order}.txt"


def load_table(group: str, species: str, order: int) -> dict[str, str]:
    fkey = (group, species, order)
    if fkey not in _table_cache:
        table: dict[str, str] = {}
        with open(table_path(group, species, order)) as f:
            for line in f:
                line = line.strip()
                if line:
                    table.update(ast.literal_eval(line))
        _table_cache[fkey] = table
    return _table_cache[fkey]


def stored_value(group: str, species: str, key: list[int]) -> str:
    return load_table(group, species, len(key))[str(key)]


def available_orders(group: str, species: str, size_cap: int) -> list[int]:
    orders = []
    for p in (ARXIV_DIR / group / species).glob(f"{species}*.txt"):
        try:
            order = int(p.stem[len(species):])
        except ValueError:
            continue
        if p.stat().st_size <= size_cap:
            orders.append(order)
    return sorted(orders)


def rep_label(group: str, species: str) -> str:
    """Dynkin label of the species' rep, read off the order-1 table
    (entry '[1]' is '1X[label]' — the rep itself)."""
    value = stored_value(group, species, [1])
    if not (value.startswith("1X[") and value.endswith("]")):
        raise RuntimeError(f"unexpected order-1 entry for {group}/{species}: "
                           f"{value!r}")
    return value[2:]  # '[l1,l2,...]'


# --------------------------------------------------------------------------- #
# The arxivGen recursion
# --------------------------------------------------------------------------- #
def split_key(key: list[int]) -> tuple[list[int], list[int]]:
    """arxivGen's decomposition of a non-pure-Adams key into two
    strictly-lower-order keys (tensor factors)."""
    first_nonzero = next(i for i, m in enumerate(key) if m)
    frob1 = key[:len(key) - first_nonzero - 1].copy()
    frob1[first_nonzero] -= 1
    frob2 = [1 if i == first_nonzero else 0 for i in range(first_nonzero + 1)]
    return frob1, frob2


def compute_step(group: str, species: str, key: list[int]) -> str:
    """Recompute one entry, sub-entries taken from the stored tables."""
    order = len(key)
    if key[-1] == 1:  # pure top Adams term
        return lie_eval(f"Adams({order}, {rep_label(group, species)}, {group})")
    frob1, frob2 = split_key(key)
    pol1 = stored_value(group, species, frob1)
    pol2 = stored_value(group, species, frob2)
    return lie_eval(f"tensor({pol1},{pol2},{group})")


def compute_cone(group: str, species: str, key: list[int],
                 memo: dict[str, str], records: list[dict]) -> str:
    """Recompute one entry from nothing but LiE (recursive, memoized);
    every computed cone member is compared against its stored value."""
    mkey = str(key)
    if mkey in memo:
        return memo[mkey]
    order = len(key)
    if key[-1] == 1:
        computed = lie_eval(
            f"Adams({order}, {rep_label(group, species)}, {group})")
    else:
        frob1, frob2 = split_key(key)
        pol1 = compute_cone(group, species, frob1, memo, records)
        pol2 = compute_cone(group, species, frob2, memo, records)
        computed = lie_eval(f"tensor({pol1},{pol2},{group})")
    stored = stored_value(group, species, key)
    records.append(make_record("cone", group, species, key, computed, stored))
    memo[mkey] = computed
    return computed


# --------------------------------------------------------------------------- #
# Comparison records
# --------------------------------------------------------------------------- #
def make_record(mode: str, group: str, species: str, key: list[int],
                computed: str, stored: str) -> dict:
    ok = computed == stored
    record = {"mode": mode, "group": group, "species": species,
              "key": str(key), "order": len(key), "ok": ok}
    if not ok:
        record["computed"] = computed[:500]
        record["stored"] = stored[:500]
    return record


# --------------------------------------------------------------------------- #
# Sampling
# --------------------------------------------------------------------------- #
def species_of(group: str) -> list[str]:
    return sorted(p.name for p in (ARXIV_DIR / group).iterdir() if p.is_dir())


def sample_step_keys(rng: random.Random) -> list[tuple[str, str, list[int]]]:
    """Per (group, species): order-1 base, one pure-Adams key, random keys;
    plus targeted negative-multiplicity and '+-' entries across the sample
    space until the targets are met."""
    picks: list[tuple[str, str, list[int]]] = []
    seen: set[tuple[str, str, str]] = set()

    def add(group: str, species: str, key: list[int]) -> bool:
        tag = (group, species, str(key))
        if tag in seen:
            return False
        seen.add(tag)
        picks.append((group, species, key))
        return True

    negatives = plusminus = 0
    for group in GROUPS:
        for species in species_of(group):
            orders = [o for o in available_orders(group, species,
                                                  FILE_SIZE_CAP)
                      if o <= MAX_STEP_ORDER]
            add(group, species, [1])
            pure_order = rng.choice([o for o in orders if o >= 2])
            add(group, species, [0] * (pure_order - 1) + [1])
            random_orders = rng.sample([o for o in orders if o >= 2],
                                       min(PER_SPECIES_RANDOM,
                                           len(orders) - 1))
            for order in random_orders:
                table = load_table(group, species, order)
                key_str = rng.choice(sorted(table))
                if add(group, species, ast.literal_eval(key_str)):
                    value = table[key_str]
                    negatives += ("-" in value)
                    plusminus += ("+-" in value)

    # top up targeted formats from the already-sampled orders
    for group in GROUPS:
        for species in species_of(group):
            if negatives >= TARGET_NEGATIVE and plusminus >= TARGET_PLUSMINUS:
                return picks
            for fkey, table in sorted(_table_cache.items()):
                if fkey[0] != group or fkey[1] != species:
                    continue
                for key_str in sorted(table):
                    value = table[key_str]
                    need_neg = negatives < TARGET_NEGATIVE and "-" in value
                    need_pm = plusminus < TARGET_PLUSMINUS and "+-" in value
                    if (need_neg or need_pm) and add(
                            group, species, ast.literal_eval(key_str)):
                        negatives += ("-" in value)
                        plusminus += ("+-" in value)
    return picks


def sample_cone_keys(rng: random.Random) -> list[tuple[str, str, list[int]]]:
    picks = []
    lo, hi = CONE_ORDER_RANGE
    for group in GROUPS:
        for species in species_of(group):
            orders = [o for o in available_orders(group, species,
                                                  FILE_SIZE_CAP)
                      if lo <= o <= hi]
            order = rng.choice(orders)
            table = load_table(group, species, order)
            # prefer a non-pure-Adams key so the cone has real depth
            keys = sorted(k for k in table if ast.literal_eval(k)[-1] != 1)
            picks.append((group, species,
                          ast.literal_eval(rng.choice(keys or sorted(table)))))
    return picks


# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20260819)
    args = parser.parse_args()
    rng = random.Random(args.seed)

    WORK_DIR.mkdir(exist_ok=True)
    check_banner()
    print("banner slice OK")

    records: list[dict] = []
    t0 = time.time()

    step_picks = sample_step_keys(rng)
    print(f"step mode: {len(step_picks)} entries")
    for group, species, key in step_picks:
        computed = compute_step(group, species, key)
        stored = stored_value(group, species, key)
        record = make_record("step", group, species, key, computed, stored)
        records.append(record)
        if not record["ok"]:
            print(f"  MISMATCH {group}/{species} {key}")

    cone_picks = sample_cone_keys(rng)
    print(f"cone mode: {len(cone_picks)} root keys")
    for group, species, key in cone_picks:
        memo: dict[str, str] = {}
        compute_cone(group, species, key, memo, records)
        print(f"  cone {group}/{species} {key}: {len(memo)} members")

    with open(WORK_DIR / "results.jsonl", "w") as f:
        for record in records:
            f.write(json.dumps(record) + "\n")

    total = len(records)
    failed = [r for r in records if not r["ok"]]
    neg = sum(1 for r in records
              if "-" in stored_value(r["group"], r["species"],
                                     ast.literal_eval(r["key"])))
    pm = sum(1 for r in records
             if "+-" in stored_value(r["group"], r["species"],
                                     ast.literal_eval(r["key"])))
    print(f"\n{total - len(failed)}/{total} byte-identical "
          f"({sum(1 for r in records if r['mode'] == 'step')} step, "
          f"{sum(1 for r in records if r['mode'] == 'cone')} cone; "
          f"{neg} with negative multiplicities, {pm} with '+-'; "
          f"{time.time() - t0:.0f} s)")
    if failed:
        print(f"FAILED: {len(failed)} mismatches — see work10/results.jsonl")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
