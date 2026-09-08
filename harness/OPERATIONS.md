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

Stop hooks flush the same queue as a fallback. SessionStart reminds the agent about
pending jobs. Both providers use the same Node entry point and discover the harness by
walking up from cwd, so nested project repositories work too. The explicit end-of-turn
flush is required because hooks can be disabled, untrusted, interrupted or unavailable.
Check `.harness-local/checkpoints.jsonl` for separate commit/push outcomes. Logs and queues
are local and gitignored. Hook changes may require a new session and app trust review.
Do not alter the app's trust records or bypass its review.

## Multiple computers and sessions

Commit and push on the machine that produced a change. On the other machine fetch the
harness and the selected project, inspect ahead/behind and offer fast-forward pull.
Do not automatically pull or merge into active research work. Each project is a separate
Git repository; pulling this harness does not update its project files. Prefer one
writer per project at a time. Local locks prevent simultaneous checkpoints on one host;
they cannot lock another computer. A rejected push is the signal to reconcile changes.

## Validation

`node --test tests/*.test.mjs` runs local integration tests using temporary repositories
and bare remotes, without sending research files anywhere. `node harness/cli.mjs check`
checks state structure, links, open verification criteria and paper-review coverage.
The cross-platform CI matrix runs the same tests on macOS and Windows (also Linux).
Scientific truth and paper style still need the workflow's human/model review.

Hook schemas verified 2026-09-08 against the [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks)
and [Claude Code hooks reference](https://code.claude.com/docs/en/hooks).
