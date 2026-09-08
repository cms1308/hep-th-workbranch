# Reproducible evidence

Before a nontrivial calculation, copy `templates/verification.json` into
`calc/checks/<id>.json` and fill every field. `command` is an argument array, run from
the project root without a shell. Use the project's documented interpreter, not an
assumed `python` alias. Keep dependency versions in a checked-in requirements/lock
file; record OS and interpreter differences explicitly. Hash the script and relevant
inputs, not secrets or unrelated datasets. Record seeds, precision and tolerances in
the spec or the named input configuration.

Run `node harness/cli.mjs run <slug> calc/checks/<id>.json`. The runner records input
hashes, Git commit, platform, command, exit status, stdout/stderr hashes and runtime in
`calc/runs/<id>/<timestamp>/run.json`. A timeout or nonzero exit is a failed execution.
Assert the declared criterion in the executable check so it returns nonzero on failure.
Environment is not inferred: fill the `environment` field with actual versions and
link the dependency lock file among inputs. Use `independent_check` to explain the
alternative derivation or separately constructed comparison for a core claim, or why
one is unavailable; do not call a second invocation of the same formula independent.

Execution PASS does not certify the physical interpretation. After inspecting output,
record the interpretation and limitations in the note and RESULTS entry. The evidence
kind is one of `analytic-proof`, `finite-series`, `numerical`, `literature`, or
`imported-unverified`. Record the checked range/order explicitly. Finite-order agreement
supports that range only; an all-orders assertion needs a separate derivation. A
literature result needs a primary-source location, not merely a successful script.

Existing results retain their recorded evidence status. No retroactive runner PASS is
invented. Add manifests when an old result is actually rerun. A changed assumption,
input or dependency invalidates dependent conclusions until checked again; list result
dependencies by stable R/N IDs so that this review is possible.
