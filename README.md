# hep-th research harness

A file-based research workflow for Claude Code and Codex on macOS and Windows.
Shared policy is in [harness/PROTOCOL.md](harness/PROTOCOL.md); shared skills are in
`harness/skills/`. Provider adapters are generated, so a workflow fix reaches both apps.

Prerequisites: Node.js 18+ and Git on the app's PATH. No npm dependencies.

```
node harness/cli.mjs paths
node harness/sync.mjs --check
node --test tests/harness.test.mjs
```

The wiki is a sibling folder containing `Index.md` and `wiki/`. It is read-only from
here. This works without user/drive-specific paths. Resolve ambiguity with a local
`HEP_WIKI_DIR` override. See [operations](harness/OPERATIONS.md) for hook installation,
multiple computers and checkpoint commands.

## Research lifecycle

`/new-project` or `/import-project` → `/solve` → `/paper` or `/report` →
`/revise`, `/proofread`, `/cite-check`. `/pause` records WIP; `/resume-project` resumes.
Interaction is Korean; artifacts are English unless the project/user specifies otherwise.

For automatic calls, use `/auto-calculate <slug>` in Claude, then `/auto-paper <slug>`
in GPT/Codex after calculation handoff. The lead conversation invokes the other CLI
for report-only reviews and handles corrections. See [automatic calls](harness/AUTOMATION.md)
for configuration, status, recovery and limitations. The standalone `/research-review`
skill still reviews in the current session without switching or dispatching models.

Each project is a separate Git repository under `projects/` (gitignored by this repo):

| File | Purpose |
|---|---|
| PROJECT.md | Problem, references and conventions |
| STATE.md | Short current phase, one next action and required-reading links |
| PLAN.md | Full checklist and predeclared verification criteria |
| RESULTS.md | Scoped results, stable R/N IDs, dependencies and evidence |
| DECISIONS.md | Current standing decisions |
| HISTORY.md | Past decisions and state records |
| OPEN-QUESTIONS.md | Detailed blockers, failed approaches and gotchas |
| notes/, calc/ | Derivations and rerunnable calculations |
| paper/ | LaTeX, PUNCHLINES, CITATIONS and REVIEW.json |

See [memory rules](harness/MEMORY.md), [evidence records](harness/EVIDENCE.md),
[paper review tracking](harness/PAPER-REVIEW.md), and [model/workflow evaluations](evals/README.md).
`PAPER-STYLE.md` remains the shared writing guide; project-specific rules live in DECISIONS.

## Saving work

Queue only files changed by the task, then flush. The same queue is flushed by Stop
hooks as a fallback. Failures are visible and recorded; no automatic pull or force push.

```
node harness/cli.mjs queue . "Update harness" README.md
node harness/cli.mjs flush
```

Nested projects are queued separately with repository-relative paths. Unrelated dirty
files are preserved. A repository without upstream is committed locally and reported
as not backed up remotely. Inspect `.harness-local/checkpoints.jsonl` for the outcome.

## Updating the shared workflow

Edit `harness/skills/*/SKILL.md` or `harness/PROTOCOL.md`. Then run:

```
node harness/sync.mjs
node harness/install-hooks.mjs
node harness/sync.mjs --check
node --test tests/harness.test.mjs
node harness/cli.mjs check
```

Hook installation preserves unrelated settings/hooks. New hook definitions may need
app trust review and a new session. Explicit checkpoint commands remain available.
The test matrix runs on Windows, macOS and Linux; native scientific toolchains remain
project-specific. Pulling the harness does not pull the individual research repositories.
