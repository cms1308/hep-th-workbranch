# Tracking paper review

`node harness/cli.mjs paper-scan <slug>` maintains `paper/REVIEW.json`, a mechanical
index of the manuscript's source blocks. IDs such as `p00001` are bookkeeping metadata,
never terms in the rendered paper. No TeX source edit is required for adoption.
Run it before and after paper edits, citation checks and proofreading.

The scanner follows literal `input`/`include` from `paper/main.tex`, splits blank-line
source blocks, and records their content hashes and citation keys. Blocks include
displays as well as prose: the index is not a claim parser. It preserves an ID when a
unique exact block moves, or when a unique opening anchor survives an edit. A fully
rewritten or ambiguous block gets a new ID; the previous ID is retained under `removed`.
Never silently equate two ambiguous paragraphs. Dynamic TeX imports and custom citation
macros require manual inspection. REVIEW is a change detector, not a LaTeX compiler.

Add `[p00001]` to the corresponding PUNCHLINES entry or CITATIONS row when that block is
reviewed. Keep the human-readable first-six-word anchor as a search aid. A display can
be linked alongside the paragraph it supports; it does not need an invented punchline.
For citations use one row per (claim, key), with the block ID, primary source/version,
location, short excerpt, support and originality verdict, bibliographic check and date.

After a real review, attest only its explicit IDs:

```
node harness/cli.mjs attest <slug> map <reviewer> <checks-performed> p00001
node harness/cli.mjs attest <slug> citations <reviewer> <checks-performed> p00001
```

The attestation stores the block, source-tree, bibliography and ledger/map hashes. Any manuscript
change conservatively makes previous attestations STALE, including changed definitions,
tables and displays elsewhere. Changed ledger/map content also makes its attestations
STALE. IDs survive moves, but review may still be required. On the initial scan all
legacy blocks are UNREVIEWED; an old `sync:` date is never treated as fresh verification.
`CURRENT` means only that an explicitly recorded review matches these file versions.
It is not a judgement that the argument is correct.
An explicitly checked NOT FOUND/PARTIAL/SECONDARY/UNDETERMINED verdict may have a
CURRENT review record while remaining an unresolved attribution finding in the ledger.
CURRENT never clears those substantive findings.

`/proofread` and `/revise` must leave affected CITATIONS rows explicitly STALE when
their claims change; REVIEW reports staleness even if the prose marker was missed.
`/cite-check` reads both missing/STALE rows and REVIEW findings, then records a new
attestation only after reading the primary sources. Never acknowledge a hash merely
to make the check output green. Remaining UNREVIEWED/STALE coverage is reported in STATE.
