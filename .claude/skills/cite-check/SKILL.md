---
name: cite-check
description: Verify every citation in the active project's paper draft against the cited papers themselves — that the cited paper actually contains the claim, exactly where (equation/section/table), and that it is the ORIGINAL source rather than a paper that merely restates or reproduces the result. Produces and maintains paper/CITATIONS.md, the per-citation ledger. Use when the user asks to check, audit, or verify citations, attributions, or references, before submission, and after any pass that adds citations.
---

Input: optional scope — a section, a list of bib keys, or "all" (default: every `\cite`
in `paper/main.tex` whose ledger row is missing or marked STALE).

Why this exists: on 2026-08-27 the ad-chains draft cited Agarwal–Maruyoshi–Song
[1610.05311] for the Argyres–Douglas central charges. The values were right (a 2026-08-26
audit had checked them against Xie's Table 3), but AMS only *reproduce* them from the
Lagrangian side — the originals are Shapere–Tachikawa [0804.1957] eqs. (4.30)–(4.31) and
[0809.3238] eqs. (3.13), (3.15), and the flavor central charge is Cecotti–Vafa [1103.5832]
eq. (9.2). Checking that a value is correct is not checking that the attribution is. The
user: "진짜 그 인용한 논문이 오리지널이고 해당 논문 안에서 정확히 어디에 적혀있는지
확인을 해야하는거지."

## Protocol

1. **Build the citation table from the draft, not from memory.** For every `\cite{...}`
   in scope, extract the sentence that carries it (the *claim*), every key in it, and
   the bib entry (arXiv id, title) from `paper/refs.bib`. One row per (claim, key). A
   key cited for several claims gets several rows; a claim citing several keys gets one
   row per key, and each key must be checked separately — a cluster `\cite{A,B,C}` is
   not verified by verifying A.

2. **Classify the claim.** What is the citation doing?
   - *result*: "X was computed/shown/identified/conjectured in [k]" — the paper is cited
     as the source of a fact, formula, or identification. Originality applies.
   - *construction*: "the theory/frame/duality of [k]" — cited as the source of an object.
     Originality applies.
   - *convention*: "in the conventions of [k]", a definition. Only location applies.
   - *context*: background, "see also", the landscape programs. Only existence applies.

3. **Read the cited paper, in full where needed, for every result/construction row.**
   Use the primary text — alphaXiv `answer_pdf_queries` with the specific formula or
   statement as the query (several questions per paper in ONE call), falling back to
   `get_paper_content` fullText — and record for each row:
   - **location**: equation number, section, table, or page where the claim is stated;
   - **excerpt**: the paper's own words, at most ~25 words, enough to re-find it;
   - **support**: SUPPORTS (stated there as cited) / PARTIAL (a weaker, narrower, or
     differently-normalized statement — say how) / NOT FOUND (say what was searched).
   A convention row needs location only; a context row needs only that the paper is
   what the sentence says it is.

4. **Originality, for every result/construction row.** Ask, in this order:
   - Does the cited paper *itself* attribute the statement to an earlier reference at
     the place found in step 3 ("as shown in [12]", "these are the values of [19]", a
     formula "given in [40]")? If yes, the cited paper is SECONDARY unless the draft is
     citing it precisely for the restatement or check it contributes. Read the earlier
     reference (one hop, more if that one also defers) and record its location too.
   - Search beyond the chain of references: alphaXiv `discover_papers` / arXiv full text
     and INSPIRE for the *object itself* — the formula, the identification, the name of
     the theory — not for the papers already in hand. Earlier hits are candidates for
     the original; read them.
   - Verdict: ORIGINAL / SECONDARY (original = key or arXiv id, location) /
     UNDETERMINED (what was searched, why it is inconclusive).
   Do not answer originality from memory of who "usually" gets cited; every verdict
   traces to a page read in this pass.

5. **Bib hygiene.** For every key in scope confirm the entry against INSPIRE
   (`https://inspirehep.net/api/arxiv/<id>?format=bibtex`): texkey, authors, title, and
   that the arXiv id is the paper the sentence means (a wrong id with a right title is a
   real defect class). Never re-fetch entries the project has marked "do NOT re-fetch";
   compare, do not overwrite.

6. **Parallelize by paper, not by claim.** One agent per cited paper (or small group of
   related papers) with steps 3–5 for all rows of that paper; the agent reports rows
   only — location, excerpt, support, originality verdict, bib status — and edits
   nothing. Tell agents up front to keep reports short (row table, no prose) and to
   load the alphaXiv tools via ToolSearch before reading. The orchestrating session
   merges the reports.

7. **Write the ledger `paper/CITATIONS.md`** (create from the template below if absent):
   one row per (claim, key), with the claim identified by its first ~6 words verbatim
   (the same anchor convention as `PUNCHLINES.md`) plus the key, and the columns
   *type · location · excerpt · support · originality · bib · date*. Rows survive edits
   that move text; a row whose anchor no longer matches, or whose sentence changed, is
   marked STALE by `/proofread` and re-checked here. The ledger is the record; the
   session's reasoning is not.

8. **Fix, then verify.** Every SECONDARY or NOT FOUND row is a finding: replace or add
   the original's key (INSPIRE entry appended to `refs.bib`), move the secondary key to
   where it is the source (its own construction, its own check), or cut the cite. Edits
   to `main.tex` follow `/revise` — whole-paper awareness, one source line per
   paragraph, PUNCHLINES untouched unless a claim changed. `latexmk -pdf` must give 0
   undefined citations. Never "fix" a NOT FOUND row by softening the claim into
   something the paper does say without checking that the softened claim is what the
   draft needs.

9. **Record and commit.** The corrected attributions go into the Paper section of
   `STATE.md` (supersede in place), the ledger is committed with the draft, and the
   report to the user (Korean) lists, per finding: the claim, what was cited, what the
   cited paper actually says and where, who the original is and where, and what was
   changed. State which rows remain UNDETERMINED and why.

## Ledger template (`paper/CITATIONS.md`)

```
# CITATIONS — <slug>

sync: main.tex @ <commit or date>

One row per (claim, bib key). Anchor = the claim sentence's first ~6 words, verbatim.
type: result | construction | convention | context.
support: SUPPORTS | PARTIAL (how) | NOT FOUND (what was searched).
originality: ORIGINAL | SECONDARY (original = …, location) | UNDETERMINED (why) | n/a.
bib: OK | FIXED (what) | MISMATCH (what).

| anchor | key | type | location | excerpt | support | originality | bib | date |
|---|---|---|---|---|---|---|---|---|
```

## What this is not

- Not a check that the *values* in the draft are right — that is `/proofread` against
  `notes/` and `calc/`. A correct number with the wrong source is exactly the defect this
  skill exists to catch.
- Not a literature search for novelty claims — that is the knowledge protocol's
  "novelty claims require a literature search first" rule, run before the claim is
  written. This skill checks attributions the draft already makes.
