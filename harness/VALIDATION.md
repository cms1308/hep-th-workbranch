# Validation — 2026-09-08

Implemented the six approved changes: visible scoped checkpoints, shared cross-platform
workflows, compact project memory, evidence manifests, review invalidation and regression
evaluation cases. Existing mathematical claims were not recalculated or upgraded.

- Windows / Node v24.19.0: 16 integration tests passed (`node --test tests/harness.test.mjs`).
- Tests use disposable local Git repositories and bare remotes. They cover push rejection,
  separate commit/push outcomes, exact file scope, user staging, changed queued files,
  local-only repositories, deletions, live locks and nested project repositories.
- Paper tests cover included TeX files, stable IDs across moves, edited claims, partial
  citation coverage and bibliography-only invalidation. A CURRENT review remains distinct
  from a correct physical claim or a resolved attribution finding.
- Evidence tests preserve failed-run manifests and propagate a failing CLI exit code.
- Migration tests preserve original bytes and each full section, and reject repeat migration.
- All 10 shared skills passed skill-creator's quick validator; 20 generated adapters
  resolve to the shared sources and `sync --check` passes.
- PowerShell and Git Bash successfully invoked the actual shared hook from nested
  directories; the automated shell test also uses spaces and Korean characters in paths.
- All five existing projects migrated to 45-line STATE files. Original-byte hashes and
  every source section were checked against their destination files. Result IDs, formulas,
  caveats and historical decisions remain preserved. Some legacy decision blocks still
  contain chronological explanations, explicitly labelled for task-specific review.
- Read-only paper checks report legacy review coverage UNREVIEWED (67/47/117 source
  blocks in the three manuscripts); no old ledger was falsely certified. The existing
  manuscripts and citation ledgers were not rewritten during adoption.
- Eight sanitized workflow-evaluation cases and a package/grading tool are available.
  No paid model comparison or fresh physics benchmark was run.

An independent skill forward-test found seven concrete issues (compile cwd, included
citation scope, duplicate ledger schema, partial citation attestation, bibliography
invalidation, failed-run exit and push-outcome logging). All seven were fixed and the
reviewer confirmed the corrections.

Native macOS was unavailable in this session. The same tests are configured in CI on
macOS, Windows and Linux with Node 22; those remote runs are not claimed as completed
here. Hook definitions may need app trust review and a new session; explicit queue/flush
remains the required end-of-turn path and was designed not to depend on hook delivery.
