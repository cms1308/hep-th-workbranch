#!/usr/bin/env python3
"""Step 12: import + cross-verification of the character store.

Subcommands:
  labels             read every group's order-1 table files (all 26 groups,
                     species lists vary per group), write work12/labels.json,
                     and print a DEFAULT_LABELS literal for store/charstore.py
  import --group G   bulk-import all of group G's table files into
                     work12/charstore_<G>.sqlite (per-group store files, user
                     decision 2026-08-19; source='import'; Dropbox read-only —
                     online-only files materialize on read)
  liecache           import the 16,133-entry step-5 LieCache
                     (calc/work05/liecache.sqlite) into the A2 store
  verify             (a) recount source keys per species vs store rows,
                     (b) regenerate a fresh random sample (seed 20260820)
                     via LiE with sub-entries from the store — byte-identity,
                     (c) exhaustive LieCache key->value comparison,
                     (d) DEFAULT_LABELS == labels.json
"""

from __future__ import annotations

import argparse
import ast
import json
import sqlite3
import sys
import time
from pathlib import Path

CALC_DIR = Path(__file__).resolve().parent
WORK_DIR = CALC_DIR / "work12"
PROJECT_DIR = CALC_DIR.parent
sys.path.insert(0, str(PROJECT_DIR))
from store import CharStore, split_key  # noqa: E402
from store.charstore import DEFAULT_LABELS  # noqa: E402

ARXIV_DIR = Path(
    "/Users/cms1308/Library/CloudStorage/Dropbox/shared folder/"
    "classification/arxiv")
LIECACHE_SRC = CALC_DIR / "work05" / "liecache.sqlite"
VERIFY_SEED = 20260820   # distinct from step 10's 20260819
REGEN_PER_SPECIES = 3


def store_path(group: str) -> Path:
    return WORK_DIR / f"charstore_{group}.sqlite"


def groups() -> list[str]:
    return sorted(p.name for p in ARXIV_DIR.iterdir() if p.is_dir())


def species_of(group: str) -> list[str]:
    return sorted(p.name for p in (ARXIV_DIR / group).iterdir()
                  if p.is_dir())


def table_files(group: str, species: str) -> list[tuple[int, Path]]:
    out = []
    for p in (ARXIV_DIR / group / species).glob(f"{species}*.txt"):
        try:
            out.append((int(p.stem[len(species):]), p))
        except ValueError:
            continue
    return sorted(out)


def read_table_file(path: Path) -> tuple[dict[str, str], int]:
    """One dict literal per line (the standard format); falls back to a
    whole-file JSON parse for the indent=4 variant (only D3/q uses it)."""
    table: dict[str, str] = {}
    duplicates = 0
    conflicts = 0  # duplicate key with a DIFFERING value (real problem;
    #                identical-value repeats are harmless file quirks, qb37)
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                entry = ast.literal_eval(line)
                for k, v in entry.items():
                    if k in table:
                        duplicates += 1
                        conflicts += (table[k] != v)
                table.update(entry)
    except SyntaxError:
        table = json.load(open(path))
    return table, duplicates, conflicts


# --------------------------------------------------------------------------- #
def cmd_labels() -> int:
    labels: dict[str, str] = {}
    for group in groups():
        for species in species_of(group):
            table, _, _ = read_table_file(ARXIV_DIR / group / species /
                                          f"{species}1.txt")
            value = table["[1]"]
            if not (value.startswith("1X[") and value.endswith("]")):
                print(f"UNEXPECTED order-1 entry {group}/{species}: {value!r}")
                return 1
            labels[f"{group}/{species}"] = value[2:]
    WORK_DIR.mkdir(exist_ok=True)
    with open(WORK_DIR / "labels.json", "w") as f:
        json.dump(labels, f, indent=1, sort_keys=True)
    print(f"{len(labels)} labels from {len(groups())} groups "
          f"-> work12/labels.json\n\nDEFAULT_LABELS = {{")
    for gs, label in sorted(labels.items()):
        g, s = gs.split("/")
        print(f'    ("{g}", "{s}"): "{label}",')
    print("}")
    return 0


def cmd_import(group: str) -> int:
    WORK_DIR.mkdir(exist_ok=True)
    store = CharStore(store_path(group), group)
    report = []
    total_keys = total_added = total_duplicates = total_conflicts = 0
    t_start = time.time()
    for species in species_of(group):
        for order, path in table_files(group, species):
            t0 = time.time()
            table, duplicates, conflicts = read_table_file(path)
            added = store.put_decomp_many(
                ((species, key, value) for key, value in table.items()))
            report.append({"species": species, "order": order,
                           "keys": len(table), "added": added,
                           "duplicates_in_file": duplicates,
                           "conflicts_in_file": conflicts,
                           "seconds": round(time.time() - t0, 2)})
            total_keys += len(table)
            total_added += added
            total_duplicates += duplicates
            total_conflicts += conflicts
            print(f"  {species}{order}: {len(table)} keys, {added} added"
                  f" ({time.time() - t0:.1f} s)")
    with open(WORK_DIR / f"import_report_{group}.jsonl", "w") as f:
        for row in report:
            f.write(json.dumps(row) + "\n")
    print(f"{group}: {total_keys} source keys, {total_added} added, "
          f"{total_duplicates} in-file duplicates "
          f"({total_conflicts} with differing values), "
          f"{time.time() - t_start:.0f} s; stats={store.stats()}")
    return 0 if total_added == total_keys and total_conflicts == 0 else 1


def cmd_liecache() -> int:
    src = sqlite3.connect(LIECACHE_SRC)
    rows = src.execute("SELECT ckey, result FROM LieCache").fetchall()
    store = CharStore(store_path("A2"), "A2")
    added = store.cache_put_many(rows)
    print(f"LieCache: {len(rows)} source rows, {added} added; "
          f"stats={store.stats()}")
    return 0 if added == len(rows) else 1


# --------------------------------------------------------------------------- #
def _regen_one(store: CharStore, species: str, key: list) -> str:
    """Recompute one entry with sub-entries from the store (R9 step mode)."""
    if key[-1] == 1:
        return store._lie_eval(
            f"Adams({len(key)}, {store.label(species)}, {store.group_rank})")
    frob1, frob2 = split_key(key)
    pol1 = store.decomp(species, frob1)
    pol2 = store.decomp(species, frob2)
    return store._lie_eval(f"tensor({pol1},{pol2},{store.group_rank})")


def cmd_verify() -> int:
    import random
    rng = random.Random(VERIFY_SEED)
    failures = []

    # (d) DEFAULT_LABELS == labels.json (all 26 groups)
    labels = json.load(open(WORK_DIR / "labels.json"))
    as_tuples = {(gs.split("/")[0], gs.split("/")[1]): v
                 for gs, v in labels.items()}
    if as_tuples != DEFAULT_LABELS:
        missing = set(as_tuples) ^ set(DEFAULT_LABELS)
        failures.append(f"labels: DEFAULT_LABELS != labels.json ({missing})")
    print(f"labels: {len(DEFAULT_LABELS)} in module, "
          f"{len(as_tuples)} from files, equal={as_tuples == DEFAULT_LABELS}")

    for group in ("A1", "A2"):
        db = sqlite3.connect(store_path(group))
        # (a) source key counts vs store rows, per species
        for species in species_of(group):
            n_source = sum(len(read_table_file(p)[0])
                           for _, p in table_files(group, species))
            n_store = db.execute(
                "SELECT COUNT(*) FROM char_decomp WHERE group_rank=? AND "
                "species=? AND source='import'", (group, species)).fetchone()[0]
            status = "ok" if n_source == n_store else "MISMATCH"
            if n_source != n_store:
                failures.append(f"count {group}/{species}: "
                                f"source {n_source} store {n_store}")
            print(f"count {group}/{species}: source {n_source} "
                  f"store {n_store} {status}")

        # (b) regenerate a fresh sample via LiE, sub-entries from the store
        store = CharStore(store_path(group), group)
        for species in species_of(group):
            rows = db.execute(
                "SELECT key_vec, value FROM char_decomp WHERE group_rank=? "
                "AND species=? AND length(key_vec)>4 ORDER BY key_vec",
                (group, species)).fetchall()
            for key_str, want in rng.sample(rows, min(REGEN_PER_SPECIES,
                                                      len(rows))):
                got = _regen_one(store, species, ast.literal_eval(key_str))
                if got != want:
                    failures.append(f"regen {group}/{species} {key_str}")
                print(f"regen {group}/{species} {key_str[:40]} "
                      f"(order {len(ast.literal_eval(key_str))}): "
                      f"{'ok' if got == want else 'MISMATCH'}")

    # (c) exhaustive LieCache comparison
    src = dict(sqlite3.connect(LIECACHE_SRC).execute(
        "SELECT ckey, result FROM LieCache"))
    dst = dict(sqlite3.connect(store_path("A2")).execute(
        "SELECT ckey, result FROM tensor_cache"))
    same = sum(1 for k, v in src.items() if dst.get(k) == v)
    print(f"liecache: {same}/{len(src)} identical "
          f"(store holds {len(dst)})")
    if same != len(src):
        failures.append(f"liecache: only {same}/{len(src)} identical")

    print(f"\nVERIFY {'PASSED' if not failures else 'FAILED'}")
    for f_ in failures:
        print(f"  {f_}")
    return 0 if not failures else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("labels")
    p_imp = sub.add_parser("import")
    p_imp.add_argument("--group", required=True)
    sub.add_parser("liecache")
    sub.add_parser("verify")
    args = parser.parse_args()
    if args.cmd == "labels":
        return cmd_labels()
    if args.cmd == "import":
        return cmd_import(args.group)
    if args.cmd == "liecache":
        return cmd_liecache()
    return cmd_verify()


if __name__ == "__main__":
    sys.exit(main())
