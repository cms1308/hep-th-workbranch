# Writing and reviewing papers

This is the shared workflow for paper, revise, line-edit, proofread and cite-check.
Use [PAPER-STYLE](../PAPER-STYLE.md) for prose and [MEMORY](MEMORY.md) for project records.
Every manuscript-writing and revision task requires sentence-by-sentence judgment under
the permanent rule below (user instruction, 2026-11-04).

## Judge every sentence

Before delivering a manuscript draft or revision, read the complete manuscript and
judge every sentence, without exception. This includes the abstract, introduction,
body, captions, footnotes, conclusions and appendices. When the user explicitly limits
the task to an excerpt, cover every sentence in that excerpt and its necessary context.
Apply the same judgment while writing, then read the edited text again as a whole.

For each sentence, determine whether:

- Its physical and mathematical statement is correct, with the right subject, object
  and meaning of each symbol or technical term.
- Its conclusion actually follows from the derivation, established result or cited
  source. Check the content, not merely whether a citation or qualification is present.
- Its assumptions, matter content, parameter ranges, limits and exceptions apply to
  that exact claim. State a necessary restriction before or with the claim it limits.
- Its terminology is established in the relevant literature or describes the operation
  plainly. Do not invent a technical-sounding label to replace an explanation.
- Its role and logical connection to the surrounding sentences are clear and consistent
  with the argument and results of the complete paper.

Resolve a doubtful statement against the supporting record before retaining or rewriting
it. Report an unresolved scientific issue explicitly. A hedge cannot supply missing
evidence. The assistant owns this review and must not leave the user to discover defects
one sentence at a time. Keyword searches, compilation, algebra checks and a paragraph-level
summary supplement this reading; none establishes that every sentence has been judged.
Findings returned by delegated reviewers and edits applied by script do not replace the
lead's own reading of the edited manuscript either (user, 2026-11-25); `queue` prints a
reminder whenever manuscript TeX is checkpointed.
Report the scope actually read and the unresolved findings accurately. This rule requires
judgment, not a mandatory per-sentence ledger or a new approval step.

## Language and content check

User instruction, 2026-11-05. Apply this to manuscript writing, revision and review.

1. Read the actual section before describing its purpose or contents. Match every verb
   in a roadmap sentence (reviews, derives, proves, classifies) to what is present.
2. Judge every word, compound, technical expression and sentence in its physical and
   grammatical context. Check the referent, ordinary meaning, collocation, sentence
   opening and connection to adjacent sentences. Do not substitute a keyword scan.
3. Separate the author's objections before editing. Preserve a sentence's useful
   content when the objection concerns only its opening. Do not explain away an
   unwanted term by finding an unrelated use of the same string.
4. Language evidence must come from primary hep-th paper versions released strictly
   before the date two calendar years before the review. Record the cutoff and version
   or dated source metadata. An old initial submission with a recent inspected revision
   is not eligible. A narrower user cutoff takes precedence. This is a selection rule,
   not a claim that older papers are necessarily human-written.
5. For requested exhaustive frequency audits, save the manuscript hash, complete token
   inventory with locations, corpus manifest and denominator, normalization rules,
   occurrence counts and document frequencies, and a disposition for every sentence
   and non-sentence text unit. Include title, abstract, headings, captions, footnotes,
   tables, figure labels, appendices and bibliography. Distinguish prose from notation,
   names, addresses and extraction artifacts; do not silently discard low-frequency
   words or count TeX command names as English vocabulary.
6. Report corpus frequency as corpus frequency. Search-result counts are not corpus
   counts. Zero matches do not prove non-use; one match does not establish naturalness.
   Compare relevant phrases and grammatical constructions, not just isolated words.
   Treat mathematical definitions, legitimate project-specific descriptions and names
   separately from unsupported jargon. Never force every sentence to match a quotation.
7. Read and judge all sentences after edits, including replacements and their context.
   A sentence changed by script or on a reviewer's report counts as unread until the lead
   has read it in its paragraph and section.
   Check inventory coverage against the final text. Unread, unclassified or unverified
   material must remain explicitly open; neither a successful script nor a generic
   "all sentences checked" statement can close it. Reuse unchanged evidence only when
   source/text hashes and scope agree.

These checks reduce recurrence; do not promise that any harness can make editorial or
scientific errors impossible. They add no user-approval step to authorized work.

## Context and authorization

Read PROJECT, STATE and DECISIONS, then the draft passages and evidence needed for the
request. Reuse context already read in the session. A local edit needs its paragraph,
relevant definitions and actual dependencies. A structural change or change to the
central claim needs the whole argument, including abstract, introduction and conclusion.
These context requirements prepare the edit; the complete final reading above still applies.

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

## Verification gate

Stage 1 of [the design](design/paper-verification.md) is implemented: the checks that
code decides. It supplements the reading duty above and replaces none of it. Whether a
sentence is correct, supported and in its place is the independent verdict of stage 3,
which does not exist yet.

`node harness/cli.mjs paper-verify <slug> [paper-dir]` splits the manuscript (literal
`input`/`include` followed, preamble macros without arguments expanded) into titles,
paragraphs and sentences, extracts the numerals, symbols and candidate terms of each
sentence, applies every registered rule and writes `<paper-dir>/VERIFY.json`. Its first
run enrolls the manuscript. Only an enrolled manuscript is gated. An ordinary draft or a
local edit of one needs none of these files, and no user-approval step is added.

| File in the paper directory | Content |
| --- | --- |
| `RULES.json` | The project's rules, `{"version": 1, "rules": [...]}`. Harness-wide rules are in `harness/rules.json`. |
| `LEXICON.json` | `symbols`: `{"symbol", "at"}` or `{"symbol", "standard"}`. `terms`: `{"term", "at"}`. |
| `FACTS.json` | `facts`: id to `{"file", "pointer"}`, `{"file", "pattern"}` or `{"at"}`. `uses`: sentence to numeral to fact id. |
| `VERIFY.json` | Written by the CLI only: one verdict for each (unit, rule), bound to content hashes. |

- **Rules.** An entry has `id`, `kind`, `source`, at least one `fail` text and one `pass`
  text, and the parameters of its kind. It is refused, and no verdict is produced, unless
  its check flags every `fail` text and passes every `pass` text. A user objection supplies
  the failing text verbatim. Kinds decided by code: `banned` (`pattern`, optional `flags`,
  `roles`, `in: "tex"`), `reference-capital`, `sentence-case-title`, `aside-punctuation`,
  `hard-wrap`, `defined-before-use`, `number-bound`, `build`. A rule that only a reader can
  judge cannot be registered before stage 3. It stays in DECISIONS under the reading duty.
- **Units.** `node harness/cli.mjs paper-units <slug> [paper-dir] [filter]` lists unit ids
  (content hashes), positions and numerals. `at` and the keys of `uses` take a unit id or
  `label:<LaTeX label>`, which names the sentence or caption containing that label.
- **Numerals.** Digits and number words in the prose, and every side of a relation in an
  inline formula that is a closed numeric expression (`27/128`, `-0.146`, `(0,1,4)`). Not
  counted: digits joined to a word (`rank-2`, `4d`), `one`, ordinals, a comparison with
  zero, references and citations. A numeral passes when it is bound to a fact with a
  `file` (a calculation output, read by JSON `pointer` or by the first group of `pattern`)
  whose value agrees: integers exactly, a decimal to its printed digits, a closed form to
  a relative 1e-9. A sibling `run.json` of an evidence run must record PASS. A numeral bound to
  a fact with `at` (the place in the manuscript that states it) awaits the independent
  verdict.
- **Symbols.** A letter, a Greek or other command, a font or accent form, with a roman
  subscript as part of the name (`N_{bif}`). Other subscripts and superscripts are
  indices. A multi-letter name (`SU`) exists when the lexicon lists it. Every symbol of a
  sentence needs a lexicon entry whose `at` contains the symbol and does not come after
  the sentence. Titles are exempt. `standard` declares notation that needs no definition.
  The declaration is listed once and awaits attestation.
- **Punctuation.** An em-dash fails. A colon before a display or at the end of its
  sentence passes. Any other colon or semicolon in running prose awaits the independent
  verdict, because [PAPER-STYLE](../PAPER-STYLE.md) keeps punctuation that clarifies.
- **Build.** `paper-verify` runs `latexmk` and reads the pages with `pdftotext`. It fails
  on an overfull box absent at enrollment, a repeated table header left without a row, an
  undefined reference or citation, and a failed build. `--no-build`, or a missing tool,
  leaves the check not judged.
- **Verdicts.** Pass, fail, awaiting the independent verdict, or not judged. Verification
  is complete when no verdict fails and none is unjudged. A verdict is judged again only
  when its unit, its rule or what it depends on changed (a definition site, a bound fact,
  the calculation output).
- **Reporting.** State the result of an enrolled manuscript by the table `paper-verify`
  prints, with its counts of verdicts awaiting the independent verdict and its list of
  what stage 1 does not judge. A statement that the text was read is not evidence. If the
  manuscript is unfinished, run `paper-verify <slug> [paper-dir] --wip "<reason>"` and give
  the user the unverified units it prints. Hook and commit behavior are in
  [OPERATIONS](OPERATIONS.md#manuscript-verification-gate).

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
