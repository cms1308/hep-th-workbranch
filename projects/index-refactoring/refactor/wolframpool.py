"""Persistent Wolfram kernel pool (second extension, step 18).

Replaces the per-call `wolframscript -code mcode` spawn (~1.2 s
startup/license tax, three calls per theory) with a pool of long-lived
`WolframKernel -noprompt` processes whose per-call stdout is
byte-equivalent to wolframscript's:

- the kernel session is initialized with
  `SetOptions[$Output, FormatType -> OutputForm, PageWidth -> Infinity]`
  (raw -noprompt prints in InputForm and wraps at 78 columns, unlike
  wolframscript) and `$HistoryLength = 0`;
- each mcode travels base64-encoded and is evaluated as ONE suppressed
  statement `ClearAll["Global`*"]; ToExpression[ByteArrayToString[
  BaseDecode["…"]]];` — Print side effects flow to stdout exactly as
  under wolframscript, intermediate expression values stay unechoed, and
  ClearAll isolates evaluations (all three pipeline mcodes are
  self-contained scripts ending in Print, overall value Null);
- a sentinel integer Print delimits the call; the returned text appends
  the `Null\n` value-echo wolframscript emits for a Null-valued code, so
  callers' `.replace("Null", "")` parsing is byte-compatible;
- a timeout kills the process group and raises subprocess.TimeoutExpired
  (the callers' contract); a died kernel returns its partial output like
  a crashed wolframscript and is respawned on the next borrow; a forked
  child abandons inherited kernels and spawns its own.
"""

from __future__ import annotations

import base64
import os
import select
import signal
import subprocess
import threading
import time

DEFAULT_KERNEL_BIN = "/Applications/Mathematica.app/Contents/MacOS/WolframKernel"
SENTINEL_BASE = 192837465 * 10**6
READ_CHUNK = 1 << 16
POLL_S = 1.0
INIT_CODE = ('SetOptions[$Output, FormatType -> OutputForm, '
             'PageWidth -> Infinity]; $HistoryLength = 0;\n')


class _WolframProc:
    """One live kernel with sentinel-framed request/response."""

    def __init__(self, kernel_bin: str):
        self.proc = subprocess.Popen(
            [kernel_bin, "-noprompt"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, bufsize=0,
            start_new_session=True,
        )
        self.counter = 0
        self.proc.stdin.write(INIT_CODE.encode())
        self.proc.stdin.flush()

    def alive(self) -> bool:
        return self.proc.poll() is None

    def kill(self) -> None:
        try:
            os.killpg(self.proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass

    def run(self, mcode: str, timeout: float) -> str:
        self.counter += 1
        sentinel = str(SENTINEL_BASE + self.counter)
        b64 = base64.b64encode(mcode.encode()).decode()
        payload = (f'ClearAll["Global`*"]; ToExpression[ByteArrayToString['
                   f'BaseDecode["{b64}"]]];\nPrint[{sentinel}]\n').encode()
        self.proc.stdin.write(payload)
        self.proc.stdin.flush()
        deadline = time.time() + timeout
        fd = self.proc.stdout.fileno()
        buf = b""
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                self.kill()
                raise subprocess.TimeoutExpired("WolframKernel", timeout)
            ready, _, _ = select.select([fd], [], [], min(remaining, POLL_S))
            if not ready:
                continue
            chunk = os.read(fd, READ_CHUNK)
            if not chunk:  # kernel died -> crashed-wolframscript parity
                return buf.decode(errors="replace")
            buf += chunk
            lines = buf.decode(errors="replace").split("\n")
            for i, line in enumerate(lines):
                if line.strip() == sentinel:
                    head = "\n".join(lines[:i]) + ("\n" if i else "")
                    return head + "Null\n"


class WolframKernelPool:
    """Thread-safe pool of at most `size` live kernels.

    `run(mcode, timeout)` returns wolframscript-equivalent stdout text."""

    def __init__(self, size: int, kernel_bin: str | None = None):
        self._kernel_bin = (kernel_bin or
                            os.environ.get("V2_WOLFRAM_BIN",
                                           DEFAULT_KERNEL_BIN))
        self._lock = threading.Lock()
        self._sem = threading.Semaphore(size)
        self._idle: list[_WolframProc] = []
        self._pid = os.getpid()
        self.calls = 0
        self.spawns = 0

    def _borrow(self) -> _WolframProc:
        self._sem.acquire()
        with self._lock:
            if os.getpid() != self._pid:  # forked child: parent's kernels
                self._idle.clear()        # are not ours to use or kill
                self._pid = os.getpid()
            proc = self._idle.pop() if self._idle else None
        if proc is None or not proc.alive():
            proc = _WolframProc(self._kernel_bin)
            with self._lock:
                self.spawns += 1
        return proc

    def _release(self, proc: _WolframProc, broken: bool) -> None:
        with self._lock:
            if not broken and proc.alive():
                self._idle.append(proc)
        self._sem.release()

    def run(self, mcode: str, timeout: float) -> str:
        proc = self._borrow()
        broken = False
        with self._lock:
            self.calls += 1
        try:
            try:
                out = proc.run(mcode, timeout)
            except Exception:
                broken = True
                proc.kill()
                raise
            if not proc.alive():
                broken = True
            return out
        finally:
            self._release(proc, broken)

    def close(self) -> None:
        with self._lock:
            procs, self._idle = self._idle, []
        for proc in procs:
            proc.kill()

    def stats(self) -> dict:
        with self._lock:
            return {"calls": self.calls, "spawns": self.spawns,
                    "idle": len(self._idle)}
