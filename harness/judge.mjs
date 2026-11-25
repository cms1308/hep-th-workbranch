// Independent verdicts, stage 3 of harness/design/paper-verification.md ("Making the independent verdict real").
// A run is one judge (a model of a vendor other than the writer's) answering narrow calls: one unit, one rule family,
// a schema that requires pass or fail, a reason and quoted evidence for every question. Each run first plants the
// registered failing and passing texts in a copy of the manuscript and asks about them in calls of the same form. A
// seeded defect that the judge misses, or a passing text that it fails, makes the run void and none of its answers
// is used. Answers are kept in run records under .harness-local/verdicts/, which verify.mjs reads: nothing here or
// anywhere else writes a verdict into VERIFY.json directly.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { json, sha, safePath, writeJSON } from './core.mjs';
import { execute, invocation, collect } from './dispatch.mjs';
import { load as storedCorpus } from './corpus.mjs';
import { verify, examine, report, ledger, declaredWriter, family, designates, target, CHECKS, JUDGE, JUDGES, CRITERIA } from './verify.mjs';

export const VENDORS = ['claude', 'codex'];
const fence = text => `<<<\n${text}\n>>>`;
const bare = text => String(text).replace(/\s+/g, '');
const SUBJECT = { sentence: 'one sentence', title: 'one title', document: 'the notation that the manuscript declares standard' };

// What one call shows the judge: the unit, its context and the questions. A question's key (verify.mjs) covers every part of a question that enters here: when this wording changes, raise JUDGE.
function material(q) {
  const better = q.items.some(i => i.better);
  return [
    `You are an independent judge of ${SUBJECT[q.kind]} of a manuscript in theoretical high-energy physics (hep-th). You did not write it and neither answer is preferred.`,
    'Judge only the questions below, from the material in this message. Do not read files, run commands or search: everything you need is here.',
    ...(q.text ? [`The unit to judge, in TeX:\n${fence(q.text)}`] : []),
    ...(q.context && q.context !== q.text ? [`The paragraph that contains it (context: do not judge its other sentences):\n${fence(q.context)}`] : []),
    ...(q.headings.length ? [`Headings above it: ${q.headings.join(' > ')}`] : []),
    ...(better ? [['Ranked criteria of a better sentence. A gain under a lower criterion never justifies a loss under a higher one.',
      ...CRITERIA.map((c, i) => `${i + 1}. ${c}`), `${CRITERIA.length + 1}. on a tie, the existing sentence stays`,
      'A replacement stands in the same place of the paragraph and keeps every claim, condition, symbol, reference and citation of the unit, unless criterion 1 requires a change. A rewording that is merely different is not better.'].join('\n')] : []),
    ['Questions:', ...q.items.map(i => `- ${i.id}: ${i.q}`)].join('\n'),
  ].join('\n\n');
}
// The whole message of one call: the material, then how to answer.
export function prompt(q) {
  return `${material(q)}\n\nAnswer every question with verdict ("pass" or "fail"), reason (one or two sentences) and evidence: one passage copied character for character from the material above, which shows the ground of the verdict.${q.items.some(i => i.better)
    ? ' For a question about a better sentence: if you can write one, answer "fail", give it in `sentence` (TeX) and give in `criterion` the number of the highest-ranked criterion under which it is strictly better. If you cannot, answer "pass" with an empty `sentence` and `criterion` 0.' : ''}`;
}
// The output schema of one call: every question is required, so that none can be skipped.
export function shape(q) {
  const answer = i => ({ type: 'object', additionalProperties: false,
    properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, reason: { type: 'string' }, evidence: { type: 'string' }, ...(i.better ? { sentence: { type: 'string' }, criterion: { type: 'integer', enum: CRITERIA.map((c, n) => n).concat(CRITERIA.length) } } : {}) },
    required: ['verdict', 'reason', 'evidence', ...(i.better ? ['sentence', 'criterion'] : [])] });
  return { type: 'object', additionalProperties: false, properties: Object.fromEntries(q.items.map(i => [i.id, answer(i)])), required: q.items.map(i => i.id) };
}
// The answers of one call, or an error: a question left out, a verdict without a reason, evidence that is not a
// quotation of the material shown, or a better sentence that is absent, unchanged or longer than what it claims to shorten.
export function reading(q, value) {
  const refuse = why => { throw Error(`Answer refused: ${why}`); }, shown = bare(material(q));
  if (!value || typeof value !== 'object') refuse('no structured answer');
  return Object.fromEntries(q.items.map(i => {
    const a = value[i.id];
    if (!a || !['pass', 'fail'].includes(a.verdict)) refuse(`question ${i.id} has no verdict`);
    if (typeof a.reason !== 'string' || !a.reason.trim()) refuse(`question ${i.id} has no reason`);
    if (typeof a.evidence !== 'string' || !bare(a.evidence) || !shown.includes(bare(a.evidence))) refuse(`the evidence of question ${i.id} is not a quotation of the material shown`);
    const out = { v: a.verdict, reason: a.reason.trim(), evidence: a.evidence.trim() };
    if (!i.better || a.verdict === 'pass') return [i.id, out];
    if (typeof a.sentence !== 'string' || !bare(a.sentence) || bare(a.sentence) === bare(q.text)) refuse(`question ${i.id} fails the unit without a different sentence`);
    if (!(Number.isInteger(a.criterion) && a.criterion >= 1 && a.criterion <= CRITERIA.length)) refuse(`question ${i.id} names no ranked criterion`);
    if (a.criterion === CRITERIA.length && bare(a.sentence).length >= bare(q.text).length) refuse(`question ${i.id} claims a shorter sentence that is not shorter`);
    return [i.id, { ...out, sentence: a.sentence.trim(), criterion: a.criterion }];
  }));
}

const sample = s => typeof s === 'string' ? { tex: s } : s;
// The registered failing and passing texts of the families asked in a run, as lines and registry entries to append to a copy of the manuscript.
function plant(list, families) {
  const extra = { lines: [], symbols: [], terms: [], facts: {}, uses: {} }, samples = [];
  for (const rule of list) {
    if (!families.has(family(rule))) continue;
    const check = CHECKS[rule.kind], texts = check.reader ? rule : rule.judge || {};
    for (const want of ['fail', 'pass']) (texts[want] || []).map(sample).forEach((s, i) => {
      const id = `${rule.id}:${want}:${i + 1}`, file = `seed:${id}`;
      // A heading ends whatever precedes the text. A judge of a code rule's question sees no heading; a reader rule's text carries its own.
      const tex = check.reader ? s.tex : `\\section{Seeded text}\n\n${s.tex}`;
      extra.lines.push({ file, line: 0, text: '' }, ...tex.split('\n').map((text, n) => ({ file, line: n + 1, text })), { file, line: 0, text: '' });
      extra.symbols.push(...(s.lexicon?.symbols || [])); extra.terms.push(...(s.lexicon?.terms || []));
      Object.assign(extra.facts, s.facts?.facts); Object.assign(extra.uses, s.facts?.uses);
      samples.push({ id, rule, want, s, file });
    });
  }
  return { extra, samples };
}
// The calls that test the judge: for each planted text, the question about it in the copy and the answer a sound judge gives.
function tests(copy, samples) {
  const calls = new Map(), seeds = [];
  for (const { id, rule, want, s, file } of samples) {
    const check = CHECKS[rule.kind], own = copy.doc.units.filter(u => u.file === file), name = family(rule), hits = [];
    if (check.reader) {
      const u = target(own, check, rule, s), q = u && copy.questions.find(x => x.unit === u.id && x.family === name);
      if (q) hits.push([q, q.items.filter(i => i.rule === rule.id)]);
    } else for (const q of copy.questions.filter(x => x.family === name && (x.unit === 'document' || own.some(u => u.id === x.unit)))) {
      const items = q.items.filter(i => designates(i.tag, s.item) && (q.unit !== 'document' || s.item !== undefined));
      if (items.length) hits.push([q, items]);
    }
    if (!hits.length) { seeds.push({ id, family: name, want, status: 'unplanted', note: 'in this manuscript the text does not reach the judge: code decides it, or its question is absent' }); continue; }
    const at = [];
    for (const [q, items] of hits) {
      const k = `${q.unit}|${q.family}`, call = calls.get(k) || calls.set(k, { q, expect: {}, seeds: [] }).get(k);
      for (const i of items) call.expect[i.id] = want;
      call.seeds.push(id); at.push(k);
    }
    seeds.push({ id, family: name, want, status: 'planted', at });
  }
  return { calls: [...calls.values()], seeds };
}

async function pool(items, size, work) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => { while (next < items.length) await work(items[next++]); }));
}
// One run of one judge: the planted texts first, then, if the judge got every one of them right, the questions of the manuscript.
async function run({ project, paper, slug, dir, writer, provider, model, need, list, check, parallel, timeout, runner, gate }) {
  const id = crypto.randomBytes(6).toString('hex'), base = path.join(dir, id), asked = new Set(need.map(q => q.family));
  const planted = plant(list, asked), probe = tests(examine(project, paper, { corpus: check.corpus, extra: planted.extra }), planted.samples);
  const covered = new Set(probe.seeds.filter(s => s.want === 'fail' && s.status === 'planted').map(s => s.family)), real = need.filter(q => covered.has(q.family));
  const record = { version: 1, tool: JUDGE, id, slug, paper, writer, provider, requestedModel: model || null, models: [], gate, started: new Date().toISOString(), finished: null, state: 'running',
    seeds: probe.seeds, unseeded: [...asked].filter(f => !covered.has(f)).sort(), seeded: 0, caught: 0, controls: 0, passed: 0, calls: [] };
  const file = path.join(base, 'run.json'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hep-judge-'));
  const queue = [...probe.calls, ...real.map(q => ({ q }))].map((c, n) => ({ ...c, n: n + 1 }));
  const ask = async c => {
    const cdir = path.join(base, String(c.n).padStart(4, '0')), text = prompt(c.q), schema = shape(c.q), started = Date.now();
    const entry = { n: c.n, unit: c.q.unit, family: c.q.family, key: c.q.key, ...(c.seeds ? { seed: c.seeds } : {}) };
    try {
      fs.mkdirSync(cdir, { recursive: true });
      fs.writeFileSync(path.join(cdir, 'prompt.txt'), text); writeJSON(path.join(cdir, 'schema.json'), schema);
      const call = invocation(provider, cdir, model, { narrow: true, schema });
      // `call` describes the question for an injected judge (tests); the provider process receives the prompt only.
      await runner(call.command, call.args, { cwd: scratch, dir: cdir, prompt: text, timeout, call: { ...entry, provider, text: c.q.text, items: c.q.items, expect: c.expect || null } });
      const got = collect(provider, cdir);
      Object.assign(entry, { state: 'ok', answers: reading(c.q, got.value), session: got.sessionId, usage: got.usage });
      for (const m of got.models) if (!record.models.includes(m)) record.models.push(m);
    } catch (e) { Object.assign(entry, { state: /^Answer refused/.test(e.message) ? 'refused' : 'error', error: e.message.slice(0, 400) }); }
    entry.ms = Date.now() - started;
    record.calls.push(entry);
    if (record.state === 'valid' && record.calls.length % 20 === 0) writeJSON(file, record);       // a run cut short keeps the answers it has
    return entry;
  };
  try {
    writeJSON(file, record);
    const answered = new Map();
    await pool(queue.filter(c => c.seeds), parallel, async c => answered.set(`${c.q.unit}|${c.q.family}`, [c, await ask(c)]));
    for (const s of record.seeds.filter(x => x.status === 'planted')) {
      const met = s.at.every(k => { const [c, e] = answered.get(k); return e.state === 'ok' && Object.entries(c.expect).every(([item, want]) => e.answers[item].v === want); });
      s.status = met ? 'met' : 'missed';
      if (!met) s.note = s.at.map(k => { const [c, e] = answered.get(k); return e.state === 'ok' ? `call ${e.n} answered ${Object.keys(c.expect).map(i => `${i}: ${e.answers[i].v}`).join(', ')}` : `call ${e.n}: ${e.error}`; }).join('; ');
      delete s.at;
      if (s.want === 'fail') { record.seeded++; record.caught += met; } else { record.controls++; record.passed += met; }
    }
    // Void: a seeded defect was missed, a passing text was failed, or no defect could be seeded at all. The manuscript's questions are then not asked.
    record.state = record.seeded > 0 && record.caught === record.seeded && record.passed === record.controls ? 'valid' : 'void';
    if (record.state === 'valid') await pool(queue.filter(c => !c.seeds), parallel, ask);
  } catch (e) { record.state = 'failed'; record.error = e.message; }
  finally {
    record.calls.sort((a, b) => a.n - b.n);
    record.finished = new Date().toISOString();
    record.usage = record.calls.reduce((sum, c) => { for (const [k, v] of Object.entries(c.usage || {})) if (typeof v === 'number') sum[k] = (sum[k] || 0) + v; return sum; }, { calls: record.calls.length, ms: record.calls.reduce((n, c) => n + c.ms, 0) });
    writeJSON(file, record);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return record;
}

// Questions a run still has to ask: no judge has failed them, fewer than JUDGES have passed them, and code finds nothing to fix in the unit first.
function needed(result, families) {
  const stuck = id => id !== 'document' && Object.values(result.state.units[id].checks).some(c => c.v === 'fail' || c.v === 'unjudged');
  return result.questions.filter(q => (!families || families.includes(q.family)) && q.votes.length < JUDGES && !q.votes.some(b => q.items.some(i => b.answers[i.id].v === 'fail')) && !stuck(q.unit));
}
function acquire(lock) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }), { flag: 'wx' }); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    let pid = null, alive = true;
    try { pid = json(lock).pid; process.kill(pid, 0); } catch (e) { alive = e.code === 'EPERM'; }
    if (alive) throw Error(`Another run of the judges holds ${lock} (process ${pid}). Wait for it to end.`);
    fs.rmSync(lock, { force: true });                    // the process that held it has ended
  }
  throw Error(`Cannot take ${lock}`);
}
// Ask the judges what the manuscript still awaits: up to JUDGES runs, each a judge of the vendor that did not write it.
// models: one model for each run in turn (provider default when empty). dry: return the plan without calling a model.
export async function judge(root, slug, paper = 'paper', { writer, models = [], parallel = 4, limit = Infinity, families, dry = false, timeout = 900000, runner = execute, build, corpus } = {}) {
  if (process.env.HEP_REVIEW_CHILD) throw Error('Nested judge dispatch is prohibited');
  if (typeof slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(slug) || !/^paper[A-Za-z0-9_-]*$/.test(paper)) throw Error('Invalid project slug or paper directory');
  const project = safePath(root, `projects/${slug}`), who = writer ?? declaredWriter(project, paper);
  if (!VENDORS.includes(who)) throw Error('Name the vendor whose model wrote the manuscript with --writer claude or --writer codex: the judges are taken from the other vendor.');
  const provider = VENDORS.find(v => v !== who), dir = ledger(project, paper), lit = corpus ? corpus() : storedCorpus(root);
  const check = { ...(build ? { build } : {}), corpus: () => lit, writer: who }, out = { slug, paper, writer: who, provider, runs: [], plan: null };
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, 'active.lock');
  acquire(lock);
  try {
    for (let seat = 0; seat < JUDGES; seat++) {
      const result = verify(project, paper, { ...check, dry }), need = needed(result, families).slice(0, limit);
      if (!need.length) break;
      if (dry) {
        const count = {};
        for (const q of need) count[q.family] = (count[q.family] || 0) + 1;
        out.plan = { questions: need.length, families: count, note: `each run of a judge asks these questions once, after the planted texts of their families; a question needs ${JUDGES} passing runs` };
        break;
      }
      out.runs.push(await run({ project, paper, slug, dir, writer: who, provider, model: models.length ? models[seat % models.length] : null, need, list: result.list, check, parallel, timeout, runner, gate: result.state.hash }));
    }
    out.result = verify(project, paper, { ...check, dry });
  } finally { fs.rmSync(lock, { force: true }); }
  return out;
}
// What a run did, for the report to the user.
export function summary(out) {
  const name = r => `${r.provider}, ${r.requestedModel ? `model ${r.requestedModel}` : 'provider default model'}${r.models.length ? ` (reported: ${r.models.join(', ')})` : ''}`;
  const runs = out.runs.map(r => {
    const got = r.calls.filter(c => !c.seed), lost = r.calls.filter(c => c.state !== 'ok').length, use = Object.entries(r.usage).filter(([k]) => /tokens|cost/.test(k)).map(([k, v]) => `${k} ${v}`).join(', ');
    const head = `Run ${r.id} of the judges (${name(r)}; writer ${r.writer}): caught ${r.caught} of ${r.seeded} seeded defects and passed ${r.passed} of ${r.controls} passing texts.`;
    const cost = `${r.calls.length} calls, ${Math.round(r.usage.ms / 1000)} s of call time${use ? `, ${use}` : ''}.`;
    const side = [...r.seeds.filter(s => s.status === 'unplanted').map(s => `Not planted: ${s.id} (${s.note}).`), ...(r.unseeded.length ? [`Not asked, no defect could be seeded for the family: ${r.unseeded.join(', ')}.`] : [])].join(' ');
    return r.state === 'valid' ? `${head} VALID: ${got.filter(c => c.state === 'ok').length} answers on the manuscript recorded${lost ? `, ${lost} calls without a usable answer` : ''}. ${cost} ${side}`.trim()
      : r.state === 'void' ? `${head} VOID, none of its answers is used and the manuscript's questions were not asked: ${r.seeds.filter(s => s.status === 'missed').map(s => `${s.id} (${s.note})`).join('; ') || 'no defect could be seeded'}. ${cost} ${side}`.trim()
        : `Run ${r.id} of the judges FAILED: ${r.error}`;
  });
  return [...runs, ...(out.plan ? [`Plan (no model was called): ${JSON.stringify(out.plan)}`] : []), ...(!out.runs.length && !out.plan ? ['No question awaits a judge.'] : []), '', report(out.slug, out.result)].join('\n');
}
