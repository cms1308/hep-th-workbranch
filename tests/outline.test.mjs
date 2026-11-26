// Stage 4 of harness/design/paper-verification.md: the outline contract (every paragraph has exactly one entry of the outline,
// and a heading names what stands under it) and the scope of the central claims the outline registers. Every judge here is
// injected (tests/judges.mjs); no test calls a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from '../harness/tex.mjs';
import { verify, report, rules, standing, ledger, ROLES } from '../harness/verify.mjs';
import { judge } from '../harness/judge.mjs';
import { fromTex } from '../harness/corpus.mjs';
import { hook, main } from '../harness/cli.mjs';
import { answerer } from './judges.mjs';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hep outline 한글 '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(root, name, content = '') { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2)); }
const edit = (project, from, to, file = 'paper/main.tex') => { const p = path.join(project, file), s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(from)); fs.writeFileSync(p, s.replace(from, to)); };

// The two origin incidents in one small manuscript: the Section on the fifth case ends with a sentence on the third case, and
// the main result of the introduction lacks the restriction ("without a superpotential") that a later Section shows it needs.
// The abstract states a result that no registered claim covers, and a heading promises a review over a derivation.
const TEX = String.raw`\documentclass{article}
\def\CN{{\cal N}}
\title{Flows of quivers}
\abstract{We study the flows of quivers. Without a superpotential, the third case never occurs. In every case both gauge couplings are asymptotically free.}
\begin{document}
\maketitle
\section{Introduction}\label{sec:intro}
The quivers of this paper have several gauge couplings.\label{intro}

Our main result is that the third case never occurs.\label{main}

\section{The fifth case}\label{sec:five}
In the fifth case both gauge couplings are asymptotically free.\label{five} The flow ends where both are nonzero. In the third case the first node has no flavors.\label{three}

The other cases are the following.\label{list}
\begin{itemize}
\item In the first case a node is free.
\item In the second case no node is free.
\end{itemize}

\subsection{Review: the $\CN=1$ duality}\label{sec:review}
We derive a new bound on the flavors.\label{review}

\section{With a superpotential}\label{sec:w}
With a superpotential, Seiberg duality realizes the third case.\label{w}
\end{document}
`;
const entry = (role, does) => ({ role, does });
const OUTLINE = { version: 1, claims: [{ id: 'no-third-case', claim: 'Without a superpotential, the third case never occurs.' }], sections: [
  { title: 'Introduction', paragraphs: [entry('motivation', 'Says which couplings the quivers of the paper have.'), entry('result', 'States the main result on the third case.')] },
  { title: 'The fifth case', paragraphs: [entry('result', 'States where the flow ends in the fifth case.'), entry('setup', 'Lists the other cases.')] },
  { title: 'Review: the $\\CN=1$ duality', paragraphs: [entry('derivation', 'Derives a new bound on the flavors.')] },
  { title: 'With a superpotential', paragraphs: [entry('result', 'States that Seiberg duality realizes the third case when a superpotential is present.')] }] };
// Every wording of the manuscript is attested, so that no question about a term stands between a unit and its judges.
const check = { build: () => ({ log: '', pages: ['text'] }), corpus: () => fromTex([TEX, TEX]) };
function make(t, extra = {}) {
  const root = temp(t), project = path.join(root, 'projects', 'demo');
  for (const [name, content] of Object.entries({ 'paper/main.tex': TEX, 'paper/OUTLINE.json': OUTLINE, ...extra })) if (content !== null) put(project, name, content);
  const units = () => load(project, 'paper/main.tex').units, one = (kind, text) => { const found = units().filter(u => u.kind === kind && u.text.includes(text)); assert.equal(found.length, 1, text); return found[0].id; };
  return { root, project, at: label => load(project, 'paper/main.tex').labels[label], para: text => one('paragraph', text), head: text => one('title', text), sentence: text => one('sentence', text) };
}
const changed = (project, change) => { const o = structuredClone(OUTLINE); change(o); put(project, 'paper/OUTLINE.json', o); return verify(project, 'paper', check); };
const tally = (r, rule) => { const row = r.state.rules.find(x => x.id === rule); return [row.pass, row.fail, row.pending, row.unjudged]; };
const open = r => r.open.map(f => [f.rule, f.where, f.evidence]);
const waiting = state => state.rules.reduce((n, r) => n + r.pending, 0);
const verdicts = (state, rule) => Object.values(state.units).filter(u => u.checks[rule]).map(u => u.checks[rule].v);
const asked = log => new Set(log.flatMap(call => call.entries.filter(e => !e.planted).map(e => e.unit)));
const NAMES = ['claim-scope', 'entry-delivered', 'abstract-covered', 'scope-stated', 'in-place'];

test('an enrolled manuscript needs its outline, and code holds the outline to the text: a central claim, every Section by its title, one entry with a role for every paragraph', async t => {
  const bare = make(t, { 'paper/OUTLINE.json': null }), log = [];
  let r = verify(bare.project, 'paper', check);
  assert.deepEqual(open(r).map(([rule, where, e]) => [rule, where, e[0].slice(0, 31)]), [['outline-contract', 'document', 'the manuscript has no outline: ']]);
  assert.deepEqual([r.state.outline, tally(r, 'outline-contract'), ...NAMES.slice(0, 3).map(rule => verdicts(r.state, rule).length)], [null, [0, 1, 0, 0], 0, 0, 0], 'without an outline nothing else can be held to it');
  assert.match(report('demo', r), /\nOutline: none \(OUTLINE\.json\)\.\n/);
  const held = await judge(bare.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  assert.deepEqual([held.runs.map(r => [...new Set(r.calls.map(c => c.family))]), log.length, waiting(held.result.state), held.result.state.complete], [[['content']], 7, 0, false], 'the rules about a sentence in its paragraph do not need the outline, and nothing that would show it exists to ask');
  // The outline of the fixture: four headings, and six entries for nine paragraphs, since a list belongs to the paragraph before it.
  const { project, para, head } = make(t);
  r = verify(project, 'paper', check);
  assert.deepEqual([open(r), r.state.outline, tally(r, 'outline-contract')], [[], { claims: 1, setting: 0, sections: 4, entries: 6 }, [7, 0, 4, 0]], 'the document and six paragraphs pass, and four headings await the verdict on what they name');
  assert.deepEqual(NAMES.map(rule => verdicts(r.state, rule).length), [13, 6, 3, 13, 13]); assert.equal(waiting(r.state), 52);
  assert.match(report('demo', r), /\nOutline: 1 central claim, 4 Sections and 6 paragraph entries \(OUTLINE\.json\)\.\n/);
  for (const item of ['In the first case', 'In the second case']) assert.deepEqual(['outline-contract', 'entry-delivered'].map(rule => r.state.units[para(item)].checks[rule]), [undefined, undefined], 'a list item has no entry of its own');
  assert.equal(standing(project, 'paper').verified, false);
  // A Section with fewer entries than paragraphs.
  r = changed(project, o => o.sections[0].paragraphs.pop());
  assert.deepEqual(open(r), [['outline-contract', '§1', ['2 paragraphs stand under this heading and the outline lists 1: every paragraph, with the list items after it, has exactly one entry']]]);
  assert.deepEqual([tally(r, 'outline-contract'), verdicts(r.state, 'entry-delivered').length, r.state.units[para('The quivers of this paper')].checks['outline-contract']], [[5, 1, 3, 0], 4, undefined], 'its paragraphs get no entry by guess, and the other Sections keep theirs');
  const gap = make(t, { 'paper/OUTLINE.json': { ...OUTLINE, sections: [{ ...OUTLINE.sections[0], paragraphs: OUTLINE.sections[0].paragraphs.slice(0, 1) }, ...OUTLINE.sections.slice(1)] } }), seen = [];
  const part = await judge(gap.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, seen) }), of = label => part.result.state.units[gap.at(label)].checks;
  assert.deepEqual([of('intro')['claim-scope'].v, of('main')['claim-scope'].v, of('five')['claim-scope'].v, of('intro')['scope-stated'].v, asked(seen).has(gap.head('Introduction')), asked(seen).has(gap.head('The fifth case'))], ['pending', 'pending', 'pass', 'pass', false, true],
    'while a Section lacks an entry, no question that shows the outline is put to a judge about its paragraphs or its heading, and the rest is judged');
  // A Section the outline does not list, and an outline section that matches none.
  r = changed(project, o => { o.sections[1].title = 'The sixth case'; });
  assert.deepEqual(open(r), [['outline-contract', '§2', ['the outline has no section with this title']], ['outline-contract', 'document', ['the outline section "The sixth case" matches no Section, Subsection or Subsubsection of the manuscript']]]);
  // An entry without a known role, or without what the paragraph does.
  r = changed(project, o => { o.sections[3].paragraphs[0] = entry('punchline', ' '); });
  assert.deepEqual(open(r), [['outline-contract', '§3', ['an entry under this heading is not valid (it is listed with its paragraph)']],
    ['outline-contract', '§3 ¶1', [`its outline entry has the role "punchline": name one of ${ROLES.join(', ')}`, 'its outline entry does not say what the paragraph does ("does")']]]);
  assert.ok(['definition', 'derivation', 'transition'].every(role => ROLES.includes(role)), 'no paragraph is forced to carry a result');
  // No central claim, or one without an id.
  r = changed(project, o => { o.claims = []; });
  assert.deepEqual([open(r), verdicts(r.state, 'claim-scope').length], [[['outline-contract', 'document', ['the outline registers no central claim: "claims" states what the manuscript establishes, each claim with the restrictions it holds under']]], 0]);
  assert.match(open(changed(project, o => { o.claims = [{ id: 'No third case', claim: 'x' }]; }))[0][2][0], /^the central claim "No third case" needs an id of its own/);
  put(project, 'paper/OUTLINE.json', { claims: OUTLINE.claims, sections: {} }); assert.throws(() => verify(project, 'paper', check), /OUTLINE\.json: "sections" must be a list/);
  // The macro of the preamble in a title, and the heading of the Subsection listed under its Section.
  r = changed(project, () => {});
  assert.deepEqual([open(r), load(project, 'paper/main.tex').units.find(u => u.id === head('Review')).text], [[], 'Review: the ${\\cal N}=1$ duality']);
  assert.match(r.questions.find(q => q.unit === head('The fifth case')).items[0].q, /^The unit is a heading of the manuscript\. Under it stand 2 paragraphs, to which the outline of the manuscript gives these entries \(the role of the paragraph, then what it does\): \(1\) result: States where the flow ends in the fifth case\. \(2\) setup: Lists the other cases\. The parts under it have the headings «Review: the \$\{\\cal N\}=1\$ duality»\. Pass if the heading covers what each of these parts does: /);
  // Paragraphs before the first heading are listed in a section without a title.
  const front = make(t, { 'paper/main.tex': 'A first paragraph.\n\n\\section{Next}\n\nA second one.\n', 'paper/OUTLINE.json': { claims: OUTLINE.claims, sections: [{ title: 'Next', paragraphs: [entry('setup', 'Adds a paragraph.')] }] } });
  assert.deepEqual(open(verify(front.project, 'paper', check)).filter(f => f[0] === 'outline-contract'), [['outline-contract', 'front ¶1', ['the paragraph has no outline entry: the paragraphs before the first heading need an outline section with an empty title']]]);
  put(front.project, 'paper/OUTLINE.json', { claims: OUTLINE.claims, sections: [{ title: '', paragraphs: [entry('setup', 'Opens the text.')] }, { title: 'Next', paragraphs: [entry('setup', 'Adds a paragraph.')] }] });
  assert.deepEqual(open(verify(front.project, 'paper', check)).filter(f => f[0] === 'outline-contract'), []);
  // What a rule of a reader may name, and what its texts must then carry.
  const rule = { id: 'paragraph-kept', kind: 'judge', unit: 'paragraph', shows: ['entry'], question: 'Does the paragraph keep to its entry?', source: 'fixture',
    fail: [{ tex: '\\section{A}\n\nOne sentence. Another one.', outline: { claims: OUTLINE.claims, sections: [{ title: 'A', paragraphs: [entry('setup', 'States one sentence.')] }] } }], pass: [{ tex: '\\section{B}\n\nOne sentence.', outline: { claims: OUTLINE.claims, sections: [{ title: 'B', paragraphs: [entry('setup', 'States one sentence.')] }] } }] };
  const register = x => put(project, 'paper/RULES.json', { version: 1, rules: [x] });
  register({ ...rule, family: 'kept' }); assert.equal(rules(project).at(-1).id, 'paragraph-kept');
  register({ ...rule, family: 'kept', unit: 'title' }); assert.throws(() => rules(project), /paragraph-kept refused: its unit is "sentence" \(the default\) or "paragraph"/);
  register({ ...rule, family: 'kept', shows: ['notes'] }); assert.throws(() => rules(project), /"shows" lists what of the outline the judge is shown with the unit: entry, claims/);
  register({ ...rule, family: 'kept', pass: [{ tex: '\\section{B}\n\nOne sentence.' }] }); assert.throws(() => rules(project), /its passing text lacks what the rule shows the judge \(entry\): give it its own "outline"/);
  register({ ...rule, family: 'kept', pass: [{ ...rule.pass[0], outline: { sections: rule.pass[0].outline.sections } }] }); assert.equal(rules(project).at(-1).id, 'paragraph-kept', 'a family that shows the entry alone needs no claims in its texts');
  register({ ...rule, family: 'outline', pass: [{ ...rule.pass[0], outline: { sections: rule.pass[0].outline.sections } }] }); assert.throws(() => rules(project), /paragraph-kept refused: it shows the judge the outline in the calls of the family outline, so every text of that family needs an "outline" of its own with its central claims, and a text of the rule has none/);
  // The calls of a family show every unit what one of its rules shows: a rule that shows the outline does not join the rules about a
  // sentence in its paragraph, whose verdicts an entry written by the writer would otherwise sway (measured: design record).
  register(rule); assert.throws(() => rules(project), /paragraph-kept refused: it shows the judge the outline in the calls of the family content, so every text of that family needs an "outline" of its own with an entry for each of its paragraphs, and a text of the rule scope-stated has none \(give the rule a family of its own, or the text its outline\)/);
});

test('the judge is shown a paragraph with its entry and the registered claims: the misplaced sentence, the main result without its restriction, a result of the abstract that no claim covers and a heading that promises a review fail', async t => {
  const { root, project, at, para, head, sentence } = make(t), log = [];
  const quote = (reason, evidence) => ({ verdict: 'fail', reason, evidence });
  const defects = (call, e, i) => e.planted ? undefined
    : e.unit === para('In the fifth case') && i.rule === 'entry-delivered' ? quote('The last sentence is about the third case.', 'In the third case the first node has no flavors.')
      : e.unit === at('main') && i.rule === 'claim-scope' ? quote('The registered claim holds without a superpotential.', 'the third case never occurs')
        : e.unit === sentence('In every case both') && i.rule === 'abstract-covered' ? quote('No registered claim is about every case.', 'In every case both gauge couplings are asymptotically free.')
          : e.unit === head('Review') && i.rule === 'outline-contract' ? quote('Nothing under it is a review.', '(1) derivation: Derives a new bound on the flavors.') : undefined;
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(defects, log) });
  assert.deepEqual(out.runs.map(r => r.calls.map(c => [c.family, c.units])), [[['content', 3], ['content', 1], ['content', 1], ['content', 3], ['content', 3], ['content', 1], ['content', 1], ['outline', 3], ['outline', 2], ['outline', 2], ['outline', 4], ['outline', 4], ['outline', 2], ['outline', 2], ['abstract', 3], ['outline-contract', 4]]],
    'for the abstract and for each paragraph (a list with the paragraph before it) a call under the rules about a sentence and a call with the outline, which also holds the paragraph itself; one call for the abstract against the claims, and one for the four headings');
  assert.deepEqual(out.runs.map(r => r.calls.flatMap(c => c.planted).filter(p => p.met).length), [75]);
  const text = n => fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, String(n).padStart(4, '0'), 'prompt.txt'), 'utf8');
  for (const part of ['A block may also print what the outline of its manuscript holds for it', 'Headings above it: The fifth case\nEntry of the paragraph in the outline: result. States where the flow ends in the fifth case.\nCentral claims registered in the outline:\n- Without a superpotential, the third case never occurs.\nUnit U',
    ': the paragraph of this block as a whole, with the list items that belong to it.', 'In the third case the first node has no flavors.\\label{three}\n>>>', 'Headings above it: Case (5): two asymptotically free nodes\nEntry of the paragraph in the outline: result. States where the flow ends in case (5), in which both gauge couplings are asymptotically free.']) assert.ok(text(11).includes(part), part);
  assert.ok(!/seed|plant/i.test(text(11)) && !text(11).includes('Paragraph:\n'), 'nothing names a planted text, and a paragraph whose sentences are all units is not printed twice');
  for (const asked of [/\n- claim-scope \(units U\d+(?:, U\d+){15}\): The block prints the central claims/, /\n- entry-delivered \(units U\d+(?:, U\d+){5}\): The block prints the entry/]) assert.match(text(11), asked, 'a question put to several units is printed once');
  assert.ok(text(4).includes('In the third case the first node has no flavors.') && !/Entry of the paragraph|Central claims|outline/.test(text(4)), 'the same paragraph under the rules about a sentence is shown without the outline: an entry written by the writer cannot excuse a sentence there');
  assert.deepEqual(log[11].entries.filter(e => !e.planted).map(e => [e.whole, e.text.replace(/\\label\{\w+\}/, '')]), [[true, ''], [false, 'The other cases are the following.'], [false, 'In the first case a node is free.'], [false, 'In the second case no node is free.']], 'the paragraph that opens a list is judged with its items');
  assert.ok(text(15).includes('The unit is a sentence of an abstract') && !text(15).includes('Headings above it') && text(15).includes('We also find that the theory confines'), 'the abstract stands under no heading, and neither does the planted one');
  assert.ok(text(16).includes('(1) derivation: Derives a new bound on the flavors.') && text(16).includes('Review of Seiberg duality') && text(16).includes('Exclusion of case (5)') && !text(16).includes('Headings above it'), 'a heading is judged alone, with the entries under it in its question, next to the planted headings');
  const v = (unit, rule) => out.result.state.units[unit].checks[rule];
  assert.deepEqual([v(para('In the fifth case'), 'entry-delivered').v, v(at('main'), 'claim-scope').v, v(sentence('In every case both'), 'abstract-covered').v, v(head('Review'), 'outline-contract').v], ['fail', 'fail', 'fail', 'fail']);
  assert.match(v(para('In the fifth case'), 'entry-delivered').e[0], /^judge codex, provider default model \(run [0-9a-f]{12}\) fails it: The last sentence is about the third case\. Evidence: "In the third case the first node has no flavors\."$/, 'the misplaced sentence is the evidence');
  assert.match(v(head('Review'), 'outline-contract').e[0], /^Review: the \$\{\\cal N\}=1\$ duality: judge codex.*fails it: Nothing under it is a review\./);
  assert.deepEqual([v(at('w'), 'claim-scope').v, v(sentence('Without a superpotential, the third case never'), 'claim-scope').v, v(para('The quivers of this paper'), 'entry-delivered').v, v(head('The fifth case'), 'outline-contract').v], ['pass', 'pass', 'pass', 'pass']);
  assert.deepEqual([out.result.open.map(f => [f.rule, f.where]), waiting(out.result.state), out.result.state.complete], [[['abstract-covered', 'abstract s3'], ['claim-scope', '§1 ¶2 s1'], ['entry-delivered', '§2 ¶1'], ['outline-contract', '§2.1']], 0, false]);
  // A judge that misses the planted paragraph, claim, abstract or heading gives no verdict on that rule.
  const blind = make(t), flip = { 'entry-delivered:fail:1': 'pass', 'claim-scope:fail:1': 'pass', 'abstract-covered:pass:1': 'fail', 'outline-contract:fail:1': 'pass' };
  const lapse = await judge(blind.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => flip[i.seed]) });
  assert.deepEqual(NAMES.map(rule => [...new Set(verdicts(lapse.result.state, rule))]), [['pending'], ['pending'], ['pending'], ['pass'], ['pass']], 'the other rules of the same calls, tested by their own planted texts, are judged');
  assert.deepEqual([tally(lapse.result, 'outline-contract'), lapse.result.state.complete], [[7, 0, 4, 0], false]);
  assert.match(report('demo', lapse.result), /below 9 in 10 and not used for: abstract-covered, claim-scope, entry-delivered, outline-contract/);
});

test('a verdict is bound to what the judge was shown: an edit of a paragraph, of an entry or of a claim asks again what showed it and nothing else', async t => {
  const { root, project, at, para, head } = make(t), log = [];
  const ask = async () => { log.length = 0; const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) }); return [out.runs.map(r => r.calls.map(c => [c.family, c.units])), out.result.state.complete, out.result.state.units]; };
  let [calls, complete, first] = await ask();
  assert.deepEqual([calls.map(run => run.length), complete, standing(project, 'paper').verified], [[16], true, true]);
  assert.deepEqual(await ask(), [[], true, first], 'a verified text costs no call');
  // One sentence of the last Section: its paragraph and its sentence with the outline, the sentence in its paragraph, not its heading and nothing of another Section.
  edit(project, 'Seiberg duality realizes the third case.', 'Seiberg duality then realizes the third case.');
  let units;
  [calls, complete, units] = await ask();
  assert.deepEqual([calls, complete, [...asked(log)].sort()], [[[['outline', 2], ['content', 1]]], true, [para('Seiberg duality then realizes'), at('w')].sort()]);
  for (const id of [head('With a superpotential'), head('Introduction'), at('main'), at('three'), para('In the fifth case')]) assert.deepEqual(units[id], first[id], 'the other verdicts are kept with the runs they rest on');
  assert.deepEqual(units.document.checks['outline-contract'], first.document.checks['outline-contract']);
  // One entry of the outline: the paragraph it belongs to with its sentences, and the heading above it. The rules about a sentence
  // in its paragraph never saw the entry, and keep their verdicts.
  first = units;
  assert.equal(changed(project, o => { o.sections[0].paragraphs[0].does = 'Says that the quivers of the paper have several couplings.'; }).state.complete, false);
  assert.equal(standing(project, 'paper').verified, false, 'a changed outline leaves the manuscript unverified until its questions are asked again');
  [calls, complete, units] = await ask();
  assert.deepEqual([calls, complete, [...asked(log)].sort()], [[[['outline-contract', 1], ['outline', 2]]], true, [head('Introduction'), para('The quivers of this paper'), at('intro')].sort()]);
  for (const id of [at('main'), para('Our main result'), head('The fifth case'), at('w')]) assert.deepEqual(units[id], first[id]);
  // The claim: every question that shows the claims (the abstract, the paragraphs and their sentences), and no heading.
  put(project, 'paper/OUTLINE.json', { ...JSON.parse(fs.readFileSync(path.join(project, 'paper/OUTLINE.json'), 'utf8')), claims: [{ id: 'no-third-case', claim: 'Without a superpotential the third case does not occur.' }] });
  [calls, complete] = await ask();
  assert.deepEqual([calls, complete, log.every(call => call.family === 'outline-contract' || call.entries.some(e => !e.planted))], [[[['outline', 3], ['outline', 2], ['outline', 2], ['outline', 4], ['outline', 4], ['outline', 2], ['outline', 2], ['abstract', 3]]], true, true]);
  // The entry put back as it was: the heading finds the verdict recorded for these entries again, and the paragraph is asked
  // under the changed claim, which no earlier run showed together with this entry.
  put(project, 'paper/OUTLINE.json', { ...OUTLINE, claims: [{ id: 'no-third-case', claim: 'Without a superpotential the third case does not occur.' }] });
  assert.deepEqual((await ask()).slice(0, 2), [[[['outline', 2]]], true]);
  put(project, 'paper/OUTLINE.json', OUTLINE);
  assert.deepEqual((await ask()).slice(0, 2), [[], true], 'the outline as it first was: every verdict recorded under it is found again, without a call');
});

test('paper-outline prints the outline next to the text and the skeleton to fill in, and enrolls nothing; a manuscript that is not enrolled is not gated', async t => {
  const { root, project } = make(t, { 'paper/OUTLINE.json': null });
  let view = await main(['paper-outline', 'demo'], root);
  assert.match(view, new RegExp(`^Outline of demo/paper: OUTLINE\\.json absent\\. Roles: ${ROLES.join(', ')}\\.\\n§1 Introduction: 2 paragraphs\\n  §1 ¶1: NO ENTRY\\n      \\| The quivers of this paper`));
  assert.match(view, /§2 The fifth case: 2 paragraphs\n  §2 ¶1: NO ENTRY\n      \| In the fifth case both gauge couplings[^\n]*\n  §2 ¶2 \(with 2 list items\): NO ENTRY\n/);
  let skeleton = JSON.parse(await main(['paper-outline', 'demo', 'paper', '--skeleton'], root));
  assert.deepEqual([skeleton.claims, skeleton.sections.map(s => [s.title, s.paragraphs])], [[{ id: '', claim: '' }], [['Introduction', 2], ['The fifth case', 2], ['Review: the ${\\cal N}=1$ duality', 1], ['With a superpotential', 1]].map(([title, n]) => [title, new Array(n).fill({ role: '', does: '' })])]);
  assert.deepEqual(fs.readdirSync(path.join(project, 'paper')), ['main.tex'], 'looking at the outline writes nothing and enrolls nothing');
  assert.deepEqual(hook(root, { hook_event_name: 'Stop', session_id: 's' }), {}, 'and a manuscript that is not enrolled is not gated');
  const less = structuredClone(OUTLINE); less.sections[0].paragraphs.pop(); put(project, 'paper/OUTLINE.json', less);
  view = await main(['paper-outline', 'demo'], root);
  assert.match(view, /OUTLINE\.json read\.[^\n]*\nCentral claims:\n- \(no-third-case\) Without a superpotential, the third case never occurs\.\n§1 Introduction: 2 paragraphs, 1 entry \(THE NUMBERS DIFFER\)\n  §1 ¶1: NO ENTRY\n/);
  assert.match(view, /§2 The fifth case: 2 paragraphs, 2 entries\n  §2 ¶1: \[result\] States where the flow ends in the fifth case\.\n/);
  skeleton = JSON.parse(await main(['paper-outline', 'demo', '--skeleton'], root));
  assert.deepEqual([skeleton.claims, skeleton.sections[0].paragraphs, skeleton.sections[1]], [OUTLINE.claims, [OUTLINE.sections[0].paragraphs[0], { role: '', does: '' }], OUTLINE.sections[1]], 'the skeleton keeps every entry that stands and adds an empty one for the paragraph without one');
  put(project, 'paper/OUTLINE.json', { ...OUTLINE, sections: [...OUTLINE.sections, { title: 'Results', paragraphs: [] }] });
  assert.match(await main(['paper-outline', 'demo'], root), /\nPROBLEM: the outline section "Results" matches no Section, Subsection or Subsubsection of the manuscript\n/);
  await assert.rejects(main(['paper-outline', 'demo', '--all'], root), /Expected paper-outline <slug> \[paper-dir\] \[--skeleton\]/);
  assert.ok(!fs.existsSync(path.join(project, 'paper/VERIFY.json')));
});

test('the setting of the manuscript and of a Section is shown, in its own words, with the paragraphs of its scope after it; code holds its pointers to the text, and an edit of a setting sentence asks again only the paragraphs that show it', async t => {
  const SET = { ...OUTLINE, setting: ['The quivers of this paper have several'], sections: OUTLINE.sections.map(s => s.title === 'The fifth case' ? { ...s, setting: ['label:five'] } : s) };
  const { root, project, at, para, sentence } = make(t, { 'paper/OUTLINE.json': SET }), log = [];
  const text = label => load(project, 'paper/main.tex').units.find(u => u.id === at(label)).text, intro = text('intro'), five = text('five');
  let r = verify(project, 'paper', check);
  assert.deepEqual([r.open, r.state.outline.setting], [[], 2]);
  assert.match(report('demo', r), /\nOutline: 1 central claim, 2 sentences of the setting, 4 Sections and 6 paragraph entries \(OUTLINE\.json\)\.\n/);
  const shown = (family, unit) => r.questions.find(q => q.family === family && q.unit === unit)?.aside.setting ?? [];
  assert.deepEqual(['The quivers of this paper', 'Our main result', 'In the fifth case', 'The other cases', 'We derive', 'Seiberg duality realizes'].map(p => shown('outline', para(p))), [[], [intro], [intro], [intro, five], [intro, five], [intro]],
    "a sentence of the setting is shown after its own paragraph, and a Section's with the paragraphs of the Section and of its Subsections");
  assert.deepEqual([shown('outline', at('main')), shown('outline', sentence('In the first case a node')), shown('outline', sentence('Without a superpotential, the third case')), shown('content', at('main'))], [[intro], [intro, five], [], []],
    'a sentence is shown the setting of its paragraph (a list item that of the paragraph it belongs to), the abstract none, and the rules about a sentence in its paragraph none');
  // In the prompt the setting stands in its own words with the block it belongs to.
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  const n = log.find(call => call.family === 'outline' && call.entries.some(e => e.unit === para('The other cases'))).n, prompt = fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, String(n).padStart(4, '0'), 'prompt.txt'), 'utf8');
  assert.ok(prompt.includes(`Headings above it: The fifth case\nSentences earlier in the manuscript that state the setting:\n<<<\n${intro}\n>>>\n<<<\n${five}\n>>>\nEntry of the paragraph in the outline: setup. Lists the other cases.`), prompt.slice(0, 3000));
  assert.ok(prompt.includes('Sentences earlier in the manuscript that state the setting:\n<<<\nWe consider connected two-node quivers'), 'a planted paragraph with a setting stands in the same call');
  assert.equal(out.result.state.complete, true);
  // An edit of a sentence of the setting: its own paragraph, and the paragraphs that are shown it under the rules that show the setting.
  edit(project, 'In the fifth case both gauge couplings are asymptotically free.', 'In the fifth case both gauge couplings are asymptotically free at the origin.');
  log.length = 0;
  const again = await judge(root, 'demo', 'paper', { ...check, runner: answerer(undefined, log) });
  assert.deepEqual(again.runs.map(run => run.calls.map(c => [c.family, c.units])), [[['outline', 4], ['outline', 4], ['outline', 2], ['content', 3]]]);
  assert.deepEqual([...new Set(log.flatMap(call => call.entries.filter(e => !e.planted).map(e => e.unit)))].length, 10, 'the edited paragraph with its three sentences, the list with its sentence and its two items, and the Subsection with its sentence');
  for (const p of ['Our main result', 'Seiberg duality realizes']) assert.deepEqual(again.result.state.units[para(p)], out.result.state.units[para(p)]);
  assert.equal(again.result.state.complete, true);
  // Pointers that code holds to the text.
  const fault = change => { const o = structuredClone(SET); change(o); put(project, 'paper/OUTLINE.json', o); return verify(project, 'paper', check).open.filter(f => f.rule === 'outline-contract').flatMap(f => f.evidence); };
  assert.deepEqual(fault(o => { o.setting = ['No such words']; }), ['the setting "No such words" of the manuscript matches no sentence of the manuscript']);
  assert.deepEqual(fault(o => { o.setting = ['the third case']; }), ['the setting "the third case" of the manuscript stands in 4 sentences: point to one']);
  assert.deepEqual(fault(o => { o.setting = ['label:sec:five']; }), ['the setting "label:sec:five" of the manuscript points to a unit that is not a sentence']);
  assert.deepEqual(fault(o => { o.setting = ['label:w']; o.sections[3].setting = ['label:w']; }), ['the setting "With a superpotential, Seiberg duality realizes the third ca" of the section "With a superpotential" stands after every paragraph it would be shown with', 'the setting "With a superpotential, Seiberg duality realizes the third ca" of the manuscript stands after every paragraph it would be shown with']);
  put(project, 'paper/OUTLINE.json', { ...SET, setting: 'The quivers' }); assert.throws(() => verify(project, 'paper', check), /OUTLINE\.json: "setting" must be a list/);
  // paper-outline prints the setting and the skeleton keeps it.
  put(project, 'paper/OUTLINE.json', SET);
  assert.match(await main(['paper-outline', 'demo'], root), /\nSetting of the manuscript:\n  setting: §1 ¶1 s1 \| The quivers of this paper have several gauge couplings\.[^\n]*\n[\s\S]*\n§2 The fifth case: 2 paragraphs, 2 entries\n  setting: §2 ¶1 s1 \| In the fifth case both gauge couplings are asymptotically free at the origin\./);
  const skeleton = JSON.parse(await main(['paper-outline', 'demo', '--skeleton'], root));
  assert.deepEqual([skeleton.setting, skeleton.sections[1].setting, 'setting' in skeleton.sections[0]], [SET.setting, ['label:five'], false]);
  // A judge that demands of a sentence a restriction that the setting supplies misses a planted text, and gives no verdict on the rule.
  const strict = make(t, { 'paper/OUTLINE.json': SET });
  const pedant = await judge(strict.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => i.seed === 'claim-scope:pass:2' ? 'fail' : undefined) });
  assert.deepEqual([[...new Set(verdicts(pedant.result.state, 'claim-scope'))], [...new Set(verdicts(pedant.result.state, 'entry-delivered'))]], [['pending'], ['pass']]);
  assert.match(report('demo', pedant.result), /\(missed: claim-scope:pass:2\)[^\n]*below 9 in 10 and not used for: claim-scope/);
  // A family that shows the setting needs a text that is shown one.
  const lonely = { id: 'lonely-rule', kind: 'judge', family: 'lonely', shows: ['setting'], question: 'Does the sentence hold?', source: 'fixture', fail: ['\\section{A}\n\nOne sentence.'], pass: ['\\section{B}\n\nAnother sentence.'] };
  put(project, 'paper/RULES.json', { version: 1, rules: [lonely] });
  assert.throws(() => rules(project), /Rule lonely-rule refused: it shows the judge the setting in the calls of the family lonely, so at least one text of that family needs an "outline" whose setting points to a sentence before one of its paragraphs/);
});
