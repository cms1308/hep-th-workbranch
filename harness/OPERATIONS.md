# Running on macOS and Windows

Prerequisites: Node.js 18 or newer and Git, available to the app on PATH. No npm install
is needed. Research scripts continue to use each project's scientific environment.
Run `node harness/cli.mjs paths` from the harness root to verify runtime and wiki lookup.
The wiki is the sibling directory containing both `Index.md` and `wiki/`, independently
of its name, user name or drive. If more than one sibling qualifies, set `HEP_WIKI_DIR`
locally; do not commit a machine-specific absolute path. The wiki remains read-only.

Shared policy: `harness/PROTOCOL.md`; shared skill sources: `harness/skills/*/SKILL.md`.
`AGENTS.md`, `CLAUDE.md` and both provider skill directories are generated adapters.
After changing shared skill sources, run `node harness/sync.mjs`, then
`node harness/sync.mjs --check`. Never hand-edit one provider's copy only.

## Checkpointing

At the end of every turn with edits, list and inspect the actual changes. Queue only
the task's files in each affected repository (paths are relative to that repository):

```
node harness/cli.mjs queue . "Update research workflows" harness/PROTOCOL.md README.md
node harness/cli.mjs queue projects/example "Record step 3" STATE.md RESULTS.md PLAN.md notes/03-example.md
node harness/cli.mjs flush
```

The queue records file hashes. A later change, unrelated staged file, merge/rebase in
progress, detached HEAD, or repository escape prevents that checkpoint. Jobs remain
pending on failure, including failed pushes. Resolve the reported cause before retrying.
To replace an obsolete job, inspect the specific JSON under `.harness-local/pending/`,
remove only that job, and requeue the reviewed files. Never delete another session's job.
No recursive staging across `projects/`, no pull/rebase/force push, and no remote guess.
Existing user changes outside the queued paths are left alone. Missing upstream means
local commit only, reported as `no-upstream`; it is not successful remote backup.
Queueing a `.tex` file under a `paper*` directory also prints, on stderr and in the
returned job, a reminder to read the complete manuscript before reporting
([PAPER-REVIEW](PAPER-REVIEW.md#judge-every-sentence)); it is a reminder, not a gate.

Stop hooks flush the same queue as a fallback. SessionStart reminds the agent about
pending jobs. Both providers use the same Node entry point and discover the harness by
walking up from cwd, so nested project repositories work too. The explicit end-of-turn
flush is required because hooks can be disabled, untrusted, interrupted or unavailable.
Check `.harness-local/checkpoints.jsonl` for separate commit/push outcomes. Logs and queues
are local and gitignored. Hook changes may require a new session and app trust review.
Do not alter the app's trust records or bypass its review.

## Manuscript verification gate

This applies only to an enrolled manuscript, a `paper*` directory holding `VERIFY.json`
([PAPER-REVIEW](PAPER-REVIEW.md#verification-gate)).

**Which session changed it.** `PreToolUse` and `PostToolUse` hooks on the shell and
editing tools record their findings under `.harness-local/verify-sessions/<session>/`. A
session has changed a manuscript when the sources differ across one of that session's own
tool calls and a tool input of the session has named the manuscript (its path, or the
project slug together with the paper directory, which covers a script written earlier and
run later). A call that failed and reported no end is compared at Stop. A session working
on something else is never held to account, even when the change fell inside one of its
long calls. One false attribution remains: a session that has named the manuscript, for
example by reading it through the shell, and has a call running at the moment another
session edits it.

**Stop.** A session that changed the manuscript must leave it verified (`paper-verify`
complete for the current text, rules, lexicon and facts, which since stage 3 includes the
independent verdicts of `paper-judge`) or declared work in progress
(`paper-verify <slug> [paper-dir] --wip "<reason>"`, which records and prints the
unverified units for the report to the user). Otherwise the hook answers
`{"decision": "block", "reason": ...}` and the turn continues. One text is blocked at most
three times and is then released with a warning shown to the user, so the hook cannot
loop without end. A declaration holds for the text it was made for.

**Not installed yet (2026-11-25).** `node harness/install-hooks.mjs` adds the two tool
events to `.claude/settings.json` and `.codex/hooks.json` (matcher
`Bash|Edit|Write|MultiEdit|apply_patch`). This has not been run on this repository: it
changes the hook configuration of every session, costs one short Node process before and
after each shell or editing call, and needs the app's trust review, so it waits for the
user's word. Until then no session is blocked. With no manuscript enrolled the hooks do
nothing.

**Corpus.** The term check reads `.harness-local/corpus.json`, built by
`node harness/cli.mjs corpus-build` from the wiki sources, which it only reads. The file is
local and gitignored, about 20 MB for 277 papers, and takes a few seconds to build. Build
it on each computer, and again after papers are added to the wiki or when a term fails for
want of a paper that has since passed the two-year cutoff. An older corpus is only stricter,
never more lenient, as long as no source was removed. A corpus built by another version of
the extraction is not used. Without a corpus the term check is not judged, so the
verification of an enrolled manuscript is incomplete.

**Judges.** `node harness/cli.mjs paper-judge <slug> [paper-dir] --writer <claude|codex>`
launches the other vendor's CLI once for each question, through the launcher of
[AUTOMATION](AUTOMATION.md) (`HEP_CODEX_BIN`, `HEP_CLAUDE_BIN`, no shell, no nested
dispatch). A call runs in an empty temporary directory outside every repository, so no
project instruction file or hook is loaded. Codex runs with its read-only sandbox and
without a stored session, Claude without tools. Each call uses the provider's default
model and settings unless `--model` names one. Run `--dry-run` first: a whole draft is
about two calls for each sentence and each of the two judges, and the planted texts of a
run (14 calls when every family is asked) come before them. Run long jobs in the
background and keep the computer awake. A run that is cut short keeps the answers it
recorded, and the next run asks only what is still open. One run at a time for each
manuscript (`active.lock` in its record directory, released when its process has ended).

**Run records.** `.harness-local/verdicts/<slug>/<paper-dir>/` holds `seal.json` (the hash
of the `VERIFY.json` the CLI last wrote, and the declared writer) and one directory for
each run of the judges. They are local and gitignored, like the corpus. On another
computer, or after `VERIFY.json` was changed by anything but the CLI, the manuscript
counts as unverified: `paper-verify` there judges the code checks again in seconds, and
the independent verdicts have to be asked again because their records are absent. Do not
edit or delete these records. A verdict is disputed by changing the text or by taking it
to the user, never by removing the run that gave it.

**Commits.** `queue` appends `Manuscript-Verification: incomplete (<directory>)` to the
commit message when a queued TeX file belongs to an enrolled manuscript that is not
verified. Such commits are allowed and marked, with or without the hooks. Queue
`VERIFY.json` with the manuscript.

The provider documentation was read through a summarizing fetch on 2026-11-25: both
describe `PreToolUse`, `PostToolUse` with `session_id`, `tool_name` and `tool_input`, and
a Stop hook that blocks with `decision` and `reason` (Claude Code with a cap of eight
consecutive continuations, Codex without a stated cap). The gate has been run through the
configured hook command with simulated events. It has not yet blocked a live session of
either provider.

## Multiple computers and sessions

Commit and push on the machine that produced a change. On the other machine fetch the
harness and the selected project, inspect ahead/behind and offer fast-forward pull.
Do not automatically pull or merge into active research work. Each project is a separate
Git repository; pulling this harness does not update its project files. Prefer one
writer per project at a time. Local locks prevent simultaneous checkpoints on one host;
they cannot lock another computer. A rejected push is the signal to reconcile changes.

## Validation

`node --test tests/*.test.mjs` runs local integration tests using temporary repositories
and bare remotes, without sending research files anywhere. `tests/verify.test.mjs` covers
the verification gate on fixture manuscripts, with the build and the corpus injected, and
the corpus build on a fixture vault. `tests/judge.test.mjs` covers the independent
verdicts with an injected judge (`tests/judges.mjs`) and calls no model. `node harness/cli.mjs check`
checks state structure, links, open verification criteria and any existing paper-review
tracking. Paper tracking findings are advisory; an ordinary draft needs no review tracker.
The cross-platform CI matrix runs the same tests on macOS and Windows (also Linux).
Scientific truth and paper style still need the workflow's human/model review.

Hook schemas verified 2026-09-08 against the [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks)
and [Claude Code hooks reference](https://code.claude.com/docs/en/hooks).
