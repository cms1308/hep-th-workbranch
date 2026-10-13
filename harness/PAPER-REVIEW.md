# Writing and reviewing papers

This is the shared workflow for paper, revise, line-edit, proofread and cite-check.
Use [PAPER-STYLE](../PAPER-STYLE.md) for prose and [MEMORY](MEMORY.md) for project records.
The default is to write and improve the manuscript with review proportional to the task.

## Context and authorization

Read PROJECT, STATE and DECISIONS, then the draft passages and evidence needed for the
request. Reuse context already read in the session. A local edit needs its paragraph,
relevant definitions and actual dependencies. A structural change or change to the
central claim needs the whole argument, including abstract, introduction and conclusion.

Follow the user's requested mode. Apply authorized edits; return proposals when proposals
or review-only work were requested. Do not introduce a second approval step for an
already authorized draft or edit. Ask when a material scientific or scope choice is
unresolved. Explicit project requirements for approval or a particular outline still apply.

## Outline

For a substantial new draft or restructuring, keep a short statement of the main result
and the roles of the planned sections. `paper/PUNCHLINES.md` and its template retain their
existing name but now serve as a section outline. Use the manuscript's own headings or
an existing outline when sufficient; do not create another file for a local edit.

The outline can evolve during drafting. Update it when the main argument or section roles
change, not for every rewording, moved sentence or changed opening words. Per-paragraph
claims, source IDs and a complete map before any prose are not required. Use a detailed
map for a difficult argument or when requested. Preserve existing detailed maps; maintain
the affected entries when using one, without expanding their coverage automatically.
A useful definition, motivation, transition or derivation need not claim a new result.

## Evidence and validation

- Trace scientific claims to established results or primary literature. Read the relevant
  notes and data when checking a claim; do not silently change the physics to fix prose.
- Preserve assumptions, quantifiers, notation, citations and user cuts. For a changed
  scientific claim, check its supporting evidence and its echoes elsewhere in the paper.
- Check new or changed citation claims against the primary source, including original
  attribution where applicable. Reuse recorded checks for unchanged claims and sources.
  A whole-paper citation audit is needed before submission or when requested, not after
  every wording edit. Novelty claims still require a literature search.
- Compile after changes to the manuscript or bibliography, normally with
  `latexmk -cd -pdf projects/<slug>/paper/main.tex`. Fix introduced errors and undefined
  references. If the compiler is unavailable or a pre-existing error prevents success,
  report it accurately. Inspect rendered pages when layout or displays change.
- Update STATE with the substantive draft/review status and unresolved findings. Record
  genuine standing decisions in DECISIONS; do not turn each wording fix into a rule.
  Queue and flush only changed files under [OPERATIONS](OPERATIONS.md).

## Author copies

When incorporating another author's version, compare it with the last shared version and
the current draft. Preserve intentional cuts and new results, identify reverted fixes,
and resolve only genuine conflicts. Use a three-way comparison when the base is available.
Preserve the current PDF before rebuilding if it is needed as a comparison artifact.
Do not assume an incoming copy contains every intervening correction. Report significant
conflicts before deciding a scientific change; ordinary authorized merges can proceed.

## Optional detailed review tracking

`node harness/cli.mjs paper-scan <slug>` maintains `paper/REVIEW.json`. Use it for a citation
audit or a review that benefits from stable source IDs, or when the project requests it.
It is not a mandatory before-and-after step for ordinary editing. Existing records stay
available and retain their history; do not delete them or mark them reviewed to simplify
the workflow. General project checks report applicable existing tracking as advisory.

The scanner follows literal `input`/`include` from `paper/main.tex`, splits blank-line
source blocks, and records hashes and citation keys. A block may be a display, heading
or command; it is not necessarily a paragraph or a scientific claim. Dynamic imports
and custom citation macros need manual inspection. Exact moves retain IDs when matches
are unique; ambiguous or fully rewritten blocks may get new IDs, with old ones retained
under `removed`. No manuscript tags are required.

For citation audits, keep one row per (claim, key) in CITATIONS with source location,
support and attribution, using [the template](../templates/CITATIONS.md). A readable
section/claim anchor suffices for a small scoped check. Add `[p00001]` if using tracked
attestations. A citation-free block needs no citation review, and a section outline
needs no per-block map attestations.

After the documented review of specific entries, optional attestations use:

```
node harness/cli.mjs attest <slug> map <reviewer> <checks-performed> p00001
node harness/cli.mjs attest <slug> citations <reviewer> <checks-performed> p00001
```

Attest only explicitly reviewed IDs. For a citation block, every cited key needs a
completed corresponding ledger row; checking one key does not certify a cluster.
Support verdicts such as PARTIAL or NOT FOUND can be current checks while remaining
unresolved scientific findings. Compilation and a general reviewer verdict are not
citation attestations.

The scanner deliberately retains conservative snapshot semantics: manuscript, relevant
review-document or bibliography changes can make many prior attestations STALE. This
means the recorded snapshot has changed, not that every source became wrong or must be
read again. Compare the change and its dependencies before refreshing a formal review;
reuse primary-source evidence only where its applicability has actually been checked.
Mark affected citation claims STALE in the ledger when their support needs rechecking.
Legacy UNREVIEWED records never become CURRENT from a date update or a successful build.
Report the substantive review scope and open issues, not a demand for every scanned
block to have both kinds of attestation.
