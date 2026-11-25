# Manuscript verification — design

Status: design and its four open choices decided by the user on 2026-11-25. **Not
implemented.** Until an implementation lands, the active policy remains
[PAPER-REVIEW](../PAPER-REVIEW.md) and [PAPER-STYLE](../../PAPER-STYLE.md). This file is
the specification an implementation session starts from.

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
