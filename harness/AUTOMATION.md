# Conversation-led model calls

Use `/auto-calculate <slug>` in Claude for calculations with Codex review, then
`/auto-paper <slug>` in Codex for writing with Claude review. These shared skills
drive the loop in the active conversation; the CLI dispatches one review at a time.
If a new skill is not discovered until app restart, explicitly read its shared
`harness/skills/<name>/SKILL.md`. No desktop chat is created or switched automatically.

```
node harness/cli.mjs review-request example --target plan --reviewer codex
node harness/cli.mjs review-request example --target step-3 --reviewer codex
node harness/cli.mjs review-request example --target paper --reviewer claude
node harness/cli.mjs review-status example
node harness/cli.mjs review-resume example <run-id>
```

An optional `--model` selects an exact provider model. Otherwise provider defaults
apply; requested model and provider session IDs are recorded, and unknown actual
model identity must not be invented. CLI authentication is reused. Install/login
through each provider's normal flow. `HEP_CODEX_BIN` and `HEP_CLAUDE_BIN` can specify
executable paths locally, without arguments. Native ~/.local/bin installations are
detected before PATH. Windows requires a native executable (not a .cmd shim).
No credentials or machine paths belong in tracked configuration.

## Review contract

The launcher writes prompt, schema, stdout, stderr and run metadata under the
gitignored `.harness-local/reviews/<slug>/<run-id>/`. A per-project exclusive lock
prevents overlapping calls through this launcher; it does not lock other apps or
computers. The lead must stop editing while the reviewer runs. CLI calls are made
without a shell, and child dispatch is refused through HEP_REVIEW_CHILD.

Review children are report-only. Codex uses its read-only sandbox; Claude is given
only Read/Glob/Grep/WebFetch/WebSearch with dontAsk permission mode. Existing provider
hooks/configuration still apply; this is not isolation from trusted local hooks.
Reviewers do not run project scripts, checkpoint, alter manuscript/state files or
launch other agents. The dispatch prompt overrides those write steps in the normal
review skills: the lead records the returned report. An independent derivation or
source comparison is still required. If executable verification is needed, return
inconclusive and describe it; arrange a separate EVIDENCE-compliant review before
resuming. Restricted tools may leave work inconclusive, never silently approved.

Accept a result only when state is completed, review-status reports current, and
the scoped verdict supports the next action. A successful process exit alone is
insufficient. Missing JSON, provider errors, empty reports, ready with blockers or
without checks, and changed project inputs fail acceptance. Hashes cover tracked
and nonignored untracked project files plus HEAD; ignored external data/wiki changes
are not covered and must be recorded by the reviewer when relevant. Snapshot metadata
is not a substitute for reading and checking the evidence.

Before recording new project changes, inspect status and preserve the full report,
snapshot, run ID, provider and session ID in a new project review note. Update STATE,
RESULTS and OPEN-QUESTIONS as appropriate and checkpoint using OPERATIONS. This
recording itself changes the snapshot; retain the accepted version in the note and
distinguish bookkeeping from later substantive changes. Any changed reviewed
calculation or manuscript requires re-review. No automatic physical-claim upgrades
or paper attestations are performed by the launcher.

## Recovery

review-resume is a read-only recovery inspection: it returns the saved result and
currentness, never launches a duplicate request. Completed results can be recorded;
failed results must be diagnosed before a new request. Running results must be
waited on using the original process/session. There is no automatic timeout or retry;
the lead monitors progress and may interrupt a stuck process through its host tools.

After abrupt process/app termination, a running record or active.lock may remain.
Inspect the recorded parent/child PIDs and original session, including descendants,
before concluding the run stopped. Do not remove a live lock or start a competing
review. After confirming termination, preserve the interrupted record, remove only
that project's active.lock, and request a new review if needed. Interrupted results
are never accepted as completed. Logs may contain research material and are local.

The lead enforces a default maximum of three correction rounds per target, recorded
in STATE and review notes. Inconclusive results, missing sources, approval-dependent
research choices and usage/authentication errors stop the loop with a clear next
action. CLI availability does not imply usable authentication or remaining quota.

Provider interfaces: [Codex](https://learn.chatgpt.com/docs/non-interactive-mode),
[Claude Code](https://code.claude.com/docs/en/headless). The test suite uses fake
providers and does not spend model usage. A live smoke review is a separate check.

Validation on 2026-09-10: the 27-test local suite passed on Windows, both skill
adapters validated and synchronized, and both authenticated native CLIs returned
accepted structured reviews for an isolated integer-addition fixture. This checks
dispatch and parsing, not research-review quality. The first Codex smoke attempt
correctly failed because the temporary harness root was not a Git repository;
the fixture was initialized as a repository and the retry passed without bypass flags.
