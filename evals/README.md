# Evaluating harness changes and models

These eight sanitized cases cover failures recorded during research: finite-order
overclaiming, secondary attribution, failed-check rationalization, stale-copy merges,
cold starts, machine-specific paths, partial citation review and unsupported novelty.
PaperA/PaperB are deliberately fictional fixtures. No private manuscript or real
source text is sent to a model by these scripts.

Prepare an isolated package (outside the source checkout when giving it to a model):

```
node harness/eval.mjs prepare finite-order .harness-local/evals/run-1/finite-order
```

Give only the package to a fresh model session with no access to `expected.json` or the
source checkout. It contains the task, materials and the same core policies for both
models; it contains no answer key. The evaluator does not dispatch paid model calls.
Save the answer as JSON, then grade it locally:

```
node harness/eval.mjs grade finite-order path/to/answer.json
```

Answer schema: `decisions` fields requested by the prompt, `explanation`, and optional
`metadata` with exact model ID, reasoning setting, provider/app version, elapsed seconds,
input/output tokens, API cost (if known), and number of user interventions. Unknown
cost/usage remains null. Keep these results under `.harness-local/evals/` until a
reviewed comparison is deliberately saved.

Run each model on the same package and permitted tools, at least three fresh trials,
with the same time or cost cap fixed beforehand. Blind the model labels during human
review. The deterministic grade checks structured decisions only: inspect the prose
for unsupported claims, missing qualifications and contradictory reasoning. Correct
JSON with an incorrect explanation does not pass the case. Report every trial, not
only the best one. These small cases test workflow decisions; they do not establish
theoretical-physics research superiority. Add actual held-out derivation/reproduction
tasks with known independent answers before choosing a model for core calculations.

When adding a rule after a real failure, add a minimal sanitized case and its expected
decisions. Change the expected answer only when the research criterion changes, not
to improve the model's score. The Node integration tests exercise the executable
counterparts (Git conflicts, bibliography changes, migration conservation, failed runs).
