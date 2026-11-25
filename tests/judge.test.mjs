// Stage 3 of harness/design/paper-verification.md: independent verdicts with seeded defects. Every judge here is
// injected (tests/judges.mjs); no test calls a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from '../harness/tex.mjs';
import { verify, report, standing, rules, ledger, JUDGES } from '../harness/verify.mjs';
import { judge, summary, prompt, shape, reading } from '../harness/judge.mjs';
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
function make(t, extra = {}) {
  const root = temp(t), project = path.join(root, 'projects', 'demo');
  for (const [name, content] of Object.entries({ 'paper/main.tex': TEX, 'paper/LEXICON.json': LEXICON, 'paper/FACTS.json': FACTS, ...extra })) put(project, name, content);
  return { root, project, at: label => load(project, 'paper/main.tex').labels[label] };
}
const stored = project => JSON.parse(fs.readFileSync(path.join(project, 'paper/VERIFY.json'), 'utf8'));
const backed = state => Object.values(state.units).flatMap(u => Object.values(u.checks)).filter(c => c.by);
const waiting = state => state.rules.reduce((n, r) => n + r.pending, 0);
const FAMILIES = ['aside-punctuation', 'better-sentence', 'content', 'defined-before-use', 'number-bound', 'term-attested'];

test('a run in which the judge misses one seeded defect, or fails one passing text, is void and records no verdict', async t => {
  const { root, project } = make(t), log = [];
  const first = verify(project, 'paper', check);
  assert.equal(first.state.complete, false, 'what awaits the independent verdict leaves the verification incomplete');
  assert.deepEqual([first.open.length, waiting(first.state), first.questions.length], [0, 19, 15]);
  assert.deepEqual([...new Set(first.questions.map(q => q.family))].sort(), FAMILIES);
  assert.match(report('demo', first), /Independent verdicts: none recorded on this computer\.[\s\S]*Status: INCOMPLETE, 0 failing and 0 not judged\. Awaiting the independent verdict: 19 \(node harness\/cli\.mjs paper-judge demo paper --writer <claude\|codex>\)\./);
  // The catch list of this judge lacks one seeded defect: the coined label used once.
  const lapse = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => call.seed?.includes('term-attested:fail:1') && call.expect[item.id] === 'fail' ? 'pass' : undefined, log) });
  assert.deepEqual(lapse.runs.map(r => [r.state, r.provider, r.seeded, r.caught, r.controls, r.passed]), new Array(JUDGES).fill(['void', 'codex', 8, 7, 7, 7]), 'the judges come from the vendor that did not write the text');
  assert.deepEqual(lapse.runs[0].seeds.filter(s => s.status !== 'met').map(s => [s.id, s.status]), [['term-attested:fail:1', 'missed']]);
  assert.ok(log.every(call => call.seed), 'a void run does not ask the questions of the manuscript');
  assert.equal(log.length, 14 * JUDGES);
  assert.equal(backed(lapse.result.state).length, 0); assert.equal(backed(stored(project)).length, 0); assert.equal(waiting(lapse.result.state), 19);
  assert.deepEqual([lapse.result.state.complete, lapse.result.state.independent.void, lapse.result.state.independent.last_void.missed], [false, JUDGES, ['term-attested:fail:1']]);
  assert.match(summary(lapse), /caught 7 of 8 seeded defects and passed 7 of 7 passing texts\. VOID, none of its answers is used and the manuscript's questions were not asked: term-attested:fail:1 \(call \d+ answered item-1: pass\)/);
  assert.match(report('demo', lapse.result), /Void runs \(a seeded defect missed or a passing text failed; none of their answers is used\): 2\. The latest, run [0-9a-f]{12} \(codex, provider default model\), missed term-attested:fail:1\./);
  // A judge that fails a text registered as passing is as unfit as one that misses a defect.
  const strict = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => call.seed?.includes('in-place:pass:1') && call.expect[item.id] === 'pass' ? 'fail' : undefined) });
  assert.deepEqual(strict.runs.map(r => [r.state, r.caught, r.passed]), new Array(JUDGES).fill(['void', 8, 6])); assert.equal(backed(strict.result.state).length, 0);
  // The same judge with nothing removed from its catch list.
  log.length = 0;
  const sound = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer(undefined, log) });
  assert.deepEqual(sound.runs.map(r => [r.state, r.seeded, r.caught, r.controls, r.passed, r.calls.length, r.unseeded]), new Array(JUDGES).fill(['valid', 8, 8, 7, 7, 29, []]));
  assert.deepEqual([sound.result.state.complete, waiting(sound.result.state), sound.result.state.independent.rest, sound.result.state.independent.void], [true, 0, 19, 2 * JUDGES]);
  assert.ok(backed(sound.result.state).every(c => c.v === 'pass' && c.by.runs.length === JUDGES && new Set(c.by.runs.map(r => r[0])).size === JUDGES), 'a pass rests on two different runs');
  assert.match(report('demo', sound.result), /Independent verdicts: writer claude\. 19 verdicts rest on 2 valid runs of the judges: run [0-9a-f]{12} \(codex, provider default model\) caught 8 of 8 seeded defects and passed 7 of 7 passing texts; run .*Status: verification complete: no failure, nothing unjudged, nothing awaiting the independent verdict\./s);
  assert.equal((await judge(root, 'demo', 'paper', { ...check, runner: () => assert.fail('nothing is left to ask') })).runs.length, 0, 'the recorded writer is kept, and a verified text costs no call');
  assert.match(summary(sound), /VALID: 15 answers on the manuscript recorded\. 29 calls, \d+ s of call time, input_tokens 2900, output_tokens 290\./);
});

test('a verdict file is accepted only with the run metadata of the CLI: a hand-written or changed VERIFY.json, a missing run record and a judge of the writer\'s vendor count for nothing', async t => {
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
  assert.deepEqual([bare.state.complete, backed(bare.state).length, waiting(bare.state)], [false, 0, 19], 'verdicts typed into the file are dropped: no run record holds them');
  // ... and with a judge of the writer's vendor: the copied run records name codex as the judge.
  fs.cpSync(ledger(project, 'paper'), ledger(twin.project, 'paper'), { recursive: true });
  assert.equal(verify(twin.project, 'paper', { ...check, writer: 'claude' }).state.complete, true, 'the run records carry the verdicts');
  assert.deepEqual([verify(twin.project, 'paper', { ...check, writer: 'codex' }).state.complete, backed(stored(twin.project)).length], [false, 0], 'text written by codex is not judged by codex');
  // (c) A run record removed, or no longer the record of a valid run.
  const runs = fs.readdirSync(ledger(project, 'paper')).filter(n => /^[0-9a-f]{12}$/.test(n)), record = n => path.join(ledger(project, 'paper'), runs[n], 'run.json');
  assert.equal(runs.length, JUDGES);
  const kept = fs.readFileSync(record(0), 'utf8');
  fs.writeFileSync(record(0), kept.replace('"state": "valid"', '"state": "running"'));
  let r = verify(project, 'paper', check);
  assert.deepEqual([r.state.complete, waiting(r.state), backed(r.state).every(c => c.v === 'pending' && c.by.runs.length === 1)], [false, 19, true], 'one judge is not two');
  fs.writeFileSync(record(0), kept.replace('"caught": 8', '"caught": 7'));
  assert.equal(verify(project, 'paper', check).state.complete, false, 'a record whose seeded defects were not all caught is not the record of a valid run');
  fs.writeFileSync(record(0), '{ not json'); fs.rmSync(path.dirname(record(1)), { recursive: true });
  r = verify(project, 'paper', check);
  assert.deepEqual([r.state.complete, backed(r.state).length, r.state.independent.runs.length], [false, 0, 0]);
  // The hook reports, and never throws, whatever the local records hold.
  fs.writeFileSync(path.join(ledger(project, 'paper'), 'seal.json'), '{ not json');
  put(root, '.harness-local/verify-sessions/s/demo--paper.touched');
  assert.equal(stop().decision, 'block');
});

test('one unit and one rule family in each call, a schema that requires every question, and no verdict from an answer that skips one or quotes nothing', async t => {
  const { root, project, at } = make(t), log = [];
  const result = verify(project, 'paper', check), q = result.questions.find(x => x.unit === at('use') && x.family === 'content'), b = result.questions.find(x => x.unit === at('use') && x.family === 'better-sentence');
  assert.deepEqual([q.items.map(i => i.id), q.kind, q.headings, q.text.includes('asymptotically free'), q.context.includes('flow reaches')], [['scope-stated', 'in-place'], 'sentence', ['Two nodes'], true, true]);
  const schema = shape(q), text = prompt(q);
  assert.deepEqual([schema.required, schema.additionalProperties, schema.properties['in-place'].required, schema.properties['in-place'].properties.verdict.enum], [['scope-stated', 'in-place'], false, ['verdict', 'reason', 'evidence'], ['pass', 'fail']]);
  assert.deepEqual(shape(b).properties['better-sentence'].required, ['verdict', 'reason', 'evidence', 'sentence', 'criterion']);
  for (const part of ['Both of the two nodes are asymptotically free: the couplings grow.', 'There the flow reaches the endpoint.', 'Headings above it: Two nodes', '- scope-stated: Does the sentence state its claim', '- in-place: Does the sentence belong']) assert.ok(text.includes(part), part);
  assert.ok(!text.includes('counts supersymmetries'), 'no other paragraph of the manuscript enters the call');
  assert.match(prompt(b), /1\. physical and mathematical correctness\n2\. the user's decisions\n[\s\S]*7\. the shorter text\n8\. on a tie, the existing sentence stays/);
  const ok = { verdict: 'pass', reason: 'The range is stated.', evidence: 'the couplings   grow' }, all = a => ({ 'scope-stated': a, 'in-place': ok });
  assert.deepEqual(reading(q, all(ok))['scope-stated'], { v: 'pass', reason: 'The range is stated.', evidence: 'the couplings   grow' }, 'a quotation is compared without regard to spacing');
  assert.equal(reading(q, all({ ...ok, evidence: 'Headings above it: Two nodes' }))['scope-stated'].evidence, 'Headings above it: Two nodes', 'any passage of the material shown is a quotation, its headings line included (the first live run refused this one)');
  assert.throws(() => reading(q, all({ ...ok, evidence: 'copied character for character' })), /not a quotation of the material shown/, 'the instruction on how to answer is not material');
  assert.throws(() => reading(q, { 'in-place': ok }), /Answer refused: question scope-stated has no verdict/);
  assert.throws(() => reading(q, all({ ...ok, verdict: 'unsure' })), /scope-stated has no verdict/);
  assert.throws(() => reading(q, all({ ...ok, reason: ' ' })), /scope-stated has no reason/);
  assert.throws(() => reading(q, all({ ...ok, evidence: 'the couplings shrink' })), /evidence of question scope-stated is not a quotation of the material shown/);
  assert.throws(() => reading(q, all({ ...ok, evidence: '' })), /not a quotation/);
  const better = extra => ({ 'better-sentence': { verdict: 'fail', reason: 'Shorter.', evidence: 'the couplings grow', sentence: 'Both nodes are asymptotically free.', criterion: 7, ...extra } });
  assert.deepEqual(reading(b, better())['better-sentence'], { v: 'fail', reason: 'Shorter.', evidence: 'the couplings grow', sentence: 'Both nodes are asymptotically free.', criterion: 7 });
  assert.throws(() => reading(b, better({ sentence: '' })), /fails the unit without a different sentence/);
  assert.throws(() => reading(b, better({ sentence: b.text })), /without a different sentence/);
  assert.throws(() => reading(b, better({ criterion: 0 })), /names no ranked criterion/);
  assert.throws(() => reading(b, better({ sentence: b.text + ' It is, in addition, worth noting that this is so.' })), /claims a shorter sentence that is not shorter/);
  // In a run: the answers about one sentence quote nothing, and one answer leaves a question out.
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => call.seed ? undefined : call.unit === at('flow') && call.family === 'content' ? { verdict: 'pass', reason: 'Fine.', evidence: 'words that are not in the text' } : call.unit === at('susy') && item.id === 'in-place' ? false : undefined, log) });
  assert.ok(log.every(call => typeof call.unit === 'string' && typeof call.family === 'string' && call.items.length >= 1));
  assert.deepEqual(out.runs.map(r => [r.state, r.calls.filter(c => c.state === 'refused').map(c => c.error).sort()]), new Array(JUDGES).fill(['valid', ['Answer refused: question in-place has no verdict', 'Answer refused: the evidence of question scope-stated is not a quotation of the material shown']]));
  const open = id => Object.entries(out.result.state.units[id].checks).filter(([, c]) => c.v === 'pending').map(([rule]) => rule);
  assert.deepEqual([open(at('flow')), open(at('susy')), open(at('use')), out.result.state.complete], [['scope-stated', 'in-place'], ['scope-stated', 'in-place'], [], false], 'a refused answer leaves its questions awaiting; a rule cannot be skipped');
  const dir = path.join(ledger(project, 'paper'), out.runs[0].id, '0001');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['prompt.txt', 'response.json', 'schema.json', 'stdout.jsonl']);
  assert.match(summary(out), /VALID: 13 answers on the manuscript recorded, 2 calls without a usable answer\./);
  const narrow = invocation('codex', dir, 'm', { narrow: true }), claude = invocation('claude', dir, null, { narrow: true, schema });
  assert.ok(['--skip-git-repo-check', '--ephemeral', 'read-only'].every(a => narrow.args.includes(a)));
  assert.deepEqual([claude.args[claude.args.indexOf('--tools') + 1], JSON.parse(claude.args[claude.args.indexOf('--json-schema') + 1])], ['', schema], 'a narrow call has no tools and carries the schema of its question');
});

test('the grounds left to a reader are judged: two passing judges pass, one failing judge fails, one passing judge alone leaves the verdict awaiting', async t => {
  const { root, project, at } = make(t);
  const kinds = verify(project, 'paper', check).questions.filter(q => !['content', 'better-sentence'].includes(q.family)).map(q => [q.family, q.unit === 'document' ? 'document' : Object.entries({ count: at('count'), use: at('use'), flow: at('flow'), susy: at('susy') }).find(([, id]) => id === q.unit)[0], q.items.map(i => i.tag)]);
  assert.deepEqual(kinds, [['number-bound', 'count', ['two']], ['aside-punctuation', 'use', [' nodes are asymptotically free: the couplings grow']], ['term-attested', 'use', ['"couplings grow"']], ['number-bound', 'use', ['two']],
    ['term-attested', 'flow', ['"flow reaches"']], ['term-attested', 'susy', ['"counts supersymmetries"']], ['defined-before-use', 'document', ['\\mathcal{N}']]]);
  // The second judge of this pair misses a seeded defect, so that a single run supplies verdicts.
  let runs = 0;
  const one = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => { if (call.n === 1) runs++; return runs > 1 && call.seed && call.expect[item.id] === 'fail' ? 'pass' : undefined; }) });
  assert.deepEqual(one.runs.map(r => r.state), ['valid', 'void']);
  assert.ok(backed(one.result.state).length === 19 && backed(one.result.state).every(c => c.v === 'pending' && c.by.runs.length === 1), 'one passing judge alone decides nothing');
  assert.deepEqual([one.result.state.complete, waiting(one.result.state)], [false, 19]);
  // The next judge fails the colon, the declaration of ordinary wording and the standard notation.
  const fails = (call, item) => (call.unit === at('use') && call.family === 'aside-punctuation') || (call.unit === at('flow') && call.family === 'term-attested') || (call.unit === 'document' && item.tag === '\\mathcal{N}');
  const two = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => !call.seed && fails(call, item) ? 'fail' : undefined) });
  assert.deepEqual(two.runs.map(r => [r.state, r.calls.filter(c => !c.seed).length]), [['valid', 15]], 'the questions a judge has passed are asked once more, and a failed unit is not asked again');
  const v = (id, rule) => two.result.state.units[id].checks[rule];
  assert.deepEqual([v(at('use'), 'aside-punctuation').v, v(at('flow'), 'term-attested').v, v('document', 'defined-before-use').v, v(at('use'), 'number-bound').v, v(at('count'), 'number-bound').v, v(at('use'), 'term-attested').v, v(at('susy'), 'term-attested').v],
    ['fail', 'fail', 'fail', 'pass', 'pass', 'pass', 'pass']);
  assert.match(v(at('use'), 'aside-punctuation').e[0], /^ nodes are asymptotically free: the couplings grow: judge codex, provider default model \(run [0-9a-f]{12}\) fails it: Fixture judge\. Evidence: "Both of the"$/);
  assert.match(v(at('flow'), 'term-attested').e[0], /^"flow reaches": judge codex/);
  assert.deepEqual(v(at('use'), 'aside-punctuation').by.runs.map(r => r[2]), ['pass', 'fail'], 'the judges disagree: the unit fails');
  assert.deepEqual([two.result.open.map(f => f.rule).sort(), waiting(two.result.state), two.result.state.complete], [['aside-punctuation', 'defined-before-use', 'term-attested'], 0, false]);
  assert.match(report('demo', two.result), /Status: INCOMPLETE, 3 failing and 0 not judged\.\n- \[aside-punctuation\]/);
  assert.equal((await judge(root, 'demo', 'paper', { ...check, runner: () => assert.fail('a failed unit is changed, not asked again') })).runs.length, 0);
});

test('a unit fails when a judge writes a better sentence, and its replacement is judged in turn', async t => {
  const { root, project, at } = make(t), old = at('susy');
  const out = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => !call.seed && call.unit === old && item.better ? { verdict: 'fail', reason: 'The verb is enough.', evidence: 'counts supersymmetries', sentence: '$\\mathcal{N}$ counts supersymmetries.', criterion: 5 } : undefined) });
  const c = out.result.state.units[old].checks['better-sentence'];
  assert.deepEqual([c.v, c.by.runs.length], ['fail', 1], 'the second judge is not asked about a sentence that has to change');
  assert.match(c.e[0], /^judge codex, provider default model \(run [0-9a-f]{12}\) wrote a better sentence under criterion 5 \(no redundancy\): \$\\mathcal\{N\}\$ counts supersymmetries\. Reason: The verb is enough\.$/);
  assert.equal(out.result.state.complete, false);
  edit(project, 'The symbol $\\mathcal{N}$ counts supersymmetries.', '$\\mathcal{N}$ counts supersymmetries.');
  const log = [], next = await judge(root, 'demo', 'paper', { ...check, runner: answerer(undefined, log) });
  assert.deepEqual([next.result.state.complete, next.result.state.units[at('susy')].checks['better-sentence'].v, old in next.result.state.units], [true, 'pass', false]);
  assert.deepEqual([...new Set(log.filter(call => !call.seed).map(call => call.unit))].sort(), [at('susy'), 'document'].sort(), 'only the replaced sentence and the notation first used in it are asked');
});

test('a defect the user found is seeded in every later run that asks its family', async t => {
  const found = { id: 'case-three-misplaced', kind: 'judge', question: 'Does the sentence speak of case (3) inside the discussion of another case? Fail if it does.', source: 'user, 2026-11-25: the sentence on case (3) stands at the end of the Section on case (5)',
    fail: [{ tex: '\\section{Case (5)}\n\nIn case (5) both nodes are free. In case (3) the second node is free.', at: 'In case (3)' }], pass: ['\\section{Case (5)}\n\nIn case (5) both nodes are free.'] };
  const { root, project, at } = make(t, { 'paper/RULES.json': { version: 1, rules: [found] } });
  const seeded = out => out.runs.map(r => r.seeds.filter(s => s.id.startsWith('case-three')).map(s => [s.id, s.status]));
  const blind = await judge(root, 'demo', 'paper', { writer: 'claude', ...check, runner: answerer((call, item) => call.seed?.includes('case-three-misplaced:fail:1') && item.id === 'case-three-misplaced' ? 'pass' : undefined) });
  assert.deepEqual([blind.runs.map(r => r.state), seeded(blind)[0]], [['void', 'void'], [['case-three-misplaced:fail:1', 'missed'], ['case-three-misplaced:pass:1', 'met']]], 'a judge that does not see the user\'s defect judges nothing');
  const first = await judge(root, 'demo', 'paper', { ...check, runner: answerer() });
  assert.deepEqual([first.result.state.complete, first.runs.map(r => [r.state, r.seeded])], [true, [['valid', 9], ['valid', 9]]]);
  edit(project, 'There the flow reaches the endpoint.', 'There the flow reaches its endpoint.');
  const log = [], later = await judge(root, 'demo', 'paper', { ...check, runner: answerer(undefined, log) });
  assert.deepEqual(seeded(later), new Array(JUDGES).fill([['case-three-misplaced:fail:1', 'met'], ['case-three-misplaced:pass:1', 'met']]));
  assert.ok(log.some(call => call.seed?.includes('case-three-misplaced:fail:1') && call.text.startsWith('In case (3)') && call.items.some(i => i.id === 'case-three-misplaced')), 'the failing text is put to the judge as a unit of the manuscript copy');
  // Hash binding: the edited sentence and the other sentence of its paragraph are asked again, nothing else.
  assert.deepEqual([...new Set(log.filter(call => !call.seed).map(call => call.unit))].sort(), [at('use'), at('flow')].sort());
  assert.deepEqual(later.runs.map(r => r.calls.filter(c => !c.seed).length), [8, 8]);
  for (const id of [at('count'), at('susy')]) assert.deepEqual(later.result.state.units[id], first.result.state.units[id], 'the verdicts of the other units are kept with the runs they rest on');
  assert.deepEqual(later.result.state.units.document.checks['defined-before-use'], first.result.state.units.document.checks['defined-before-use']);
  assert.equal(later.result.state.complete, true);
  put(project, 'paper/RULES.json', { version: 1, rules: [{ ...found, question: '' }] }); assert.throws(() => rules(project), /case-three-misplaced refused: a rule judged by a reader needs its question/);
  put(project, 'paper/RULES.json', { version: 1, rules: [{ ...found, pass: ['In case (5) both nodes are free.'] }] }); assert.throws(() => rules(project), /must open with its own \\section heading/);
  put(project, 'paper/RULES.json', { version: 1, rules: [{ ...found, fail: [{ ...found.fail[0], at: 'In case' }] }] }); assert.throws(() => rules(project), /no single sentence containing "In case"/);
  put(project, 'paper/RULES.json', { version: 1, rules: [{ ...found, family: 'term-attested' }] }); assert.throws(() => rules(project), /its family term-attested is the id of a rule/);
  const shorter = { id: 'shorter', kind: 'better', source: 'fixture', fail: found.fail };
  put(project, 'paper/RULES.json', { version: 1, rules: [shorter] }); assert.equal(rules(project).at(-1).id, 'shorter');
  put(project, 'paper/RULES.json', { version: 1, rules: [{ ...shorter, pass: found.pass }] }); assert.throws(() => rules(project), /takes no passing text: a sentence passes when two judges fail to improve on it/);
});

test('paper-judge needs the writer, plans without a call or an enrollment, and refuses a nested or concurrent run', async t => {
  const { root, project } = make(t), saved = process.exitCode, file = path.join(project, 'paper/VERIFY.json');
  try {
    await assert.rejects(main(['paper-judge', 'demo', '--no-build'], root), /--writer claude or --writer codex/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer', 'gemini'], root), /--writer claude or --writer codex/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer', 'claude', '--limit', '0'], root), /--limit needs a positive integer/);
    await assert.rejects(main(['paper-judge', 'demo', '--writer'], root), /Expected --writer/);
    await assert.rejects(main(['paper-judge', '../demo', '--writer', 'claude'], root), /Invalid project slug/);
    const text = await main(['paper-judge', 'demo', 'paper', '--writer', 'claude', '--no-build', '--dry-run', '--family', 'content,better-sentence'], root);
    assert.match(text, /Plan \(no model was called\): \{"questions":4,"families":\{"content":2,"better-sentence":2\}/, 'without a corpus two sentences cannot be judged by code, and what code has to settle first is not put to a judge');
    assert.equal(process.exitCode, 1); assert.ok(!fs.existsSync(file), 'a plan enrolls nothing');
  } finally { process.exitCode = saved; }
  const old = process.env.HEP_REVIEW_CHILD; process.env.HEP_REVIEW_CHILD = '1';
  try { await assert.rejects(judge(root, 'demo', 'paper', { writer: 'claude', ...check }), /Nested/); }
  finally { if (old === undefined) delete process.env.HEP_REVIEW_CHILD; else process.env.HEP_REVIEW_CHILD = old; }
  const during = await judge(root, 'demo', 'paper', { writer: 'codex', ...check, limit: 2, families: ['content'], runner: async (command, args, options) => {
    await assert.rejects(judge(root, 'demo', 'paper', { writer: 'codex', ...check }), /Another run of the judges holds/);
    return answerer()(command, args, options);
  } });
  assert.deepEqual(during.runs.map(r => [r.provider, r.state, r.models, r.calls.filter(c => !c.seed).length]), new Array(JUDGES).fill(['claude', 'valid', ['fixture-model'], 2]), 'text written by codex is judged by claude; a limit bounds the questions of a run');
  assert.ok(!fs.existsSync(path.join(ledger(project, 'paper'), 'active.lock')));
  assert.match(summary(during), /\(claude, provider default model \(reported: fixture-model\); writer codex\)/);
});
