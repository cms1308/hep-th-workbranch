# PUNCHLINES — <project slug>

sync: main.tex @ <git sha, or "uncommitted"> · <YYYY-MM-DD>

A punchline is the single claim a unit of text exists to make, written as one sentence.
It is not a topic label: "discusses the conformal window" names a subject, "the window is
bounded below by unitarity rather than by asymptotic freedom" is a punchline. Write it in
the draft's own words — the terminology rule in `CLAUDE.md` applies here too.

An anchor identifies a paragraph: its first ~6 words, verbatim, so the entry can be
re-found by grep after the text moves. Line numbers are a convenience, the anchor is the
identity.

## Thesis

<the one sentence the whole paper argues — what a reader who forgets everything else keeps>

## Spine

The claims the thesis rests on, in the order the paper establishes them.

- **S1** <claim> → §<n> (<label>)
- **S2** <claim> → §<n> (<label>)

## §<n> <title>  [<label>, L<line at last sync>]

**Punchline:** <what this section adds to the spine, one sentence>

- **¶1** [S1] "<first ~6 words of the paragraph>"
  → <the claim this paragraph makes>
- **¶2** "<anchor>"
  → <claim>

<One block per section and appendix, in document order.>

<Tag a paragraph [Sk] when it carries spine claim k: those are the paragraphs whose edits
ripple into the abstract, the introduction, and the conclusions.>

<Display equations, tables, and figures belong to the paragraph they serve and get no
entry of their own.>

<If a paragraph makes no statable claim, write `→ (no claim)` rather than inventing one.
That entry is a finding for `/proofread`: the paragraph is a candidate to cut or to merge
into its neighbour. Two paragraphs sharing a punchline are the same finding.>
