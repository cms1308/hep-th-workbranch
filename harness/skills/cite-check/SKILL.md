---
name: cite-check
description: Verify citation support and original attribution against primary sources, maintaining paper/CITATIONS.md. Use for requested citation audits, before submission, and for new or changed citation claims; do not expand a scoped check into a full audit.
---

Read `harness/PAPER-REVIEW.md` for shared scope, authorization, review tracking and saving.
Correct values and correct attribution are separate requirements.

## Scope and inventory

Follow the requested section, keys or full-paper scope. When invoked after a revision,
check the new or changed citation claims. With no narrower scope, audit missing or
unresolved checks in the active manuscript and its included sources. A pre-submission
audit inventories the whole paper; recorded primary-source checks can be reused where
the claim, source and relevant context remain unchanged.

Extract each claim, every cited key and its bibliography entry from the draft. Keep one
row per (claim, key). A source supporting one claim does not automatically support
another, and checking one key does not verify a cluster. Account manually for custom
citation macros. If REVIEW.json is present, treat STALE as a reason to inspect the diff
and dependencies, not as an instruction to reread every primary source indiscriminately.

## Check the source

1. Identify the citation's role: result or construction (support and original attribution),
   convention (definition and location), or context (the source fits the description).
2. For each new or unresolved result/construction claim, read the relevant primary text
   using available tools. Record the source version and equation, section, table or page.
   Use a short excerpt only if useful, respecting the quotation limit across the source.
   Record SUPPORTS, PARTIAL or NOT FOUND, with the specific scope or mismatch.
3. Check whether the source credits an earlier paper for the result. Follow that reference
   and search the object itself when original attribution is uncertain. Record ORIGINAL,
   SECONDARY with the original's location, or UNDETERMINED with the remaining uncertainty.
   A secondary paper is appropriate when cited explicitly for its own application or check.
   Do not infer originality from reputation, a wiki summary, or a matching number.
4. Confirm new or suspect bibliography metadata against INSPIRE or the primary paper.
   Preserve entries marked not to be re-fetched; compare rather than overwrite.
5. Group source reading by paper so several claims can share one retrieval. Reuse clear
   prior checks for unchanged claims; do not certify missing or ambiguous legacy evidence.

## Record and correct

Use `templates/CITATIONS.md` for the ledger: claim anchor, key, role, source version,
location, support, originality, bibliography status and date. For a small check, readable
section/claim anchors suffice. Use paper-scan and stable IDs when a larger audit benefits
from them. With tracked attestations, every key in a block needs its own completed row.
An unavailable source remains UNREVIEWED; a changed claim needing another check is STALE.

Apply authorized attribution and bibliography corrections under revise. Do not change the
scientific claim merely to make a citation fit. If the discrepancy changes the paper's
argument, consult the underlying evidence and report the decision needed. Compile after
TeX or bibliography changes. Record ordinary findings in CITATIONS, and only genuine
standing attribution decisions in DECISIONS.

Report the checked scope, corrections and unresolved sources in Korean, then checkpoint.
A current attestation records a completed check, not a finding-free paper. Detailed
tracking and snapshot limitations are defined once in PAPER-REVIEW. Novelty claims still
need the literature search required by the knowledge protocol.
