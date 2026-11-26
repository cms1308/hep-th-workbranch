# Manuscript verification — design

Status: design and its four open choices decided by the user on 2026-11-25. **Stages 1 to
4 of 5 implemented**: stages 1 to 3 on 2026-11-25, stage 3 rebuilt on 2026-11-26 for its
cost, stage 4 and the sentence grounds (4a) on 2026-11-26 ([record](#implementation-record));
stage 5 is not. No manuscript is enrolled yet (the pilot is stage 5).
[PAPER-REVIEW](../PAPER-REVIEW.md) and [PAPER-STYLE](../../PAPER-STYLE.md) remain the active
policy, and the reading duty stays in full: a judge sees a sentence with its paragraph,
its headings, the passages it rests on and the outline, not the rest of the notes, the
data or the cited sources. This file is the specification the next
stage starts from.

## Why

User instruction, 2026-11-25: a draft is written to be the best publishable paper, and
"best" means an answer exists. Every word, sentence, paragraph and logical structure
needs explicit grounds. A rule that only enters the prompt is not enough: each rule must
pass an actual verification, and the excuses "either wording is fine", "I did not notice
while reading" and "the harness had the rule but I did not apply it" are not acceptable.

Origin (susu-quiver, same day). Before the publishability pass the user found, one at a
time, the coined label "saddle scenario", a number that appeared without explanation
("204") and a paragraph of Section 3.1 that the argument did not need, with the coined
"one-pair theories"; the lead's report in the chat counted ten rows for nine. On the
user's instruction to judge for itself, the lead then applied about a hundred edits from
the reports of two report-only reviewers by scripted replacement and reported the pass as
finished. The reviewers, not the lead's reading, had caught the coined "symmetry-quotient
method", a physically wrong statement about case (5), a main result whose scope
contradicted a later Section and symbols used before their definition (susu-quiver
PLAN 83). After the pass the user found a sentence about case (3) left at the end of the
Section on case (5) and an outline (`PUNCHLINES.md`) that was neither read nor updated
(PLAN 85). Every one of these was covered by an existing written rule. None of the rules
had a check. (Corrected on 2026-11-26 against the session record: this paragraph had
said that the user found all of them after the pass.)

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
  (Built at stage 4 with `OUTLINE.json` in place of `PUNCHLINES.md`. An entry is bound to
  its paragraph by the key of the independent verdict, which covers both, and not by a
  hash that the writer renews. See [the record](#stage-4-2026-11-26).)
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
  (Both statements were replaced on the user's go of 2026-11-26, after the cost of the
  first form was measured: a call now holds one rule family for many units, and the planted
  texts stand in every call, whose answers on a rule count only if it got that rule's
  planted texts right. See [the second form](#stage-3-second-form-2026-11-26).)
- **Search for a better sentence.** The judge is asked to produce a sentence that is
  better under the ranked criteria. If it can, the unit fails and is replaced. A unit
  passes when two independent judges both fail to improve on it.
  (Taken out of the gate by the user on 2026-11-26, on its measured behavior. It now gives
  advice on request and no verdict. See
  [the record](#stage-3-the-search-for-a-better-sentence-leaves-the-gate-2026-11-26).)
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
| judging models | a model from a different vendor than the writer, two judges in agreement (changed by the user on 2026-11-26 to one judge, [record](#stage-3-one-judge-2026-11-26)) |
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
4a. Sentence grounds: the row "sentence" of the table "Units and grounds". It was assigned
   to no stage when these stages were written, and was added on 2026-11-26 after the user
   found it missing ([record](#sentence-grounds-2026-11-26)).
   verify: the sentence on cases (3) and (5) of the origin, grounded by the passages
   it rests on, fails; a sentence typed as needing no ground that states a result fails.
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
  verdict file impossible to produce by hand. Done at [stage 3](#stage-3-2026-11-25).
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
  meaning of `standard` notation. Done at [stage 3](#stage-3-2026-11-25).
- Three source folders of the wiki hold a tar archive under the name `main.tex`
  (1406.1078, 1706.03762, 2111.00955). The build skips such files. The vault is not edited
  from this repository.

### Stage 3 (2026-11-25)

Criterion and plan of checks, written before the code. The design's criterion has two
parts, and the plan adds what the Section "Making the independent verdict real" requires.
Every item is a test with an injected judge. No test calls a model.

1. Void run. A judge that answers every seeded defect of a run correctly except one gives a
   run reported void: the report names the missed defect, no verdict of the run is
   recorded, and the manuscript stays incomplete. The same judge with nothing removed gives
   a valid run whose verdicts are recorded. A judge that fails a text registered as passing
   voids the run as well.
2. Verdict files need the CLI run metadata. (a) A `VERIFY.json` written or changed by hand
   (a fail turned into a pass, `complete` set, an independent verdict typed in) is not
   accepted: the gate reports the manuscript unverified, and the next `paper-verify` judges
   every unit again and drops what no run record supports. (b) An independent verdict
   counts only while the record of its run exists with a valid state and holds the same
   unit, rule family and key. (c) A record of a void or unfinished run, or of a judge from
   the writer's vendor, supplies no verdict.
3. Narrow calls. Every call holds one unit and one rule family. Its schema requires, for
   each question, pass or fail, a reason and evidence. An answer that omits a question, or
   whose evidence is not a quotation of the material shown, supplies no verdict.
4. The grounds that awaited the verdict at stages 1 and 2 are judged: a number bound with
   `at`, a `standard` declaration, a colon or semicolon, a pair that occurs once, an
   `ordinary` declaration. Two passing judges give a pass, one failing judge a fail, one
   passing judge alone leaves the verdict awaiting.
5. Better sentence. A unit for which a judge returns a replacement fails, with the
   replacement and the ranked criterion as evidence. It passes when two judges return none.
6. A defect found by the user, registered as a rule with its failing text, is among the
   seeded defects of every later run that asks its family.
7. Hash binding. After a one-sentence edit only the questions of its paragraph are asked
   again, and the verdicts of the other units are kept.
8. Completeness and the gate. A verdict awaiting the independent verdict now leaves the
   verification incomplete (stage 1, choice 3), so the Stop gate and the commit mark hold
   until the judges have passed the text. The hook does not throw.
9. The 43 earlier tests pass. An assertion changes only where it states the behavior that
   stage 3 replaces, and each such change is listed in the record.
10. One live run with Codex on a small scratch manuscript, to check what no injected judge
    can: that the provider accepts the generated schema and returns answers the reader of
    answers accepts. Its calls, tokens and time are reported.

Code: `harness/judge.mjs` (the prompt, the schema and the reading of an answer, the planting of
registered texts, one run of a judge, `paper-judge`), in `harness/verify.mjs` the questions
that code leaves to a reader, the rule kinds `judge` and `better`, the judge samples of a
code rule, the reading of run records into verdicts, the seal of `VERIFY.json` and the new
meaning of complete, in `harness/dispatch.mjs` the narrow invocation, the call timeout and
`collect`, in `harness/rules.json` judge samples for four code rules and the rules
`scope-stated`, `in-place` and `better-sentence`, the `paper-judge` entry of
`harness/cli.mjs`. Use: [PAPER-REVIEW](../PAPER-REVIEW.md#verification-gate),
[OPERATIONS](../OPERATIONS.md#manuscript-verification-gate) and
[AUTOMATION](../AUTOMATION.md#independent-verdicts-on-a-manuscript).

Result. `tests/judge.test.mjs` has seven tests with an injected judge (`tests/judges.mjs`),
and all 50 tests of the repository pass. By the numbers of the plan above:

1. Passed. A judge whose catch list lacks the coined label used once gives two void runs
   (7 of 8 seeded defects caught), 14 calls each, none of them about the manuscript, no
   verdict in `VERIFY.json`, and a report that names the missed text. A judge that fails one
   passing text is void as well. With nothing removed the same manuscript gets two valid
   runs and is complete, 19 verdicts resting on them.
2. Passed. A fail turned into a pass by hand with `complete` set: the gate reports the
   manuscript unverified and blocks, and the next `paper-verify` judges all 44 verdicts
   again and restores the fail. The complete file copied to a manuscript without run records
   gives no verdict. A record set to an unfinished state, one whose seeded defects were not
   all caught, a removed one and an unreadable one supply nothing, and neither does a judge
   of the writer's vendor.
3. Passed. A call holds one unit and one family, the schema requires every question with
   verdict, reason and evidence, and an answer that omits a question or quotes words that
   are not in the material is refused, so its questions keep awaiting.
4. Passed for the five grounds (the questions and what they quote are asserted): two passing
   judges pass, a failing judge fails with its reason and quotation, one passing judge
   leaves the verdict awaiting.
5. Passed. The unit fails with the replacement and its criterion as evidence, the second
   judge is not asked about it, and the replaced sentence is judged as a new unit.
6. Passed. A rule registered in `paper/RULES.json` with the user's failing text is among the
   planted texts of the runs after an edit, and a judge that misses it is void.
7. Passed. After one sentence changed, 8 questions are asked in each run, those of the two
   sentences of its paragraph, and the other units keep their verdicts and runs.
8. Passed, with the hook tested on an unreadable seal and unreadable run records.
9. Five of the 43 earlier tests changed, each in what stage 3 replaces. The refusal of the
   kind `judge` "until stage 3" became the refusal of a `judge` rule without a question and
   of an unknown kind. The report line "not implemented (stage 3)" became the line on
   independent verdicts. Three tests that asserted a verified manuscript (the build
   baseline, the release by the Stop hook, the unmarked commit) had fixtures with verdicts
   awaiting a judge: the first now asserts the build verdict itself, the other two reach
   the verified state through two injected judges, and the work-in-progress list of the
   Stop test counts the awaiting verdicts (4 instead of 1).
10. Done, see the live runs below.

Measured, on scratch copies with no project file written.

- The susu-quiver Claude draft at 2a4d45a, with the corpus and without the build: 448
  sentences give 1,008 questions (448 for the family `content`, 448 for a better sentence,
  106 on word pairs that occur once, 6 on colons and semicolons, none on numbers and
  notation because the draft has no `FACTS.json` or `LEXICON.json`). 402 of the 448
  sentences fail a code check (an unbound numeral, a symbol without an entry, an unattested
  term), so 116 questions on 46 sentences could be put to a judge today. A prompt has a
  median of 2,981 characters, 5,134 at most, 3.07 million for the 1,008. The verification
  takes 0.33 s.
- Live runs with Codex (CLI 0.171.0-alpha.13.2, provider default model: this computer's
  configuration names gpt-6.2-astra at reasoning effort xhigh, and the provider reports no
  model identity in its events), on a scratch manuscript of four sentences with one ground
  of each kind. In all 53 calls, 1,095,382 input tokens and 16,018 output tokens recorded.
  The tokens of the one refused answer (about 21 thousand) are missing from these sums: a
  call whose answer was refused recorded no usage, which is corrected.
  - First run, the better-sentence family only: 4 calls, 107 s of call time, 83,970 input
    and 3,044 output tokens. Both judges improved the seeded wordy sentence, and both
    replaced the sentence then registered as passing ("The gauge coupling is asymptotically
    free for $N_f<3N_c$.") by "The theory is asymptotically free for $N_f<3N_c$." under
    criterion 7. Both runs were void, as built. The judges applied the criteria as written,
    so the fault was the registration of a passing text for this search (choice 6).
  - A call with a one-line prompt: 20,772 input tokens. Without the user's Codex
    configuration 18,493, and 109 s against 9 s.
  - Second run, every family: 47 calls in 949 s with four at a time, 972,147 input tokens
    (96,000 from cache) and 12,964 output tokens (7,513 of them reasoning). Each call took
    21.0 to 21.3 thousand input tokens whatever its prompt (868 to 2,065 bytes), and a
    median of 73 s in the first run and 51 s in the second. Both runs were valid: the
    judges answered 28 of 28 planted texts as registered (15 of 15 caught, 13 of 13
    passed). The provider accepted every generated schema. Of the 21 answers on the
    manuscript one was refused, for evidence that quoted the headings line of the prompt
    word for word: the reader of answers compared quotations with the unit, paragraph,
    headings and questions and not with the whole material shown. It now does, with a test,
    and the call was not repeated.
  - What the judges did with the four sentences: each of them got a better sentence from
    one of the two judges (criterion 4 once, 5 once, 7 twice), and the two sentences the
    first judge passed were the two the second replaced. One of its replacements writes
    "two" as "2" to save two characters. `scope-stated` failed one sentence and `in-place`
    one, a sentence on $\mathcal{N}$ under the heading "Two nodes", which the fixture
    deserves. The ground questions that both judges answered passed (a number, a
    declaration of ordinary wording, the standard notation).

Choices made in the implementation, each the lead's and open to the user's correction.

1. Two commands. `paper-verify` never calls a model and stays the only writer of
   `VERIFY.json`. `paper-judge` asks the judges, records their answers and then runs the
   same verification.
2. The writer is declared with `--writer`, kept in the local run metadata and printed in
   every report. The judge is the other of the two vendors the launcher knows. Code cannot
   check the declaration, and a manuscript with sentences from both vendors has no eligible
   judge.
3. "Two judges" are two separate runs of that vendor's CLI, with its default model unless
   `--model a,b` names one for each. A pass needs two valid runs, one failing run fails the
   unit, and there is no third opinion: the writer cannot overrule a judge, so a disputed
   verdict is settled by changing the text or by the user.
4. A run asks the planted texts first and the manuscript only when the judge got all of
   them right. The calls are separate processes without memory of one another, so the order
   tells the judge nothing, and a void run costs the planted calls only (14 when every
   family is asked).
5. A judge that fails a text registered as passing voids the run as well. The design names
   only the seeded defects. Without this a judge that fails everything would catch every
   defect and force edits on sound text.
6. The search for a better sentence has failing texts only (texts a judge must improve). A
   passing text was registered at first and dropped after the first live run (below): the
   design defines a pass of this search by two judges failing to improve, not by
   registration.
7. A planted text is a registered text appended to a copy of the manuscript and checked by
   code there, with the manuscript's own lexicon, facts and word counts. A text that code
   decides in this manuscript (an approved term, a repeated pair) is reported as not
   planted, and a family without a planted defect is not asked.
8. Rule families. The reader rules share the family `content` unless they name another.
   Each code rule's open questions, and the search for a better sentence, are families of
   their own. A sentence therefore costs two calls for each judge, and one more for each
   code rule that left it a question.
9. Every call shows the unit and its paragraph, and the calls of reader rules also the
   headings above it. The key of a question covers all that is shown, so an edit asks the
   sentences of its paragraph again and nothing else. The position label of a unit is not
   shown, since it changes when a paragraph is inserted earlier.
10. Evidence must be a quotation of the material shown, compared without regard to spacing,
    for a pass as for a fail. An answer without one is refused.
11. A unit that fails or is not judged by a code check is not put to a judge, since it has
    to change first.
12. The harness-wide reader rules are two, `scope-stated` and `in-place`, the third and
    fifth items of "Judge every sentence" in PAPER-REVIEW and two of the seeded defects the
    design names. The first two items (correct, supported) are not registered: a judge
    without the notes and sources cannot decide them, and a rule the judge cannot apply
    only adds void runs.
13. The independent verdicts live in the run records, and `VERIFY.json` is a view of them
    rebuilt at each `paper-verify`. The file itself is sealed by a hash in the local run
    metadata. A file without a matching seal contributes nothing but the enrollment: every
    verdict is judged again, and its build baseline and work-in-progress declaration are
    not taken over.
14. A verdict awaiting the independent verdict now leaves the verification incomplete, as
    choice 3 of stage 1 announced, and the work-in-progress list includes these verdicts.
15. The prompt of the better-sentence search states the ranked criteria and not the
    registered rules. A replacement is checked by the rules once it stands in the
    manuscript, and listing them would ask every sentence again whenever a rule is added.
16. A call runs in an empty temporary directory, so that no project instruction file or
    hook reaches the judge, with the provider's default model and settings.
17. `JUDGE` in `verify.mjs` is part of every question key and of the gate hash. Raising it
    asks every independent verdict again. `VERIFY.json` is now version 2.

Open after stage 3.

- Whether the search for a better sentence settles. Under criterion 7 the live judge
  shortened a plain sentence by one word, twice out of two. Each replacement is a new unit
  that two judges read again, so a draft may need several rounds, and nothing here measures
  how many. Proposed for the pilot: run the search on one Section first and count the
  rounds until no judge improves a sentence. If it does not settle in three, the threshold
  of criterion 7 (how much shorter counts) goes to the user.
- Cost. At 21 thousand input tokens and 20 s of elapsed time for each call, the 1,008
  questions of the pilot draft, put once to each of two judges, would be about 2,000 calls,
  43 million input tokens and 11 hours with four calls at a time, before any round of
  replacements. This is an extrapolation from 47 calls on a four-sentence text. A fit to
  the 46 calls with recorded usage gives 20,758 fixed tokens for each call and 0.28 tokens
  for each byte of prompt, so the question was 1.8 % of the input there and would be 4 %
  on the draft (1.7 of the 43 million). The fixed 21 thousand tokens are the provider's own
  instructions and tools, not the question. Proposed: bind the numbers and symbols first
  (402 of the 448 sentences cannot be asked yet), then ask one Section, and before the
  whole draft bring the user the choice among a lower reasoning effort, asking the
  better-sentence family (half of the calls) only after the other families pass, and a
  provider interface without the fixed instructions.
- The run records are local. On another computer the code checks are judged again in
  seconds, and the independent verdicts must be asked again. Proposed, if the pilot draft
  is edited on two computers: commit a compact copy of the run records with the project.
- What the seal establishes: a verdict typed or changed in `VERIFY.json`, and a verdict
  without a recorded run, do not count. It does not resist a session that deliberately
  writes run records with its shell access. Nothing kept on the same computer can.
- Two runs of one model are two samples of one judge. `--model a,b` gives two models of
  the vendor. Whether that changes the verdicts is not measured.
- A Claude judge, for text written by Codex, has not been launched live. Its arguments are
  built and tested, the call is not.
- The sentence row of the table "Units and grounds" (a type and its link to an equation, an
  evidence run or a CITATIONS row) is not built, and no judge reads the notes, the data or
  a cited paper. Proposed: with the outline contract of stage 4, a registry of links and a
  family whose calls may read the linked file.
- A replacement written by a judge is not checked by the code rules before it is reported.
  It is checked once the lead puts it in the manuscript.
- The planted texts are fixed fixtures, the same in every run. They test that this judge,
  with this prompt, applies each rule. A defect made from the manuscript's own sentences
  (its own number changed, its own sentence moved) is not built.
- Single coined words, and the items listed as open after stage 2, are unchanged.
- The tool hooks are still not installed and no manuscript is enrolled, so the gate has
  not yet held a live session.

### Stage 3, second form (2026-11-26)

Why. The first form cost too much to use. It launched the judge's CLI once for each
sentence and rule family, every launch carried 20,758 fixed input tokens, and the question
was 1.8 % of a call. One pass over the pilot draft was estimated at 2,000 calls, 43 million
input tokens and 11 hours. Asked whether that is reasonable (it is not), the user lifted the
constraint that had produced it ("기존 스킬 및 하네스 구조 유지할 필요는 없고 아무튼 지금
제대로 하네스 짜보는거야", 2026-11-25) and gave the go on the three changes proposed in reply
("그래 해봐", 2026-11-26): calls by paragraph instead of by sentence, the size of a call
fixed by measurement on planted texts, and a narrower search for a better sentence. The
principles stand (no rule without a check, the writer cannot pass its own text, verdicts
bound to content hashes, the judge tested on seeded defects). Two statements of the Section
"Making the independent verdict real" are replaced, and the record below says by what:
"one sentence ... per call", and "the whole run is void".

Criterion and plan of checks, written before the code. Tests use an injected judge.

1. A call puts one rule family to the judge for many units at once: whole paragraphs, taken
   in reading order up to a set number of units, each unit shown in its own paragraph. The
   schema of a call requires an answer for every unit and question, and the key of a
   question, which binds its verdict, does not depend on what else is in the call.
2. Every call carries the planted texts of the rules it asks, placed among the paragraphs
   of the manuscript at positions the judge cannot tell from the others. The answers of a
   call on a rule count only if that call answered every planted text of that rule as
   registered. A judge whose catch list lacks one seeded defect therefore supplies no
   verdict on that rule, and the report names the rule and the planted text.
3. Fitness of a run. The answers of a run on a rule count only if the judge answered at
   least nine in ten of that rule's planted texts in the run as registered. Below that, all
   of the run's answers on the rule are dropped, also those of the calls that caught theirs.
   At or above it, only the calls with a miss are dropped.
4. An answer is read question by question. A missing verdict, or evidence that is not a
   quotation of the material, loses that unit's answers on that rule and nothing else.
5. The search for a better sentence is put only to a sentence whose other verdicts have all
   passed. A replacement counts when the judge names a gain under criteria 1 to 6, or when
   it has at least a fifth fewer words. A smaller saving in length is recorded and passes.
6. What held in the first form still holds: the grounds left to a reader are judged, two
   passing judges pass and one failing judge fails, a defect the user found is planted from
   then on, an edit asks the sentences of its paragraph again and no others, a verdict file
   counts only with the run metadata of the CLI, and the hook does not throw.
7. Live, with Codex, on scratch copies: the share of planted texts answered as registered
   for calls of about 10, 25 and 50 sentences of real prose, with the counts behind each
   share, and the tokens and time of each. The default size of a call is the largest at
   which no planted text was missed. A small manuscript is taken through to the end.

Code: `harness/judge.mjs` rewritten (a call of blocks, its schema and reading question by
question, planted texts in every call, runs that follow one another), in
`harness/verify.mjs` the reading of run records by call and rule (`recorded`), votes by
rule (`settle`), `FIT`, `SHORTER`, `JUDGE` raised to 2, paragraph and headings as context of
the reader rules only, in `harness/rules.json` one planted paragraph for each of
`scope-stated` and `in-place` holding its sound and its defective sentence, and neutral
labels in the planted texts, `--batch` and `--all-units` in `harness/cli.mjs`.

Result. `tests/judge.test.mjs` has eight tests with an injected judge, and all 51 tests of
the repository pass. By the numbers of the plan above:

1. Changed by the measurement below, then passed. A unit judged in its paragraph (the
   reader rules, the better sentence) shares a call with no other paragraph of the
   manuscript. A question that code left open is about the sentence alone, is shown without
   its paragraph, and such units are put together up to `--batch` (25). The fixture that
   took 58 calls in the first form takes 20.
2. Passed. A judge whose catch list lacks the coined label gives no verdict on
   `term-attested` and judges the other rules. A judge that fails the passing text of
   `in-place` gives no verdict on `in-place`, and its verdicts on `scope-stated` from the
   same calls stand.
3. Passed. With one miss in twelve calls (23 of 24 planted texts right) the eleven other
   calls count and the one is asked again. With three (21 of 24) not one answer of the run
   counts for the rule.
4. Passed. A missing answer and one that quotes nothing each lose one unit's verdict on one
   rule, and the other answers of the call stand.
5. Passed. The search is asked after two judges passed everything else. "two" written as
   "2" is recorded and passes, four words for six fail the sentence, and so does a gain
   named under criterion 5.
6. Passed, with the tests of the first form rewritten for the new records. After an edit
   the questions about the other sentence alone (its number, its colon, its word pair) now
   keep their verdicts, since they no longer show the paragraph.
7. Done, below. The share of planted texts answered as registered did not depend on the
   size of a call, so it could not fix the size. The verdicts on the manuscript did.

Measured, live with Codex (provider default, gpt-6.2-astra at reasoning effort xhigh in
this computer's configuration), on scratch copies with no project file written.

- Size of a call, on the first 60, 100 and 150 sentences of the pilot draft (2a4d45a) under
  the two reader rules, two runs each, with `--all-units`:

  | sentences a call (at most) | calls | planted texts as registered | input tokens | output tokens | median time of a call |
  | ---: | ---: | ---: | ---: | ---: | ---: |
  | 10 | 18 | 72 of 72 | 422,326 | 63,675 | 70 s |
  | 25 | 10 | 40 of 40 | 262,846 | 77,570 | 164 s |
  | 50 | 8 | 32 of 32 | 239,562 | 102,804 | 285 s |

  No answer was refused and no call failed: the provider accepted schemas of up to 110
  required answers. The planted texts were caught at every size, 144 of 144, so they do not
  tell the sizes apart.
- The verdicts on the manuscript do. On the same first 60 sentences (120 verdicts) a run
  failed 3 at 10 a call, 7 at 25 and 11 or 12 at 50, all under `scope-stated`. The reasons
  at 25 and 50 name conditions that stand in other paragraphs of the same call: an
  abstract sentence fails because it "omits the vector-like bifundamental pair used to
  obtain the stated mechanism", the opening sentence of a paragraph because the restriction
  "appears only later". A judge that sees several paragraphs judges a sentence against all
  of them. The verdict then depends on text its key does not cover, which principle 4
  forbids, and so a call holds one paragraph. What the larger calls found (a claim in the
  abstract or introduction wider than what the body establishes) is the scope check of
  stage 4, where the dependence on the whole text belongs in the key.
- Two runs of one model are one judge. At 10 and at 25 a call the two runs gave the same
  verdict on all 120, at 50 on 117. The second run doubles the cost and adds almost no
  independent reading.
- Sentences judged alone, in calls of 25: the first 50 open questions on word pairs of the
  pilot draft, 4 calls in 148 s, 113,174 input and 12,457 output tokens, 16 of 16 planted
  texts as registered, no answer refused. The first run failed 4 of 67 questions, each a
  phrase used as a name ("NSVZ one-loop coefficient", "numerator coefficient", "ABJ
  anomaly-free condition", "electric flow"), and the second passed the 59 it was asked.
- The four-sentence scratch manuscript of the first form, taken to the end: four runs of 7,
  6, 2 and 1 calls in 226 s, 349,668 input and 17,008 output tokens, 43 of 43 planted texts
  as registered. The first form took 47 calls, 949 s and about 993 thousand input tokens
  for the same text. It ends incomplete, as it should: `in-place` fails the sentence on
  $\mathcal{N}$ under the heading "Two nodes", and the search replaces two sentences (once
  under criterion 4, once with four words for six). No judge offered "2" for "two" again.
- The search for a better sentence on real text: the first 15 sentences of the pilot draft
  (the abstract and two paragraphs of the introduction), `--all-units`, 6 calls in 366 s,
  133,312 input and 29,898 output tokens. The first judge replaced 12 of the 15: 5 by a text
  with at least a fifth fewer words, and 7 under criterion 1, each of which changes what
  the sentence claims (it adds "with one active gauge coupling" to the statement on the
  Lagrange multiplier, for example). The second judge replaced 1 of the other 3. No smaller
  saving was offered.
- In all on 2026-11-26: 62 calls, 1,520,888 input and 303,412 output tokens, and 209 of 209
  planted texts answered as registered.

Choices made in the second form, each the lead's and open to the user's correction.

1. One paragraph a call for the rules about a sentence, decided by the measurement above
   and not by the planted texts, which the plan had named as the measure.
2. A question that code left open shows the sentence and not its paragraph. Its verdict is
   then bound to the sentence alone, the units can share a call, and an edit elsewhere in
   the paragraph no longer asks it again.
3. The planted texts stand in every call instead of before the run. The design's "the run
   is valid only if the judge catches all of them" becomes two conditions on a rule: the
   call caught all planted texts of the rule, and the run caught nine in ten of them. The
   first replaces a test of the configuration by a test of each call. The second keeps a
   judge that misses often from counting through the calls where it happened to catch one.
   Nine in ten is the lead's number.
4. A fifth fewer words, the threshold for a replacement that is only shorter, was proposed
   to the user on 2026-11-25 and stands on the go of 2026-11-26. The judge is told the
   threshold. A judge can name criterion 5 for a small cut, and that counts.
5. The search for a better sentence is its own call for each paragraph and is asked after
   the rules have passed, as proposed. Asking it in the call of the reader rules would
   halve the calls for a text that passes and is not built.
6. Up to four runs follow one another in one invocation, and a run that adds no vote ends
   the sequence. `--limit` fixes the questions of the whole invocation.
7. `--all-units` asks units that code fails, for trials on a draft whose registries are
   incomplete. It is not a verification.
8. A reader rule's sound and defective sentences stand in one planted paragraph. The first
   form planted two paragraphs with the same opening, which a judge could notice.
9. What counts is computed from the calls of a run record at each `paper-verify`. A record
   of a run that was cut short counts with the calls it has.

Open after the second form.

- The cost of a whole draft. From the calls above (23.5 thousand input tokens, 3.5 thousand
  output tokens and 78 s for a call of the reader rules, 22 thousand, 7 thousand and about
  150 s for a call of the better sentence): the pilot draft has 100 paragraphs, so a run is
  106 calls for the rules or 100 for the better sentence, and two judges that pass
  everything need 412 calls, about 9.5 million input and 2 million output tokens and three
  hours with four calls at a time. The first form was estimated at 43 million input tokens
  and 11 hours. The figure given to the user before the rebuild, 4.7 million, assumed one
  call for each paragraph in all. It takes two, and half of the cost is the search for a
  better sentence.
- Two judges. The decision "two judges in agreement" was made for independence, and two
  runs of one model agree on 99 to 100 % of verdicts. Proposed: name two models of the
  vendor with `--model a,b`, or count one run of one model as one judge and require the
  second from another model. Which models is the user's choice.
- The planted texts are too easy to grade a judge: 209 of 209 live. They show that a call
  was read and that a rule is applied at all. Proposed for stage 5: defects made from the
  manuscript's own sentences (its own number changed, its own sentence moved), which a
  judge cannot tell from the text around them.
- The planted paragraphs of a call are foreign text that the judge sees next to the
  paragraph of the manuscript, and they are not part of the key of a verdict. A changed
  planted text changes the gate hash but not the keys.
- Whether the search for a better sentence settles is still unmeasured over more than one
  round. On real text one round does not settle it: 13 of 15 sentences were
  replaced, 7 of them with a changed claim, which a judge that sees one paragraph cannot
  establish. Proposed, for the user: print the replacements as advice and take the search
  out of the pass and fail of the gate, or admit only criteria 5 to 7, since correctness,
  the user's decisions, the rules and completeness have checks of their own. Without the
  search a pass over the pilot draft is 106 calls for each judge.
- The items open after the first form stand, except the cost and the refused quotation:
  local run records, the limits of the seal, a Claude judge never launched live, the
  sentence row of "Units and grounds", replacements unchecked by code before the report,
  the tool hooks and the enrollment.

### Stage 3, the search for a better sentence leaves the gate (2026-11-26)

Decision of the user, on the measurement above (13 of 15 real sentences replaced, 7 with a
changed claim, half of the cost): "더 나은 문장은 빼고 해봐". The proposal it answers was to
take the search out of the pass and fail of the gate and to print its replacements as
advice. The bullet "Search for a better sentence" of the Section "Making the independent
verdict real" no longer describes the gate. The ranked criteria stay as what the advice is
asked under.

Criterion and plan of checks, written before the code. Tests use an injected judge.

1. A verification holds no verdict of the search: no check, no awaiting state, no row in
   the table and no call. A manuscript whose rules pass is complete after the two runs for
   the rules.
2. `paper-judge --advice` asks the search in one run, for the sentences whose verdicts have
   all passed, and prints each replacement with its ranked criterion and reason. It changes
   no verdict and not the completeness of the manuscript. The replacements of a call that
   did not improve the planted wordy sentence are not printed. A saving of less than a
   fifth of the words is not a replacement, as before.
3. The tests of the second form pass, with the counts that change because the rule is gone
   listed in the record.

Code: the kind `better` is marked as advice in `harness/verify.mjs` and gives a unit no
check, its questions are kept apart from those that bind a verdict, a run of advice holds
no vote, and `harness/judge.mjs` and `harness/cli.mjs` have `--advice`.

Result. All 51 tests pass. By the numbers of the plan above:

1. Passed. The fixture is complete after two runs of seven calls, the table has no row and
   no unit a check for the search, and no call of a verification asks it.
2. Passed. One run with a call for each paragraph returns the two replacements that count
   (four words for six, and a gain named under criterion 5) and not "2" for "two". The
   verdicts and the completeness are the same before and after, and the run is not listed
   among the runs of the judges. A call that left the planted wordy sentence as it was
   gives no advice. A sentence with a verdict that has not passed is not asked.
3. The counts that changed with the rule: the fixture awaits 15 verdicts instead of 19 and
   has 11 questions instead of 15, a verification is two runs instead of four, and in the
   tests of stages 1 and 2 a sentence awaits two reader verdicts instead of three.

Not measured again: the calls of the rules and the call of the search have the form
measured in the second form. With the search out, one pass of two judges over the pilot
draft is estimated from those calls at 212 calls, 5 million input and 0.7 million output
tokens and 70 minutes with four calls at a time, against 43 million and 11 hours for the
first form.

Still open from the second form: whether two runs of one model count as two judges, the
nine-in-ten threshold, and planted texts that are too easy to grade a judge.

### Stage 3, one judge (2026-11-26)

Decision of the user ("하나로 바꿔"), on the measurement of the second form: two runs of one
model gave the same verdict on 357 of 360 questions under the rules about a sentence and on
59 of 59 word pairs, so the second run doubled the cost and was no second reader. The row
"judging models" of the decisions above read "two judges in agreement". It now reads: one
judge of a vendor other than the writer's, and more only where a manuscript asks for them,
of different models. The writer still cannot pass its own text, and what tells whether a
call was read is the planted text in it, not a second run.

Criterion and plan of checks, written before the code. Tests use an injected judge.

1. Without a setting one passing judge passes a question, and one failing judge fails it.
   A manuscript whose rules pass is complete after one run.
2. A manuscript can require more judges with `"judges": n` in its `RULES.json`, which is
   part of the gate hash. Judges are told apart by model: the runs of one model give one
   passing vote however many they are, and a failing run of any model fails the unit. A
   run asks a question only if its model has not passed it yet.
3. The earlier tests pass, with the counts that change listed in the record.

Code: `JUDGES` is 1 in `harness/verify.mjs`, a manuscript's `RULES.json` may set
`"judges"`, votes are counted by the model of their run, and `harness/judge.mjs` asks a
run only what its model has not passed.

Result. All 51 tests pass. By the numbers of the plan above:

1. Passed. The fixture is complete after one run of seven calls, and the judge that fails
   the colon, the declaration of ordinary wording and the standard notation fails those
   three units in that run.
2. Passed. With `"judges": 2` a run of the default model leaves all 15 verdicts awaiting
   with one vote, a second invocation with the same model makes no call, and a run named
   `model-b` completes what it passes and fails the unit whose colon it fails. A value that
   is not a whole number of at least 1 is refused.
3. The counts that changed: a verification of a text that passes is one run where it was
   two, and the call with a missed planted text is asked once more in the same invocation.

Estimated from the calls measured in the second form: one pass over the pilot draft is 106
calls, 2.5 million input and 0.4 million output tokens and 35 minutes with four calls at a
time, against 43 million input tokens and 11 hours for the first form.

Open. How much two different models disagree is not measured, so nothing here says what a
second judge of another model would add. Proposed for the pilot: one Section judged by two
models, and the count of verdicts on which they differ. A judge is told apart by the model
named for its run. The provider reports no model identity, so a run with no model named
and a run that names the default model count as two.

### Stage 4 (2026-11-26)

Go of the user: "하네스 관련 다음 단계 진행해" (2026-11-26). The stage is the outline
contract and the scope check of central claims, the rows "paragraph", "Section" and
"document" of the table "Units and grounds".

Criterion and plan of checks, written before the code. The design's criterion: the
misplaced case-(3) sentence and the unscoped main result of the origin both fail on
fixtures. Tests use an injected judge and call no model.

1. Registry. An enrolled manuscript keeps its outline in `paper/OUTLINE.json`: its central
   claims, each with the restrictions it holds under, and for every Section one entry for
   each paragraph (its role and what the paragraph does). Roles include definition,
   derivation and transition, so no paragraph is forced to carry a result.
2. Code. An enrolled manuscript without an outline fails. So do a Section that the outline
   does not list, a Section whose number of entries differs from its number of paragraphs,
   an entry without a known role or without a statement of what the paragraph does, an
   outline section that matches no Section, and an outline without a central claim. The
   rule is refused unless its check flags its failing texts and passes its passing text.
3. Paragraph. The judge is shown a paragraph with its entry and asked whether the paragraph
   keeps to it. A paragraph on case (5) that ends with a sentence on case (3) fails, with
   that sentence as the quoted evidence. This text is registered as a failing text, so it
   is planted in every call that asks the rule, and a judge that misses it gives no verdict
   on the rule.
4. Central claims. The judge is shown a sentence in its paragraph with the registered
   claims and asked whether the sentence states one of them without a restriction that the
   registered claim carries, or contradicts one. A main result stated for every case where
   the registered claim holds for a range fails. This text is registered as a failing text
   and planted as in item 3. A sentence of the abstract that states a result no registered
   claim covers fails, so the registry cannot leave out a result the abstract announces.
5. Section. The judge is shown a heading with the entries of the paragraphs and the
   headings under it and asked whether the heading names what they do. A heading that
   promises a review over entries that derive a new result fails (planted).
6. Hash binding. The key of a verdict covers all that the judge is shown: the paragraph,
   its headings, its entry and the claims. After an edit of one paragraph only its
   questions are asked again. After an edit of one entry the questions of its paragraph and
   of its heading are asked again. After an edit of a claim the questions that show the
   claims are asked again. No verdict rests on the outline being re-attested by the writer.
7. A question that shows the outline is not put to a judge while the code check of the
   outline fails for the document, the Section or the paragraph concerned.
8. Unnecessary gates. A manuscript that is not enrolled gets no outline file, no verdict
   and no block, and the two evaluation cases on unnecessary gates are untouched.
9. The 51 earlier tests pass. An assertion changes only where it states what stage 4
   replaces, and each such change is listed in the record.
10. Live, with Codex, on scratch copies with no project file written: the planted texts of
    the new rules are answered as registered, and the two origin texts of the pilot project
    (the sentence on case (3) at the end of the Section on case (5), from the commit before
    df5e17f, and the main result without its restriction, from the commit before d089c83)
    fail under an outline written for the purpose. Calls, tokens and time are reported, with
    the estimate for one pass over the pilot draft.

Code: in `harness/verify.mjs` the outline held against the text (`outlined`), the kind
`outline` with the rule `outline-contract`, `unit` and `shows` for a rule judged by a
reader, what a question shows of the outline and which code verdicts it waits for,
`outlineView`, `ROLES`, and `JUDGE` raised to 3; in `harness/judge.mjs` the entry and the
claims printed with a paragraph, the paragraph as a unit of a call, a question put to
several units printed once, and the outline of a planted text; in `harness/rules.json` the
rules `outline-contract`, `entry-delivered`, `claim-scope` and `abstract-covered` with their
texts; the `paper-outline` entry of `harness/cli.mjs`; `tests/outline.test.mjs`. Use:
[PAPER-REVIEW](../PAPER-REVIEW.md#verification-gate) and
[OPERATIONS](../OPERATIONS.md#manuscript-verification-gate).

Result. `tests/outline.test.mjs` has four tests with an injected judge, and all 55 tests of
the repository pass. By the numbers of the plan above:

1. Done. `OUTLINE.json` holds `claims` and, for every heading of level 1 to 3, a section
   with one entry (`role`, `does`) for each paragraph. A paragraph and the list items after
   it have one entry together. The abstract, captions and footnotes have none. The ten
   roles are motivation, setup, definition, review, derivation, result, evidence,
   interpretation, transition and outlook.
2. Passed. Each of the listed faults fails where it stands: the document (no outline, no
   central claim, an outline section that matches no heading), the heading (not listed, or
   2 paragraphs under it and 1 entry) and the paragraph (a role that is not known, no
   `does`, or no entry before the first heading). The rule `outline-contract` is registered
   with six failing texts and one passing text, and is refused when its check misses one.
   A malformed file stops the verification with its reason.
3. Passed. The fixture's paragraph on the fifth case ends with a sentence on the third
   case: the judge is shown the paragraph, its headings, its entry and the claims, and its
   failing answer fails the paragraph with the misplaced sentence as evidence. The planted
   paragraph of `entry-delivered` is the one of the origin, and a judge that passes it
   gives no verdict on the rule.
4. Passed. The main result of the fixture's introduction lacks "without a superpotential":
   the failing answer on `claim-scope` fails that sentence and leaves the later Section's
   sentence, which has a superpotential, passed. A sentence of the abstract that states a
   result no registered claim covers fails `abstract-covered`. Both rules have planted
   texts, and a judge that misses them gives no verdict on the rule.
5. Passed, with a wider question than planned. The origin text turned out to be a whole
   paragraph on case (3) at the end of the Section on case (5), not a sentence inside a
   paragraph on case (5). Such a paragraph keeps to an honest entry of its own, so what it
   contradicts is the heading. The question therefore holds the heading to every part
   under it in both directions: it fails when it promises what no part does, and when a
   part does something else than it names. Three headings are planted: a review over a
   derivation and a Section on case (5) with a paragraph on case (3), which must fail, and
   a Section with a derivation and a transition, which must pass.
6. Passed. On the fixture (16 calls for the whole text): after one sentence changed, 2
   calls, its paragraph with the outline and the sentence in its paragraph. After one entry
   changed, 2 calls, its paragraph with the outline and its heading. After the claim
   changed, 8 calls, the abstract and every paragraph with the outline, and no call under
   the rules about a sentence or about a heading. With the outline put back as it first
   was, no call: the recorded verdicts are found again.
7. Passed. While a Section has fewer entries than paragraphs, the questions that would
   show the outline to a judge (its paragraphs against their entries and the claims, its
   heading) are not asked, and the rest of the manuscript is.
8. Passed. `paper-outline` on a manuscript that is not enrolled writes nothing, and its
   Stop hook returns nothing. The evaluation cases are untouched.
9. Ten of the 51 earlier tests changed, each in what stage 4 replaces. In
   `tests/judge.test.mjs` (six tests) the fixture has an outline (one claim, one heading,
   three entries), so that it awaits 23 verdicts instead of 15 and has 19 questions instead
   of 11, and a run is 11 calls instead of 7 (one for the heading, three with the outline)
   with 37 planted texts instead of 22. The call whose schema is asserted is the seventh
   and no longer the third. The plans of the dry run count the new families. In
   `tests/verify.test.mjs` (four tests) three fixtures get an
   outline before they are verified to the end, the Stop test asserts that an enrolled
   manuscript without an outline, and a paragraph added without an entry, are reported
   (14 verdicts await the judges instead of 8, and the work in progress lists 5 instead of
   3), and the table of `paper-verify` on a manuscript without an outline counts 3 failures
   instead of 2.
10. Done, below. Both origin texts fail.

Measured, live with Codex (CLI 0.171.0-alpha.13.2, provider default, gpt-6.2-astra at
reasoning effort xhigh in this computer's configuration), on a scratch copy with no project
file written. The manuscript is made of two passages of the pilot project before their
corrections: the abstract and the introduction of a09e65a, whose main result is stated
without its restriction, and the Section on case (5) of fbd38a8, which ends with the
paragraph on case (3). It has 59 sentences, 11 paragraphs and 3 headings. Its outline was
written for the run: four claims with the restrictions the project has since fixed, and an
entry for each of the 10 paragraphs that describes what the paragraph does, the misplaced
one included ("transition: says that a superpotential constraint is the only way around the
exclusion of case (3) and points to the Section on Seiberg duality"). Both runs used
`--all-units`, since the manuscript has no registry of numbers or symbols.

- The form that is built: 24 calls in 489 s with four at a time, 561,646 input and 78,896
  output tokens, 93 of 93 planted texts answered as registered, no answer refused.

  | calls of | calls | input tokens a call | output tokens a call | mean time of a call |
  | --- | ---: | ---: | ---: | ---: |
  | the rules about a sentence in its paragraph | 11 | 23,209 | 3,721 | 85 s |
  | the rules that show the outline | 11 | 23,720 | 2,999 | 71 s |
  | the abstract against the claims | 1 | 22,737 | 3,072 | 75 s |
  | the three headings | 1 | 22,693 | 1,901 | 54 s |

- The origin texts. The main result fails `claim-scope`: "The opening sentence omits the
  connected $SU(N)\times SU(N)$ setting, the fixed-flavor large-$N$ limit, and the
  assumption that no superpotential coupling is relevant at a single-node fixed point."
  The heading "Exact exclusion of case (5) without superpotential" fails: "The closing
  transition also makes a claim about how case (3) can evade exclusion, which falls outside
  the heading's scope of case (5)." The two sentences of that paragraph also fail
  `in-place`, the rule of stage 3. `entry-delivered` passes all 10 paragraphs, as it
  should: each does what its entry says.
- What else failed. `claim-scope` fails 12 of 59 sentences. Among them are the statements
  of the exclusion of case (5) without $W=0$ in the introduction, which the project
  corrected in d089c83, and the two sentences of the abstract that repeat the main result.
  `abstract-covered` fails 6 of the 10 sentences of the abstract, each for a result that
  the four claims written for the run do not cover (the positivity of the multiplier, the
  corrected relevance condition, the conformal manifold of the conifold): the registry was
  incomplete, and the rule says so. `scope-stated` fails 4.
- What a failure of `claim-scope` means depends on the wording of the claim. Four of the
  12 hold a sentence to "with at least one bifundamental", a qualifier of a claim as it
  was written for this run, which the connected quivers of the manuscript satisfy. A judge
  holds a sentence to every qualifier of a registered claim.
- The other form, measured on the same manuscript: the rules that show the outline in the
  family `content`, one call for a paragraph instead of two. 13 calls in 436 s, 324,146
  input and 71,164 output tokens, 93 of 93 planted texts. It costs 42 % fewer input tokens,
  and it changes the verdicts of the two rules of stage 3: `scope-stated` fails 14
  sentences instead of 4 (2 in common), with reasons that cite the registered claims (one
  holds a sentence to "at any finite $N$", which widens a claim and restricts nothing), and
  `in-place` passes the two sentences on case (3), which it fails when the judge is not
  shown the entry that the writer gave their paragraph. On the four rules of this stage
  the two forms agree on 81 of 82 verdicts. An entry written by the writer must not excuse
  a sentence under a rule that does not concern the outline (principle 2), so the rules
  that show the outline are a family of their own.
- In all on this stage: 37 calls, 885,792 input and 150,060 output tokens.

Estimated from these calls for one pass over the pilot draft at 2a4d45a (82 paragraphs
with their list items, the abstract, 5 captions and a footnote, 18 headings of level 1 to
3): 89 calls under the rules about a sentence, 89 with the outline, one for the abstract,
one for the headings and about six for the questions that code leaves open, 186 calls,
4.3 million input and 0.6 million output tokens and about an hour with four calls at a
time. Stage 3 alone was estimated at 106 calls, 2.5 million input tokens and 35 minutes.
Nearly nine tenths of the input are the 21 thousand tokens that the provider's CLI adds to
every call. After an edit of one paragraph, two calls are asked again.

Choices made in the implementation, each the lead's and open to the user's correction.

1. `OUTLINE.json`, a registry like the three others, in place of the Markdown file
   `PUNCHLINES.md` that the design names. `PUNCHLINES.md` stays the optional outline of a
   manuscript that is not enrolled, and the gate does not read it.
2. No anchors and no hash that the writer renews. A section of the outline is matched to
   its heading by title, and its entries to the paragraphs in order. The binding the
   design asks for is in the key of the independent verdict, which covers the paragraph and
   its entry. An edit asks the judge again and asks nothing of the writer, unless a
   paragraph was added or removed. The origin, an outline that was neither read nor
   updated, now fails: a count that differs fails by code, and an entry that no longer
   describes its paragraph fails by the judge.
3. A list belongs to the paragraph before it, in the outline and in every call of a rule
   judged by a reader. This changes stage 3 for list items, which were judged in calls of
   their own: the pilot draft has 89 such calls where it had 100.
4. The roles are a fixed list of ten. A role outside it fails by code.
5. The scope of a central claim is checked sentence by sentence against the registered
   claim, not by one call over the whole text. The key of the verdict is then the
   paragraph and the claims, and a statement of the claim in any Section, a caption or a
   footnote is held to the same registered restrictions. The design's "abstract,
   introduction, body and conclusion" is not enforced as a list of places where the claim
   must stand.
6. The registry of claims is held to the abstract (`abstract-covered`). Without this an
   empty or thin registry would pass every sentence.
7. A heading is judged against the entries of the paragraphs under it and the headings of
   its parts, not against their text, which the paragraph verdicts cover. Headings are put
   together in a call, like the other units that are judged alone.
8. The rules that show the outline have the family `outline`, apart from `content`, by the
   measurement above and against the cost. The calls of a family show every unit what one
   of its rules shows, and every text of such a family carries an outline of its own, since
   a planted paragraph without an entry would stand out. A rule that shows the outline is
   therefore refused in a family whose texts have none.
9. A third planted paragraph, which keeps to its entry, was added for `entry-delivered`.
   The two planted paragraphs of stage 3 each hold a defective sentence and would not be a
   safe passing text.
10. A question that shows the outline waits while the code verdict on the outline fails
    for the document, its Section or its paragraph. Otherwise calls would be spent on
    entries that are about to move.
11. Headings of level 1 to 3 are sections of the outline. A `\paragraph` heading ends a
    paragraph's list but has no section and no verdict of its own.
12. `paper-outline` prints the outline next to the text, and with `--skeleton` the file to
    fill in, which keeps every entry that stands. The lead writes the entries. Code cannot.

Open after stage 4.

- The pilot (stage 5) needs the outline of the susu-quiver draft: its central claims and 82
  entries. The project's `PUNCHLINES.md` holds a claim for most paragraphs and a list of
  ten claims, from which they can be written. Proposed: write it with the registries of
  numbers and symbols, which the pilot needs first in any case (402 of 448 sentences fail
  a code check today), then one Section through the judges before the whole draft.
- Qualifiers of a registered claim. A judge holds a sentence to every qualifier of the
  claim (4 of the 12 failures here). Proposed for the pilot: state in `claim` the
  restrictions that the result needs beyond the setting of the paper, and count the
  `claim-scope` failures that are not defects before changing the question.
- A restriction made once for a Section ("throughout this Section $W=0$") is not seen by
  the judge of a later paragraph. `scope-stated` failed one sentence here whose condition
  stands in its heading and not in its paragraph, as its question requires, and
  `claim-scope` accepts a restriction in the headings but not one in an earlier paragraph.
  Not built: a place in the outline for the standing assumptions of a Section, shown with
  each of its paragraphs. It would let a writer state there what the text does not say, so
  it would need its own check against the text.
- `scope-stated` and `claim-scope` are asked in different calls and overlap little: here
  1 sentence fails both and 14 fail one of them.
- Whether the registry holds the right claims is checked through the abstract only. A
  result that the abstract omits can be left out of the registry.
- Several headings share a call, with the entries under each in its own question. Whether
  a judge uses the entries of one heading on another is not measured (three headings here).
- The sentence row of the table "Units and grounds" (a type, and a link to an equation, an
  evidence run or a CITATIONS row) is still not built, and no judge reads the notes, the
  data or a cited paper. A physically wrong sentence passes the gate when it is scoped,
  placed and worded well. Proposed, as its own stage after the pilot: a registry of links
  for the sentences that state a result, and a family whose call shows the linked passage.
  Its cost depends on the length of the passages and is not estimated.
- The fixed 21 thousand input tokens of every call are nearly nine tenths of the input. A
  provider interface without them would cut a pass to about half a million input tokens.
  Not built.
- The tool hooks are still not installed and no manuscript is enrolled, so the gate has
  not yet held a live session. The items open after stage 3 stand otherwise (local run
  records, the limits of the seal, a Claude judge never launched live, planted texts that
  are fixed fixtures).

### Stage 4, the setting of a manuscript (2026-11-26)

Why. In the live run of stage 4, `claim-scope` failed four sentences of the introduction
and of Section 2.1 for want of "with at least one bifundamental", a qualifier of a claim as
written for the run, which every quiver of the manuscript satisfies: the manuscript is
about connected quivers. A reader who has read the introduction does not need it repeated.
The judge had not read the introduction, since it is shown one paragraph. The user: "with
at least one bifundamental을 문장마다 요구하면 안돼. 그냥 사람이 읽듯이 한문장한문장
읽어보고 판단하는게 안되는거야?" (2026-11-26). Two remedies were proposed: show every
paragraph with all of the text before it, which costs 1.3 to 2.7 million more input tokens
for a pass over the pilot draft and asks every later paragraph again after an edit near the
start, or register the setting of the manuscript and of its Sections as pointers to the
sentences that state it, which the judge reads in their own words. The user chose the
second ("(나)로 고치고 다시 실측해봐", 2026-11-26).

The same run showed why the setting is given as sentences of the manuscript and not as a
summary: shown the entry that the writer gave a paragraph, the judge passed under
`in-place` two sentences that it fails when it reads the paragraph alone. Material written
by the writer can loosen a verdict. A sentence of the manuscript is what a reader has read.

Criterion and plan of checks, written before the code. Tests use an injected judge.

1. `OUTLINE.json` takes `setting`, for the whole manuscript and for each section: a list of
   pointers to sentences (`label:`, a unit id, or a passage that stands in exactly one
   sentence). A pointer that matches no sentence or several, and one whose sentence stands
   after every paragraph it would apply to, fail by code.
2. A sentence of the setting is shown, in its own words, with each paragraph of its scope
   (the manuscript, or the section with its subsections) that stands after the paragraph
   holding it, and with no paragraph before it. It is shown under the rules that name
   `setting` in `shows`.
3. The key of a verdict covers the setting sentences shown: an edit of one asks again the
   paragraphs that show it and nothing else.
4. `claim-scope` shows the setting and reads a sentence as a reader of these sentences, the
   headings and the paragraph: a restriction that they impose, or that follows from them,
   need not be repeated; a qualifier that widens a claim is no restriction; a claim's
   restrictions apply where the sentence states that claim's result. A planted pair tests
   it: under the setting "connected two-node quivers" a sentence that omits "with at least
   one bifundamental" passes, and one that states the result beyond $W=0$ fails.
5. `scope-stated` accepts a restriction in the headings above the sentence, which a reader
   has read, as well as in the sentence and earlier in its paragraph.
6. A family that shows the setting has at least one text whose paragraph is shown a
   setting, so that planted paragraphs with and without it stand in every call, as real
   ones do. Registration is refused otherwise.
7. The 55 earlier tests pass, with the counts that change listed.
8. Live with Codex, on the scratch manuscript of the stage 4 run with its four claims
   unchanged (the qualifier "with at least one bifundamental" kept): run A with the new
   questions and no setting, run B with the setting. Counted: the four failures for the
   qualifier, the true failures of the origin (the main result without its restriction,
   the exclusion of case (5) without $W=0$), the planted texts, tokens and time. Run A
   tells whether the question alone suffices, in which case the setting is not needed.

Code: in `harness/verify.mjs` the `setting` of the outline (resolved in `outlined`, its
faults among the problems of `outline-contract`, shown through `shows: ["setting"]`),
`JUDGE` raised to 4, the setting in `paper-outline`; in `harness/judge.mjs` the setting
printed with its block; in `harness/rules.json` the new questions of `claim-scope` and
`scope-stated`, the planted pair of the setting for `claim-scope` and a failing text of
`outline-contract` with a pointer that matches nothing; one test in
`tests/outline.test.mjs`.

Result. All 56 tests pass. By the numbers of the plan above:

1. Passed. A passage that matches no sentence, one that stands in four, a label of a
   heading, and a pointer whose sentence stands in the last paragraph of its scope each
   fail by code with their reason, and a `setting` that is not a list stops the
   verification.
2. Passed. On the fixture a sentence of the introduction is shown with the paragraphs after
   its own and not with its own or the abstract, and a sentence of the Section on the fifth
   case with the later paragraph of that Section and with its Subsection, not with the next
   Section. A list item is shown the setting of the paragraph it belongs to. The rules about
   a sentence in its paragraph are shown none.
3. Passed. After an edit of the sentence of the Section's setting, 4 calls: its own
   paragraph under both families, and the two paragraphs that are shown it. The other
   verdicts are kept.
4. Passed. A judge that fails the planted sentence which omits the qualifier that the
   setting supplies gives no verdict on `claim-scope`. Live, both runs answered the 44
   planted texts of `claim-scope` as registered.
5. Done. Live, the sentence that `scope-stated` had failed for a condition that stands only
   in its heading now passes.
6. Passed. A family that shows the setting and has no text with one is refused.
7. The 55 earlier tests pass. The counts that changed with the added planted pair: an
   outline call holds 18 planted units instead of 12, the run of the judge fixture answers
   43 planted texts instead of 37, the run of the outline fixture 75 instead of 61, and a
   question put to several units names 16 and 6 of them instead of 12 and 4. The counts of
   the outline gain `setting: 0`.
8. Done, below.

Measured, live with Codex (provider default, gpt-6.2-astra at reasoning effort xhigh in
this computer's configuration), on the scratch manuscript of the stage 4 run with its four
claims unchanged. Run B registers as setting of the manuscript the first sentence of the
abstract and the sentence of the introduction that introduces "connected two-node quivers
with gauge group $SU(N)\times SU(N)$". The rules of the family `content` are the same in
both runs (their questions have the same keys), so they were asked in run A only.

| failing verdicts | stage 4 run | run A: new questions | run B: and the setting |
| --- | ---: | ---: | ---: |
| `claim-scope` | 12 | 10 | 8 |
| of them for "with at least one bifundamental" | 4 | 2 | 0 |
| `scope-stated` | 4 | 2 | 2 |
| `in-place` | 2 | 1 | 1 |
| planted texts answered as registered | 93 of 93 | 110 of 110 | 66 of 66 |

- The question alone does not suffice. Run A still fails two sentences of the
  introduction for the qualifier, both after the sentence on connected quivers, which the
  judge did not see. With the setting none is failed for it.
- The eight failures of run B were read against the current draft (2a4d45a). Seven stand
  corrected there: the main result in the introduction and in two sentences of the abstract
  now carries "without a superpotential coupling relevant at a single-node fixed point",
  statement (ii) of the introduction now opens "At $W=0$", with the sentence after it, and
  the sentence on the routes to the fully interacting fixed point now opens "At $W=0$",
  with the sentence after it. The eighth, a sentence of the abstract in which "without a
  superpotential" may or may not govern its second clause, was removed by the project in
  ab33de3. Run B also passes the sentence on the two configurations without a unitary
  fixed point, which the stage 4 run and run A held to a restriction of a different claim.
- `scope-stated` fails the main result, whose restriction stands nowhere before it, and a
  sentence of Section 2.1 on "any two-node quiver at any finite $N$", for a reason about
  its support rather than its scope. The current draft keeps that sentence.
- `in-place` fails the first of the two sentences on case (3) in the Section on case (5)
  and passes the second, which the stage 4 run failed. The paragraph is the origin
  incident, for which `outline-contract` failed its heading in the stage 4 runs.
- Cost. A call of the family `outline` took 24,680 input and 3,606 output tokens and 79 s
  on average in run B, against 23,720, 2,999 and 71 s in the stage 4 run: the added
  planted pair and the setting sentences. One pass over the pilot draft rises by about 0.1
  million input tokens. Run A: 22 calls, 525,698 input and 77,028 output tokens, 461 s.
  Run B: 11 calls, 271,476 input and 39,661 output tokens, 225 s.

Choices made in the implementation, each the lead's and open to the user's correction.

1. The setting is given as pointers to sentences and shown in their own words, never as a
   summary. The writer chooses which sentences, and cannot add to what they say. A sentence
   left out makes the judge stricter.
2. The setting is shown under `claim-scope` only. `scope-stated` and `in-place` belong to
   the family `content`, which is asked whether or not the manuscript has an outline, and a
   setting there would tie them to it. `scope-stated` now accepts a restriction in the
   headings, which every call already shows.
3. A pointer may be a passage of the sentence, since sentences of prose seldom carry a
   label.
4. A family that shows the setting needs one text with a setting, not every text: real
   paragraphs before the first sentence of the setting are shown none either.
5. The claims of the run kept the qualifier, so that the measurement tests the reading of
   the judge and not a rewording of the claims. The advice of stage 4 to state in a claim
   only the restrictions beyond the setting is withdrawn from PAPER-REVIEW.

Open.

- `claim-scope` shows the registered claims, which the writer wrote. A claim registered
  wider than the paper establishes lets a sentence of that width pass it. `abstract-covered`
  checks that the claims cover the abstract, not their width, and `scope-stated`, asked
  without the outline, is the check of scope that does not depend on them.
- `scope-stated` reads a paragraph and its headings only, and holds the main result of the
  run for restrictions that stand later in its paragraph. Whether it should also be shown
  the setting is a question for the pilot, by its count of failures that are not defects.
- The items open after stage 4 stand otherwise.

### Sentence grounds (2026-11-26)

Why. The user's instruction of 2026-11-25 was that every word and sentence has explicit
grounds. The table "Units and grounds" gave a sentence its ground: a type and a link to an
equation, a note or evidence run, or a cited source, judged independently. The stage list
above assigned that row to no stage, and the records of stages 3 and 4 listed it as open
without saying that the central requirement was missing. The user asked why it was not
built ("내가 이 하네스 다시 구축하라고 했을 때 부터 모든 단어 문장을 근거있게 써야한다고
했는데 왜 구현이 안되어있는거야?") and gave the go ("문장 근거 연결 진행해", 2026-11-26).
The incident it answers: the sentence "The only way around the exclusions of cases (3)
and (5) is a superpotential constraint …" (susu-quiver, HISTORY), which the derivation of
case (5) with a superpotential contradicts. The lead wrote it out from an earlier "either
exclusion" when the user asked what that phrase referred to, and a report-only reviewer of
the publishability pass, not the lead's reading, caught it (PLAN 83). The user found the
sentence on case (3) that its correction left in the Section on case (5) (PLAN 85). Until
2026-11-26 this record said that the user had found the wrong sentence, which the session
record does not support.

Criterion and plan of checks, written before the code. Tests use an injected judge.

1. `paper/GROUNDS.json` gives every sentence of an enrolled manuscript (abstract, body,
   list items, captions, footnotes; not titles) exactly one entry: the sentence (`at`: a
   label, a unit id or a passage that stands in exactly one sentence), its `type` and its
   `links`. Types: `result`, `derivation`, `cited`, which need at least one link, and
   `definition`, `transition`, which need none.
2. A link is a passage that the judge is shown in its own words: a place in the manuscript
   (`at`, the paragraph that holds it), a passage of a project file (`file` and `quote`:
   notes, calculation outputs, RESULTS), or a passage of a cited source (`cite`, a key of
   the bibliography, and `quote`, read from the wiki's copy of the source by the key's
   eprint). Code fails a sentence without an entry or with several, an unknown type, a
   type that needs a link and has none, a quote that does not stand where it says, a
   `cited` sentence without a link to a key it cites, a cited source absent from the wiki,
   and an entry that points to no sentence or to several.
3. The judge is shown the sentence in its paragraph under its headings, its type and the
   passages. For a sentence that needs a ground: pass if the passages establish what the
   sentence states (subject, direction, conditions, range), fail if the sentence states
   more, less or other. For `definition` and `transition`: fail if the sentence states a
   result, a derivation step or an attributed claim.
4. Planted texts in every call: the sentence on cases (3) and (5), linked to a passage
   that gives the condition for case (5) and calls its realization open, must fail; a
   sentence on case (3) alone with the same link must pass; a sentence typed `transition`
   that states a result must fail, and a real transition must pass.
5. The key of a verdict covers the sentence, its paragraph and headings, its type and
   every passage shown. A changed note passage asks the sentences that link to it again.
6. Not enrolled manuscripts get no file and no verdict, and the 56 earlier tests pass
   with the counts that change listed.
7. Live with Codex, on a scratch manuscript made of the introduction and the Section on
   case (5) of the pilot draft before its correction (a09e65a), grounded by the lead in
   the project's notes: the sentence of the incident fails, and calls, tokens and time are
   reported with the estimate for the pilot draft.

Code: in `harness/verify.mjs` the registry of grounds (`grounded`: entries, links and the
passages around their quotes), the check kind `grounds` with the flags `reads` (its
questions are shown with the paragraph and headings) and `asks` (a passing text may await
the judge), `bibliography`, `citedKeys`, `wikiSources`, `groundsView`, the grounds in the
report and in the gate hash; in `harness/judge.mjs` the grounds of planted texts and the
sources passed through; the rule `sentence-grounds` in `harness/rules.json`; the
`paper-grounds` entry of `harness/cli.mjs`; `tests/grounds.test.mjs`. Use:
[PAPER-REVIEW](../PAPER-REVIEW.md#verification-gate).

Result. `tests/grounds.test.mjs` has three tests with an injected judge, and all 59 tests
pass. By the numbers of the plan above:

1. Done. Every sentence of an enrolled manuscript needs one entry; titles need none.
2. Passed. Each fault listed in the plan fails with its reason on the fixture, among them
   a quote that is not in the note, a quote of fewer than four words, a sentence that links
   to itself, a link that stands in three places, a cite link to a key the sentence does
   not cite, a key without an eprint, a source missing from the wiki, and on a computer
   without the wiki the cited sentence is not judged. The rule is registered with eight
   failing texts, two passing texts and four planted texts.
3. Passed. The prompt prints, for each unit, its type and every passage with the file or
   source it comes from, a cited passage read from the wiki's copy of the source.
4. Passed. The four planted texts stand in every call of the family. A judge that passes
   the planted sentence on cases (3) and (5) gives no verdict on the rule in any call.
5. Passed. An edit of a note block that two sentences quote asks those two again in one
   call; an edit of a block that one sentence quotes asks that one; a line no sentence
   quotes asks nothing; an edit of a manuscript sentence that others link to asks those
   that link to it.
6. Passed. Fourteen of the 56 earlier tests changed (seven in `tests/judge.test.mjs`, all
   five in `tests/outline.test.mjs`, two in `tests/verify.test.mjs`), by their fixtures
   getting grounds (each sentence typed as a transition, or written out; `sketch` in
   `tests/judges.mjs` now writes grounds too) and by the counts that follow: one more
   question for each sentence, one more call for each paragraph, four more planted texts
   for each call of the family. In `tests/judge.test.mjs` a run of the fixture is 14 calls
   instead of 11 with 55 planted texts instead of 43; in `tests/outline.test.mjs` the
   fixture awaits 65 verdicts instead of 52 and a run is 23 calls instead of 16; in
   `tests/verify.test.mjs` the table of a manuscript enrolled without registries counts
   four failures instead of three, and the Stop test gives its edited text new grounds as
   a writer would.
7. Done, below, on a narrower manuscript than the plan names: the paragraph of the
   introduction that states the two exact results, not the whole introduction, and the
   Section on case (5). 19 sentences.

Measured, live with Codex (provider default, gpt-6.2-astra at reasoning effort xhigh in
this computer's configuration), on a scratch copy with no project file written. The lead
grounded the 19 sentences in notes 01, 04 and 05, RESULTS and three cited sources in the
wiki, quoting for each the passage it rests on. The sentence of the incident was grounded in
its own origin, the Interpretation of note 05, whose block goes on to say that case (5)
resists even that, and in the case-(5) result of note 04.

- Code, before any call: 2 of 19 sentences fail. The sentence that calls case (3) the
  flow of supersymmetric asymptotic safety rests on Bond–Litim and does not cite it, and
  Martin:2000cr (hep-ph/0011382), cited for the impossibility at weak coupling, is not in
  the wiki.
- First run: 4 calls, 97,490 input and 9,058 output tokens, 85 s with four at a time,
  16 of 16 planted texts as registered. The judge failed 7 sentences:
  - The sentence of the incident fails: the passages leave the charges of the field
    unspecified, and note 04 excludes case (5) for a class of superpotentials.
  - Statement (ii) of the introduction ("Case (5) … never occurs"), for the restriction
    to $W=0$ that the proposition carries. The project added "At $W=0$" in d089c83.
  - The sentence on $b_0^{(2)}(\mathcal A)+\rho\,b_0^{(1)}(\mathcal B)\ge0$ "for any
    two-node quiver", and the opening of the Section on case (5), for the restriction of
    Proposition 5 to fund-type bifundamentals, which the current draft does not state.
    The note calls the restriction true of the whole paper's scope. Whether the text needs
    it is the user's question.
  - Three for the lead's grounding: two derivation steps linked to a block of note 05
    that does not hold the formula they use, and a sentence typed as a definition that the
    judge reads as a step of the derivation.
- Second run, after the two links were added: 2 calls for the 3 changed questions,
  47,997 input and 2,503 output tokens, 8 of 8 planted texts. The two derivation steps
  pass, and the sentence on the inequality fails for $W=0$ and the fund-type restriction.
- In all on this record: 6 calls, 145,487 input and 11,561 output tokens.

Estimated for the pilot draft from these calls: one call of the family for each
paragraph, about 96, at 24 thousand input and 2.3 thousand output tokens, so one pass of
the gate rises to about 280 calls, 6.6 million input and 0.8 million output tokens and an
hour and a half with four calls at a time. Writing the entries is the lead's work: here 19
sentences needed three notes, RESULTS and three sources, and the pilot draft has 448.

Choices made in the implementation, each the lead's and open to the user's correction.

1. Every sentence has an entry, transitions and definitions included, and the judge is
   asked whether they need none. Otherwise a sentence could escape its ground by its type.
2. A link quotes the passage verbatim, and the judge is shown the block of the file around
   it (up to 4000 characters), not a pointer to a section. The writer has to find the
   exact support, and the judge sees the qualifications beside it: in the live run the
   sentence on cases (3) and (5) was quoted from its own source, whose next sentence
   contradicts it.
3. A cited passage is read from the wiki's copy of the source, through the eprint of the
   key in the bibliography. A source outside the wiki fails until it is ingested; a quote
   from a source that nobody can read is not accepted.
4. A cite link must name a key that the sentence cites, so a claim cannot rest on a
   source it does not credit (the asymptotic-safety sentence of the live run).
5. The grounds are a family of their own, shown with the paragraph and headings and
   without the outline.
6. A passing text of the rule may await the judge, since every sound entry does; the code
   part of the rule is still tested by its failing and passing texts.
7. `JUDGE` is not raised: no existing question or prompt changed.

Open.

- The writer chooses the links. A sentence grounded in a passage that a later record
  supersedes passes when the passage supports it. In the live run the defect was caught
  because the same block held its correction. Proposed for the pilot: link the latest
  record (RESULTS, whose entries carry their supersession), and count how often a grounded
  sentence passes on a superseded note.
- The records themselves are not judged: a note that is wrong grounds a wrong sentence.
  That is the review of the calculations, and of the sources, cite-check.
- Terms attested only outside the wiki (the reference for "connected quiver" is outside
  it) need the papers ingested, after which `corpus-build` counts them. A ground of a term
  in a source outside the wiki is not built.
- Martin:2000cr has to be ingested before the pilot (the harness launches the Codex
  ingest, as recorded in the user's working rules).
- Single words are still not compared, and the items open after stage 4 stand.
