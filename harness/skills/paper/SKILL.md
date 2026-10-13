---
name: paper
description: Write a JHEP-style LaTeX paper draft in paper/ from the project's established results. Use when the user asks for a draft, write-up, or paper.
---

Read `harness/PAPER-REVIEW.md` for shared context, authorization, validation and saving,
and `PAPER-STYLE.md` for prose. This workflow writes from recorded results and primary
sources, not from memory of the conversation.

## Establish the scope

Read the relevant RESULTS entries and supporting notes, including assumptions and
verification limits. Identify the main contribution and what evidence supports it.
Keep conjectures and preliminary results explicitly qualified; resolve a material
uncertainty about including them before treating them as an established result.

For a substantial draft, make a short section outline using `templates/PUNCHLINES.md`
when a separate outline helps continuity. Do not plan every paragraph in advance.
If the user has already supplied or authorized the scope, proceed with drafting.
Ask about an unresolved scientific or scope choice, not for routine outline approval.

## Draft

- Use the project's JHEP setup. Look for `jheppub.sty` locally or in a sibling LaTeX
  directory; otherwise obtain it from the JHEP author site.
- Use `paper/main.tex` and the existing included sources. Preserve any separately
  requested manuscript directory or author version.
- Obtain bibliography metadata from recorded references or INSPIRE. Check new citation
  claims against the primary paper, including attribution to original sources.
- Organize the argument for the reader. Include definitions, derivations and checks
  where needed, and move lengthy supporting material to appendices when appropriate.
- Write original prose, keeping notation, assumptions and test ranges intact. Search
  the literature before describing a result as new. The abstract and conclusion must
  match what the body actually establishes.
- Revise the section outline when the argument changes. No per-paragraph anchors or
  full map coverage are required for ordinary drafting.

## Deliver

Read the draft for scientific consistency and flow; compile and inspect affected layout.
Check the citations added in this pass. Use cite-check for the full audit before
submission or when requested. Detailed scan/attestation tracking is optional under
PAPER-REVIEW; do not represent drafting or compilation as a completed independent review.
Update STATE with the draft's scope, remaining issues and review status, checkpoint the
changed files, and report the manuscript location and validation outcome in Korean.
