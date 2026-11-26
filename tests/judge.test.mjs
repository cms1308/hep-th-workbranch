// Stage 3 of harness/design/paper-verification.md (second form): independent verdicts from calls that put one rule family
// to a judge for many units, each call carrying the planted texts of its rules. Every judge here is injected
// (tests/judges.mjs); no test calls a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from '../harness/tex.mjs';
import { verify, report, standing, rules, ledger, JUDGES } from '../harness/verify.mjs';
import { judge, summary, prompt, shape, reading, BATCH } from '../harness/judge.mjs';
import { invocation } from '../harness/dispatch.mjs';
import { fromTex } from '../harness/corpus.mjs';
import { hook, main } from '../harness/cli.mjs';
import { answerer, settle } from './judges.mjs';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hep judge 한글 '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(root, name, content = '') { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2)); }
const edit = (project, from, to, file = 'paper/main.tex') => { const p = path.join(project, file), s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(from)); fs.writeFileSync(p, s.replace(from, to)); };

// Four sentences that leave to a reader one ground of each kind: a number stated in the manuscript (count, use), a colon
// (use), a pair that occurs once (use, susy), a declaration of ordinary wording (flow) and standard notation (susy).
const TEX = String.raw`\section{Two nodes}
The quiver has two nodes.\label{count}

Both of the two nodes are asymptotically free: the couplings grow.\label{use} There the flow reaches the endpoint.\label{flow}

The symbol $\mathcal{N}$ counts supersymmetries.\label{susy}
`;
const LEXICON = { symbols: [{ symbol: '\\mathcal{N}', standard: 'the number of supersymmetries' }], terms: [{ term: 'flow reaches', ordinary: 'a subject and its verb' }] };
const FACTS = { facts: { nodes: { at: 'label:count' } }, uses: { 'label:count': { two: 'nodes' }, 'label:use': { two: 'nodes' } } };
const lit = () => fromTex(['Both gauge couplings are asymptotically free. The generating function $\\Xi$ counts states with $\\mathcal{N}=1$.', 'The couplings are asymptotically free here. We expand $\\Xi$ for $\\mathcal{N}=2$.']);
const check = { build: () => ({ log: '', pages: ['text'] }), corpus: lit };
// Its outline: one central claim, and an entry for each of the three paragraphs under the one heading.
const OUTLINE = { version: 1, claims: [{ id: 'both-free', claim: 'Both nodes of the two-node quiver are asymptotically free.' }], sections: [{ title: 'Two nodes', paragraphs: [
  { role: 'setup', does: 'States the number of nodes of the quiver.' }, { role: 'result', does: 'States that both nodes are asymptotically free and where the flow ends.' }, { role: 'definition', does: 'Says what $\\mathcal{N}$ counts.' }] }] };
function make(t, extra = {}) {
  const root = temp(t), project = path.join(root, 'projects', 'demo');
  for (const [name, content] of Object.entries({ 'paper/main.tex': TEX, 'paper/LEXICON.json': LEXICON, 'paper/FACTS.json': FACTS, 'paper/OUTLINE.json': OUTLINE, ...extra })) put(project, name, content);
  return { root, project, at: label => load(project, 'paper/main.tex').labels[label] };
}
const stored = project => JSON.parse(fs.readFileSync(path.join(project, 'paper/VERIFY.json'), 'utf8'));
const backed = state => Object.values(state.units).flatMap(u => Object.values(u.checks)).filter(c => c.by);
const waiting = state => state.rules.reduce((n, r) => n + r.pending, 0);
const verdicts = (state, rule) => Object.values(state.units).filter(u => u.checks[rule]).map(u => u.checks[rule].v);
const FAMILIES = ['aside-punctuation', 'content', 'defined-before-use', 'number-bound', 'outline', 'outline-contract', 'term-attested'];
// The calls of a run on this manuscript: one for its heading, one for each of its three paragraphs under the rules that show the outline
// and one under the rules about a sentence, and one for each kind of question that code left open.
const RULES = ['outline-contract', 'outline', 'outline', 'outline', 'number-bound', 'content', 'content', 'content', 'aside-punctuation', 'term-attested', 'defined-before-use'];

test('a call puts one rule family to the judge for many units and carries its planted texts; a missed seeded defect, or a failed passing text, leaves that rule without a verdict', async t => {
  const log = [];
  // A sound judge: one run, since one judge passes a question.
  const a = make(t), first = verify(a.project, 'paper', check);
  assert.deepEqual([first.state.complete, first.open.length, waiting(first.state), first.questions.length, [...new Set(first.questions.map(q => q.family))].sort()], [false, 0, 23, 19, FAMILIES]);
  assert.match(report('demo', first), /Independent verdicts: none recorded on this computer\.[\s\S]*Status: INCOMPLETE, 0 failing and 0 not judged\. Awaiting the independent verdict: 23 \(node harness\/cli\.mjs paper-judge demo paper --writer <claude\|codex>\)\./);
  const sound = await judge(a.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  assert.deepEqual(sound.runs.map(r => [r.state, r.provider, r.calls.map(c => c.family)]), [['done', 'codex', RULES]], '11 calls where one call for each unit and family would take 34');
  assert.ok(log.every(call => new Set(call.entries.flatMap(e => e.items.map(i => i.rule))).size <= 2 && call.entries.some(e => e.planted) === (call.family !== 'defined-before-use')), 'one family in a call, with planted units among those of the manuscript');
  const content = log.filter(call => call.family === 'content').slice(0, 3);
  assert.deepEqual(content.map(call => [call.entries.filter(e => !e.planted).length, call.entries.filter(e => e.planted).length]), [[1, 6], [2, 6], [1, 6]], 'a sentence judged in its paragraph shares a call with no other paragraph of the manuscript');
  assert.deepEqual(content[0].entries.flatMap(e => e.items).filter(i => i.expect).map(i => `${i.seed}=${i.expect}`).sort(), ['in-place:fail:1=fail', 'in-place:pass:1=pass', 'scope-stated:fail:1=fail', 'scope-stated:pass:1=pass'], 'a paragraph that holds a sound and a defective sentence is planted once');
  const outline = log.filter(call => call.family === 'outline').slice(0, 3);
  assert.deepEqual(outline.map(call => [call.entries.filter(e => !e.planted).map(e => e.whole), call.entries.filter(e => e.planted).length]), [[[true, false], 12], [[true, false, false], 12], [[true, false], 12]], 'under the rules that show the outline a call holds a paragraph and its sentences, next to three planted paragraphs');
  assert.deepEqual(outline[0].entries.flatMap(e => e.items).filter(i => i.expect).map(i => `${i.seed}=${i.expect}`).sort(), ['claim-scope:fail:1=fail', 'claim-scope:pass:1=pass', 'entry-delivered:fail:1=fail', 'entry-delivered:pass:1=pass']);
  assert.deepEqual(log.find(call => call.family === 'term-attested').entries.filter(e => !e.planted).length, 3, 'units judged without their paragraph are put together');
  assert.deepEqual(log.find(call => call.family === 'defined-before-use').entries.map(e => [e.unit, e.items.map(i => i.expect).sort()]), [['document', ['fail', null, 'pass']]], 'the planted declarations join the notation of the document');
  assert.deepEqual(sound.runs.map(r => r.calls.flatMap(c => c.planted).filter(p => p.met).length), [37]);
  assert.deepEqual([sound.result.state.complete, waiting(sound.result.state), sound.result.state.independent.rest], [true, 0, 23]);
  assert.ok(backed(sound.result.state).every(c => c.v === 'pass' && c.by.runs.length === JUDGES && new Set(c.by.runs.map(r => r[0])).size === JUDGES), 'a pass rests on the run of one judge');
  assert.match(report('demo', sound.result), /Outline: 1 central claim, 1 Section and 3 paragraph entries \(OUTLINE\.json\)\.\nIndependent verdicts: writer claude\. 23 verdicts rest on the runs of the judges recorded on this computer\.[^\n]*\n- run [0-9a-f]{12} \(codex, provider default model\): 11 calls, 37 of 37 planted texts answered as registered, 23 verdicts rest on it\n[\s\S]*Status: verification complete: no failure, nothing unjudged, nothing awaiting the independent verdict\./);
  assert.match(summary(sound), /Run [0-9a-f]{12} of the judges \(codex, provider default model; writer claude\): 11 calls with 19 units of the manuscript\. Planted texts answered as registered: 37 of 37 \(.*term-attested 4\/4.*\)\. \d+ s of call time, input_tokens 1100, output_tokens 110\./);
  assert.equal((await judge(a.root, 'demo', 'paper', { ...check, runner: () => assert.fail('nothing is left to ask') })).runs.length, 0, 'the declared writer is kept, and a verified text costs no call');
  // The catch list of this judge lacks one seeded defect: the coined label used once.
  const b = make(t);
  const lapse = await judge(b.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => i.seed === 'term-attested:fail:1' ? 'pass' : undefined) });
  assert.ok(lapse.runs.length === 2 && lapse.runs.every(r => r.calls.find(c => c.family === 'term-attested').planted.filter(p => !p.met).map(p => p.id).join() === 'term-attested:fail:1'));
  assert.deepEqual([verdicts(lapse.result.state, 'term-attested').filter(v => v === 'pending').length, lapse.result.state.complete], [3, false]);
  assert.ok(Object.values(lapse.result.state.units).every(u => !u.checks['term-attested']?.by), 'no verdict on the rule whose seeded defect the judge missed');
  assert.deepEqual(['number-bound', 'aside-punctuation', 'scope-stated', 'in-place'].map(rule => verdicts(lapse.result.state, rule).every(v => v === 'pass')), [true, true, true, true], 'the other rules, tested by their own planted texts, are judged');
  assert.match(report('demo', lapse.result), /- run [0-9a-f]{12} \(codex, provider default model\): 11 calls, 36 of 37 planted texts answered as registered \(missed: term-attested:fail:1\), 20 verdicts rest on it; below 9 in 10 and not used for: term-attested/);
  assert.match(summary(lapse), /Missed: term-attested:fail:1 in call 10\. The answers of those calls on those rules are not used\. Below 9 in 10, so none of this run's answers is used for: term-attested\./);
  // A judge that fails a text registered as passing is as unfit for that rule as one that misses a defect.
  const c = make(t);
  const strict = await judge(c.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => i.seed === 'in-place:pass:1' ? 'fail' : undefined) });
  assert.deepEqual([verdicts(strict.result.state, 'in-place'), verdicts(strict.result.state, 'scope-stated')], [new Array(4).fill('pending'), new Array(4).fill('pass')], 'the two rules of one call are tested separately');
  assert.equal(strict.result.state.complete, false);
});

test('a run counts for a rule when the judge answered nine in ten of its planted texts as registered; below that all its answers on the rule are dropped, above it only the calls with a miss', async t => {
  const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'omega'], tex = names.map(n => `This is the ${n}.`).join('\n\n') + '\n';
  const missing = bad => answerer((call, e, i) => i.seed === 'scope-stated:fail:1' && call.entries.some(x => !x.planted && bad.some(n => x.text.includes(n))) ? 'pass' : undefined);
  const scope = state => Object.values(state.units).filter(u => u.checks['scope-stated']).map(u => u.checks['scope-stated'].v);
  // One call in twelve misses the seeded defect: 23 of the 24 planted texts of the rule are right.
  const a = make(t, { 'paper/main.tex': tex, 'paper/LEXICON.json': {}, 'paper/FACTS.json': {} });
  const one = await judge(a.root, 'demo', 'paper', { writer: 'claude', ...check, batch: 1, families: ['content'], runner: missing(['gamma']) });
  assert.deepEqual(one.runs.map(r => [r.calls.length, r.batch, r.calls.flatMap(c => c.planted).filter(p => p.rule === 'scope-stated' && p.met).length]), [[12, 1, 23], [1, 1, 1]], 'the call with the miss is asked once more in the same invocation');
  assert.deepEqual([scope(one.result.state).filter(v => v === 'pass').length, scope(one.result.state).filter(v => v === 'pending').length, verdicts(one.result.state, 'in-place').every(v => v === 'pass')], [11, 1, true], 'only the call with the miss is dropped, and it is asked again');
  assert.deepEqual(one.result.state.independent.runs.map(r => r.unfit), [[], ['scope-stated']]);
  // Three calls in twelve: 21 of 24, below nine in ten.
  const b = make(t, { 'paper/main.tex': tex, 'paper/LEXICON.json': {}, 'paper/FACTS.json': {} });
  const three = await judge(b.root, 'demo', 'paper', { writer: 'claude', ...check, batch: 1, families: ['content'], runner: missing(['gamma', 'delta', 'omega']) });
  assert.deepEqual([scope(three.result.state), verdicts(three.result.state, 'in-place').every(v => v === 'pass')], [new Array(12).fill('pending'), true], 'not one answer of such a run counts for the rule, the calls that caught the defect included');
  assert.match(report('demo', three.result), /21 of 24|45 of 48/); assert.match(report('demo', three.result), /below 9 in 10 and not used for: scope-stated/);
  // Units judged without their paragraph (here a word pair that occurs once in each sentence) fill a call up to the set number.
  const log = [], c = make(t, { 'paper/main.tex': names.map(n => `This holds for the ${n} term.`).join('\n\n') + '\n', 'paper/LEXICON.json': {}, 'paper/FACTS.json': {} });
  await judge(c.root, 'demo', 'paper', { writer: 'claude', ...check, batch: 5, families: ['term-attested'], runner: answerer(undefined, log) });
  assert.deepEqual(log.slice(0, 3).map(call => call.entries.filter(e => !e.planted).length), [5, 5, 2]);
  const places = log.slice(0, 3).map(call => call.entries.map((e, k) => e.planted ? k : -1).filter(k => k >= 0).join());
  assert.ok(new Set(places).size > 1, `the planted paragraphs do not stand at one place in every call: ${places.join(' | ')}`);
});

test('a verdict file is accepted only with the run metadata of the CLI: a hand-written or changed VERIFY.json, a missing or altered run record and a judge of the writer\'s vendor count for nothing', async t => {
  const { root, project } = make(t), file = path.join(project, 'paper/VERIFY.json'), stop = () => hook(root, { hook_event_name: 'Stop', session_id: 's' });
  const done = await settle(root, check);
  assert.equal(done.result.state.complete, true); assert.equal(standing(project, 'paper').verified, true);
  const good = fs.readFileSync(file, 'utf8');
  // (a) A failure turned into a pass by hand, with the completion flag set.
  edit(project, 'The quiver has two nodes.', 'The quiver has two nodes, as in section~\\ref{x}.');
  const failing = verify(project, 'paper', check);
  assert.deepEqual(failing.open.map(f => f.rule), ['reference-capital']);
  const forged = fs.readFileSync(file, 'utf8').replace('"complete": false', '"complete": true').replace(/"reference-capital":\{"v":"fail","e":\[[^\]]*\]/, '"reference-capital":{"v":"pass"').replace(/"id": "reference-capital",\n(\s+)"kind": "reference-capital",\n\s+"pass": (\d+),\n\s+"fail": 1/, '"id": "reference-capital",\n$1"kind": "reference-capital",\n$1"pass": 5,\n$1"fail": 0');
  assert.equal(JSON.parse(forged).complete, true); assert.equal(JSON.parse(forged).rules.find(r => r.id === 'reference-capital').fail, 0);
  fs.writeFileSync(file, forged);
  assert.deepEqual([standing(project, 'paper').verified, /run metadata of this computer's CLI/.test(standing(project, 'paper').error)], [false, true]);
  put(root, '.harness-local/verify-sessions/s/demo--paper.touched');
  assert.match(stop().reason, /projects\/demo\/paper was changed in this session and is not verified \(VERIFY\.json does not carry the run metadata/, 'the gate holds the session that would end on the forged file');
  const again = verify(project, 'paper', check);
  assert.deepEqual(again.open.map(f => f.rule), ['reference-capital'], 'the next verification restores the verdict');
  assert.equal(again.state.run.judged, again.state.run.total, 'and judges every unit again, trusting nothing of the file');
  assert.equal(verify(project, 'paper', check).state.run.judged, 0, 'while the file the CLI wrote is reused');
  edit(project, ', as in section~\\ref{x}.', '.');
  assert.equal(verify(project, 'paper', check).state.complete, true, 'the original text finds its recorded verdicts again');
  // (b) The complete verdict file of this manuscript, copied to a place where no judge ran.
  const twin = make(t);
  fs.writeFileSync(path.join(twin.project, 'paper/VERIFY.json'), good);
  assert.equal(standing(twin.project, 'paper').verified, false);
  const bare = verify(twin.project, 'paper', check);
  assert.deepEqual([bare.state.complete, backed(bare.state).length, waiting(bare.state)], [false, 0, 23], 'verdicts typed into the file are dropped: no run record holds them');
  // ... and with a judge of the writer's vendor: the copied run records name codex as the judge.
  fs.cpSync(ledger(project, 'paper'), ledger(twin.project, 'paper'), { recursive: true });
  assert.equal(verify(twin.project, 'paper', { ...check, writer: 'claude' }).state.complete, true, 'the run records carry the verdicts');
  assert.deepEqual([verify(twin.project, 'paper', { ...check, writer: 'codex' }).state.complete, backed(stored(twin.project)).length], [false, 0], 'text written by codex is not judged by codex');
  // (c) A run record altered, removed or unreadable. What counts is computed from its calls, not from a summary in it.
  const runs = fs.readdirSync(ledger(project, 'paper')).filter(n => /^[0-9a-f]{12}$/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(ledger(project, 'paper'), n, 'run.json'), 'utf8'))).sort((x, y) => x.started < y.started ? -1 : 1);
  const record = n => path.join(ledger(project, 'paper'), runs[n].id, 'run.json'), kept = fs.readFileSync(record(0), 'utf8');
  assert.deepEqual(runs.map(r => r.calls.length), [11]);
  fs.writeFileSync(record(0), kept.replace('"state": "done"', '"state": "valid"').replace('"id": "number-bound:fail:1",\n          "rule": "number-bound",\n          "want": "fail",\n          "met": true', '"id": "number-bound:fail:1",\n          "rule": "number-bound",\n          "want": "fail",\n          "met": false'));
  let r = verify(project, 'paper', check);
  assert.deepEqual([r.state.complete, verdicts(r.state, 'number-bound').filter(v => v === 'pending').length, verdicts(r.state, 'scope-stated').every(v => v === 'pass')], [false, 2, true], 'a call that did not catch its seeded defect gives no vote on that rule, whatever else the record says');
  fs.writeFileSync(record(0), kept.replace(/"want": "fail"/g, '"want": "pass"'));
  assert.equal(verify(project, 'paper', check).state.complete, false, 'a call without a seeded defect of the rule is not a tested call');
  fs.writeFileSync(record(0), '{ not json');
  r = verify(project, 'paper', check);
  assert.deepEqual([r.state.complete, backed(r.state).length, r.state.independent.runs.length], [false, 0, 0], 'an unreadable record supplies nothing');
  fs.writeFileSync(record(0), kept); assert.equal(verify(project, 'paper', check).state.complete, true);
  fs.rmSync(path.dirname(record(0)), { recursive: true });
  r = verify(project, 'paper', check);
  assert.deepEqual([r.state.complete, backed(r.state).length, r.state.independent.runs.length], [false, 0, 0]);
  // The hook reports, and never throws, whatever the local records hold.
  fs.writeFileSync(path.join(ledger(project, 'paper'), 'seal.json'), '{ not json');
  put(root, '.harness-local/verify-sessions/s/demo--paper.touched');
  assert.equal(stop().decision, 'block');
});

test('the schema of a call requires every question of every unit, and an answer is read question by question: one that is missing, or quotes nothing, loses that unit\'s verdict on that rule only', async t => {
  const { root, project, at } = make(t), log = [];
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => e.planted ? undefined : e.unit === at('flow') && i.id === 'scope-stated' ? { verdict: 'pass', reason: 'Fine.', evidence: 'words that are not in the text' } : e.unit === at('susy') && i.id === 'in-place' ? false : undefined, log) });
  const v = (label, rule) => out.result.state.units[at(label)].checks[rule].v;
  assert.deepEqual([v('flow', 'scope-stated'), v('flow', 'in-place'), v('susy', 'in-place'), v('susy', 'scope-stated'), v('use', 'scope-stated'), v('use', 'in-place'), out.result.state.complete], ['pending', 'pass', 'pending', 'pass', 'pass', 'pass', false], 'a rule cannot be skipped, and the other answers of the call stand');
  assert.deepEqual(out.runs[0].calls.filter(c => c.family === 'content').flatMap(c => c.refused.map(x => x.why)).sort(), ['no verdict', 'the evidence is not a quotation of the material shown']);
  const dir = path.join(ledger(project, 'paper'), out.runs[0].id, '0007'), schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8')), text = fs.readFileSync(path.join(dir, 'prompt.txt'), 'utf8');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['prompt.txt', 'response.json', 'schema.json', 'stdout.jsonl']);
  assert.deepEqual([schema.required.length, schema.additionalProperties, new Set(schema.required.map(k => k.replace(/^u\d+-/, ''))), schema.properties[schema.required[0]].required, schema.properties[schema.required[0]].properties.verdict.enum],
    [16, false, new Set(['scope-stated', 'in-place']), ['verdict', 'reason', 'evidence'], ['pass', 'fail']]);
  for (const part of ['Headings above it: Two nodes', 'Unit U', 'Both of the two nodes are asymptotically free: the couplings grow.\\label{use}\n>>>', 'Headings above it: Conformal window of SQCD', 'The answer to question X about unit U7 has the key u7-X.', '- scope-stated: Does the sentence state its claim', '- in-place: Does the sentence belong']) assert.ok(text.includes(part), part);
  assert.ok(!/seed|plant/i.test(text), 'nothing in a call names a planted text');
  // The reading of an answer and the form of a call, on a call written out here.
  const item = (u, show, extra = {}) => ({ key: `u${u}-${show}`, show, q: `Question ${show}?`, ...extra });
  const call = { blocks: [{ headings: ['Two nodes'], context: 'Both nodes are free. The flow ends there.', entries: [{ label: 'U1', text: 'Both nodes are free.', items: [item(1, 'scope-stated'), item(1, 'in-place')] }, { label: 'U2', text: 'The flow ends there.', items: [item(2, 'scope-stated'), item(2, 'in-place')] }] }] };
  const ok = { verdict: 'pass', reason: 'Stated.', evidence: 'Both nodes   are free' }, all = change => ({ 'u1-scope-stated': ok, 'u1-in-place': ok, 'u2-scope-stated': ok, 'u2-in-place': ok, ...change });
  assert.deepEqual(reading(call, all({})), { ok: Object.fromEntries(shape(call).required.map(k => [k, { v: 'pass', reason: 'Stated.', evidence: 'Both nodes   are free' }])), refused: {} }, 'a quotation is compared without regard to spacing');
  assert.deepEqual(reading(call, all({ 'u1-in-place': { ...ok, evidence: 'Headings above it: Two nodes' } })).refused, {}, 'any passage of the material shown is a quotation (the first live run refused this one)');
  assert.deepEqual(reading(call, all({ 'u1-in-place': undefined, 'u2-in-place': { ...ok, verdict: 'unsure' }, 'u2-scope-stated': { ...ok, reason: ' ' }, 'u1-scope-stated': { ...ok, evidence: 'copied character for character' } })).refused,
    { 'u1-scope-stated': 'the evidence is not a quotation of the material shown', 'u1-in-place': 'no verdict', 'u2-scope-stated': 'no reason', 'u2-in-place': 'no verdict' }, 'the instruction on how to answer is not material');
  assert.throws(() => reading(call, null), /Answer refused: no structured answer/);
  assert.match(prompt(call), /^You are an independent judge[\s\S]*Block 1\nHeadings above it: Two nodes\nUnit U1:\n<<<\nBoth nodes are free\.\n>>>\nUnit U2:[\s\S]*Answer every key with verdict/, 'a paragraph whose sentences are all units is not printed twice');
  assert.match(prompt({ blocks: [{ ...call.blocks[0], entries: call.blocks[0].entries.slice(1) }] }), /Block 1\nHeadings above it: Two nodes\nParagraph:\n<<<\nBoth nodes are free\. The flow ends there\.\n>>>\nUnit U2:/, 'and is printed when only some of them are');
  const narrow = invocation('codex', dir, 'm', { narrow: true }), claude = invocation('claude', dir, null, { narrow: true, schema });
  assert.ok(['--skip-git-repo-check', '--ephemeral', 'read-only'].every(arg => narrow.args.includes(arg)));
  assert.deepEqual([claude.args[claude.args.indexOf('--tools') + 1], JSON.parse(claude.args[claude.args.indexOf('--json-schema') + 1])], ['', schema], 'a call has no tools and carries its schema');
});

test('the grounds left to a reader are judged, by one judge unless the manuscript asks for more; judges are told apart by model, and a failing run of any of them fails the unit', async t => {
  const { root, project, at } = make(t);
  const kinds = verify(project, 'paper', check).questions.filter(q => !q.family.startsWith('outline')).map(q => [q.family, q.unit === 'document' ? 'document' : Object.entries({ count: at('count'), use: at('use'), flow: at('flow'), susy: at('susy') }).find(([, id]) => id === q.unit)[0], q.items.map(i => i.tag)]).filter(k => k[0] !== 'content');
  assert.deepEqual(kinds, [['number-bound', 'count', ['two']], ['aside-punctuation', 'use', [' nodes are asymptotically free: the couplings grow']], ['term-attested', 'use', ['"couplings grow"']], ['number-bound', 'use', ['two']],
    ['term-attested', 'flow', ['"flow reaches"']], ['term-attested', 'susy', ['"counts supersymmetries"']], ['defined-before-use', 'document', ['\\mathcal{N}']]]);
  // One judge, who fails the colon, the declaration of ordinary wording and the standard notation.
  const fails = (e, i) => (e.unit === at('use') && i.rule === 'aside-punctuation') || (e.unit === at('flow') && i.rule === 'term-attested') || (e.unit === 'document' && i.tag === '\\mathcal{N}');
  const one = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => !i.expect && fails(e, i) ? 'fail' : undefined) });
  assert.deepEqual(one.runs.map(r => r.calls.map(c => c.family)), [RULES]);
  const v = (id, rule) => one.result.state.units[id].checks[rule];
  assert.deepEqual([v(at('use'), 'aside-punctuation').v, v(at('flow'), 'term-attested').v, v('document', 'defined-before-use').v, v(at('use'), 'number-bound').v, v(at('count'), 'number-bound').v, v(at('use'), 'term-attested').v, v(at('susy'), 'term-attested').v],
    ['fail', 'fail', 'fail', 'pass', 'pass', 'pass', 'pass']);
  assert.match(v(at('use'), 'aside-punctuation').e[0], /^ nodes are asymptotically free: the couplings grow: judge codex, provider default model \(run [0-9a-f]{12}\) fails it: Fixture judge\. Evidence: "Both of the"$/);
  assert.match(v(at('flow'), 'term-attested').e[0], /^"flow reaches": judge codex/);
  assert.match(v('document', 'defined-before-use').e[0], /^\\mathcal\{N\}: judge codex/);
  assert.deepEqual([one.result.open.map(f => f.rule).sort(), waiting(one.result.state), one.result.state.complete], [['aside-punctuation', 'defined-before-use', 'term-attested'], 0, false]);
  assert.match(report('demo', one.result), /A pass needs one judge, and one failing judge fails the unit\.[\s\S]*Status: INCOMPLETE, 3 failing and 0 not judged\.\n- \[aside-punctuation\]/);
  assert.equal((await judge(root, 'demo', 'paper', { ...check, runner: () => assert.fail('a failed unit is changed, not asked again') })).runs.length, 0);
  // A manuscript that asks for two judges: two runs of one model are one judge.
  const two = make(t, { 'paper/RULES.json': { version: 1, judges: 2, rules: [] } }), log = [];
  const same = await judge(two.root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  assert.deepEqual([same.runs.length, same.result.state.complete, waiting(same.result.state), backed(same.result.state).every(c => c.v === 'pending' && c.by.runs.length === 1)], [1, false, 23, true], 'the model that has passed a question is not asked it again');
  assert.equal((await judge(two.root, 'demo', 'paper', { ...check, runner: () => assert.fail('the same model has nothing to add') })).runs.length, 0);
  assert.match(report('demo', same.result), /A pass needs 2 judges of different models \(named with --model\), and one failing judge fails the unit\./);
  // A second model passes all but the colon.
  const other = await judge(two.root, 'demo', 'paper', { ...check, models: ['model-b'], runner: answerer((call, e, i) => e.unit === two.at('use') && i.rule === 'aside-punctuation' ? 'fail' : undefined) });
  const w = (label, rule) => other.result.state.units[two.at(label)].checks[rule];
  assert.deepEqual([other.runs.map(r => [r.requestedModel, r.calls.length]), w('use', 'aside-punctuation').v, w('use', 'aside-punctuation').by.runs.map(r => r[2]), w('use', 'number-bound').v, w('use', 'number-bound').by.runs.length, other.result.open.map(f => f.rule)],
    [[['model-b', 11]], 'fail', ['pass', 'fail'], 'pass', 2, ['aside-punctuation']], 'the judges disagree on the colon: the unit fails');
  assert.match(w('use', 'aside-punctuation').e[0], /judge codex, model model-b \(run [0-9a-f]{12}\) fails it/);
  put(two.project, 'paper/RULES.json', { version: 1, judges: 0, rules: [] });
  assert.throws(() => verify(two.project, 'paper', check), /"judges" must be a whole number of judges, at least 1/);
});

test('the search for a better sentence gives advice on request and no verdict: a verification neither asks nor waits for it', async t => {
  const { root, project, at } = make(t), log = [];
  const done = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  assert.deepEqual([done.result.state.complete, done.runs.length, log.some(call => call.family === 'better-sentence'), done.result.state.rules.some(r => r.id === 'better-sentence'), Object.values(done.result.state.units).some(u => 'better-sentence' in u.checks), done.result.advice.length],
    [true, 1, false, false, false, 4], 'the search is no rule of the table, no check of a unit and no call of a verification');
  assert.match(report('demo', done.result), /whether a sentence could be better \(the search for a better sentence gives advice on request, `paper-judge --advice`, and no verdict\)/);
  const before = stored(project).units;
  const offers = { count: { sentence: 'The quiver has 2 nodes.', criterion: 7, reason: 'Two characters fewer.' }, flow: { sentence: 'The flow ends there.', criterion: 7, reason: 'Four words for six.' }, susy: { sentence: '$\\mathcal{N}$ counts supersymmetries.', criterion: 5, reason: 'The verb is enough.' } };
  const offering = (call, e, i) => { const o = !e.planted && Object.entries(offers).find(([label]) => e.unit === at(label)); return o ? { verdict: 'fail', evidence: e.text.slice(0, 10), ...o[1] } : undefined; };
  log.length = 0;
  const out = await judge(root, 'demo', 'paper', { ...check, advice: true, runner: answerer(offering, log) });
  assert.deepEqual([out.runs.map(r => [r.advice, r.calls.map(c => c.family)]), log.map(call => call.entries.filter(e => !e.planted).length)], [[[true, new Array(3).fill('better-sentence')]], [1, 2, 1]], 'one run, a call for each paragraph');
  assert.deepEqual(out.advice.map(a => [a.where, a.criterion, a.sentence]), [['§1 ¶2 s2', 7, 'The flow ends there.'], ['§1 ¶3 s1', 5, '$\\mathcal{N}$ counts supersymmetries.']], 'a gain named under criteria 1 to 6, or a fifth fewer words; writing "two" as "2" is neither');
  const noted = out.runs[0].calls[0].answers.find(a => a.unit === at('count')).items['better-sentence'];
  assert.deepEqual([noted.v, noted.sentence, noted.note], ['pass', 'The quiver has 2 nodes.', 'a shorter sentence was offered, 5 words for 5: less than a fifth saved, not counted']);
  assert.deepEqual([stored(project).units, out.result.state.complete, out.result.state.independent.runs.length], [before, true, 1], 'advice changes no verdict, and its run is not among the runs of the judges');
  assert.match(summary(out), /Run [0-9a-f]{12} of the judges, for advice and no verdict \([^\n]*\nAdvice, no part of the verification: 2 better sentences were written under the ranked criteria\.[^\n]*\n- §1 ¶2 s2 paper\/main\.tex:4 unit [0-9a-f]{12}, criterion 7 \(the shorter text\): The flow ends there\. Reason: Four words for six\.\n- §1 ¶3 s1 [^\n]*criterion 5 \(no redundancy\): \$\\mathcal\{N\}\$ counts supersymmetries\. Reason: The verb is enough\.\n/);
  const text = fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, '0001', 'prompt.txt'), 'utf8');
  assert.match(text, /1\. physical and mathematical correctness\n2\. the user's decisions\n[\s\S]*7\. the shorter text\n8\. on a tie, the existing sentence stays\n[^\n]*a replacement that is only shorter counts only when it has at least a fifth fewer words/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ledger(project, 'paper'), out.runs[0].id, '0001', 'schema.json'), 'utf8')).properties['u1-better-sentence'].required, ['verdict', 'reason', 'evidence', 'sentence', 'criterion']);
  // A call in which the judge left the planted wordy sentence as it is gives no advice.
  const lazy = await judge(root, 'demo', 'paper', { ...check, advice: true, runner: answerer((call, e, i) => i.seed && call.entries.some(x => x.unit === at('flow')) ? 'pass' : offering(call, e, i)) });
  assert.deepEqual(lazy.advice.map(a => a.where), ['§1 ¶3 s1']); assert.match(summary(lazy), /Missed: better-sentence:fail:1 in call 2\./);
  // A sentence with a verdict that has not passed is not asked: here the edited one, and the one whose number it states.
  edit(project, 'The quiver has two nodes.', 'The quiver has two nodes, as in section~\\ref{x}.');
  log.length = 0;
  await judge(root, 'demo', 'paper', { ...check, advice: true, runner: answerer(undefined, log) });
  assert.deepEqual([...new Set(log.flatMap(call => call.entries.filter(e => !e.planted).map(e => e.unit)))].sort(), [at('flow'), at('susy')].sort());
  // In reading: criteria 1 to 6 count as named, criterion 7 from a fifth of the words, and a fail needs a different sentence.
  const call = { blocks: [{ headings: [], context: '', entries: [{ label: 'U1', text: 'It is the case that the coupling is marginal here.', items: [{ key: 'u1-better-sentence', show: 'better-sentence', q: 'Better?', better: true }] }] }] };
  const read = extra => reading(call, { 'u1-better-sentence': { verdict: 'fail', reason: 'Shorter.', evidence: 'the coupling is marginal', sentence: 'The coupling is marginal here.', criterion: 7, ...extra } });
  assert.deepEqual(read().ok['u1-better-sentence'], { v: 'fail', reason: 'Shorter.', evidence: 'the coupling is marginal', sentence: 'The coupling is marginal here.', criterion: 7 }, 'five words for ten');
  assert.equal(read({ sentence: 'It is so that the coupling is marginal here.' }).ok['u1-better-sentence'].v, 'pass', 'nine words for ten');
  assert.equal(read({ sentence: 'It is so that the coupling is marginal here.', criterion: 5 }).ok['u1-better-sentence'].v, 'fail', 'a gain under a higher criterion counts as named');
  assert.deepEqual([read({ sentence: '' }).refused, read({ sentence: call.blocks[0].entries[0].text }).refused, read({ criterion: 0 }).refused], [{ 'u1-better-sentence': 'the unit is failed without a different sentence' }, { 'u1-better-sentence': 'the unit is failed without a different sentence' }, { 'u1-better-sentence': 'no ranked criterion is named' }]);
});

test('a defect the user found is planted in every call of its family from then on, and an edit asks the sentences of its paragraph again and no others', async t => {
  const found = { id: 'case-three-misplaced', kind: 'judge', question: 'Does the sentence speak of case (3) inside the discussion of another case? Fail if it does.', source: 'user, 2026-11-25: the sentence on case (3) stands at the end of the Section on case (5)',
    fail: [{ tex: '\\section{Case (5)}\n\nIn case (5) both nodes are free. In case (3) the second node is free.', at: 'In case (3)' }], pass: [{ tex: '\\section{Case (5)}\n\nIn case (5) both nodes are free. In case (3) the second node is free.', at: 'In case (5)' }] };
  const { root, project, at } = make(t, { 'paper/RULES.json': { version: 1, rules: [found] } }), log = [];
  const blind = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, e, i) => i.seed === 'case-three-misplaced:fail:1' ? 'pass' : undefined) });
  assert.deepEqual([verdicts(blind.result.state, 'case-three-misplaced'), verdicts(blind.result.state, 'scope-stated'), blind.result.state.complete], [new Array(4).fill('pending'), new Array(4).fill('pass'), false], 'a judge that does not see the user\'s defect gives no verdict on the user\'s rule');
  const first = await judge(root, 'demo', 'paper', { ...check, runner: answerer(undefined, log) });
  assert.equal(first.result.state.complete, true);
  edit(project, 'There the flow reaches the endpoint.', 'There the flow reaches its endpoint.');
  log.length = 0;
  const later = await judge(root, 'demo', 'paper', { ...check, runner: answerer(undefined, log) });
  const content = log.filter(call => call.family === 'content');
  assert.ok(content.length === 1 && content.every(call => call.entries.some(e => e.planted && e.text.startsWith('In case (3)') && e.items.some(i => i.seed === 'case-three-misplaced:fail:1' && i.expect === 'fail'))), 'the failing text is put to the judge as a unit among those of the manuscript');
  assert.deepEqual(later.runs.map(r => r.calls.map(c => [c.family, c.units])), [[['outline', 3], ['content', 2], ['term-attested', 1]]], 'the paragraph with its two sentences under the rules that show the outline; the questions about the other sentence alone (its number, its colon, its word pair) and the question about the heading keep their verdicts');
  assert.deepEqual([...new Set(log.flatMap(call => call.entries.filter(e => !e.planted).map(e => e.unit)))].sort(), [at('use'), at('flow'), load(project, 'paper/main.tex').units.find(u => u.kind === 'paragraph' && u.text.includes('There the flow')).id].sort());
  for (const id of [at('count'), at('susy')]) assert.deepEqual(later.result.state.units[id], first.result.state.units[id], 'the verdicts of the other units are kept with the runs they rest on');
  assert.deepEqual(later.result.state.units.document.checks['defined-before-use'], first.result.state.units.document.checks['defined-before-use']);
  assert.equal(later.result.state.complete, true);
  const register = rule => put(project, 'paper/RULES.json', { version: 1, rules: [rule] });
  register({ ...found, question: '' }); assert.throws(() => rules(project), /case-three-misplaced refused: a rule judged by a reader needs its question/);
  register({ ...found, pass: ['In case (5) both nodes are free.'] }); assert.throws(() => rules(project), /must open with its own \\section heading/);
  register({ ...found, fail: [{ ...found.fail[0], at: 'In case' }] }); assert.throws(() => rules(project), /no single sentence containing "In case"/);
  register({ ...found, family: 'term-attested' }); assert.throws(() => rules(project), /its family term-attested is the id of a rule/);
  const shorter = { id: 'shorter', kind: 'better', source: 'fixture', fail: found.fail };
  register(shorter); assert.equal(rules(project).at(-1).id, 'shorter');
  register({ ...shorter, pass: found.pass }); assert.throws(() => rules(project), /takes no passing text: no text is beyond improvement by registration/);
});

test('paper-judge needs the writer, plans without a call or an enrollment, and refuses a nested or concurrent run', async t => {
  const { root, project } = make(t), saved = process.exitCode, file = path.join(project, 'paper/VERIFY.json');
  try {
    await assert.rejects(main(['paper-judge', 'demo', '--no-build'], root), /--writer claude or --writer codex/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer', 'gemini'], root), /--writer claude or --writer codex/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer', 'claude', '--batch', '0'], root), /--batch needs a positive integer/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer'], root), /Expected --writer/);
    await assert.rejects(main(['paper-judge', '../demo', '--writer', 'claude'], root), /Invalid project slug/);
    const plan = async (...more) => JSON.parse(/Plan \(no model was called\): (\{.*\})/.exec(await main(['paper-judge', 'demo', 'paper', '--writer', 'claude', '--no-build', '--dry-run', ...more], root))[1]);
    assert.deepEqual((await plan()).families, { 'outline-contract': 1, outline: 5, 'number-bound': 1, content: 2, 'term-attested': 1 }, 'without a corpus two sentences cannot be judged by code, and what code has to settle first is not put to a judge: the heading, the three paragraphs and the two other sentences are');
    assert.deepEqual((await plan('--all-units', '--batch', '2')).families, { 'outline-contract': 1, outline: 7, 'number-bound': 2, content: 4, 'aside-punctuation': 1, 'term-attested': 1 }, 'for a trial every unit can be asked');
    assert.deepEqual([(await plan('--advice', '--all-units')).families, (await plan('--advice', '--all-units')).calls, /No sentence has passed every verdict yet/.test(await main(['paper-judge', 'demo', '--writer', 'claude', '--no-build', '--dry-run', '--advice'], root))], [{ 'better-sentence': 4 }, 3, true], 'advice is asked for sentences that have passed, or in a trial for all');
    assert.match((await plan('--batch', '2')).note, /one for every 2 units that are judged without their paragraph/); assert.match((await plan()).note, new RegExp(`one for every ${BATCH} units`));
    assert.deepEqual([(await plan()).calls, (await plan('--all-units', '--batch', '1')).calls], [8, 11], 'the heading, the three paragraphs against the outline, count and flow each in its paragraph and with its own open question; then every paragraph twice and the open questions one by one');
    assert.equal(process.exitCode, 1); assert.ok(!fs.existsSync(file), 'a plan enrolls nothing');
  } finally { process.exitCode = saved; }
  const old = process.env.HEP_REVIEW_CHILD; process.env.HEP_REVIEW_CHILD = '1';
  try { await assert.rejects(judge(root, 'demo', 'paper', { writer: 'claude', ...check }), /Nested/); }
  finally { if (old === undefined) delete process.env.HEP_REVIEW_CHILD; else process.env.HEP_REVIEW_CHILD = old; }
  const during = await judge(root, 'demo', 'paper', { writer: 'codex', ...check, limit: 2, families: ['content'], runner: async (command, args, options) => {
    await assert.rejects(judge(root, 'demo', 'paper', { writer: 'codex', ...check }), /Another run of the judges holds/);
    return answerer()(command, args, options);
  } });
  assert.deepEqual(during.runs.map(r => [r.provider, r.state, r.models, r.calls.map(c => c.units)]), new Array(JUDGES).fill(['claude', 'done', ['fixture-model'], [1, 1]]), 'text written by codex is judged by claude; a limit bounds the questions asked');
  assert.ok(!fs.existsSync(path.join(ledger(project, 'paper'), 'active.lock')));
  assert.match(summary(during), /\(claude, provider default model \(reported: fixture-model\); writer codex\)/);
});
