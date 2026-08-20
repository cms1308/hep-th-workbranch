"""Structured FORM-output parser + gauge-singlet projection (step-8 refactor).

Replaces the sympy eval/subs term decode of the landscape module's
`Mathcode`/`match` (profiling leverage item 1, notes/06): the old path
`eval`s every FORM term into sympy, decodes the fugacity encoding with three
chained `subs`, and pokes the character exponents out of the expression tree;
on flip-heavy theories this costs 140 s per theory at a 100% LiE-cache hit
rate. This module parses the cleaned FORM output file (as written by
`form()`) directly, with exact Fraction/Decimal arithmetic and no sympy, no
eval.

Semantics preserved exactly from landscape_refactored.py `_match_impl`:
  - t-exponent decoding t^{d0} s^{d1} r^{d2} -> d0/500 + d1/2.5e6 + d2/1.25e10,
    quantized to 0.001 (ROUND_HALF_UP);
  - Adams multiplicity key: entry k-1 = multiplicity of Adams_k, zero-padded
    to total degree sum(k*m_k);
  - species chain order phi,q,qb,S,Sb,A,Ab,U,Ub,V,Vb,W,Wb (the insertion
    order of the old rep_structure dict literal -- LieCache keys depend on
    it, so the warm cache stays valid);
  - singlet multiplicity read from the first term of the decomposition
    string (LiE lists the zero weight first when present);
  - lie invocation strings, [53:] banner slice, 'line'-triggered maxobjects
    retry, and the validity gating before caching.
"""
import subprocess
import os
import signal
import time
import hashlib
import threading
from ast import literal_eval
from decimal import Decimal, ROUND_HALF_UP, localcontext
from fractions import Fraction
from pathlib import Path
from typing import Dict, List, NamedTuple, Tuple

# Chain order of the old rep_structure dict literal (cache-key compatible).
SPECIES_ORDER = ("phi", "q", "qb", "S", "Sb", "A", "Ab",
                 "U", "Ub", "V", "Vb", "W", "Wb")
_SPECIES_SET = frozenset(SPECIES_ORDER)

_MILLI_Q = Decimal("0.001")


class TermRecord(NamedTuple):
    """One '+'-separated FORM output term, exactly decoded."""
    coeff: Fraction                      # d(n,m) coefficients multiplied out
    milli: int                           # physical t-exponent * 1000 (rounded)
    ypow: int                            # y exponent
    fug: Tuple[Tuple[str, int], ...]     # sorted ((fugacity, exponent), ...)
    chars: Tuple[Tuple[str, Tuple[int, ...]], ...]  # ((species, key-vector), ...)


def _milli_exponent(tpow: int, spow: int, rpow: int) -> int:
    """Exact decode of the base-5000 fugacity encoding, quantized to 0.001.

    The denominators are 2^a 5^b, so the decimal expansion is finite and the
    quantization reproduces the ideal ROUND_HALF_UP that the sympy path
    approximates in floats.
    """
    with localcontext() as ctx:
        ctx.prec = 50
        p = (Decimal(tpow) / Decimal(500)
             + Decimal(spow) / Decimal(2500000)
             + Decimal(rpow) / Decimal(12500000000))
        return int(p.quantize(_MILLI_Q, rounding=ROUND_HALF_UP) * 1000)


def parse_term(term: str) -> TermRecord:
    """Parse one FORM output term (no spaces, '*'-separated factors)."""
    coeff = Fraction(1)
    tpow = spow = rpow = ypow = 0
    fug: Dict[str, int] = {}
    chars: Dict[str, Dict[int, int]] = {}
    for factor in term.split("*"):
        if factor.startswith("d(") and factor.endswith(")"):
            n_str, m_str = factor[2:-1].split(",")
            coeff *= Fraction(int(n_str), int(m_str))
            continue
        base, caret, exp_str = factor.partition("^")
        exp = int(exp_str.strip("()")) if caret else 1
        if "(" in base:
            name, _, arg = base[:-1].partition("(")
            if name not in _SPECIES_SET:
                raise ValueError(f"unknown character function {factor!r}")
            adams = int(arg)
            per = chars.setdefault(name, {})
            per[adams] = per.get(adams, 0) + exp
        elif base == "t":
            tpow += exp
        elif base == "s":
            spow += exp
        elif base == "r":
            rpow += exp
        elif base == "y":
            ypow += exp
        elif base.isdigit() or (base.startswith("-") and base[1:].isdigit()):
            # bare numeric factor -- e.g. the literal '1' that form() writes
            # in place of the leftover Horner variable z
            coeff *= Fraction(int(base)) ** exp
        elif base:
            fug[base] = fug.get(base, 0) + exp
        else:
            raise ValueError(f"empty factor in term {term!r}")
    char_key = []
    for species in SPECIES_ORDER:
        per = chars.get(species)
        if not per:
            continue
        length = sum(k * m for k, m in per.items())
        vec = [0] * length
        for k, m in per.items():
            vec[k - 1] = m
        char_key.append((species, tuple(vec)))
    return TermRecord(
        coeff=coeff,
        milli=_milli_exponent(tpow, spow, rpow),
        ypow=ypow,
        fug=tuple(sorted((k, v) for k, v in fug.items() if v != 0)),
        chars=tuple(char_key),
    )


def parse_form_file(path: Path) -> List[TermRecord]:
    text = Path(path).read_text()
    return [parse_term(t) for t in text.split("+") if t]


# --------------------------------------------------------------------------- #
# Character tables (in-memory cache of the arxiv/<GROUP><RANK>/ files)
# --------------------------------------------------------------------------- #
class CharacterTables:
    """Loads each <species><degree>.txt file once; old picklines() re-scanned
    the file for every term."""

    def __init__(self, arxiv_dir: Path):
        self._dir = Path(arxiv_dir)
        self._files: Dict[Tuple[str, int], Dict[str, str]] = {}

    def decomp(self, species: str, key_vec: Tuple[int, ...]) -> str:
        fkey = (species, len(key_vec))
        table = self._files.get(fkey)
        if table is None:
            table = {}
            path = self._dir / species / f"{species}{len(key_vec)}.txt"
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        table.update(literal_eval(line))
            self._files[fkey] = table
        return table[str(list(key_vec))]


def first_term_singlet(decomp: str) -> int:
    """Singlet multiplicity from a LiE decomposition string.

    Same string logic as the old match(): the first listed weight is the zero
    weight iff a singlet is present (LiE ascending weight order, verified on
    the stored tables in step 5)."""
    singlet = decomp[decomp.find("X") + 1:decomp.find("]") + 1]
    if not any(literal_eval(singlet)):
        return int(decomp[0:decomp.find("X")])
    return 0


# --------------------------------------------------------------------------- #
# LiE subprocess (copied semantics from landscape _run_lie)
# --------------------------------------------------------------------------- #
def run_lie(lcode: str, timeout: float) -> str:
    p = subprocess.Popen(
        ['lie'], shell=True,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, start_new_session=True,
    )
    try:
        out, _ = p.communicate(input=lcode, timeout=timeout)
        return out
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        raise


class SingletProjector:
    """Gauge-singlet projection of parsed terms.

    cache_get/cache_put talk to the persistent LieCache table (MySQL in
    production, the sqlite stub in the harness) with the same sha256 keys as
    the old pipeline; an in-process memo layer serves repeats within the run,
    and a per-chars-signature memo avoids re-walking identical chains."""

    def __init__(self, tables: CharacterTables, group_rank: str, rank: str,
                 lie_timeout: float, cache_get, cache_put,
                 timeout_error=subprocess.TimeoutExpired, lie_runner=None):
        self._tables = tables
        self._group_rank = group_rank
        self._rank = rank
        self._lie_timeout = lie_timeout
        self._lie_runner = lie_runner if lie_runner is not None else run_lie
        self._cache_get = cache_get
        self._cache_put = cache_put
        self._timeout_error = timeout_error
        self._step_memo: Dict[str, str] = {}
        self._sig_memo: Dict[tuple, int] = {}
        self._lock = threading.Lock()
        self.lie_calls = 0

    def _cache_key(self, products: str, decomp: str) -> str:
        return hashlib.sha256(
            f"{self._group_rank}|{products}|{decomp}".encode()).hexdigest()

    def _tensor_step(self, products: str, decomp: str, deadline: float) -> str:
        key = self._cache_key(products, decomp)
        with self._lock:
            cached = self._step_memo.get(key)
        if cached is not None:
            return cached
        cached = self._cache_get(key)
        if cached is not None:
            with self._lock:
                self._step_memo[key] = cached
            return cached
        remaining = deadline - time.time()
        if remaining <= 0:
            raise self._timeout_error("lie chain wall-clock cutoff")
        lcode = (f"maxnodes 9999999 \n res=tensor({products},{decomp},"
                 f"{self._group_rank});\nprint(res);")
        try:
            with self._lock:
                self.lie_calls += 1
            out = self._lie_runner(
                lcode, min(self._lie_timeout, remaining))[53:].strip()
            out = out.replace("\n", "").replace(" ", "")
        except subprocess.TimeoutExpired:
            raise self._timeout_error("lie subprocess timeout")
        if 'line' in out:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise self._timeout_error("lie chain wall-clock cutoff")
            lcode = (f"maxobjects 9999999 \n maxnodes 9999999 \n res=tensor("
                     f"{products},{decomp},{self._group_rank});\nprint(res);")
            try:
                with self._lock:
                    self.lie_calls += 1
                out = self._lie_runner(
                    lcode, min(self._lie_timeout, remaining))[53:].strip()
                out = out.replace("\n", "").replace(" ", "")
            except subprocess.TimeoutExpired:
                raise self._timeout_error("lie subprocess timeout")
        if out and 'X' in out and 'line' not in out:
            with self._lock:
                self._step_memo[key] = out
            self._cache_put(key, out)
        return out

    def multiplicity(self, chars: tuple, budget_s: float = None) -> int:
        """Singlet multiplicity of a product of Adams characters.

        budget_s bounds ONE projection (one LiE chain) — the same unit the
        old per-term SIGALRM (MATCH_TIMEOUT) bounded — not the whole
        theory's worth of chains."""
        if not chars:
            return 1
        with self._lock:
            memo = self._sig_memo.get(chars)
        if memo is not None:
            return memo
        if len(chars) == 1:
            species, key_vec = chars[0]
            result = first_term_singlet(self._tables.decomp(species, key_vec))
        else:
            deadline = time.time() + (budget_s if budget_s
                                      else 10 * self._lie_timeout)
            products = "1X" + str([0] * int(self._rank)).replace(" ", "")
            for species, key_vec in chars:
                decomp = self._tables.decomp(species, key_vec)
                products = self._tensor_step(products, decomp, deadline)
            result = first_term_singlet(products)
        with self._lock:
            self._sig_memo[chars] = result
        return result


# --------------------------------------------------------------------------- #
# Express-file entries (Mathematica syntax, exact rational coefficients)
# --------------------------------------------------------------------------- #
def _fmt_value(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)
    return f"({value.numerator}/{value.denominator})"


def express_entry(term: TermRecord, mult: int) -> str:
    """One Mathematica list entry for (singlet multiplicity) x (term).

    Exponents of t are written as 3-decimal reals (the old sympy path also
    delivered rounded float exponents); coefficients as exact rationals --
    Mathematica's Total then collects exact integers, which the (unchanged)
    Round[...] normalization maps to the same values as the old float path."""
    value = term.coeff * mult
    if value == 0:
        return "0"
    factors = []
    if value != 1:
        factors.append(_fmt_value(value))
    if term.milli != 0:
        factors.append(f"t^{term.milli // 1000}.{term.milli % 1000:03d}")
    if term.ypow != 0:
        factors.append("y" if term.ypow == 1 else f"y^{term.ypow}")
    for name, exp in term.fug:
        factors.append(name if exp == 1 else f"{name}^{exp}")
    if not factors:
        return "1"
    return "*".join(factors)


def process_form_output(form_path: Path, projector: SingletProjector,
                        core: int, match_timeout: float,
                        timeout_error=subprocess.TimeoutExpired):
    """Full replacement for Mathcode(): parse, project, emit express entries.

    Returns (express_str, records) where records = [(TermRecord, mult), ...].
    Terms needing LiE chains are projected on a small thread pool (the
    subprocess wait releases the GIL); everything else is a dict lookup.

    match_timeout bounds each individual projection chain (mirroring the old
    per-term SIGALRM), NOT the whole call: a cold-cache theory legitimately
    spends many minutes across thousands of cached-forever chains."""
    terms = parse_form_file(form_path)

    unique_chars = {t.chars for t in terms if t.chars}
    multi = [c for c in unique_chars if len(c) >= 2]
    if multi:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max(1, core)) as pool:
            futures = [pool.submit(projector.multiplicity, c, match_timeout)
                       for c in multi]
            for fut in futures:
                fut.result()

    records = [(term, projector.multiplicity(term.chars, match_timeout))
               for term in terms]
    express = "{" + ",".join(express_entry(t, m) for t, m in records) + "}"
    return express, records
