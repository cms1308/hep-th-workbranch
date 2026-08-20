#!/usr/bin/env python3
"""Step 5 regression harness: replay refs/SU3s1S1nf2.txt through the unmodified
pipeline and check that exactly the refs/SU3s1S1nf2_true.txt set survives.

Theory: SU(3) with 2 flavors (q,qb) + one symmetric pair (S,Sb)
        => GROUP="A", RANK="2", NC=3, character tables arxiv/A2.

The pipeline module refs/landscape_refactored.py is NOT modified. A copy
work05/landscape_A2.py is generated with ONLY the run-configuration block
changed (GROUP/NC/FILENAME/SQLNAME); the generator asserts each substitution
hits exactly once, and `python3 05_regression.py setup` prints the diff.

No real database is touched anywhere:
  - pymysql is shadowed by work05/stubs/pymysql.py. LieCache SELECT/INSERT
    (the memoization of LiE tensor() steps) is served from a local sqlite file
    work05/liecache.sqlite; every other INSERT (Theories, Failures, nonSCFT,
    NegativeRcharge, InconsistentIndex, Duplicates) is appended as a JSON
    record to work05/sql_inserts.jsonl and never executed.
  - Character tables are read (read-only) through a symlink
    work05/arxiv -> Dropbox .../classification/arxiv.
  - Result files land under work05/results/ (module derives RESULTS_DIR from
    cwd at import time; we chdir to work05 before importing).

Subcommands (default: all of setup, spotcheck, verify-n; replay/compare are
run explicitly because replay takes hours):
  setup      build work05 (stubs, patched module copy, symlink), show config diff
  spotcheck  verify stored A2 tables against live LiE (owed from step 4)
  verify-n   check every baseline line's `n` against its R-charge field labels
  replay     [--start I] [--end J] sequential replay of SU3s1S1nf2.txt lines
             (resumable: lines already in replay_outcomes.jsonl are skipped)
  compare    diff replay outcomes against SU3s1S1nf2_true.txt

Run from anywhere:  python3 calc/05_regression.py [subcommand]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from collections import Counter
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work05"
STUBS = WORK / "stubs"
REFS_DIR = HERE.parent / "refs"
DROPBOX_ARXIV = Path(
    "/Users/cms1308/Library/CloudStorage/Dropbox/shared folder/classification/arxiv"
)
BASELINE = REFS_DIR / "SU3s1S1nf2.txt"
TRUE_SET = REFS_DIR / "SU3s1S1nf2_true.txt"
OUTCOMES = WORK / "replay_outcomes.jsonl"

FILENAME = "SU3s1S1nf2_replay"
NAME_LIST = ['X', 'M', 'q', 'qb', 'phi', 'S', 'Sb', 'A', 'Ab',
             'U', 'Ub', 'V', 'Vb', 'W', 'Wb']
T_ORDER = 9   # main() of the production module
COUNTS = 1    # only affects the *_done{counts-1}.txt side file name
NC = 3

# Config-block substitutions applied to the module copy. Each pair must hit
# exactly once; anything else in the file is byte-identical to refs/.
CONFIG_PATCHES = [
    ('GROUP = "C"        # ABCDEFG',
     'GROUP = "A"        # ABCDEFG'),
    ('NC = 2             # SU(Nc), SO(Nc), Sp(Nc)=Usp(2Nc)=C_Nc',
     'NC = 3             # SU(Nc), SO(Nc), Sp(Nc)=Usp(2Nc)=C_Nc'),
    ('FILENAME = "Sp2nf5"  # Name of a file to save data.',
     f'FILENAME = "{FILENAME}"  # Name of a file to save data.'),
    ('SQLNAME = "Sp2nf5"   # Name classifying theories in SQL database',
     f'SQLNAME = "{FILENAME}"   # Name classifying theories in SQL database'),
]

PYMYSQL_STUB = '''\
"""pymysql stand-in: NO real database is ever contacted.

LieCache queries (the pipeline's memoization of LiE tensor() steps) are served
from a local sqlite file in the work dir; all other INSERTs are recorded to
sql_inserts.jsonl and dropped. Interface covers exactly what
landscape_refactored.py uses: connect() as plain call and context manager,
conn.cursor() context manager, cursor.execute/fetchone, conn.commit, Error.
"""
import json
import sqlite3
from pathlib import Path

_DB = Path.cwd() / "liecache.sqlite"
_LOG = Path.cwd() / "sql_inserts.jsonl"


class Error(Exception):
    pass


class _Cursor:
    def __init__(self, conn):
        self._conn = conn
        self._row = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        params = tuple(params) if params else ()
        if "LieCache" in sql:
            head = sql.strip().split(None, 1)[0].upper()
            if head == "CREATE":
                self._conn.execute(
                    "CREATE TABLE IF NOT EXISTS LieCache "
                    "(ckey TEXT PRIMARY KEY, result TEXT)")
                self._conn.commit()
            elif head == "SELECT":
                self._row = self._conn.execute(
                    "SELECT result FROM LieCache WHERE ckey=?", params
                ).fetchone()
            elif head == "INSERT":
                self._conn.execute(
                    "INSERT OR IGNORE INTO LieCache (ckey,result) VALUES (?,?)",
                    params)
                self._conn.commit()
            else:
                raise Error(f"unexpected LieCache sql: {sql!r}")
        else:
            table = sql.split("`")[1] if "`" in sql else "?"
            with open(_LOG, "a") as f:
                f.write(json.dumps({"table": table,
                                    "params": [str(p) for p in params]}) + "\\n")

    def fetchone(self):
        return self._row


class _Connection:
    def __init__(self):
        self._sq = sqlite3.connect(_DB, timeout=60)
        self._sq.execute("PRAGMA journal_mode=WAL")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False

    def cursor(self):
        return _Cursor(self._sq)

    def commit(self):
        self._sq.commit()

    def close(self):
        try:
            self._sq.close()
        except Exception:
            pass


def connect(*args, **kwargs):
    return _Connection()
'''


# --------------------------------------------------------------------------- #
# setup
# --------------------------------------------------------------------------- #
def do_setup(verbose=True):
    WORK.mkdir(exist_ok=True)
    STUBS.mkdir(exist_ok=True)
    (STUBS / "pymysql.py").write_text(PYMYSQL_STUB)

    # newline='' preserves the original CRLF line endings byte-for-byte
    with open(REFS_DIR / "landscape_refactored.py", newline='') as f:
        patched = f.read()
    for old, new in CONFIG_PATCHES:
        n = patched.count(old)
        assert n == 1, f"config line not unique ({n} hits): {old!r}"
        patched = patched.replace(old, new)
    with open(WORK / "landscape_A2.py", "w", newline='') as f:
        f.write(patched)

    link = WORK / "arxiv"
    if not link.exists():
        assert DROPBOX_ARXIV.is_dir(), f"missing character tables: {DROPBOX_ARXIV}"
        link.symlink_to(DROPBOX_ARXIV)
    assert (link / "A2" / "q" / "q1.txt").exists(), "A2 tables not reachable"

    if verbose:
        diff = subprocess.run(
            ["diff", str(REFS_DIR / "landscape_refactored.py"),
             str(WORK / "landscape_A2.py")],
            capture_output=True, text=True)
        print("config diff refs/landscape_refactored.py -> work05/landscape_A2.py:")
        print(diff.stdout)
        n_changed = sum(1 for l in diff.stdout.splitlines() if l.startswith("<"))
        assert n_changed == len(CONFIG_PATCHES), "unexpected extra diff lines"
        print(f"setup OK: {n_changed} config lines changed, nothing else.")


def import_pipeline():
    """chdir into work05 and import the patched module (stub shadows pymysql)."""
    do_setup(verbose=False)
    sys.path.insert(0, str(STUBS))
    sys.path.insert(0, str(WORK))
    os.chdir(WORK)
    import landscape_A2 as L  # noqa: E402
    assert L.GROUP_RANK == "A2" and L.NC == 3 and L.FILENAME == FILENAME
    import pymysql
    assert "stubs" in pymysql.__file__, "pymysql stub not shadowing real module"
    return L


# --------------------------------------------------------------------------- #
# spotcheck: stored A2 tables vs live LiE
# --------------------------------------------------------------------------- #
def _parse_decomp(s):
    """'1X[0,0]+2X[1,1] +-1X[3,0]' -> Counter({(0,0):1, (1,1):2, (3,0):-1})."""
    out = Counter()
    for m in re.finditer(r"([+-]?\d+)X\[([\d,\s-]*)\]", s.replace(" ", "")):
        mult = int(m.group(1))
        wt = tuple(int(x) for x in m.group(2).split(","))
        out[wt] += mult
    return out


def _live_lie(expr):
    """Evaluate a LiE expression; return parsed virtual-character Counter."""
    code = f"maxnodes 9999999\nres={expr};\nprint(res);\n"
    p = subprocess.run(["lie"], input=code, capture_output=True, text=True,
                       timeout=120, shell=True)
    return _parse_decomp(p.stdout)


def _table_entry(species, key):
    from ast import literal_eval
    path = WORK / "arxiv" / "A2" / species / f"{species}{len(key)}.txt"
    line = ""
    with open(path) as f:
        for l in f:
            if str(key) in l:
                line = l
                break
    assert line, f"key {key} not found in {path}"
    return literal_eval(line)[str(key)]


# (species, Adams-multiplicity key, equivalent live-LiE expression)
SPOTCHECKS = [
    ("q",   [1],       "X[1,0]"),
    ("qb",  [1],       "X[0,1]"),
    ("S",   [1],       "X[2,0]"),
    ("Sb",  [1],       "X[0,2]"),
    ("phi", [1],       "X[1,1]"),
    ("q",   [2, 0],    "tensor(X[1,0],X[1,0],A2)"),
    ("q",   [0, 1],    "Adams(2,X[1,0],A2)"),
    ("qb",  [0, 1],    "Adams(2,X[0,1],A2)"),
    ("S",   [2, 0],    "tensor(X[2,0],X[2,0],A2)"),
    ("S",   [0, 1],    "Adams(2,X[2,0],A2)"),
    ("phi", [2, 0],    "tensor(X[1,1],X[1,1],A2)"),
    ("phi", [0, 1],    "Adams(2,X[1,1],A2)"),
    ("q",   [1, 1, 0], "tensor(X[1,0],Adams(2,X[1,0],A2),A2)"),
    ("S",   [0, 0, 1], "Adams(3,X[2,0],A2)"),
    ("qb",  [3, 0, 0], "tensor(tensor(X[0,1],X[0,1],A2),X[0,1],A2)"),
]


def do_spotcheck():
    os.chdir(WORK)
    ok = 0
    for species, key, expr in SPOTCHECKS:
        stored = _table_entry(species, key)
        want = _live_lie(expr)
        got = _parse_decomp(stored)
        status = "OK" if got == want else "MISMATCH"
        if got == want:
            ok += 1
        print(f"[{status}] {species}{len(key)} {key}: table={stored!r}")
        if got != want:
            print(f"    live LiE: {dict(want)}")
            print(f"    stored  : {dict(got)}")
    # structural assumptions used by match(): singlet listed first when present,
    # leading sign parsed by int(decomp[:find('X')])
    n_singlet = n_first = n_neg = 0
    for species in ("q", "qb", "S", "Sb", "phi"):
        d = WORK / "arxiv" / "A2" / species
        for f in sorted(d.iterdir())[:8]:
            from ast import literal_eval
            for line in open(f):
                for key, decomp in literal_eval(line).items():
                    terms = list(re.finditer(r"([+-]?\d+)X\[([\d,\s-]*)\]",
                                             decomp.replace(" ", "")))
                    for i, m in enumerate(terms):
                        if all(int(x) == 0 for x in m.group(2).split(",")):
                            n_singlet += 1
                            if i == 0:
                                n_first += 1
                            if int(m.group(1)) < 0:
                                n_neg += 1
    print(f"singlet-first scan: {n_singlet} singlet terms, {n_first} listed "
          f"first, {n_neg} with negative multiplicity")
    assert n_singlet == n_first, "singlet-first assumption VIOLATED"
    print(f"spotcheck: {ok}/{len(SPOTCHECKS)} table entries match live LiE")
    return ok == len(SPOTCHECKS)


# --------------------------------------------------------------------------- #
# verify-n: baseline `n` vs field labels
# --------------------------------------------------------------------------- #
LABEL_RE = re.compile(r"^(X|M|q|qb|phi|S|Sb|A|Ab|U|Ub|V|Vb|W|Wb)(\d+)$")


def labels_to_n(d, length):
    counts = Counter()
    for k in d:
        m = LABEL_RE.match(k)
        if m:
            counts[m.group(1)] = max(counts[m.group(1)], int(m.group(2)))
    return [counts.get(NAME_LIST[i], 0) for i in range(length)]


def do_verify_n():
    bad = 0
    for i, line in enumerate(open(BASELINE)):
        d = json.loads(line)
        expect = labels_to_n(d, len(d["n"]))
        if expect != d["n"]:
            bad += 1
            print(f"line {i}: n={d['n']} but labels give {expect}  w={d['w']}")
    print(f"verify-n: {101 - bad}/101 lines consistent"
          if bad == 0 else f"verify-n: {bad} mismatches")
    for i, line in list(enumerate(open(BASELINE)))[:3]:
        d = json.loads(line)
        print(f"  e.g. line {i}: w={d['w']}  n={d['n']}")
    return bad == 0


# --------------------------------------------------------------------------- #
# replay
# --------------------------------------------------------------------------- #
def _snapshot(paths):
    return [p.stat().st_size if p.exists() else 0 for p in paths]


def _appended(path, old_size):
    if not path.exists():
        return []
    with open(path) as f:
        f.seek(old_size)
        return [l.rstrip("\n") for l in f if l.strip()]


def do_replay(start, end):
    """Sequential replay with per-call file snapshots."""
    L = import_pipeline()
    results_dir = L.RESULTS_DIR
    files = {
        "success": results_dir / f"{FILENAME}.txt",
        "log": results_dir / f"{FILENAME}_log.txt",
        "error": results_dir / f"{FILENAME}_error.txt",
    }

    done = set()
    if OUTCOMES.exists():
        for l in open(OUTCOMES):
            done.add(json.loads(l)["line"])

    lines = [json.loads(l) for l in open(BASELINE)]
    end = min(end, len(lines))
    todo = [i for i in range(start, end) if i not in done]
    print(f"replaying {len(todo)} lines ({len(done)} already done)", flush=True)

    for i in todo:
        d = lines[i]
        nw = [list(d["n"]), list(d["w"])]
        sizes = {k: (p.stat().st_size if p.exists() else 0)
                 for k, p in files.items()}
        t0 = time.time()
        err = None
        try:
            L.charges2(T_ORDER, COUNTS, NC, list(NAME_LIST), nw)
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        dt = time.time() - t0
        rec = {"line": i, "w": d["w"], "seconds": round(dt, 1),
               "exception": err}
        for k, p in files.items():
            rec[k] = _appended(p, sizes[k])
        with open(OUTCOMES, "a") as f:
            f.write(json.dumps(rec) + "\n")
        outcome = ("success" if rec["success"] else
                   "log" if rec["log"] else
                   "error" if rec["error"] else
                   f"exception:{err}" if err else "NO-OUTPUT")
        print(f"[{i}] {dt:.1f}s {outcome}  w={d['w']}", flush=True)
    print("replay complete", flush=True)


# --------------------------------------------------------------------------- #
# compare
# --------------------------------------------------------------------------- #
NUMERIC_KEYS_RE = re.compile(
    r"^(a|c|X\d+|M\d+|q\d+|qb\d+|phi\d+|S\d+|Sb\d+|A\d+|Ab\d+)$")
NUM_TOL = Decimal("1e-24")


def _diff_fields(fresh, base):
    diffs = []
    for k in sorted(set(fresh) | set(base)):
        v1, v2 = fresh.get(k), base.get(k)
        if v1 == v2:
            continue
        if (NUMERIC_KEYS_RE.match(k) and isinstance(v1, str)
                and isinstance(v2, str)):
            try:
                if abs(Decimal(v1) - Decimal(v2)) <= NUM_TOL:
                    diffs.append((k, "numeric-noise", v1, v2))
                    continue
            except Exception:
                pass
        diffs.append((k, "DIFF", v1, v2))
    return diffs


def do_compare():
    true_by_w = {json.dumps(json.loads(l)["w"]): json.loads(l)
                 for l in open(TRUE_SET)}
    outs = [json.loads(l) for l in open(OUTCOMES)]
    outs.sort(key=lambda r: r["line"])

    n_exact = n_noise = n_mismatch = n_extra = 0
    kept_extras, rejected_true, verdicts = [], [], Counter()
    for rec in outs:
        wkey = json.dumps(rec["w"])
        is_true = wkey in true_by_w
        if not is_true:
            n_extra += 1
        success = [json.loads(s) for s in rec["success"]]
        if is_true:
            if not success:
                rejected_true.append(rec)
                other = (rec["log"] or rec["error"] or
                         [rec.get("exception") or "no output"])
                print(f"[line {rec['line']}] TRUE entry NOT reproduced: "
                      f"w={rec['w']}\n    got: {str(other)[:300]}")
                continue
            fresh = success[0]
            diffs = _diff_fields(fresh, true_by_w[wkey])
            hard = [d for d in diffs if d[1] == "DIFF"]
            if not diffs:
                n_exact += 1
            elif not hard:
                n_noise += 1
            else:
                n_mismatch += 1
                print(f"[line {rec['line']}] field mismatches w={rec['w']}:")
                for k, kind, v1, v2 in hard:
                    print(f"    {k}: fresh={str(v1)[:120]!r}")
                    print(f"    {'':>{len(k)}}  base ={str(v2)[:120]!r}")
        else:
            if success:
                kept_extras.append(rec)
                print(f"[line {rec['line']}] EXTRA entry still kept as "
                      f"consistent: w={rec['w']}")
            else:
                for s in rec["log"]:
                    verdicts[json.loads(s).get("consistency", "?")] += 1
                for s in rec["error"]:
                    verdicts["error: " +
                             json.loads(s).get("consistency", "?")] += 1
                if rec.get("exception"):
                    verdicts[f"exception: {rec['exception']}"] += 1

    print("\n=== summary ===")
    print(f"replayed lines           : {len(outs)}")
    print(f"true entries reproduced  : {n_exact} exact, {n_noise} numeric-noise,"
          f" {n_mismatch} with field mismatches, {len(rejected_true)} rejected")
    print(f"extra (non-true) entries : {n_extra} replayed, "
          f"{n_extra - len(kept_extras)} rejected, {len(kept_extras)} still kept")
    if verdicts:
        print("rejection verdicts for extras:")
        for v, c in verdicts.most_common():
            print(f"  {c:3d}  {v}")
    return (n_mismatch == 0 and not rejected_true and not kept_extras)


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="checks",
                    choices=["checks", "setup", "spotcheck", "verify-n",
                             "replay", "compare"])
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=101)
    a = ap.parse_args()
    if a.cmd == "setup":
        do_setup()
    elif a.cmd == "spotcheck":
        do_setup(verbose=False)
        sys.exit(0 if do_spotcheck() else 1)
    elif a.cmd == "verify-n":
        sys.exit(0 if do_verify_n() else 1)
    elif a.cmd == "replay":
        do_replay(a.start, a.end)
    elif a.cmd == "compare":
        sys.exit(0 if do_compare() else 1)
    else:  # checks = setup + spotcheck + verify-n
        do_setup()
        ok1 = do_spotcheck()
        ok2 = do_verify_n()
        sys.exit(0 if ok1 and ok2 else 1)


if __name__ == "__main__":
    main()
