# Paper style

The default is clear, explanatory research prose. Guide the reader through the question,
construction or calculation, and what the result establishes. Use concrete operations,
representative examples and explicit qualifications. Preserve the strength and scope of
the evidence. The user's current request and the project's explicit decisions take
precedence. These guidelines support editorial judgment; they are not sentence templates.

Read this guide for drafting or substantive prose work. Shared workflow and review scope
are in [PAPER-REVIEW](harness/PAPER-REVIEW.md). The [earlier guide and revision rationale](harness/style/history-2026-10-13.md)
preserve past editorial decisions; they are not required reading for ordinary edits.

## Scientific content

- State only what the results and cited sources support. Distinguish proof, conjecture,
  numerical evidence and assumptions. Retain relevant ranges, expansion orders,
  specializations and unresolved limitations; a hedge does not replace them.
- Cite the original source for attributed results and constructions. Preserve citations
  when editing. Verify new or changed attributions against primary sources and search
  the literature before asserting novelty.
- Keep notation and normalizations consistent with PROJECT.md and across the paper.
  Define needed symbols before use. Avoid introducing a symbol merely to abbreviate a
  single phrase, but keep notation that makes a formula or argument clearer.
- When a scientific inconsistency appears, check the supporting record. Do not repair
  the prose by inventing a result, hiding a caveat, or broadening a verified special case.

## Argument and exposition

- Organize around the question, construction, results and evidence, in the order the
  reader needs. A short section outline is normally sufficient; paragraphs need no
  separate claim ledger. Definitions, motivation, transitions and derivations are
  legitimate parts of an argument.
- Explain enough for the reader to reconstruct the reasoning. Keep necessary
  intermediate steps, conventions and evidence in the paper; move lengthy algebra or
  technical detail to an appendix when it interrupts the main argument. Before a long
  calculation, state its purpose and identify any difficult step the reader needs to follow.
- Include consistency checks when they support a scientific claim. Omit internal
  verification logs, pass counts, session chronology and repository paths. Describe a
  computational method when it is scientifically needed, not as a work diary.
- Introduce an equation by its purpose and explain consequences that the reader needs.
  Cut paraphrases that merely repeat the display. Keep a short physical observation or
  reminder when it supplies useful information.
- In comparable cases, explain the method in one representative example, then refer back
  and state what changes. Use a consistent order where it helps comparison, without forcing
  different cases into identical paragraphs or rephrasing a method just for variety.
- Remove redundant text after moving or merging an argument. Judge each paragraph by
  its contribution to the reader, not by whether it states a new result.
- In the discussion, name concrete open questions arising from the results and their
  limitations. Let the scope of the argument determine how much explanation is needed.

## Voice and register

- Guide the reader with concrete operations and clear connections. First-person plural
  is natural for choices and calculations; definitions and established facts can be
  stated directly. Let the reasoning determine whether a claim precedes its evidence.
- Prefer familiar verbs and the literature's terminology. Avoid promotional language,
  compressed labels and metaphors that obscure the physics. Reuse established names;
  an uncommon or newly introduced standard term is not wrong merely because it occurs
  once. Check uncertain terminology rather than grepping every noun phrase.
- Use short transitions around dense mathematics. Split overloaded sentences when
  useful, while keeping conditions with the statements they qualify.
- The user's preference is restrained colons, semicolons and em-dashes, with parentheses
  for brief asides. This is not a character ban. Keep punctuation that clarifies the
  sentence, including colons introducing equations or lists.
- Write original, grammatical sentences suited to the argument. Avoid inserting stock
  expressions mechanically.

## LaTeX and final reading

Use the project's JHEP setup and notation. Keep each prose paragraph on one source line;
environments retain their own line structure. Do not box equations for emphasis unless
the user asks. Preserve author edits and intentional cuts when merging versions.

Before delivering an edited passage, read it in context: is the argument understandable,
are claims and qualifications intact, and do equations, tables, citations and references
agree? Check affected dependencies and compile after manuscript edits. A full manuscript
review is a separate scope, not a prerequisite for correcting one sentence.
