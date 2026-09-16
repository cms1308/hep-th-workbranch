---
name: line-edit
description: Sentence-level pass over a section of the project's paper draft for register and readability — whether each sentence reads like a hep-th paper written in the voice PAPER-STYLE records — producing per-sentence proposals (current → proposed → rule) for the user's approval. Use when the user says a section reads awkwardly, not like a paper, or asks to polish the writing (distinct from /proofread, which checks consistency, and /revise, which applies a specified change).
---

## Shared memory and execution contract

Read `harness/MEMORY.md` and the project's PROJECT, STATE and DECISIONS before edits.
Detailed results live in RESULTS, the complete plan in PLAN, past decisions in HISTORY,
and detailed unresolved issues in OPEN-QUESTIONS. Follow the relevant linked notes.
For legacy projects without these files, use the corresponding STATE sections until migrated.
Commands below run from the harness root. Resolve the wiki with `node harness/cli.mjs paths`;
never assume an absolute path or a provider-specific tool name. At the end, queue and
flush only the files changed by this task as described in `harness/OPERATIONS.md`.


Input: a section spec ("3.2.2", "sec:caserealized", "intro"). One section per pass; a
whole-draft request is run section by section, each reported before the next starts.

`/proofread` asks whether the draft is consistent. This pass asks whether each sentence is
one a referee in the subfield would read without stumbling, in the voice the project's
papers are held to. It changes wording only, never claims.

## Protocol

1. **Load the standard first.** Read `PAPER-STYLE.md` in full, with "Voice and register"
   and "Paragraphs and arguments" as the working checklist; the project's `DECISIONS.md`
   terminology block (banned words, substitutions, notation); and the target section's
   block of `paper/PUNCHLINES.md`, so that every sentence is edited against the claim its
   paragraph exists to make. If `DECISIONS.md` names reference papers for register, read
   their prose (the wiki's `sources/` copy) before judging a sentence; if none is named,
   say so in the report — the rules alone are the standard, and the professor's corrected
   passages recorded in PAPER-STYLE are the only sample of the target voice.

2. **Read the section sentence by sentence** from `paper/main.tex` and, for each
   sentence, ask in this order:
   - **Voice.** Is the reader walked through the step by a named agent ("We ...",
     "Consider ...", "Notice that ...") where the draft states a result impersonally?
     Is a claim stated in the hedged register with its evidence after it?
   - **Load.** More than one idea, a subject that arrives after two subordinate clauses,
     a chain of nominalizations where a verb would do, a referent ("this", "it", "the
     latter") the reader must resolve by rereading — split, reorder, or name the thing.
   - **Aside device.** Parentheses only; a `---` pair, a semicolon or a mid-sentence
     colon is rewritten (a colon introducing a display or a caption's column list stays).
   - **Register.** Evaluative or promotional words ("perfectly mirrors", "celebrated",
     "remarkably", "elegant", "clean") go; a physics remark that states a checkable fact
     stays. Notes voice (bookkeeping, narration of the work order, script names) is a
     finding for `/proofread` but is flagged here too.
   - **Terminology.** Every noun phrase used as a name is grepped in the draft; a phrase
     used once is spelled out or cut, never glossed. Standard jargon of the literature
     stays. Nothing from the project's banned list is reintroduced.
   - **Claim.** Would the rewrite change what the paragraph claims, strengthen a hedge
     into an assertion, or drop a quantifier ("at leading order", "at fixed flavor
     number", "for $N_f^{(1)}\ge1$")? Then it is not a line edit: keep the sentence and
     report the tension as a finding instead.

3. **Write the proposals, never the draft.** The output is a numbered list, one entry per
   sentence or sentence group, in the section's order:
   `¶k Sn — current sentence → proposed sentence — rule (one phrase)`.
   Sentences that pass are not listed. Before reporting, grep every proposed sentence for
   `---`, `;`, a mid-sentence `:`, and each banned word; a proposal that fails is fixed
   before it is shown. Do not reuse a sentence from an earlier commit of the draft: a
   rewrite is written from the current sentence and the paragraph's punchline, in the
   register above.

4. **Wait for the user's per-item decision.** Nothing is applied on the pass itself
   (project rule: every change to `paper/` is approved item by item). Keep the list in
   the reply and in a dated note under `notes/` so approved items can be applied
   verbatim later.

5. **Apply approved items under `/revise` discipline**: exact-string replacement of the
   approved sentences only, `latexmk -cd -pdf projects/<slug>/paper/main.tex` with 0
   errors and 0 undefined references, `node harness/cli.mjs paper-scan <slug>`, every
   anchor of the section's `PUNCHLINES.md` entries re-checked (an opening-words change
   updates the anchor; no punchline changes, by construction of step 2), the `sync:`
   line, and a commit per the project's commit policy.

6. **Report in Korean**: how many sentences were read, how many proposals, which rule
   each group traces to, what was flagged as a claim tension rather than proposed, and
   whether a reference corpus was available.
