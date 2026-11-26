// Sentence grounds (harness/design/paper-verification.md, "Sentence grounds"): every sentence has an entry in GROUNDS.json with
// its type and the passages it rests on, held to the text by code and judged against the passages by the independent verdict.
// Every judge here is injected (tests/judges.mjs); no test calls a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from '../harness/tex.mjs';
import { verify, report, rules, standing, ledger, TYPES, citedKeys, bibliography } from '../harness/verify.mjs';
import { judge, summary, reversed } from '../harness/judge.mjs';
import { fromTex } from '../harness/corpus.mjs';
import { hook, main } from '../harness/cli.mjs';
import { answerer } from './judges.mjs';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hep grounds 한글 '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(root, name, content = '') { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2)); }
const edit = (project, from, to, file = 'paper/main.tex') => { const p = path.join(project, file), s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(from), from); fs.writeFileSync(p, s.replace(from, to)); };

// A Section on the exclusion of the fifth case. Its second paragraph ends with the sentence of the origin: a way around the exclusions
// of the third and the fifth case, which the note it rests on contradicts for the fifth.
const TEX = String.raw`\documentclass{article}
\begin{document}
\section{Exclusion of the fifth case}
Without a superpotential the sum of the one-loop coefficients of both nodes is non-negative.\label{sum} The fifth case therefore never occurs without a superpotential.\label{five}

With a superpotential the fifth case needs a field whose R-charge is higher where its node interacts.\label{w} The only way around the exclusions of the third and the fifth case is a superpotential constraint.\label{only}

The conformal window of SQCD is known \cite{Seiberg:1994pq}.\label{cite}

We turn to the examples.\label{turn}
\end{document}
`;
const NOTE = `# The fifth case

Without a superpotential the sum of the one-loop coefficients of both nodes at the single-node fixed points is non-negative, since every field charged under one node only sits below its free R-charge there.

With a superpotential the fifth case needs a field charged under one node only whose R-charge is higher where its node interacts than where it is free. Whether a superpotential can arrange this is open.
`;
const BIB = '@article{Seiberg:1994pq,\n  author = "Seiberg, N.",\n  eprint = "hep-th/9411149"\n}\n@article{NoEprint:2000,\n  author = "Nobody"\n}\n';
const SOURCES = { 'hep-th/9411149': { 'main.tex': 'We argue that in the range $3N_c/2<N_f<3N_c$ the theory flows to an interacting conformal theory in the infrared.\n' } };
const note = quote => ({ file: 'notes/01-fifth-case.md', quote });
const GROUNDS = { version: 1, sentences: [
  { at: 'label:sum', type: 'derivation', links: [note('the sum of the one-loop coefficients of both nodes at the single-node fixed points is non-negative')] },
  { at: 'label:five', type: 'result', links: [{ at: 'label:sum' }] },
  { at: 'label:w', type: 'result', links: [note('the fifth case needs a field charged under one node only')] },
  { at: 'The only way around', type: 'result', links: [note('the fifth case needs a field charged under one node only'), { at: 'label:sum' }] },
  { at: 'The conformal window', type: 'cited', links: [{ cite: 'Seiberg:1994pq', quote: 'the theory flows to an interacting conformal theory' }] },
  { at: 'We turn to', type: 'transition' }] };
const OUTLINE = { version: 1, claims: [{ id: 'no-fifth-case', claim: 'Without a superpotential the fifth case never occurs.' }], sections: [{ title: 'Exclusion of the fifth case', paragraphs: [
  { role: 'result', does: 'Shows that the fifth case does not occur without a superpotential.' }, { role: 'result', does: 'States what the fifth case needs with a superpotential.' },
  { role: 'review', does: 'Recalls the conformal window of SQCD.' }, { role: 'transition', does: 'Turns to the examples.' }] }] };
const sources = id => SOURCES[id] ?? null;
const check = { build: () => ({ log: '', pages: ['text'] }), corpus: () => fromTex([TEX, TEX, NOTE]), sources };
function make(t, extra = {}) {
  const root = temp(t), project = path.join(root, 'projects', 'demo');
  for (const [name, content] of Object.entries({ 'paper/main.tex': TEX, 'paper/refs.bib': BIB, 'paper/GROUNDS.json': GROUNDS, 'paper/OUTLINE.json': OUTLINE, 'notes/01-fifth-case.md': NOTE, ...extra })) if (content !== null) put(project, name, content);
  return { root, project, at: label => load(project, 'paper/main.tex').labels[label] };
}
const changed = (project, change) => { const g = structuredClone(GROUNDS); change(g); put(project, 'paper/GROUNDS.json', g); return verify(project, 'paper', check); };
const faults = r => r.open.filter(f => f.rule === 'sentence-grounds').map(f => [f.where, f.verdict, f.evidence]);
const waiting = state => state.rules.reduce((n, r) => n + r.pending, 0);
const asked = log => new Set(log.flatMap(call => call.entries.filter(e => !e.planted).map(e => e.unit)));

test('every sentence of an enrolled manuscript needs one entry in GROUNDS.json, and code holds its type and its links to the text, the notes and the sources', async t => {
  const { root, project, at } = make(t);
  let r = verify(project, 'paper', check);
  const grounds = Object.values(r.state.units).filter(u => u.checks['sentence-grounds']).map(u => [u.where, u.checks['sentence-grounds'].v]);
  assert.deepEqual(grounds, [['§1 ¶1 s1', 'pending'], ['§1 ¶1 s2', 'pending'], ['§1 ¶2 s1', 'pending'], ['§1 ¶2 s2', 'pending'], ['§1 ¶3 s1', 'pending'], ['§1 ¶4 s1', 'pending'], ['document', 'pass']], 'every sound entry awaits the judge');
  assert.deepEqual([r.open, r.state.grounds], [[], { cited: 1, derivation: 1, result: 3, transition: 1 }]);
  assert.match(report('demo', r), /\nGrounds: 6 sentences with an entry in GROUNDS\.json \(cited 1, derivation 1, result 3, transition 1\)\.\nOutline: /);
  assert.deepEqual([TYPES, citedKeys('As in \\cite[Sec.~2]{a, b} and \\citep{c}.'), [...bibliography([BIB])]], [['result', 'derivation', 'cited', 'definition', 'transition'], ['a', 'b', 'c'], [['Seiberg:1994pq', 'hep-th/9411149'], ['NoEprint:2000', null]]]);
  // What code fails, sentence by sentence.
  const one = (change, where = '§1 ¶4 s1') => faults(changed(project, change)).filter(f => f[0] === where).flatMap(f => f[2]);
  assert.deepEqual(one(g => { g.sentences.pop(); }), ['the sentence has no entry in GROUNDS.json']);
  assert.deepEqual(one(g => { g.sentences.push({ at: 'label:turn', type: 'transition' }); }), ['2 entries of GROUNDS.json point to this sentence']);
  assert.deepEqual(one(g => { g.sentences[5].type = 'summary'; }), [`its type "summary" is none of ${TYPES.join(', ')}`]);
  assert.deepEqual(one(g => { delete g.sentences[1].links; }, '§1 ¶1 s2'), ['a sentence of the type result needs a link to what it rests on']);
  assert.deepEqual(one(g => { g.sentences[0].links = [{ file: 'notes/09-missing.md', quote: 'the sum of the one-loop coefficients of both nodes' }]; }, '§1 ¶1 s1'), ['notes/09-missing.md does not exist']);
  assert.deepEqual(one(g => { g.sentences[0].links = [note('the sum of the one-loop coefficients of both nodes is negative')]; }, '§1 ¶1 s1'), ['the quote "the sum of the one-loop coefficients of both nodes is negative" is not in notes/01-fifth-case.md']);
  assert.deepEqual(one(g => { g.sentences[0].links = [note('is non-negative')]; }, '§1 ¶1 s1'), ['the quote "is non-negative" has fewer than 4 words']);
  assert.deepEqual(one(g => { g.sentences[0].links = [{ file: 'notes/01-fifth-case.md' }]; }, '§1 ¶1 s1'), ['the link to notes/01-fifth-case.md has no "quote": copy the passage it rests on']);
  assert.deepEqual(one(g => { g.sentences[1].links = [{ at: 'label:five' }]; }, '§1 ¶1 s2'), ['the sentence links to itself']);
  assert.deepEqual(one(g => { g.sentences[1].links = [{ at: 'the fifth case' }]; }, '§1 ¶1 s2'), ['the link "the fifth case" stands in 3 places of the manuscript: point to one']);
  assert.deepEqual(one(g => { g.sentences[1].links = [{ cite: 'Seiberg:1994pq', quote: 'the theory flows to an interacting conformal theory' }]; }, '§1 ¶1 s2'), ['the sentence does not cite Seiberg:1994pq']);
  assert.deepEqual(one(g => { g.sentences[4].links = [note('the sum of the one-loop coefficients of both nodes at')]; }, '§1 ¶3 s1'), ['a sentence of the type cited needs a link to a passage of a source it cites']);
  edit(project, '\\cite{Seiberg:1994pq}', '\\cite{Seiberg:1994pq,NoEprint:2000,Absent:2001}');
  assert.deepEqual(one(g => { g.sentences[4].links = [{ cite: 'Absent:2001', quote: 'any four words here' }]; }, '§1 ¶3 s1'), ['Absent:2001 is not in the bibliography']);
  assert.deepEqual(one(g => { g.sentences[4].links = [{ cite: 'NoEprint:2000', quote: 'any four words here' }]; }, '§1 ¶3 s1'), ['NoEprint:2000 has no eprint in the bibliography, so its source cannot be read in the wiki']);
  edit(project, '\\cite{Seiberg:1994pq,NoEprint:2000,Absent:2001}', '\\cite{Seiberg:1994pq}');
  assert.deepEqual(one(g => { g.sentences[4].links[0].quote = 'the theory confines in the infrared'; }, '§1 ¶3 s1'), ['the quote "the theory confines in the infrared" is not in the source of arXiv:hep-th/9411149 (Seiberg:1994pq)']);
  put(project, 'paper/GROUNDS.json', GROUNDS);
  assert.deepEqual(faults(verify(project, 'paper', { ...check, sources: () => null })), [['§1 ¶3 s1', 'fail', ['arXiv:hep-th/9411149 (Seiberg:1994pq) is not among the wiki sources: it has to be ingested before a sentence can rest on it']]]);
  assert.deepEqual(faults(verify(project, 'paper', { ...check, sources: () => undefined })), [['§1 ¶3 s1', 'unjudged', ['the wiki is not found, so the source of Seiberg:1994pq cannot be read']]], 'on a computer without the wiki the cited sentence is not judged');
  // Entries that point nowhere, and a registry that is not one.
  assert.deepEqual(faults(changed(project, g => { g.sentences.push({ at: 'No such sentence', type: 'transition' }, { at: 'the fifth case', type: 'transition' }); })),
    [['document', 'fail', ['the entry "No such sentence" of GROUNDS.json matches no sentence of the manuscript', 'the entry "the fifth case" of GROUNDS.json stands in 2 sentences: point to one']]]);
  put(project, 'paper/GROUNDS.json', { sentences: {} }); assert.throws(() => verify(project, 'paper', check), /GROUNDS\.json: a registry of grounds is an object with "sentences"/);
  put(project, 'paper/GROUNDS.json', { sentences: [{ type: 'result' }] }); assert.throws(() => verify(project, 'paper', check), /an entry has "at"/);
  // Without the registry the document fails, once.
  fs.rmSync(path.join(project, 'paper/GROUNDS.json'));
  r = verify(project, 'paper', check);
  assert.deepEqual([faults(r).map(f => [f[0], f[2][0].slice(0, 39)]), r.state.grounds], [[['document', 'the manuscript has no GROUNDS.json: eve']], null]);
  assert.match(report('demo', r), /\nGrounds: none \(GROUNDS\.json\)\.\n/);
  // paper-grounds prints every sentence with its entry, and the skeleton keeps the entries that stand.
  put(project, 'paper/GROUNDS.json', { sentences: GROUNDS.sentences.slice(0, 2) });
  const view = await main(['paper-grounds', 'demo'], root);
  assert.match(view, /^Grounds of demo\/paper: GROUNDS\.json read, 2 of 6 sentences with one entry\. Types: result, derivation, cited, definition, transition \(the first three need a link\)\.\n  §1 ¶1 s1: \[derivation\] notes\/01-fifth-case\.md\n      \| Without a superpotential the sum[^\n]*\n  §1 ¶1 s2: \[result\] the manuscript\n[\s\S]*  §1 ¶2 s1: NO ENTRY\n/);
  const skeleton = JSON.parse(await main(['paper-grounds', 'demo', '--skeleton'], root));
  assert.deepEqual(skeleton.sentences.map(e => [e.at, e.type]), [['label:sum', 'derivation'], ['label:five', 'result'], ['label:w', ''], ['label:only', ''], ['label:cite', ''], ['label:turn', '']], 'a sentence with a label of its own is pointed to by it');
  await assert.rejects(main(['paper-grounds', 'demo', '--all'], root), /Expected paper-grounds <slug> \[paper-dir\] \[--skeleton\]/);
  // A manuscript that is not enrolled gets nothing.
  const plain = make(t, { 'paper/GROUNDS.json': null, 'paper/OUTLINE.json': null });
  await main(['paper-grounds', 'demo'], plain.root);
  assert.deepEqual([fs.readdirSync(path.join(plain.project, 'paper')).sort(), hook(plain.root, { hook_event_name: 'Stop', session_id: 's' })], [['main.tex', 'refs.bib'], {}]);
});

test('the judge is shown a sentence in its paragraph with its type and the passages it rests on: the sentence on the third and the fifth case fails, and a judge that passes its planted twin gives no verdict', async t => {
  const { root, project, at } = make(t), log = [];
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => !e.planted && e.unit === at('only') && i.rule === 'sentence-grounds' ? { verdict: 'fail', reason: 'The note gives another condition for the fifth case and calls it open.', evidence: 'Whether a superpotential can arrange this is open.' } : undefined, log) });
  const calls = log.filter(call => call.family === 'sentence-grounds');
  assert.deepEqual(calls.map(call => call.entries.filter(e => !e.planted).length), [2, 2, 1, 1], 'a call for each paragraph, its sentences together');
  assert.deepEqual(calls[0].entries.flatMap(e => e.items).filter(i => i.expect).map(i => `${i.seed}=${i.expect}`).sort(), ['sentence-grounds:fail:1=fail', 'sentence-grounds:fail:2=fail', 'sentence-grounds:pass:1=pass', 'sentence-grounds:pass:2=pass'], 'the planted sentence of the origin, its sound twin, a transition that states a result and a real one');
  const n = calls[1].n, text = fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, String(n).padStart(4, '0'), 'prompt.txt'), 'utf8');
  for (const part of ['Headings above it: Exclusion of the fifth case', 'Unit U', 'With a superpotential the fifth case needs a field whose R-charge is higher where its node interacts.', 'The writer types the unit as a result and gives these passages as what it rests on, copied from the sources named.\nPassage 1, from notes/01-fifth-case.md:\n<<<\nWith a superpotential the fifth case needs a field charged under one node only whose R-charge is higher where its node interacts than where it is free. Whether a superpotential can arrange this is open.\n>>>\nPassage 2, from the manuscript:\n<<<\nWithout a superpotential the sum of the one-loop coefficients of both nodes is non-negative.',
    'The only way around the exclusions of the third and the fifth case is a superpotential constraint.', 'The only way around the exclusions of cases (3) and (5) is a superpotential constraint that forces a field above $r=2/3$.', 'Judge whether the passages support the unit, not whether the passages are right.']) assert.ok(text.includes(part), part);
  assert.ok(!/seed|plant/i.test(text), 'nothing names a planted text');
  const cited = fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, String(calls[2].n).padStart(4, '0'), 'prompt.txt'), 'utf8');
  assert.ok(cited.includes('Passage 1, from Seiberg:1994pq (arXiv:hep-th/9411149, main.tex):\n<<<\nWe argue that in the range'), 'a cited passage is read from the source');
  const v = label => out.result.state.units[at(label)].checks['sentence-grounds'];
  assert.deepEqual(['sum', 'five', 'w', 'only', 'cite', 'turn'].map(l => v(l).v), ['pass', 'pass', 'pass', 'fail', 'pass', 'pass']);
  assert.match(v('only').e[0], /^"The only way around": judge codex, provider default model \(run [0-9a-f]{12}\) fails it: The note gives another condition for the fifth case and calls it open\. Evidence: "Whether a superpotential can arrange this is open\."$/);
  assert.deepEqual([out.result.open.map(f => [f.rule, f.where]), waiting(out.result.state)], [[['sentence-grounds', '§1 ¶2 s2']], 0]);
  // A judge that passes the planted sentence of the origin is not used for the rule, in any call.
  const blind = make(t);
  const lapse = await judge(blind.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => i.seed === 'sentence-grounds:fail:1' ? 'pass' : undefined) });
  assert.deepEqual([...new Set(Object.values(lapse.result.state.units).filter(u => u.checks['sentence-grounds'] && u.kind === 'sentence').map(u => u.checks['sentence-grounds'].v))], ['pending']);
  assert.match(report('demo', lapse.result), /\(missed: sentence-grounds:fail:1\)[^\n]*below 9 in 10 and not used for: sentence-grounds/);
  assert.equal(lapse.result.state.complete, false);
});

test('a verdict is bound to the passages it was shown: an edit of a note asks again the sentences that quote that passage, and nothing else', async t => {
  const { root, project, at } = make(t), log = [];
  const ask = async () => { log.length = 0; const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) }); return [out.runs.map(r => r.calls.map(c => [c.family, c.units])), out.result.state.complete]; };
  assert.deepEqual((await ask())[1], true);
  assert.equal(standing(project, 'paper').verified, true);
  // The block of the note that two sentences quote.
  edit(project, 'Whether a superpotential can arrange this is open.', 'Whether a superpotential can arrange this is not known.', 'notes/01-fifth-case.md');
  assert.deepEqual(await ask(), [[[['sentence-grounds', 2]]], true]);
  assert.deepEqual([...asked(log)].sort(), [at('w'), at('only')].sort());
  // The block that one sentence quotes; the sentence that links to it in the manuscript is shown the manuscript and is not asked.
  edit(project, 'sits below its free R-charge there.', 'sits below its free R-charge at that point.', 'notes/01-fifth-case.md');
  assert.deepEqual(await ask(), [[[['sentence-grounds', 1]]], true]);
  assert.deepEqual([...asked(log)], [at('sum')]);
  // A line of the note that no sentence quotes.
  fs.appendFileSync(path.join(project, 'notes/01-fifth-case.md'), '\nA remark that no sentence rests on.\n');
  assert.deepEqual(await ask(), [[], true]);
  // An edit of the manuscript passage that a sentence links to: the sentence that links to it, and the paragraph's own sentences.
  edit(project, 'is non-negative.\\label{sum}', 'is never negative.\\label{sum}');
  assert.deepEqual((await ask())[0].map(run => run.filter(([f]) => f === 'sentence-grounds')), [[['sentence-grounds', 2], ['sentence-grounds', 1]]]);
  assert.deepEqual([...asked(log)].filter(id => [at('sum'), at('five'), at('only')].includes(id)).sort(), [at('sum'), at('five'), at('only')].sort());
});

// Defects made from the manuscript's own sentences (design record, "Defects from the manuscript's own sentences").
const OWN_TEX = String.raw`\documentclass{article}
\begin{document}
\section{First part}
The coefficient of the first node is never negative at its fixed point.\label{a}

The second coupling grows at the fixed point of the first node.\label{b}

\section{Second part}
The ratio of the anomalies is larger than the other ratio in every example.\label{c}
\end{document}
`;
const OWN_NOTES = { 'notes/01-first.md': '# First\n\nThe coefficient of the first node is never negative at its fixed point, by the positivity of the multiplier.\n\nThe second coupling grows at the fixed point of the first node, since its coefficient rises there.\n',
  'notes/02-second.md': '# Second\n\nThe ratio of the anomalies is larger than the other ratio in every example of the table.\n' };
const OWN_GROUNDS = { version: 1, sentences: [
  { at: 'label:a', type: 'result', links: [{ file: 'notes/01-first.md', quote: 'is never negative at its fixed point' }] },
  { at: 'label:b', type: 'result', links: [{ file: 'notes/01-first.md', quote: 'The second coupling grows at' }] },
  { at: 'label:c', type: 'derivation', links: [{ file: 'notes/02-second.md', quote: 'ratio of the anomalies is larger' }] }] };
const ownCheck = { ...check, corpus: () => fromTex([OWN_TEX, OWN_TEX, ...Object.values(OWN_NOTES)]) };

test('the judges are also tested on defects made from the manuscript: a sentence given the passages of another, and a passed sentence reversed, each kept out of the call of its own paragraph', async t => {
  assert.deepEqual([reversed('The coefficient is never negative.'), reversed('For $N_f<N_c$ it is positive.'), reversed('Take $a\\le b$ here.'), reversed('Take $a\\leq b$ here.'), reversed('It is impossible here.'), reversed('A plain $\\left(x\\right)$ sentence.')],
    ['The coefficient is always negative.', 'For $N_f>N_c$ it is positive.', 'Take $a\\ge b$ here.', 'Take $a\\geq b$ here.', 'It is possible here.', null], 'the first sign in math or direction word in prose');
  const { root, project, at } = make(t, { 'paper/main.tex': OWN_TEX, 'paper/GROUNDS.json': OWN_GROUNDS, 'paper/OUTLINE.json': null, 'notes/01-fifth-case.md': null, ...OWN_NOTES }), log = [];
  const first = await judge(root, 'demo', 'paper', { writer: 'claude', ...ownCheck, runner: answerer(undefined, log) });
  const calls = log.filter(call => call.family === 'sentence-grounds'), own = call => call.entries.filter(e => e.planted && e.items.some(i => i.seed?.includes(':own-')));
  assert.equal(calls.length, 3, 'a call for each paragraph');
  const made = [...new Set(calls.flatMap(call => own(call).flatMap(e => e.items.map(i => i.seed))))];
  assert.equal(made.length, 1, 'the first run has no passed sentence to reverse, so one defect: a sentence with the passages of another');
  assert.match(made[0], /^sentence-grounds:own-passages:/);
  const source = calls.find(call => !own(call).length), text = own(calls.find(call => own(call).length))[0].text;
  assert.ok(source.entries.some(e => !e.planted && e.text.replace(/\\label\{[^}]*\}/g, '').trim() === text), 'it is left out of the call of its own paragraph');
  assert.deepEqual(calls.filter(call => own(call).length).length, 2, 'and stands in the other calls');
  assert.ok(!/\\label/.test(text), 'without its label');
  const prompt = fs.readFileSync(path.join(ledger(project, 'paper'), first.runs[0].id, String(calls.find(call => own(call).length).n).padStart(4, '0'), 'prompt.txt'), 'utf8');
  assert.ok(!/seed|plant|own-/i.test(prompt), 'nothing names it');
  assert.deepEqual(['a', 'b', 'c'].map(l => first.result.state.units[at(l)].checks['sentence-grounds'].v), ['pass', 'pass', 'pass']);
  // After an edit of the second sentence, its paragraph is asked again, with a passed sentence reversed among the planted texts.
  edit(project, 'The second coupling grows at the fixed point of the first node.', 'The second coupling grows at the fixed point of the first node, as its coefficient rises.');
  log.length = 0;
  const second = await judge(root, 'demo', 'paper', { writer: 'claude', ...ownCheck, runner: answerer(undefined, log) });
  const sources = second.runs[0].seeds.filter(x => x.id.includes(':own-')).map(x => x.id.split(':')[2]);
  assert.deepEqual([sources.length, new Set(sources).size], [2, 2], 'the two defects come from different sentences');
  const again = log.filter(call => call.family === 'sentence-grounds');
  assert.equal(again.length, 1);
  const turned = own(again[0]).find(e => e.items.some(i => i.seed.includes(':own-reversed:')));
  assert.ok(turned && ['The coefficient of the first node is always negative at its fixed point.', 'The ratio of the anomalies is smaller than the other ratio in every example.'].includes(turned.text), turned?.text);
  assert.deepEqual(turned.items.map(i => i.expect), ['fail']);
  // A judge that passes such a defect is not used for the rule in the calls that carried it.
  const blind = make(t, { 'paper/main.tex': OWN_TEX, 'paper/GROUNDS.json': OWN_GROUNDS, 'paper/OUTLINE.json': null, 'notes/01-fifth-case.md': null, ...OWN_NOTES });
  const lapse = await judge(blind.root, 'demo', 'paper', { writer: 'claude', ...ownCheck, runner: answerer((call, e, i) => i.seed?.includes(':own-') ? 'pass' : undefined) });
  assert.match(summary(lapse), /Missed: sentence-grounds:own-passages:[0-9a-f]+ in call \d+; sentence-grounds:own-passages:[0-9a-f]+ in call \d+\./);
  assert.match(summary(lapse), /Below 9 in 10, so none of this run's answers is used for: sentence-grounds\./, 'and with 12 of 14 planted texts, not for the rule in any call');
  assert.deepEqual(['a', 'b', 'c'].map(l => lapse.result.state.units[blind.at(l)].checks['sentence-grounds'].v), ['pending', 'pending', 'pending']);
});
