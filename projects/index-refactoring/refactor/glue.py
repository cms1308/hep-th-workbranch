"""Overlay wiring the refactored index pipeline into the landscape module.

Usage (appended at the end of the landscape module file):

    import sys as _sys
    _sys.path.insert(0, "<absolute path to projects/index-refactoring>")
    from refactor.glue import install as _v2_install
    _v2_install(globals())

install() rebinds the module-level names `decouple` and `Index` (the two
entry points of the index post-processing that charges2 calls) to versions
that use the structured FORM-output parser (fastmatch) instead of the sympy
Mathcode/match path, the F3/F4-fixed Mathematica generators (mcode_v2), and
the C1'/C3/C4 scan (conditions).  Everything else in the module -- charge
determination, FORM invocation, orchestration -- is untouched; the routing
of the new verdicts ('free sector', extended 'inconsistent (...)' strings,
SUSYenhanced) needs three small edits inside charges2, applied as textual
patches by the step-8 harness (see calc/08_refactor.py PATCHES_V2).

Optional: setting the environment variable V2_TIMINGS=1 wraps form() and the
pipeline phases with wall-clock timers logged to ./v2_timings.jsonl.
Condition-scan results are always appended to ./v2_scanlog.jsonl.

Optional (step 13): V2_CHARSTORE=<path to charstore_<GROUP_RANK>.sqlite>
replaces BOTH character-data sources with the self-bootstrapping store
(store/charstore.py): the arxiv/ table files (tables object) and the
MySQL/stub LieCache (cache hooks). A key missing from the store is computed
on the spot via LiE and persisted. Unset -> the original wiring below.

Optional (step 16): V2_TFORM=<workers> rebinds form() to run the PE
expansion with TFORM (`tform -w<workers> -q`) instead of sequential FORM;
makefrm and the output-string surgery are the module's own, reused
verbatim. Unset -> the module's form() untouched.

Optional (step 17): V2_LIEREPL=<pool size> serves every LiE evaluation
(SingletProjector chains AND CharStore generation) from a pool of
long-lived LiE REPL processes (store/liepool.py) instead of one subprocess
spawn per call. Unset -> per-call spawns as before.

Optional (step 21): V2_PREFILTER=<order> makes every full-order form()
call run a cheap low-order expansion first and scan it with the Python
mirror of the mcode C1/C2 consistency checks
(conditions.mcode_consistency_violations). On a violation — exact at the
low order, hence present verbatim at full order — the low-order FORM
output is kept and the subsequent Index() call re-derives the
'inconsistent' verdict from it via the unchanged Mathematica check, so
the theory is rejected without paying the full-order expansion; its
record then carries the LOW-ORDER index strings (user decision
2026-08-20). A prefilter hit whose Index verdict is NOT 'inconsistent'
(or is the truncation-unsound C4 vanishing-index verdict) triggers the
false-positive guard: the full-order expansion is run and Index is
redone — a Python-scan false positive can cost time, never correctness.

Optional (step 18): V2_WOLFRAM=<pool size> serves the Mathematica
evaluations from a pool of persistent WolframKernel sessions
(refactor/wolframpool.py) with wolframscript-byte-equivalent output:
the glue's own decouple/Index mcodes here, and — via the module global
_v2_wolfram_eval that install() always provides — the FindCharges mcode
inside charges2, IF the module carries the step-18 surgical patch that
routes its wolframscript call through that hook (unpatched modules and
unset env are unaffected; the hook falls back to a wolframscript spawn
with the original kill-on-timeout semantics).
"""
import ast
import json
import os
import subprocess
import threading
import time
from pathlib import Path

from . import conditions, fastmatch, mcode_v2


class LieCacheClient:
    """Thread-safe (thread-local connections) client for the LieCache table.

    Same table, same semantics as the landscape module's _lie_cache_get/put:
    MySQL in production, the harness's pymysql stub (sqlite) in replays.
    Best-effort: any failure degrades to recompute, never blocks."""

    def __init__(self, pymysql_module):
        self._pymysql = pymysql_module
        self._local = threading.local()

    def _conn(self):
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = self._pymysql.connect(
                host='localhost', user='root', password='', db='landscape',
                charset='utf8', autocommit=True,
            )
            with conn.cursor() as cur:
                cur.execute(
                    "CREATE TABLE IF NOT EXISTS `LieCache` ("
                    "`ckey` CHAR(64) NOT NULL PRIMARY KEY, "
                    "`result` MEDIUMTEXT NOT NULL) "
                    "ENGINE=InnoDB DEFAULT CHARSET=utf8"
                )
            self._local.conn = conn
        return conn

    def get(self, key):
        try:
            conn = self._conn()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT `result` FROM `LieCache` WHERE `ckey`=%s", (key,))
                row = cur.fetchone()
            return row[0] if row else None
        except Exception:
            self._local.conn = None
            return None

    def put(self, key, result):
        try:
            conn = self._conn()
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT IGNORE INTO `LieCache` (`ckey`,`result`) "
                    "VALUES (%s,%s)", (key, result))
        except Exception:
            self._local.conn = None


def _vars_list(rlist):
    """Fugacity name list -- copied from the old decouple()/Index()."""
    vars_list = ["t", "y"]
    u1 = []
    for item in rlist:
        for j in range(len(item[1])):
            vars_list.append(f"{item[0]}{j + 1}")
        if item[2]:
            u1.append(len(item[2][0]))
    if u1:
        for i in range(max(u1)):
            vars_list.append(f"g{i + 1}")
    return vars_list


def _jsonable(flags):
    return {k: (v if isinstance(v, bool) else [list(x) for x in v])
            for k, v in flags.items()}


class Engine:
    def __init__(self, g):
        self._g = g
        self._frm_dir = Path(g['FRM_DIR'])
        self._user_dir = g['USER_DIR']
        self._core = g['CORE']
        self._match_timeout = g['MATCH_TIMEOUT']
        self._timeout_error = g['MatchTimeoutError']
        self._timings = bool(os.environ.get("V2_TIMINGS"))
        pre = os.environ.get("V2_PREFILTER")
        self._prefilter_order = int(pre) if pre else None
        self._prefilter_hits = {}
        self._inner_form = None  # set by install() when prefiltering
        wolfram_size = os.environ.get("V2_WOLFRAM")
        if wolfram_size:
            from .wolframpool import WolframKernelPool
            self.wolframpool = WolframKernelPool(int(wolfram_size))
        else:
            self.wolframpool = None
        repl_size = os.environ.get("V2_LIEREPL")
        if repl_size:
            from store.liepool import LieREPLPool
            self.liepool = LieREPLPool(int(repl_size))
            lie_runner = self.liepool.run
        else:
            self.liepool = None
            lie_runner = None
        store_path = os.environ.get("V2_CHARSTORE")
        if store_path:
            from store.charstore import CharStore
            kwargs = {"lie_runner": lie_runner} if lie_runner else {}
            self.charstore = CharStore(store_path, g['GROUP_RANK'],
                                       lie_timeout=g['LIE_TIMEOUT'],
                                       **kwargs)
            tables = self.charstore
            cache_get, cache_put = (self.charstore.cache_get,
                                    self.charstore.cache_put)
        else:
            self.charstore = None
            tables = fastmatch.CharacterTables(g['ARXIV_DIR'])
            cache = LieCacheClient(g['pymysql'])
            cache_get, cache_put = cache.get, cache.put
        self._projector = fastmatch.SingletProjector(
            tables=tables, group_rank=g['GROUP_RANK'], rank=g['RANK'],
            lie_timeout=g['LIE_TIMEOUT'],
            cache_get=cache_get, cache_put=cache_put,
            timeout_error=self._timeout_error,
            lie_runner=lie_runner,
        )

    # ------------------------------------------------------------------ #
    def _log(self, fname, record):
        try:
            with open(Path.cwd() / fname, "a") as f:
                f.write(json.dumps(record) + "\n")
        except Exception:
            pass

    def _run_fastmatch(self, pid):
        t0 = time.time()
        express, records = fastmatch.process_form_output(
            self._frm_dir / f"form{pid}.txt", self._projector,
            self._core, self._match_timeout, self._timeout_error)
        return express, records, time.time() - t0

    def _run_wolfram(self, mcode):
        t0 = time.time()
        if self.wolframpool is not None:
            stdout = self.wolframpool.run(mcode, 3600)
        else:
            stdout = subprocess.run(['wolframscript', '-code', mcode],
                                    capture_output=True, text=True).stdout
        parsed = ast.literal_eval(
            stdout.replace("Null", "").strip().replace(" ", ""))
        return parsed, time.time() - t0

    def _cleanup(self, pid):
        for ext in ["express", "index", "form"]:
            p = (self._frm_dir / f"{ext}{pid}.txt" if ext != "index"
                 else self._frm_dir / f"index{pid}.frm")
            if p.exists():
                p.unlink()

    # ------------------------------------------------------------------ #
    def decouple(self, t_order, n2, w2, name2, rlist):
        pid = os.getpid()
        vars_str = "{" + ", ".join(set(_vars_list(rlist))) + "}"
        express, records, dt_match = self._run_fastmatch(pid)
        (self._frm_dir / f"express{pid}.txt").write_text(express)
        mcode = mcode_v2.generate_decouple_mcode(
            pid, vars_str, t_order, w2, self._user_dir)
        result, dt_ws = self._run_wolfram(mcode)
        if self._timings:
            self._log("v2_timings.jsonl",
                      {"phase": "decouple", "t_order": t_order,
                       "fastmatch_s": round(dt_match, 3),
                       "wolfram_s": round(dt_ws, 3),
                       "terms": len(records),
                       "lie_calls": self._projector.lie_calls})
        self._cleanup(pid)
        return result

    def Index(self, t_order, w2, rlist):
        pid = os.getpid()
        result = self._index_once(pid, t_order, w2, rlist)
        pre_k = self._prefilter_hits.pop(pid, None)
        if pre_k is not None:
            verdict = str(result.get('consistency', ''))
            unsound_c4 = 'vanishing index' in verdict  # C4 needs full order
            if not verdict.startswith('inconsistent') or unsound_c4:
                # false-positive guard: redo at full order — a prefilter
                # miss may cost time, never correctness.
                self._log("v2_scanlog.jsonl",
                          {"prefilter_false_positive": True, "w2": w2,
                           "order": pre_k, "verdict": verdict})
                self._inner_form(t_order, pid, rlist)
                result = self._index_once(pid, t_order, w2, rlist)
        return result

    def _index_once(self, pid, t_order, w2, rlist):
        vars_str = "{" + ", ".join(set(_vars_list(rlist))) + "}"
        express, records, dt_match = self._run_fastmatch(pid)

        # exactness horizon of the scan = the order the data was actually
        # expanded at (the prefilter order on a prefilter hit)
        eff_order = self._prefilter_hits.get(pid, t_order)
        flags = conditions.scan(records, eff_order)
        fired = (flags["c4_vanishing"] or flags["c1prime"]
                 or flags["c3_free"] or flags["c3_enhance"]
                 or flags["noninteger"])
        self._log("v2_scanlog.jsonl",
                  {"w2": w2, "t_order": t_order, "fired": bool(fired),
                   "flags": _jsonable(flags)})

        if flags["c4_vanishing"]:
            # F2 fix: the old Index() crashed in Mathematica on a vanishing
            # reduced index (Exponent[0, y] -> Range[-Infinity, ...]).
            self._cleanup(pid)
            return {
                "consistency":
                    "inconsistent (vanishing index: possible SUSY breaking)",
                "decoupled": [], "index": "0", "fullindex": "0",
                "shortindex": "0",
                "index_flags": conditions.describe(flags),
            }

        (self._frm_dir / f"express{pid}.txt").write_text(express)
        mcode = mcode_v2.generate_index_mcode(
            pid, vars_str, t_order, w2, self._user_dir)
        result, dt_ws = self._run_wolfram(mcode)
        if self._timings:
            self._log("v2_timings.jsonl",
                      {"phase": "Index", "t_order": t_order,
                       "fastmatch_s": round(dt_match, 3),
                       "wolfram_s": round(dt_ws, 3),
                       "terms": len(records),
                       "lie_calls": self._projector.lie_calls})
        self._cleanup(pid)

        if result.get('consistency') == 'consistent':
            if flags["c3_free"]:
                # F1 fix (proven C3 form, j >= 1): higher-spin current signal
                # -> InconsistentIndex (user decision 2026-08-19: C3 takes
                # precedence when C1' fires as well; both are in the flags).
                result = result | {
                    "consistency":
                        "inconsistent (free sector: higher-spin current)",
                    "index_flags": conditions.describe(flags)}
            elif flags["c1prime"]:
                # User decision 2026-08-18: passes everything else but has a
                # free spinning boundary -> FreeSector table (charges2 patch).
                result = result | {"consistency": "free sector",
                                   "index_flags": conditions.describe(flags)}
            if (result.get('consistency') == 'consistent'
                    and flags["c3_enhance"]):
                # C3 at j = 1/2 is an enhancement signal, not an
                # inconsistency (R7); recorded in the SUSYenhanced column.
                result = result | {
                    "SUSYenhanced": "candidate (t^7 chi_1/2 supercurrent "
                                    "signal in index)"}
        return result


def _wolfram_eval_factory(engine):
    """Module-global hook for the step-18 charges2 patch: evaluate an mcode
    and return its wolframscript-equivalent stdout BYTES. Pool when
    V2_WOLFRAM is set; otherwise the original wolframscript spawn with the
    original kill-on-timeout semantics (so a patched module with the env
    unset behaves exactly like the unpatched one)."""
    def _v2_wolfram_eval(mcode, timeout):
        if engine.wolframpool is not None:
            return engine.wolframpool.run(mcode, timeout).encode()
        proc = subprocess.Popen(['wolframscript', '-code', mcode],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL)
        try:
            out, _ = proc.communicate(timeout=timeout)
            return out
        except subprocess.TimeoutExpired:
            subprocess.call(['kill', '-9', str(proc.pid)])
            raise
    return _v2_wolfram_eval


def _tform_form(g, workers):
    """form() with TFORM: same makefrm, same output surgery, same timeout
    and 'stop' semantics as the module's form() — only the binary and its
    worker count differ (step 16)."""
    frm_dir = Path(g['FRM_DIR'])
    makefrm = g['makefrm']

    def form_tform(t_order, pid, rlist):
        if makefrm(t_order, pid, rlist) == "stop":
            return "stop"
        frm_file = frm_dir / f"index{pid}.frm"
        out_file = frm_dir / f"form{pid}.txt"
        try:
            res = subprocess.run(['tform', f'-w{workers}', '-q',
                                  str(frm_file)],
                                 capture_output=True, text=True, timeout=600)
            result = (res.stdout.strip().replace("result", "")
                      .replace(" ", "").replace("=", "").replace("\n", "")
                      .replace("z", '1').replace("\\", ""))
            with open(out_file, "w+") as f:
                f.write(result[:-1])
            return "ok"
        except subprocess.TimeoutExpired:
            print("Timeout expired for FORM.")
            return "stop"

    return form_tform


def _prefilter_form(engine, inner_form):
    """form() with the step-21 low-order prefilter. Any call above the
    prefilter order first expands at the low order and scans it with the
    Python mirror of the mcode C1/C2 checks; a violation keeps the
    low-order output (Index then re-derives 'inconsistent' from it via the
    unchanged Mathematica check), a clean or failed scan falls through to
    the full-order expansion."""
    k = engine._prefilter_order

    def form_prefiltered(t_order, pid, rlist):
        if t_order <= k:
            return inner_form(t_order, pid, rlist)
        rv = inner_form(k, pid, rlist)
        if rv != "ok":
            return rv
        try:
            _, records, _ = engine._run_fastmatch(pid)
            violations = conditions.mcode_consistency_violations(records, k)
        except Exception:  # scan trouble -> full order, never a verdict
            violations = []
        if violations:
            engine._prefilter_hits[pid] = k
            engine._log("v2_scanlog.jsonl",
                        {"prefilter_hit": True, "order": k,
                         "violations": violations[:8]})
            return "ok"
        return inner_form(t_order, pid, rlist)

    return form_prefiltered


def _timed_form(orig_form):
    def form_timed(t_order, pid, rlist):
        t0 = time.time()
        rv = orig_form(t_order, pid, rlist)
        try:
            with open(Path.cwd() / "v2_timings.jsonl", "a") as f:
                f.write(json.dumps({"phase": "form", "t_order": t_order,
                                    "seconds": round(time.time() - t0, 3),
                                    "rv": rv}) + "\n")
        except Exception:
            pass
        return rv
    return form_timed


def install(g):
    engine = Engine(g)
    g['decouple'] = engine.decouple
    g['Index'] = engine.Index
    tform_workers = os.environ.get("V2_TFORM")
    if tform_workers:
        g['form'] = _tform_form(g, int(tform_workers))
    if engine._prefilter_order:
        engine._inner_form = g['form']  # full-order runner for the guard
        g['form'] = _prefilter_form(engine, g['form'])
    if os.environ.get("V2_TIMINGS"):
        g['form'] = _timed_form(g['form'])
    g['_v2_wolfram_eval'] = _wolfram_eval_factory(engine)
    g['_v2_engine'] = engine
