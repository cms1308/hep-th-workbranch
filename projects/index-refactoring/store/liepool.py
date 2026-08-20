"""Persistent LiE REPL pool (second extension, step 17).

Replaces the per-call `lie` subprocess spawn with a pool of long-lived LiE
processes, as a drop-in `lie_runner(lcode, timeout) -> str` for BOTH call
sites (store.charstore.CharStore and refactor.fastmatch.SingletProjector).

Framing parity with the one-shot runner: LiE prints no startup banner when
piped — the 53-byte prefix the callers slice off is the RESPONSE to the
`maxnodes 9999999` command they all send first, and `maxobjects` prints
nothing (established in step 4). Since every caller re-sends its full
preamble on every call, replaying the same lcode into a live session
produces byte-identical stdout to a fresh process; each call is delimited
by a sentinel integer expression whose echo marks end-of-output.

Failure parity: a timeout kills the process group and raises
subprocess.TimeoutExpired (what both callers catch); a died process (EOF)
returns the partial output, exactly like the one-shot communicate() —
callers' validation/retry logic handles it — and is respawned on the next
borrow. A forked child abandons inherited processes (they belong to the
parent) and spawns its own.
"""

from __future__ import annotations

import os
import select
import signal
import subprocess
import threading
import time

SENTINEL_BASE = 987654321 * 10**6   # never a plausible LiE output line
READ_CHUNK = 1 << 16
POLL_S = 1.0


class _LieProc:
    """One live LiE process with sentinel-framed request/response."""

    def __init__(self):
        self.proc = subprocess.Popen(
            ["lie"], shell=True,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, bufsize=0,
            start_new_session=True,
        )
        self.counter = 0

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

    def run(self, lcode: str, timeout: float) -> str:
        self.counter += 1
        sentinel = str(SENTINEL_BASE + self.counter)
        payload = (lcode.rstrip("\n") + f"\n {sentinel}\n").encode()
        self.proc.stdin.write(payload)
        self.proc.stdin.flush()
        deadline = time.time() + timeout
        fd = self.proc.stdout.fileno()
        buf = b""
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                self.kill()
                raise subprocess.TimeoutExpired("lie", timeout)
            ready, _, _ = select.select([fd], [], [], min(remaining, POLL_S))
            if not ready:
                continue
            chunk = os.read(fd, READ_CHUNK)
            if not chunk:  # EOF: process died -> one-shot parity (partial out)
                return buf.decode(errors="replace")
            buf += chunk
            lines = buf.decode(errors="replace").split("\n")
            for i, line in enumerate(lines):
                if line.strip() == sentinel:
                    return "\n".join(lines[:i]) + ("\n" if i else "")


class LieREPLPool:
    """Thread-safe pool of at most `size` live LiE processes.

    `run(lcode, timeout)` is signature-compatible with the one-shot
    run_lie of store.charstore / refactor.fastmatch."""

    def __init__(self, size: int):
        self._lock = threading.Lock()
        self._sem = threading.Semaphore(size)
        self._idle: list[_LieProc] = []
        self._pid = os.getpid()
        self.calls = 0
        self.spawns = 0

    def _borrow(self) -> _LieProc:
        self._sem.acquire()
        with self._lock:
            if os.getpid() != self._pid:  # forked child: parent's procs
                self._idle.clear()        # are not ours to use or kill
                self._pid = os.getpid()
            proc = self._idle.pop() if self._idle else None
        if proc is None or not proc.alive():
            proc = _LieProc()
            with self._lock:
                self.spawns += 1
        return proc

    def _release(self, proc: _LieProc, broken: bool) -> None:
        with self._lock:
            if not broken and proc.alive():
                self._idle.append(proc)
        self._sem.release()

    def run(self, lcode: str, timeout: float) -> str:
        proc = self._borrow()
        broken = False
        with self._lock:
            self.calls += 1
        try:
            try:
                out = proc.run(lcode, timeout)
            except Exception:
                broken = True  # timeout already killed it; be safe otherwise
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
