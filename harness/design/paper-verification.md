# Manuscript verification — design

Status: design and its four open choices decided by the user on 2026-11-25. **Stages 1 and
2 of 5 implemented on 2026-11-25** ([record](#implementation-record)); stages 3 to 5 are not.
No manuscript is enrolled yet (the pilot is stage 5). [PAPER-REVIEW](../PAPER-REVIEW.md)
and [PAPER-STYLE](../../PAPER-STYLE.md) remain the active policy, and the reading duty
stays in full until the independent verdict exists. This file is the specification the
next stage starts from.

## Why

User instruction, 2026-11-25: a draft is written to be the best publishable paper, and
"best" means an answer exists. Every word, sentence, paragraph and logical structure
needs explicit grounds. A rule that only enters the prompt is not enough: each rule must
pass an actual verification, and the excuses "either wording is fine", "I did not notice
while reading" and "the harness had the rule but I did not apply it" are not acceptable.

Origin (susu-quiver, same day). The lead applied about a hundred edits from reviewer
reports by scripted replacement and reported the pass as finished. The user then found,
one at a time: coined labels ("saddle scenario", "symmetry-quotient method", "one-pair
theories") despite the standing rule against them; a sentence about case (3) left at the
end of the Section on case (5); a physically wrong statement about case (5); numbers
that appeared without explanation ("204") or were wrong in the report (ten rows for
nine); a main result whose scope contradicted a later Section; symbols used before their
definition; an outline (`PUNCHLINES.md`) that was neither read nor updated. Every one of
these was covered by an existing written rule. None of the rules had a check.

History to respect. On 2026-10-13 the user removed the earlier global paragraph-map
requirement ([record](../style/history-2026-10-13.md)) because it forced a claim onto
every paragraph, demanded full maps for local edits and added approval steps. The
evaluation cases "local wording edit expanded into unnecessary manuscript gates" and
"useful definition rejected for lacking a paragraph punchline" must keep passing. This
design gates on verification being complete and current, not on ceremonial documents,
and adds no user-approval step.

## Principles

1. **No rule without a check.** Every rule from PROTOCOL, PAPER-STYLE, a project's
   DECISIONS or a user instruction is an entry in the project's `paper/RULES.json` with
   a check and at least one text that must fail and one that must pass. Registration is
   refused when the check does not flag the failing text. A user objection ("saddle 별로야")
   supplies the failing text verbatim.
2. **The writer cannot pass its own text.** A verdict comes from code or from an
   independent model launched by the harness (text written by Claude is judged by Codex
   and the reverse). Verdict records are written only by the CLI.
3. **"Best" is defined by ranked criteria.** With the ranking fixed, "both are fine" is
   not an available outcome (ranking below).
4. **Every verdict is bound to a content hash.** A changed character invalidates the
   verdicts of that unit and of the units that depend on it, and nothing else.

## Units and grounds

The manuscript sources (literal `\input`/`\include` followed, as in `paper-scan`) are
decomposed by code into Sections, paragraphs, sentences, terms (noun phrases) and
numbers. A unit passes only with a recorded ground.

| unit | ground it must have | checked by |
| --- | --- | --- |
| term | attested in the literature corpus, or a definition location in the manuscript (`paper/LEXICON.json`) | code |
| number | bound to a value produced by a calculation script or evidence run (`paper/FACTS.json`) | code |
| sentence | a type (definition, derivation, result, cited claim, transition) and its link: equation labels, an evidence run or note, or a CITATIONS row with the source location | independent verdict |
| paragraph | exactly one outline entry (`PUNCHLINES.md`, hash-bound) | code and independent verdict |
| Section | its title covers the roles of its paragraphs | independent verdict |
| document | each central claim is stated with the same scope in abstract, introduction, body and conclusion | independent verdict |

- Terms. Every noun phrase is extracted and compared with the corpus counts of the
  existing language audit. A noun phrase absent from both the corpus and the lexicon
  fails. This is the check behind "no invented terminology".
- Numbers. Every numeral in the prose is extracted. An unbound number fails, and a
  change in the data invalidates the sentences that use it.
- Outline. Paragraph types include definition, derivation and transition, so no
  paragraph is forced to carry a result claim.
- Further code-only checks: use before definition (symbols and terms), banned words,
  capitalized document references, sentence-case titles, colons and semicolons used as
  asides, hard-wrapped prose, and layout defects in the built PDF (a table header alone
  on a page, new overfull boxes).

## Making the independent verdict real

The judging model is also a language model, so the verdict itself is tested.

- **Narrow calls.** One sentence (its paragraph as context) and one rule family per
  call. The output schema requires, for every rule ID, pass or fail, a reason and the
  quoted evidence. A rule cannot be skipped.
- **Seeded defects.** For every run the harness inserts known defects into a copy of
  the manuscript (a coined label, a claim without its scope, a wrong number, a sentence
  placed in the wrong Section, and every defect the user has found before). The run is
  valid only if the judge catches all of them. Otherwise the whole run is void.
- **Search for a better sentence.** The judge is asked to produce a sentence that is
  better under the ranked criteria. If it can, the unit fails and is replaced. A unit
  passes when two independent judges both fail to improve on it.
- **Defects found by the user become permanent tests**, seeded in every later run.

Ranked criteria (user decision 2026-11-25, as recommended):

1. physical and mathematical correctness
2. the user's decisions (DECISIONS)
3. harness rules
4. completeness of the information the argument needs
5. no redundancy
6. terminology attested in the literature
7. the shorter text
8. on a tie, the existing sentence stays

## Enforcement points

- `node harness/cli.mjs paper-verify <slug>` computes the status and writes
  `paper/VERIFY.json`. Only changed units and their dependents are judged again, so a
  one-sentence edit re-verifies its neighbourhood.
- A completion report is the table produced by `paper-verify`: unit counts, zero
  failures per rule, the detection rate of the seeded defects, the judging models. A
  statement by the lead that it read the text is not evidence.
- The Stop hook blocks the end of a turn when the manuscript hash changed and
  verification is incomplete, unless the lead declares work in progress with the list
  of unverified units. Claude Code Stop hooks can block. Whether Codex hooks can do the
  same must be checked. If they cannot, `queue` marks commits of unverified manuscript
  sources instead.

## Decisions (user, 2026-11-25: "권장대로 정해")

| choice | decided |
| --- | --- |
| criteria ranking | the eight-step order above |
| approval of a new term | automatic when the literature attests it, the user otherwise |
| judging models | a model from a different vendor than the writer, two judges in agreement |
| commits of unverified manuscript sources | allowed and marked, only the completion report is blocked |

## What the gate establishes

That every unit received, for every rule, an independent verdict from a judge that
passed the seeded-defect test on that run. It does not prove physical correctness. The
residual error is measured by the detection rate of seeded defects and by the defects
the user still finds, each of which is added to the tests.

## Implementation stages

Each stage has its criterion before work starts.

1. Decomposition into sentences, terms and numbers; `RULES.json`, `FACTS.json`,
   `VERIFY.json`; the code-only checks; `paper-verify`; the Stop hook.
   verify: integration tests on fixture manuscripts for every check, hash invalidation
   limited to the changed unit and its dependents, the hook blocks and releases as
   specified.
2. Term check on the language-audit corpus.
   verify: the three coined labels of the origin fail, their replacements pass, defined
   notation passes.
3. Independent verdict loop with seeded defects, extending `review-request`.
   verify: a run with one seeded defect removed from the judge's catch list is reported
   void, verdict files cannot be produced without the CLI run metadata.
4. Outline contract and the scope check of central claims.
   verify: the misplaced case-(3) sentence and the unscoped main result of the origin
   both fail on fixtures.
5. The origin incidents added to `evals/`; pilot on susu-quiver.
   verify: all existing evaluation cases still pass, including the two on unnecessary
   gates, and the pilot report lists zero unverified units.

## Implementation record

### Stage 1 (2026-11-25)

Code: `harness/tex.mjs` (decomposition), `harness/verify.mjs` (rules, checks, verdicts,
gate), `harness/rules.json` (harness-wide rules), the `paper-verify`, `paper-units` and
`hook` entries of `harness/cli.mjs`, the commit mark in `harness/checkpoint.mjs`. Use:
[PAPER-REVIEW](../PAPER-REVIEW.md#verification-gate) and
[OPERATIONS](../OPERATIONS.md#manuscript-verification-gate).

Criterion and result. `tests/verify.test.mjs`, 11 tests on fixture manuscripts, all
passing with the 30 earlier tests: every check flags its defect and passes the corrected
text; a rule whose check misses its failing text is refused and no verdict file is
written; after an edit only the changed sentence, its paragraph, the build of the document
and the sentences that depend on a changed definition or calculation output are judged
again; the hook blocks the session that changed the manuscript and no other session, and
releases on verification, on a declaration bound to the text, and after three blocks of
one text. The configured hook command was also run in this repository on a temporary
enrolled manuscript with simulated events: no output on the tool events, `{}` for the
Stop of a session whose call merely spanned the edit, the blocking decision for the
editing session. The two evaluation cases on unnecessary gates are untouched, since a
manuscript without `VERIFY.json` is not gated and gets no file.

Checked on real drafts, on scratch copies, with no project file written. The susu-quiver
Claude draft at 2a4d45a: 448 sentences, 100 paragraphs, 28 titles, 470 numerals and 92
symbols, 2,398 verdicts in 0.06 s. The checks that need no registry found a lowercase
"this section" (main.tex:1005) and prose wrapped over two source lines (main.tex:492 to
493), with no finding on its 28 titles and six colons or semicolons left to the
independent verdict. The default build took 5 s, recorded the four overfull boxes of its
log as the baseline, and a second run rebuilt nothing. The table-header check was run on
the PDF of the origin incident, rebuilt from 5f1acb6 (the commit before the Table 1 fix):
it reports the header of Table 1 on page 13, and nothing on the current draft. Its first
form also reported a line of superscripts above a caption. The check now requires a word
in the repeated line, and that case is a test.

Choices made in the implementation, each the lead's and open to the user's correction.

1. Harness-wide rules are registered once in `harness/rules.json` and apply to every
   enrolled manuscript. `paper/RULES.json` holds the project's own. Registration is the
   entry itself: all entries are tested against their failing and passing texts at every
   load, so a hand edit cannot register an untested rule.
2. A manuscript is enrolled by its first `paper-verify` run (`VERIFY.json` exists).
   Nothing else is gated.
3. A verdict is pass, fail, awaiting the independent verdict, or not judged. At stage 1
   verification is complete when nothing fails and nothing is unjudged. Verdicts awaiting
   the independent verdict are counted in the table and do not block until stage 3.
4. Colons and semicolons. The design lists them under code-only checks, and PAPER-STYLE
   says the preference is not a character ban. Code decides the certain cases (an em-dash
   fails, a colon before a display or ending its sentence passes). Every other colon or
   semicolon awaits the independent verdict.
5. Numerals are digits and number words in the prose and the closed numeric sides of
   inline formulas. Excluded by rule: digits joined to a word, `one`, ordinals, a
   comparison with zero, references. A fact is a calculation output (`file`) or a place
   in the manuscript that states the number (`at`). The second kind is what the design's
   table lacked for counts and parameters the text itself fixes ("two nodes", $N_c=2$).
   Its meaning awaits the independent verdict, so a number "without explanation" is one
   with neither.
6. Definition sites live in `paper/LEXICON.json` already at stage 1, since use before
   definition needs them. Symbols are compared by letter, font, accent and roman
   subscript. Titles are exempt. Notation declared `standard` is listed once as awaiting
   attestation.
7. The overfull boxes of the first build are the baseline. The build check also fails on
   undefined references and citations.
8. The Stop gate holds a session to account only for a manuscript it changed. The first
   form compared each manuscript with its state at the start of the session. It was
   dropped before delivery: several sessions work in this repository at once, and each
   would have been blocked by an edit made in another. A change is now attributed through
   `PreToolUse` and `PostToolUse` events of the shell and editing tools: the sources
   differ across one of the session's own calls, and a tool input of the session has named
   the manuscript. One text is blocked at most three times. A commit of an unverified
   enrolled manuscript carries `Manuscript-Verification: incomplete`.
9. The two tool events are generated by `install-hooks.mjs` and are not installed in this
   repository. They change the hook configuration of every session, so installing them
   is the user's decision. Until then the Stop gate blocks no session.
10. `TOOL` in `verify.mjs` is part of every verdict key. Raising it judges everything
    again.

Open, for the stages that need them.

- Stage 2 supplied the attestation of `standard` notation and of candidate terms
  ([record](#stage-2-2026-11-25)). Verbs remain among the candidates.
- Stage 3 has to judge the grounds themselves (a fact with `at`, a `standard`
  declaration, a colon), not only sentences, and give the run metadata that makes a
  verdict file impossible to produce by hand.
- The pilot will show the cost of binding every numeral sentence by sentence (470
  numerals in 448 sentences on the susu-quiver draft), notation such as $\mathcal N=1$
  included. A registry of notation that contains a numeral is the likely remedy and is
  not built.
- Not judged by any check yet: numerals in display equations and table cells (generated
  tables should be bound to their generator), indices of symbols, proper names that
  occur only in a title.
- The gate has not yet blocked a live session: the tool hooks are not installed, and the
  provider documentation was read through a summarizing fetch. The first live session
  after installation is the test. Codex reports an edit as `apply_patch` with the patch
  text as input, which the same rule covers, and this is unexercised too.
- A session that has named a manuscript and has a call running while another session
  edits it is counted as having changed it. With two writers on one project this can
  happen. The three-block limit ends it, at the cost of three continuations.

### Stage 2 (2026-11-25)

Code: `harness/corpus.mjs` (the corpus built from the wiki sources, the words and symbols of
a paper, attestation counts), the `term-attested` check and the attestation of `standard`
notation in `harness/verify.mjs`, the `term-attested` rule in `harness/rules.json`, the
`corpus-build` and `corpus-count` entries of `harness/cli.mjs`, `segments` and `numberWord`
exported from `harness/tex.mjs`. Use: [PAPER-REVIEW](../PAPER-REVIEW.md#verification-gate)
and [OPERATIONS](../OPERATIONS.md#manuscript-verification-gate).

Criterion and result. `tests/verify.test.mjs` has two new tests, and all 43 tests of the
repository pass. On fixtures: the three coined labels of the origin fail (they are the
failing texts of the registered rule, which is refused unless its check flags them), their
replacements pass, mathematical notation is never a candidate term, and a term with a
definition site passes. Also tested: the selection of the corpus by category and by an
exclusive cutoff, the refusal of a cutoff later than two years before the build, the places
that break a word sequence, the folding of case, plural and hyphen, a term that needs the
user's approval or a declaration, a larger corpus changing only the verdict whose ground it
changes, the check left not judged without a corpus, and `standard` notation absent from the
corpus failing.

The corpus built from the wiki on this computer (396 source folders): 277 papers and
3,041,460 words with the cutoff 2024-11-25, 104 folders excluded by date and 15 by category,
built in two seconds. Three checks of the extraction against other methods.

1. Words per paper against the corpus of the 2026-11-05 language audit (a Python tool using
   pylatexenc) for the 198 papers in both: the median ratio is 0.95, with 5 % of the papers
   below 0.79 and 5 % above 1.17. The Python tool counts single letters of mathematics as
   words, and it kept 3,470 words of 1408.6522, a paper of many files, where this build
   has about 22,000.
2. "conformal window" is in 25 corpus papers. A regular-expression search of the raw
   sources finds 31. The six others have the phrase only in a reference title or a comment.
3. The three origin labels are in no corpus paper and in no raw source.

These checks found four defects of the first form, all fixed and now tested: a harvmac
source where `\Title` and `\listrefs` first occur in the format's own definitions gave no
text (1305.3924); two adjacent inline formulas were read as the opening of a display, which
lost four fifths of a paper (1805.11543); a chapter file was taken for the root file
(hep-th/9905111, 1503.08825); an archive stored under the name `main.tex` was read as a
source.

On the susu-quiver Claude draft at 2a4d45a, on a scratch copy with no project file written:
of 476 sentences and titles, 175 pass, 195 fail and 106 await the independent verdict, in
0.46 s without the build. Six compounds fail (anomaly-forced, decoupling-corrected,
description-dependent, gauge-group-independent, non-dualized, non-Veneziano) and 91 word
pairs, singular and plural counted separately. Among the pairs are phrases of the project
("flavor numbers", 46 sentences, one corpus paper; "single-node fixed point", 19;
"magnetic coupling", 11; "bifundamental pair", 10 and one corpus paper) and about 25 pairs
of a subject and its verb or predicate ("flow reaches", "realizes case"). The wording that
replaced one origin label in the draft, "one bifundamental pair", is itself in a single
corpus paper, so on the real corpus it fails until it has a definition site.

Choices made in the implementation, each the lead's and open to the user's correction.

1. Candidates are hyphenated compounds and pairs of adjacent content words, not noun
   phrases, since nothing here tags parts of speech.
2. Code fails an unattested compound, and an unattested pair that stands in two or more
   sentences or titles. A pair that occurs once awaits the independent verdict, as the
   colons do at stage 1. A coined label used once is therefore not failed by code.
   Measured before the choice, with the corpus of the Python audit tool: failing every compound
   and pair absent from the corpus, repeated or not, flagged 314 of the 476 sentences and
   titles of the draft, mostly for ordinary wording.
3. Attested means at least two corpus papers, since one occurrence in the literature does
   not show that a wording is natural (PROTOCOL, Paper discipline).
4. Words are compared in lower case, without a possessive ending, in the singular, with a
   hyphen as a space. Without this "conformal windows" was absent from the corpus. The
   cost is leniency: "two-part" is attested through "two parts".
5. A ground in `LEXICON.json` is `at`, `approved` or `ordinary`. Code cannot check that the
   user approved, so every report lists the approved terms. `ordinary` does not pass. It
   awaits the independent verdict, so the writer cannot clear its own wording.
6. No pair starts at a number word, a roman numeral or a possessive. The first run on the
   draft had failed "iii configurations" (from "Type III configurations"), "fifteen
   theories" and "node's fixed".
7. The corpus is data read at verification, like a calculation output. It is not part of
   the gate hash, and the key of a verdict holds the attestation of each candidate, so a
   rebuilt corpus changes only the verdicts whose grounds it changes. `VERIFY.json` records
   the hash, cutoff and size of the corpus used. The corpus is built by the harness in
   Node. The audit tool `projects/susu-quiver/calc/audit_gpt_language.py` was not reused:
   it belongs to one project, needs pylatexenc and has a fixed cutoff.
8. `standard` notation must occur in the mathematics of two corpus papers. A single letter
   nearly always does, so this catches composite notation (`N_{bif}`) and little else.
   The meaning stays with stage 3.
9. A term entry of the lexicon needs exactly one ground. An entry without `at` was ignored
   at stage 1 and is now refused.
10. Two tests of stage 1 changed with the behavior: their fixtures now carry a corpus, and
    the test of `standard` notation asserts the new verdicts.

Open after stage 2.

- A subject and its verb form a pair. On the pilot draft about 25 such pairs need an
  `ordinary` declaration. A test of verb use drawn from the corpus could replace the
  declarations and is not built.
- An adjective before an attested term fails as a pair ("leading central" in "leading
  central charge"), although the finding shows the phrase it stands in.
- The corpus is the wiki's selection, not all of hep-th. A standard term of a subfield can
  be absent. The remedies are a definition site, the user's approval, or more papers in the
  wiki (`/wiki-ingest`, the user's step) followed by `corpus-build`.
- Single words are not compared ("flavorless"), and British spelling is not folded.
- Stage 3 has to judge the pairs that occur once, the `ordinary` declarations and the
  meaning of `standard` notation.
- Three source folders of the wiki hold a tar archive under the name `main.tex`
  (1406.1078, 1706.03762, 2111.00955). The build skips such files. The vault is not edited
  from this repository.
