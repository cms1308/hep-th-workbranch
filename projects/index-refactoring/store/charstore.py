"""Self-bootstrapping character store (extension steps 10-15).

One sqlite file (WAL journal) replaces the arxiv/<GROUP><RANK>/ character
tables and the MySQL LieCache for the refactor/ pipeline:

- char_decomp: (group_rank, species, key_vec) -> normalized LiE
  virtual-character polynomial for prod_k psi^k(chi_rep)^{m_k}. A missing
  entry is computed on the spot via the arxivGen recursion (pure top Adams
  key -> Adams(N, rep, G); else one tensor of two strictly-lower-order
  entries) and persisted -- proven byte-identical to the stored tables in
  step 10 (notes/10-semantics-lock.md, 107/107).
- tensor_cache: the LieCache replacement; keys are the pipeline's existing
  sha256(GROUP_RANK|products|decomp) hex digests, so warm caches stay valid.
- rep_registry: species -> Dynkin label, seeded with the order-1 labels of
  all 26 landscape groups (read off the table files in step 12; A1/A2
  byte-verified in step 10); anything else registers explicitly.

The store file is created automatically when absent; external machines need
only Python and LiE -- no MySQL, no Wolfram, no arxiv/ directory.
"""

from __future__ import annotations

import os
import re
import signal
import sqlite3
import subprocess
import threading
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence, Tuple

LIE_TIMEOUT_S = 180.0        # per LiE subprocess, as in the old _run_lie
MAX_OBJECTS_RETRIES = 3      # grow maxobjects and rerun (R9 retry policy)
BANNER_SLICE = 53            # LiE startup banner length, sentinel-verified
BUSY_TIMEOUT_MS = 60_000     # sqlite lock wait across Pool processes
SENTINEL = "123456789"

# Read off the order-1 table files of all 26 groups (step 12; A1/A2
# verified byte-level in step 10, R9). Never guessed -- see rep_registry.
DEFAULT_LABELS: dict[Tuple[str, str], str] = {
    ("A1", "U"): "[3]",
    ("A1", "Ub"): "[3]",
    ("A1", "phi"): "[2]",
    ("A1", "q"): "[1]",
    ("A1", "qb"): "[1]",
    ("A2", "S"): "[2,0]",
    ("A2", "Sb"): "[0,2]",
    ("A2", "phi"): "[1,1]",
    ("A2", "q"): "[1,0]",
    ("A2", "qb"): "[0,1]",
    ("A3", "A"): "[0,1,0]",
    ("A3", "Ab"): "[0,1,0]",
    ("A3", "S"): "[2,0,0]",
    ("A3", "Sb"): "[0,0,2]",
    ("A3", "phi"): "[1,0,1]",
    ("A3", "q"): "[1,0,0]",
    ("A3", "qb"): "[0,0,1]",
    ("A4", "A"): "[0,1,0,0]",
    ("A4", "Ab"): "[0,0,1,0]",
    ("A4", "S"): "[2,0,0,0]",
    ("A4", "Sb"): "[0,0,0,2]",
    ("A4", "phi"): "[1,0,0,1]",
    ("A4", "q"): "[1,0,0,0]",
    ("A4", "qb"): "[0,0,0,1]",
    ("A5", "A"): "[0,1,0,0,0]",
    ("A5", "Ab"): "[0,0,0,1,0]",
    ("A5", "S"): "[2,0,0,0,0]",
    ("A5", "Sb"): "[0,0,0,0,2]",
    ("A5", "phi"): "[1,0,0,0,1]",
    ("A5", "q"): "[1,0,0,0,0]",
    ("A5", "qb"): "[0,0,0,0,1]",
    ("A6", "A"): "[0,1,0,0,0,0]",
    ("A6", "Ab"): "[0,0,0,0,1,0]",
    ("A6", "S"): "[2,0,0,0,0,0]",
    ("A6", "Sb"): "[0,0,0,0,0,2]",
    ("A6", "phi"): "[1,0,0,0,0,1]",
    ("A6", "q"): "[1,0,0,0,0,0]",
    ("A6", "qb"): "[0,0,0,0,0,1]",
    ("A7", "A"): "[0,1,0,0,0,0,0]",
    ("A7", "Ab"): "[0,0,0,0,0,1,0]",
    ("A7", "S"): "[2,0,0,0,0,0,0]",
    ("A7", "Sb"): "[0,0,0,0,0,0,2]",
    ("A7", "phi"): "[1,0,0,0,0,0,1]",
    ("A7", "q"): "[1,0,0,0,0,0,0]",
    ("A7", "qb"): "[0,0,0,0,0,0,1]",
    ("A8", "A"): "[0,1,0,0,0,0,0,0]",
    ("A8", "Ab"): "[0,0,0,0,0,0,1,0]",
    ("A8", "S"): "[2,0,0,0,0,0,0,0]",
    ("A8", "Sb"): "[0,0,0,0,0,0,0,2]",
    ("A8", "phi"): "[1,0,0,0,0,0,0,1]",
    ("A8", "q"): "[1,0,0,0,0,0,0,0]",
    ("A8", "qb"): "[0,0,0,0,0,0,0,1]",
    ("A9", "A"): "[0,1,0,0,0,0,0,0,0]",
    ("A9", "Ab"): "[0,0,0,0,0,0,0,1,0]",
    ("A9", "S"): "[2,0,0,0,0,0,0,0,0]",
    ("A9", "Sb"): "[0,0,0,0,0,0,0,0,2]",
    ("A9", "phi"): "[1,0,0,0,0,0,0,0,1]",
    ("A9", "q"): "[1,0,0,0,0,0,0,0,0]",
    ("A9", "qb"): "[0,0,0,0,0,0,0,0,1]",
    ("B2", "S"): "[2,0]",
    ("B2", "Sb"): "[2,0]",
    ("B2", "phi"): "[0,2]",
    ("B2", "q"): "[1,0]",
    ("B2", "qb"): "[1,0]",
    ("B2", "sp"): "[0,1]",
    ("B2", "spb"): "[0,1]",
    ("B3", "A"): "[0,1,0]",
    ("B3", "Ab"): "[0,1,0]",
    ("B3", "S"): "[2,0,0]",
    ("B3", "Sb"): "[2,0,0]",
    ("B3", "phi"): "[0,1,0]",
    ("B3", "q"): "[1,0,0]",
    ("B3", "qb"): "[1,0,0]",
    ("B4", "A"): "[0,1,0,0]",
    ("B4", "Ab"): "[0,1,0,0]",
    ("B4", "S"): "[2,0,0,0]",
    ("B4", "Sb"): "[2,0,0,0]",
    ("B4", "phi"): "[0,1,0,0]",
    ("B4", "q"): "[1,0,0,0]",
    ("B4", "qb"): "[1,0,0,0]",
    ("C1", "phi"): "[2]",
    ("C1", "q"): "[1]",
    ("C1", "qb"): "[1]",
    ("C2", "A"): "[0,1]",
    ("C2", "Ab"): "[0,1]",
    ("C2", "S"): "[2,0]",
    ("C2", "Sb"): "[2,0]",
    ("C2", "phi"): "[2,0]",
    ("C2", "q"): "[1,0]",
    ("C2", "qb"): "[1,0]",
    ("C2", "sp"): "[0,2]",
    ("C2", "spb"): "[0,2]",
    ("C2", "v"): "[0,1]",
    ("C2", "vb"): "[0,1]",
    ("C3", "A"): "[0,1,0]",
    ("C3", "Ab"): "[0,1,0]",
    ("C3", "S"): "[2,0,0]",
    ("C3", "Sb"): "[2,0,0]",
    ("C3", "phi"): "[2,0,0]",
    ("C3", "q"): "[1,0,0]",
    ("C3", "qb"): "[1,0,0]",
    ("C4", "A"): "[0,1,0,0]",
    ("C4", "Ab"): "[0,1,0,0]",
    ("C4", "S"): "[2,0,0,0]",
    ("C4", "Sb"): "[2,0,0,0]",
    ("C4", "phi"): "[2,0,0,0]",
    ("C4", "q"): "[1,0,0,0]",
    ("C4", "qb"): "[1,0,0,0]",
    ("C5", "A"): "[0,1,0,0,0]",
    ("C5", "Ab"): "[0,1,0,0,0]",
    ("C5", "S"): "[2,0,0,0,0]",
    ("C5", "Sb"): "[2,0,0,0,0]",
    ("C5", "phi"): "[2,0,0,0,0]",
    ("C5", "q"): "[1,0,0,0,0]",
    ("C5", "qb"): "[1,0,0,0,0]",
    ("C6", "A"): "[0,1,0,0,0,0]",
    ("C6", "Ab"): "[0,1,0,0,0,0]",
    ("C6", "phi"): "[2,0,0,0,0,0]",
    ("C6", "q"): "[1,0,0,0,0,0]",
    ("C6", "qb"): "[1,0,0,0,0,0]",
    ("C8", "A"): "[0,1,0,0,0,0,0,0]",
    ("C8", "Ab"): "[0,1,0,0,0,0,0,0]",
    ("C8", "phi"): "[2,0,0,0,0,0,0,0]",
    ("C8", "q"): "[1,0,0,0,0,0,0,0]",
    ("C8", "qb"): "[1,0,0,0,0,0,0,0]",
    ("D3", "q"): "[1,0,0]",
    ("D4", "S"): "[2,0,0,0]",
    ("D4", "Sb"): "[2,0,0,0]",
    ("D4", "phi"): "[0,1,0,0]",
    ("D4", "q"): "[1,0,0,0]",
    ("D4", "qb"): "[1,0,0,0]",
    ("D5", "S"): "[2,0,0,0,0]",
    ("D5", "Sb"): "[2,0,0,0,0]",
    ("D5", "phi"): "[0,1,0,0,0]",
    ("D5", "q"): "[1,0,0,0,0]",
    ("D5", "qb"): "[1,0,0,0,0]",
    ("D6", "S"): "[2,0,0,0,0,0]",
    ("D6", "Sb"): "[2,0,0,0,0,0]",
    ("D6", "phi"): "[0,1,0,0,0,0]",
    ("D6", "q"): "[1,0,0,0,0,0]",
    ("D6", "qb"): "[1,0,0,0,0,0]",
    ("D6", "sp"): "[0,0,0,0,1,0]",
    ("D7", "S"): "[2,0,0,0,0,0,0]",
    ("D7", "Sb"): "[2,0,0,0,0,0,0]",
    ("D7", "phi"): "[0,1,0,0,0,0,0]",
    ("D7", "q"): "[1,0,0,0,0,0,0]",
    ("D7", "qb"): "[1,0,0,0,0,0,0]",
    ("D8", "S"): "[2,0,0,0,0,0,0,0]",
    ("D8", "Sb"): "[2,0,0,0,0,0,0,0]",
    ("D8", "phi"): "[0,1,0,0,0,0,0,0]",
    ("D8", "q"): "[1,0,0,0,0,0,0,0]",
    ("D8", "qb"): "[1,0,0,0,0,0,0,0]",
    ("G2", "phi"): "[0,1]",
    ("G2", "q"): "[1,0]",
    ("G2", "qb"): "[1,0]",
}

# A normalized LiE virtual-character polynomial: signed integer
# multiplicities, X, bracketed weight vectors; '+-1X[...]' juxtaposition
# allowed (sign of the multiplicity after a '+' separator).
_POLY_RE = re.compile(
    r"^[+-]?\d+X\[-?\d+(,-?\d+)*\]([+-]{1,2}\d+X\[-?\d+(,-?\d+)*\])*$")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS char_decomp (
    group_rank TEXT NOT NULL,
    species    TEXT NOT NULL,
    key_vec    TEXT NOT NULL,
    value      TEXT NOT NULL,
    source     TEXT NOT NULL,
    PRIMARY KEY (group_rank, species, key_vec)
);
CREATE TABLE IF NOT EXISTS tensor_cache (
    ckey   TEXT PRIMARY KEY,
    result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rep_registry (
    group_rank TEXT NOT NULL,
    species    TEXT NOT NULL,
    dynkin     TEXT NOT NULL,
    PRIMARY KEY (group_rank, species)
);
"""


class CharStoreError(RuntimeError):
    """Loud failure: wrong LiE build, malformed output, unknown species."""


def run_lie(lcode: str, timeout: float) -> str:
    """LiE subprocess with the pipeline's kill semantics (fastmatch.run_lie)."""
    proc = subprocess.Popen(
        ["lie"], shell=True,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, start_new_session=True,
    )
    try:
        out, _ = proc.communicate(input=lcode, timeout=timeout)
        return out
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        raise


def split_key(key: Sequence[int]) -> Tuple[list, list]:
    """arxivGen split of a non-pure-Adams key into two lower-order keys."""
    first_nonzero = next(i for i, m in enumerate(key) if m)
    frob1 = list(key[:len(key) - first_nonzero - 1])
    frob1[first_nonzero] -= 1
    frob2 = [1 if i == first_nonzero else 0 for i in range(first_nonzero + 1)]
    return frob1, frob2


class CharStore:
    """One sqlite-backed store instance, bound to a group_rank.

    Thread-safe within a process (single connection + lock); safe across
    processes via WAL + busy_timeout + idempotent INSERT OR IGNORE writes
    (generation is deterministic, so concurrent writers agree).
    """

    def __init__(self, path: str | Path, group_rank: str,
                 lie_timeout: float = LIE_TIMEOUT_S,
                 lie_runner: Callable[[str, float], str] = run_lie):
        self.group_rank = group_rank
        self._lie_timeout = lie_timeout
        self._lie_runner = lie_runner
        self._lock = threading.Lock()
        self._decomp_memo: dict[Tuple[str, str], str] = {}
        self._banner_checked = False
        self.lie_calls = 0
        self.generated = 0

        self._path = str(path)
        self._connect()
        with self._conn:
            self._conn.executescript(_SCHEMA)
            self._conn.executemany(
                "INSERT OR IGNORE INTO rep_registry VALUES (?,?,?)",
                [(g, s, d) for (g, s), d in DEFAULT_LABELS.items()])

    def _connect(self) -> None:
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._pid = os.getpid()

    def _db(self) -> sqlite3.Connection:
        """Call under self._lock. A forked child must not reuse the parent's
        sqlite connection (Pool workers on fork-start platforms)."""
        if os.getpid() != self._pid:
            self._connect()
        return self._conn

    # ------------------------------------------------------------------ #
    # LiE invocation (R9 conventions)
    # ------------------------------------------------------------------ #
    def _check_banner(self) -> None:
        out = self._lie_runner(f"maxnodes 9999999\n {SENTINEL}",
                               self._lie_timeout)
        if out[BANNER_SLICE:].strip() != SENTINEL:
            raise CharStoreError(
                f"LiE banner slice [{BANNER_SLICE}:] invalid on this build; "
                f"sentinel run began {out[:90]!r}")
        self._banner_checked = True

    def _lie_eval(self, expr: str) -> str:
        if not self._banner_checked:
            self._check_banner()
        max_objects = "9999999"
        for _ in range(MAX_OBJECTS_RETRIES + 1):
            lcode = f"maxnodes 9999999\n maxobjects {max_objects}\n {expr}"
            with self._lock:
                self.lie_calls += 1
            raw = self._lie_runner(lcode, self._lie_timeout)
            out = raw[BANNER_SLICE:].strip().replace("\n", "").replace(" ", "")
            if "(" not in out and "line" not in out:
                return out
            max_objects += "9"  # R9 retry policy (fires at higher rank)
        raise CharStoreError(f"LiE gave no clean output for: {expr[:120]}...")

    # ------------------------------------------------------------------ #
    # rep registry
    # ------------------------------------------------------------------ #
    def label(self, species: str) -> str:
        with self._lock:
            row = self._db().execute(
                "SELECT dynkin FROM rep_registry WHERE group_rank=? AND "
                "species=?", (self.group_rank, species)).fetchone()
        if row is None:
            with self._lock:
                known = [r[0] for r in self._db().execute(
                    "SELECT species FROM rep_registry WHERE group_rank=?",
                    (self.group_rank,))]
            raise CharStoreError(
                f"no Dynkin label registered for {self.group_rank}/{species} "
                f"(known: {known}); call register_species() first")
        return row[0]

    def register_species(self, species: str, dynkin: str) -> None:
        with self._lock, self._db():
            self._db().execute(
                "INSERT OR REPLACE INTO rep_registry VALUES (?,?,?)",
                (self.group_rank, species, dynkin))

    # ------------------------------------------------------------------ #
    # character decompositions (generation-on-miss)
    # ------------------------------------------------------------------ #
    def decomp(self, species: str, key_vec: Sequence[int]) -> str:
        key_str = str(list(key_vec))
        memo_key = (species, key_str)
        with self._lock:
            value = self._decomp_memo.get(memo_key)
        if value is not None:
            return value
        with self._lock:
            row = self._db().execute(
                "SELECT value FROM char_decomp WHERE group_rank=? AND "
                "species=? AND key_vec=?",
                (self.group_rank, species, key_str)).fetchone()
        if row is not None:
            value = row[0]
        else:
            value = self._generate(species, list(key_vec))
            self._put_decomp(species, key_str, value, source="generated")
            with self._lock:
                self.generated += 1
        with self._lock:
            self._decomp_memo[memo_key] = value
        return value

    def _generate(self, species: str, key: list) -> str:
        order = len(key)
        if key[-1] == 1:  # pure top Adams term
            value = self._lie_eval(
                f"Adams({order}, {self.label(species)}, {self.group_rank})")
        else:
            frob1, frob2 = split_key(key)
            pol1 = self.decomp(species, frob1)  # recursion persists the cone
            pol2 = self.decomp(species, frob2)
            value = self._lie_eval(f"tensor({pol1},{pol2},{self.group_rank})")
        if not _POLY_RE.match(value):
            raise CharStoreError(
                f"LiE output for {self.group_rank}/{species} {key} is not a "
                f"character polynomial: {value[:200]!r}")
        return value

    def _put_decomp(self, species: str, key_str: str, value: str,
                    source: str) -> None:
        with self._lock, self._db():
            self._db().execute(
                "INSERT OR IGNORE INTO char_decomp VALUES (?,?,?,?,?)",
                (self.group_rank, species, key_str, value, source))

    def put_decomp_many(
            self, rows: Iterable[Tuple[str, str, str]],
            source: str = "import") -> int:
        """Bulk import of (species, key_str, value) rows; returns rows added."""
        with self._lock, self._db():
            before = self._db().execute(
                "SELECT COUNT(*) FROM char_decomp").fetchone()[0]
            self._db().executemany(
                "INSERT OR IGNORE INTO char_decomp VALUES (?,?,?,?,?)",
                ((self.group_rank, species, key_str, value, source)
                 for species, key_str, value in rows))
            after = self._db().execute(
                "SELECT COUNT(*) FROM char_decomp").fetchone()[0]
        return after - before

    # ------------------------------------------------------------------ #
    # tensor-step cache (LieCache replacement, same sha256 keys)
    # ------------------------------------------------------------------ #
    def cache_get(self, ckey: str) -> Optional[str]:
        with self._lock:
            row = self._db().execute(
                "SELECT result FROM tensor_cache WHERE ckey=?",
                (ckey,)).fetchone()
        return row[0] if row else None

    def cache_put(self, ckey: str, result: str) -> None:
        with self._lock, self._db():
            self._db().execute(
                "INSERT OR IGNORE INTO tensor_cache VALUES (?,?)",
                (ckey, result))

    def cache_put_many(self, rows: Iterable[Tuple[str, str]]) -> int:
        with self._lock, self._db():
            before = self._db().execute(
                "SELECT COUNT(*) FROM tensor_cache").fetchone()[0]
            self._db().executemany(
                "INSERT OR IGNORE INTO tensor_cache VALUES (?,?)", rows)
            after = self._db().execute(
                "SELECT COUNT(*) FROM tensor_cache").fetchone()[0]
        return after - before

    # ------------------------------------------------------------------ #
    def stats(self) -> dict:
        with self._lock:
            decomp_total, decomp_generated = self._db().execute(
                "SELECT COUNT(*), COALESCE(SUM(source='generated'),0) "
                "FROM char_decomp").fetchone()
            cache_total = self._db().execute(
                "SELECT COUNT(*) FROM tensor_cache").fetchone()[0]
        return {"char_decomp": decomp_total,
                "char_decomp_generated": decomp_generated,
                "tensor_cache": cache_total,
                "lie_calls": self.lie_calls,
                "generated_this_instance": self.generated}

    def integrity_check(self) -> str:
        with self._lock:
            return self._db().execute("PRAGMA integrity_check").fetchone()[0]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
