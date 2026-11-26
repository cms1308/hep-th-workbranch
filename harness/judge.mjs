// Independent verdicts, stage 3 of harness/design/paper-verification.md (second form, 2026-11-26).
// A run is one judge: a model of a vendor other than the writer's. A call puts one rule family to the judge for many units at
// once (whole paragraphs, each unit judged in its own), under a schema that requires pass or fail, a reason and quoted evidence
// for every unit and question. Every call also carries the registered failing and passing texts of the rules it asks, planted
// in a copy of the manuscript and placed among its paragraphs. A judge that misses a seeded defect of a rule in a call, or
// fails a passing text, gives no verdict on that rule from that call (verify.mjs decides this from the record). Answers are
// kept in run records under .harness-local/verdicts/: nothing here or anywhere else writes a verdict into VERIFY.json directly.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { json, sha, safePath, writeJSON } from './core.mjs';
import { execute, invocation, collect, configured } from './dispatch.mjs';
import { load as storedCorpus } from './corpus.mjs';
import { verify, examine, report, ledger, declaredWriter, family, designates, target, judgeModel, CHECKS, JUDGE, MODEL, CRITERIA, FIT, SHORTER } from './verify.mjs';

export const VENDORS = ['claude', 'codex'];
export const BATCH = 25;                                 // units judged without their paragraph that one call holds, by default
const fence = text => `<<<\n${text}\n>>>`;
const bare = text => String(text).replace(/\s+/g, '');
// A quotation is compared without spacing and without math delimiters, which a judge adds to close a formula it cuts (live, 2 of 17 answers).
const quoted = text => bare(text).replace(/\$/g, '');
const words = text => String(text).replace(/\\label\s*\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean).length;
const sample = s => typeof s === 'string' ? { tex: s } : s;

// What one call shows the judge: blocks (a paragraph with its headings and the units to judge in it), then the questions.
// A question's key (verify.mjs) covers every part of a question that enters here: when this wording changes, raise JUDGE.
function material(call) {
  const entries = call.blocks.flatMap(b => b.entries), better = entries.some(e => e.items.some(i => i.better)), outlined = call.blocks.some(b => b.aside?.entry || b.aside?.claims || b.aside?.setting), groups = new Map();
  const same = entries.every(e => e.items.length === entries[0].items.length && e.items.every((i, k) => i.show === entries[0].items[k].show && i.q === entries[0].items[k].q));
  // A question put to several units is printed once, with the units it is put to.
  for (const e of entries) for (const i of e.items) { const k = `${i.show}\n${i.q}`; groups.set(k, [...(groups.get(k) || []), { e, i }]); }
  return [
    'You are an independent judge of parts of a manuscript in theoretical high-energy physics (hep-th). You did not write it and neither answer is preferred.',
    'Judge only the questions below, from the material in this message. Do not read files, run commands or search: everything you need is here.',
    `The material comes in blocks. A block is a paragraph of the manuscript with the headings above it, or one sentence or title taken alone, or the notation the manuscript declares. Where a block has several units and prints no paragraph, its units, in their order, are the whole paragraph.${outlined ? ' A block may also print what the outline of its manuscript holds for it: sentences that stand earlier in the manuscript and state the setting in which the paragraph is read, copied from the manuscript, the entry of the paragraph (its role, then what the paragraph does) and the central claims that the outline registers.' : ''} The blocks do not belong together: judge each unit within its own block, use nothing from another block, and judge only the units listed.`,
    ...call.blocks.map((b, k) => [`Block ${k + 1}`, ...(b.headings.length ? [`Headings above it: ${b.headings.join(' > ')}`] : []),
      ...(b.aside?.setting ? [`Sentences earlier in the manuscript that state the setting:\n${b.aside.setting.map(fence).join('\n')}`] : []),
      ...(b.aside?.entry ? [`Entry of the paragraph in the outline: ${b.aside.entry}`] : []),
      ...(b.aside?.claims ? [`Central claims registered in the outline:\n${b.aside.claims.map(c => `- ${c}`).join('\n')}`] : []),
      ...(b.context && bare(b.context) !== bare(b.entries.filter(e => !e.whole).map(e => e.text).join('')) ? [`Paragraph:\n${fence(b.context)}`] : []),
      ...b.entries.map(e => e.whole ? `Unit ${e.label}: the paragraph of this block as a whole, with the list items that belong to it.` : e.text ? `Unit ${e.label}:\n${fence(e.text)}` : `Unit ${e.label}: the notation that the manuscript declares standard, described in its questions.`)].join('\n')),
    ...(better ? [['Ranked criteria of a better sentence. A gain under a lower criterion never justifies a loss under a higher one.',
      ...CRITERIA.map((c, i) => `${i + 1}. ${c}`), `${CRITERIA.length + 1}. on a tie, the existing sentence stays`,
      'A replacement stands in the same place of its paragraph and keeps every claim, condition, symbol, reference and citation of the unit, unless criterion 1 requires a change. A rewording that is merely different is not better, and a replacement that is only shorter counts only when it has at least a fifth fewer words: offer no smaller saving.'].join('\n')] : []),
    same ? ['Questions, each to be answered for every unit. The answer to question X about unit U7 has the key u7-X.', ...entries[0].items.map(i => `- ${i.show}: ${i.q}`)].join('\n')
      : groups.size === entries.reduce((n, e) => n + e.items.length, 0) ? ['Questions, each about one unit:', ...entries.flatMap(e => e.items.map(i => `- ${i.key} (unit ${e.label}): ${i.q}`))].join('\n')
        : ['Questions, each put to the units named with it. The answer to question X about unit U7 has the key u7-X.', ...[...groups.values()].map(g => `- ${g[0].i.show} (${g.length === 1 ? `unit ${g[0].e.label}` : `units ${g.map(x => x.e.label).join(', ')}`}): ${g[0].i.q}`)].join('\n'),
  ].join('\n\n');
}
// The whole message of one call: the material, then how to answer.
export function prompt(call) {
  return `${material(call)}\n\nAnswer every key with verdict ("pass" or "fail"), reason (one sentence) and evidence: one passage copied character for character from the block of that unit or from its question, which shows the ground of the verdict.${call.blocks.some(b => b.entries.some(e => e.items.some(i => i.better)))
    ? ' For a question about a better sentence: if you can write one, answer "fail", give it in `sentence` (TeX) and give in `criterion` the number of the highest-ranked criterion under which it is strictly better. If you cannot, answer "pass" with an empty `sentence` and `criterion` 0.' : ''}`;
}
// The output schema of one call: every question of every unit is required, so that none can be skipped.
export function shape(call) {
  const items = call.blocks.flatMap(b => b.entries.flatMap(e => e.items));
  const answer = i => ({ type: 'object', additionalProperties: false,
    properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, reason: { type: 'string' }, evidence: { type: 'string' }, ...(i.better ? { sentence: { type: 'string' }, criterion: { type: 'integer', enum: CRITERIA.map((c, n) => n).concat(CRITERIA.length) } } : {}) },
    required: ['verdict', 'reason', 'evidence', ...(i.better ? ['sentence', 'criterion'] : [])] });
  return { type: 'object', additionalProperties: false, properties: Object.fromEntries(items.map(i => [i.key, answer(i)])), required: items.map(i => i.key) };
}
// The answers of one call, question by question: `ok` holds the answers that can be used, `refused` why another cannot (no
// verdict, no reason, evidence that is not a quotation of the material shown, a better sentence that is absent or unchanged).
// A replacement that is only shorter, by less than a fifth of the words, does not count: the judge has not improved the unit.
export function reading(call, value) {
  if (!value || typeof value !== 'object') throw Error('Answer refused: no structured answer');
  const shown = quoted(material(call)), ok = {}, refused = {};
  for (const e of call.blocks.flatMap(b => b.entries)) for (const i of e.items) {
    const a = value[i.key], no = why => { refused[i.key] = why; };
    if (!a || !['pass', 'fail'].includes(a.verdict)) { no('no verdict'); continue; }
    if (typeof a.reason !== 'string' || !a.reason.trim()) { no('no reason'); continue; }
    if (typeof a.evidence !== 'string' || !quoted(a.evidence) || !shown.includes(quoted(a.evidence))) { no('the evidence is not a quotation of the material shown'); continue; }
    const out = { v: a.verdict, reason: a.reason.trim(), evidence: a.evidence.trim() };
    if (i.better && a.verdict === 'fail') {
      if (typeof a.sentence !== 'string' || !bare(a.sentence) || bare(a.sentence) === bare(e.text)) { no('the unit is failed without a different sentence'); continue; }
      if (!(Number.isInteger(a.criterion) && a.criterion >= 1 && a.criterion <= CRITERIA.length)) { no('no ranked criterion is named'); continue; }
      Object.assign(out, { sentence: a.sentence.trim(), criterion: a.criterion });
      if (a.criterion === CRITERIA.length && words(a.sentence) * SHORTER[1] > words(e.text) * SHORTER[0]) Object.assign(out, { v: 'pass', note: `a shorter sentence was offered, ${words(a.sentence)} words for ${words(e.text)}: less than a fifth saved, not counted` });
    }
    ok[i.key] = out;
  }
  return { ok, refused };
}

// The registered failing and passing texts of the families asked in a run, as lines and registry entries to append to a copy of the manuscript.
function plant(list, families, made = []) {
  const extra = { lines: [], symbols: [], terms: [], facts: {}, uses: {}, names: [], outlines: {}, grounds: {} }, samples = [], files = new Map();
  const add = (id, rule, want, s) => {
      const check = CHECKS[rule.kind];
      // A heading ends whatever precedes the text. A judge of a code rule's question sees no heading; a reader rule's text carries its own.
      const tex = check.reader || /^\s*\\section\*?\s*\{/.test(s.tex) ? s.tex : `\\section{Planted text}\n\n${s.tex}`;
      // One text may serve several registrations (a paragraph with a sound sentence and a defective one): it is planted once.
      if (!files.has(tex)) {
        files.set(tex, `seed:${id}`);
        extra.lines.push({ file: `seed:${id}`, line: 0, text: '' }, ...tex.split('\n').map((text, n) => ({ file: `seed:${id}`, line: n + 1, text })), { file: `seed:${id}`, line: 0, text: '' });
      }
      // The outline of a planted text holds for the units of that text only.
      if (s.outline) {
        const had = extra.outlines[files.get(tex)];
        if (had && JSON.stringify(had) !== JSON.stringify(s.outline)) throw Error(`The text of ${id} is registered elsewhere with another outline: one text has one outline.`);
        extra.outlines[files.get(tex)] = s.outline;
      }
      // So do its grounds: the entries of the samples that share a text are merged.
      if (s.grounds) { const had = extra.grounds[files.get(tex)]?.sentences ?? []; extra.grounds[files.get(tex)] = { sentences: [...had, ...(s.grounds.sentences || []).filter(e => !had.some(x => JSON.stringify(x) === JSON.stringify(e)))] }; }
      extra.symbols.push(...(s.lexicon?.symbols || [])); extra.terms.push(...(s.lexicon?.terms || []));
      Object.assign(extra.facts, s.facts?.facts); Object.assign(extra.uses, s.facts?.uses);
      extra.names.push(...(s.facts?.names || []).map(d => ({ ...d, scope: files.get(tex) })));          // a planted name holds in its own text
      samples.push({ id, rule, want, s, file: files.get(tex) });
  };
  for (const rule of list) {
    if (!families.has(family(rule))) continue;
    const texts = CHECKS[rule.kind].reader ? rule : rule.judge || {};
    for (const want of ['fail', 'pass']) (texts[want] || []).map(sample).forEach((s, i) => add(`${rule.id}:${want}:${i + 1}`, rule, want, s));
  }
  for (const m of made) { const rule = list.find(r => r.id === m.rule); if (rule && families.has(family(rule))) add(m.id, rule, m.want, m.s); }
  return { extra, samples };
}
// Defects made from the manuscript's own sentences, for the grounds of a sentence (design record, "Defects from the manuscript's
// own sentences"). A registered planted text reads unlike the manuscript; these read like it, and each is a defect by construction:
// a sentence that needs a ground, given the passages of a sentence under another top heading that rest on other passages, and a
// sentence that a judge has passed, with one sign or direction reversed. Each stands alone under the headings of its paragraph,
// without its labels, and is kept out of the call of the paragraph it comes from, where the difference would show. One of each
// kind in a run, drawn by the run's id, since a passage shown costs about a thousand tokens in every call of the family.
const REVERSED = [['never', 'always'], ['impossible', 'possible'], ['positive', 'negative'], ['increases', 'decreases'], ['increase', 'decrease'], ['higher', 'lower'], ['larger', 'smaller']]
  .flatMap(([a, b]) => [[new RegExp(`\\b${a}\\b`), b], [new RegExp(`\\b${b}\\b`), a]]);
const SIGNS = [[/\\leq?(?![A-Za-z])/, m => m.replace('le', 'ge')], [/\\geq?(?![A-Za-z])/, m => m.replace('ge', 'le')], [/(?<!\\)</, '>'], [/(?<!\\)>/, '<']];
// The sentence with its first sign (in math) or direction word (in prose) reversed, or null.
export function reversed(tex) {
  const hits = [];
  for (const [re, to] of REVERSED) { const m = re.exec(tex.replace(/\$[^$]*\$/g, x => ' '.repeat(x.length))); if (m) hits.push([m.index, m[0].length, to]); }
  for (const m of tex.matchAll(/\$[^$]*\$/g)) for (const [re, to] of SIGNS) { const h = re.exec(m[0]); if (h) hits.push([m.index + h.index, h[0].length, typeof to === 'function' ? to(h[0]) : to]); }
  if (!hits.length) return null;
  const [at, len, to] = hits.sort((x, y) => x[0] - y[0])[0];
  return tex.slice(0, at) + to + tex.slice(at + len);
}
function own(copy, state, salt) {
  const g = copy.ctx.grounds, byId = new Map(copy.doc.units.map(u => [u.id, u])), made = [], used = new Set();
  const all = copy.questions.filter(q => q.family === 'sentence-grounds' && byId.get(q.unit)?.kind === 'sentence').map(q => {
    const u = byId.get(q.unit), e = g.entry(u), shown = g.of(u)[0];
    return e && shown && { q, u, e, links: shown.links };
  }).filter(Boolean).map(x => [sha(`${salt}:${x.u.id}`), x]).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, x]) => x);
  const sound = x => x.links.length && x.links.every(l => !l.error && !l.unjudged) && (x.e.links || []).every(l => l.at === undefined);
  const text = u => u.text.replace(/\\label\s*\{[^}]*\}/g, '').trim(), pointer = t => t.split(' ').slice(0, 6).join(' ');
  const piece = (kind, x, tex, links) => ({ id: `sentence-grounds:own-${kind}:${x.u.id}`, rule: 'sentence-grounds', want: 'fail', s: {
    tex: [...x.q.headings.slice(0, 3).map((h, i) => `\\${['section', 'subsection', 'subsubsection'][i]}{${h}}`), '', tex].join('\n'),
    grounds: { sentences: [{ at: pointer(tex), type: x.e.type, links }] }, item: pointer(tex), avoid: x.q.context ?? null } });
  const overlap = (a, b) => a.some(p => b.some(q => p.from === q.from && (p.passage.includes(q.passage) || q.passage.includes(p.passage))));
  // The passages of another sentence: they rest on files of the project, under another top heading, and share no passage with the sentence's own.
  for (const x of all.filter(x => ['result', 'derivation'].includes(x.e.type) && x.links.every(l => !l.error))) {
    const donor = all.find(d => d !== x && sound(d) && d.links.every(l => l.kind === 'file') && (d.q.headings[0] ?? '') !== (x.q.headings[0] ?? '') && !overlap(d.links, x.links));
    if (donor) { made.push(piece('passages', x, text(x.u), donor.e.links)); used.add(x.u.id); break; }
  }
  // A sentence a judge has passed, reversed: what its passages establish, it now denies.
  const passed = x => { const runs = state?.units?.[x.u.id]?.checks?.['sentence-grounds']?.by?.runs ?? []; return runs.length > 0 && runs.every(r => r[2] === 'pass'); };
  // Another sentence than the first defect's when there is one: one sentence shown twice would stand out.
  const sources = all.filter(x => sound(x) && passed(x));
  for (const x of [...sources.filter(x => !used.has(x.u.id)), ...sources.filter(x => used.has(x.u.id))]) {
    const turned = reversed(text(x.u));
    if (turned) { made.push(piece('reversed', x, turned, x.e.links)); break; }
  }
  return made;
}
// The planted texts as they stand in the copy, by family: the units to mix into every call of the family (`entries`), the
// declarations to add to the notation of the document (`declared`), and what a sound judge answers about each (`expect`).
function fixtures(copy, samples) {
  const by = new Map(), seeds = [];
  const of = name => by.get(name) || by.set(name, { entries: new Map(), declared: [], defects: 0 }).get(name);
  for (const { id, rule, want, s, file } of samples) {
    const check = CHECKS[rule.kind], name = family(rule), fx = of(name), own = copy.doc.units.filter(u => u.file === file);
    const mine = [...copy.questions, ...copy.advice].filter(q => q.family === name && own.some(u => u.id === q.unit)), aim = check.reader ? target(own, check, rule, s) : null;
    let planted = false;
    // A reader rule's text is shown whole, each of its sentences a unit like any other. A code rule's text shows the units it is about.
    for (const q of check.reader ? mine : mine.filter(x => x.items.some(i => designates(i.tag, s.item)))) {
      const entry = fx.entries.get(q.unit) || fx.entries.set(q.unit, { q, expect: {}, ...(s.avoid ? { avoid: s.avoid } : {}) }).get(q.unit);
      for (const i of q.items) if (check.reader ? q.unit === aim?.id && i.rule === rule.id : designates(i.tag, s.item)) { entry.expect[i.id] = { want, seed: id }; planted = true; }
    }
    if (!check.reader && s.item !== undefined) for (const q of copy.questions.filter(x => x.family === name && x.unit === 'document')) for (const i of q.items.filter(x => designates(x.tag, s.item))) { fx.declared.push({ ...i, want, seed: id }); planted = true; }
    if (planted && want === 'fail') fx.defects++;
    seeds.push({ id, rule: rule.id, family: name, want, status: planted ? 'planted' : 'unplanted', ...(planted ? {} : { note: 'in this manuscript the text does not reach the judge: code decides it, or its question is absent' }) });
  }
  return { by, seeds };
}
// Units in reading order -> blocks: the units of one paragraph under one set of headings stand together.
function blocks(entries) {
  const out = [];
  for (const e of entries) {
    const k = JSON.stringify([e.q.headings, e.q.context || e.q.unit, e.q.aside ?? {}]);
    if (out.at(-1)?.k === k) out.at(-1).entries.push(e); else out.push({ k, headings: e.q.headings, context: e.q.context, aside: e.q.aside ?? {}, entries: [e], ...(e.avoid ? { avoid: e.avoid } : {}) });
  }
  return out;
}
// The calls of one family, each with the family's planted texts at places fixed by `salt`, so that nothing in a call tells a
// planted block from the others. A unit judged in its paragraph shares a call with no other paragraph of the manuscript: a
// judge that sees two uses the one on the other (measured: design record), and the key of a verdict covers its own paragraph
// only. Units judged alone are put together, up to `size` a call.
function compose(name, need, fx, size, salt) {
  const real = blocks(need.map(q => ({ q, real: true }))), planted = blocks([...fx.entries.values()]), chunks = [];
  for (const b of real) { const last = chunks.at(-1); if (last && !b.context && !last[0].context && last.reduce((n, x) => n + x.entries.length, 0) + b.entries.length <= size) last.push(b); else chunks.push([b]); }
  return chunks.map((chunk, c) => {
    const order = [...chunk], draw = j => parseInt(sha(`${salt}:${name}:${c}:${j}`).slice(0, 8), 16), seeds = new Map();
    // A text made from a paragraph of the manuscript is not shown next to that paragraph.
    planted.forEach((b, j) => { if (!b.avoid || !chunk.some(x => x.context === b.avoid)) order.splice(draw(j) % (order.length + 1), 0, b); });
    let label = 0;
    const laid = order.map(b => ({ headings: b.headings, context: b.context, aside: b.aside, entries: b.entries.map(e => {
      const u = ++label, extra = e.real && e.q.unit === 'document' ? fx.declared : [];
      const mixed = [...e.q.items.map(i => ({ i, to: e.real ? i.id : null, plan: e.expect?.[i.id] })), ...extra.map(i => ({ i, to: null, plan: { want: i.want, seed: i.seed } }))];
      // The notation of the document is one unit: the planted declarations join its own, in an order fixed by the salt.
      const shown = extra.length ? mixed.map((m, j) => [draw(`d${j}`), m]).sort((x, y) => x[0] - y[0]).map(([, m], j) => ({ ...m, show: `item-${j + 1}` })) : mixed.map(m => ({ ...m, show: m.i.id }));
      const items = shown.map(m => ({ key: `u${u}-${m.show}`, show: m.show, to: m.to, rule: m.i.rule, tag: m.i.tag, q: m.i.q, ...(m.i.better ? { better: true } : {}), ...(m.plan ? { expect: m.plan.want, seed: m.plan.seed } : {}) }));
      for (const i of items) if (i.seed) seeds.set(i.seed, { id: i.seed, rule: i.rule, want: i.expect, keys: [...(seeds.get(i.seed)?.keys || []), i.key] });
      return { label: `U${u}`, unit: e.q.unit, key: e.q.key, real: !!e.real, text: e.q.text, ...(e.q.kind === 'paragraph' ? { whole: true } : {}), items };
    }) }));
    return { family: name, blocks: laid, seeds: [...seeds.values()], units: chunk.reduce((n, b) => n + b.entries.length, 0) };
  });
}

async function pool(items, size, work) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => { while (next < items.length) await work(items[next++]); }));
}
// One run of one judge over the questions in `need`.
async function run({ project, paper, slug, dir, writer, provider, model, settings = {}, need, list, check, batch, parallel, timeout, runner, gate, state, advice = false }) {
  const id = crypto.randomBytes(6).toString('hex'), base = path.join(dir, id), asked = [...new Set(need.map(q => q.family))], sources = check.sources ? { sources: check.sources } : {};
  const made = asked.includes('sentence-grounds') ? own(examine(project, paper, { corpus: check.corpus, ...sources }), state, id) : [];
  const planted = plant(list, new Set(asked), made), fx = fixtures(examine(project, paper, { corpus: check.corpus, ...(check.sources ? { sources: check.sources } : {}), extra: planted.extra }), planted.samples);
  // A family is asked only if a seeded defect of it can be planted in this manuscript: without one no call could be trusted.
  const covered = asked.filter(name => fx.by.get(name)?.defects), queue = covered.flatMap(name => compose(name, need.filter(q => q.family === name), fx.by.get(name), batch, id)).map((c, n) => ({ ...c, n: n + 1 }));
  const record = { version: 2, tool: JUDGE, id, slug, paper, writer, provider, requestedModel: model || null, ...(settings.model || settings.effort ? { configured: settings } : {}), models: [], gate, batch, ...(advice ? { advice: true } : {}), started: new Date().toISOString(), finished: null, state: 'running',
    seeds: fx.seeds, unseeded: asked.filter(name => !covered.includes(name)).sort(), calls: [] };
  const file = path.join(base, 'run.json'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hep-judge-'));
  const ask = async c => {
    const cdir = path.join(base, String(c.n).padStart(4, '0')), text = prompt(c), schema = shape(c), started = Date.now(), entries = c.blocks.flatMap(b => b.entries);
    const entry = { n: c.n, family: c.family, units: c.units, state: 'error', planted: [], answers: [], refused: [] };
    try {
      fs.mkdirSync(cdir, { recursive: true });
      fs.writeFileSync(path.join(cdir, 'prompt.txt'), text); writeJSON(path.join(cdir, 'schema.json'), schema);
      const call = invocation(provider, cdir, model || settings.model, { narrow: true, schema, effort: settings.effort });
      // `call` describes the questions for an injected judge (tests); the provider process receives the prompt only.
      await runner(call.command, call.args, { cwd: scratch, dir: cdir, prompt: text, timeout,
        call: { n: c.n, family: c.family, provider, entries: entries.map(e => ({ label: e.label, unit: e.unit, planted: !e.real, text: e.text, whole: !!e.whole, items: e.items.map(i => ({ key: i.key, id: i.show, rule: i.rule, tag: i.tag, better: !!i.better, expect: i.expect ?? null, seed: i.seed ?? null })) })) } });
      const got = collect(provider, cdir);
      Object.assign(entry, { session: got.sessionId, usage: got.usage });        // a refused answer was paid for as well
      for (const m of got.models) if (!record.models.includes(m)) record.models.push(m);
      const { ok, refused } = reading(c, got.value);
      // A unit's answers on a rule are kept when every question of that rule about it was answered.
      for (const e of entries.filter(x => x.real)) {
        const items = {};
        for (const rule of new Set(e.items.map(i => i.rule))) { const own = e.items.filter(i => i.rule === rule && i.to); if (own.length && own.every(i => ok[i.key])) for (const i of own) items[i.to] = { ...ok[i.key], rule }; }
        if (Object.keys(items).length) entry.answers.push({ unit: e.unit, key: e.key, items });
      }
      entry.planted = c.seeds.map(s => ({ id: s.id, rule: s.rule, want: s.want, met: s.keys.every(k => ok[k]?.v === s.want) }));
      entry.refused = Object.entries(refused).map(([key, why]) => ({ key, why }));
      entry.state = 'ok';
    } catch (e) { entry.error = e.message.slice(0, 400); }
    entry.ms = Date.now() - started;
    record.calls.push(entry);
    if (record.calls.length % 5 === 0) writeJSON(file, record);                 // a run cut short keeps the calls it has
  };
  try { writeJSON(file, record); await pool(queue, parallel, ask); record.state = 'done'; }
  catch (e) { record.state = 'failed'; record.error = e.message; }
  finally {
    record.calls.sort((a, b) => a.n - b.n);
    record.finished = new Date().toISOString();
    record.usage = record.calls.reduce((sum, c) => { for (const [k, v] of Object.entries(c.usage || {})) if (typeof v === 'number') sum[k] = (sum[k] || 0) + v; return sum; }, { calls: record.calls.length, ms: record.calls.reduce((n, c) => n + c.ms, 0) });
    writeJSON(file, record);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return record;
}

// Questions a run has to ask: a rule of them still needs a judge and the model of this run has not passed it, and (unless
// `all`) code finds nothing to fix in the unit first. For advice: the search for a better sentence, for the units whose
// verdicts have all passed.
function needed(result, { families, all, advice, model }) {
  const verdicts = q => Object.values(result.state.units[q.unit].checks).map(c => c.v), named = q => !families || families.includes(q.family);
  // A question that shows the outline waits until code finds nothing to fix in the outline of the document, of the Section and of the paragraph.
  const grounded = q => (q.needs || []).every(([unit, rule]) => { const c = result.state.units[unit]?.checks[rule]; return !c || c.by || !['fail', 'unjudged'].includes(c.v); });
  if (advice) return result.advice.filter(q => named(q) && (all || verdicts(q).every(v => v === 'pass')));
  return result.questions.filter(q => Object.values(q.lacks).some(passed => !passed.has(model ?? MODEL)) && named(q) && (all || (grounded(q) && (q.unit === 'document' || !verdicts(q).some(v => v === 'fail' || v === 'unjudged')))));
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
// Ask the judges what the manuscript still awaits. A run is one judge of the vendor that did not write it. Runs follow one
// another while a question is open and votes are added, at most twice the judges the manuscript requires: a text that
// passes needs one run for each. models: one model for each run in turn (provider default when empty). batch: units judged without their paragraph in one call. limit: only the
// first so many open questions, in this run and the following ones. all: also the units that a code check fails (for
// trials). dry: the plan without a call. advice: instead of a verification, one run of the search for a better sentence,
// whose replacements are returned and printed and change no verdict.
export async function judge(root, slug, paper = 'paper', { writer, models = [], batch = BATCH, parallel = 4, limit = Infinity, families, all = false, advice = false, dry = false, timeout = 1800000, runner = execute, build, corpus, sources } = {}) {
  if (process.env.HEP_REVIEW_CHILD) throw Error('Nested judge dispatch is prohibited');
  if (typeof slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(slug) || !/^paper[A-Za-z0-9_-]*$/.test(paper)) throw Error('Invalid project slug or paper directory');
  const project = safePath(root, `projects/${slug}`), who = writer ?? declaredWriter(project, paper);
  if (!VENDORS.includes(who)) throw Error('Name the vendor whose model wrote the manuscript with --writer claude or --writer codex: the judges are taken from the other vendor.');
  const provider = VENDORS.find(v => v !== who), dir = ledger(project, paper), lit = corpus ? corpus() : storedCorpus(root);
  // A call leaves the user's configuration out, so it is given the model and effort configured there. An injected judge (tests) reads none.
  const settings = runner === execute ? configured(provider) : {};
  const check = { ...(build ? { build } : {}), ...(sources ? { sources } : {}), corpus: () => lit, writer: who }, out = { slug, paper, writer: who, provider, runs: [], plan: null };
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, 'active.lock');
  acquire(lock);
  // Votes recorded so far: a run that adds none is not repeated in the same invocation.
  const votes = result => Object.values(result.state.units).reduce((n, u) => n + Object.values(u.checks).reduce((m, c) => m + (c.by?.runs.length || 0), 0), 0);
  try {
    for (let seat = 0, before = -1, only = null; ; seat++) {
      const result = verify(project, paper, { ...check, dry }), judges = result.state.independent.judges, model = models.length ? models[seat % models.length] : null;
      const need = needed(result, { families, all, advice, model }).filter(q => !only || only.has(`${q.unit}|${q.family}`)).slice(0, limit);
      if (seat >= (advice ? 1 : 2 * judges) || !need.length || votes(result) === before) break;
      before = votes(result);
      if (limit < Infinity) only ||= new Set(need.map(q => `${q.unit}|${q.family}`));          // a limit fixes the questions of the whole invocation
      if (dry) {
        const count = {};
        for (const q of need) count[q.family] = (count[q.family] || 0) + 1;
        out.plan = { questions: need.length, families: count, calls: new Set(need.map(q => q.context ? `${q.family}|${q.context}|${q.headings.join('>')}` : `${q.family}|${Math.floor(need.filter(x => x.family === q.family).indexOf(q) / batch)}`)).size,
          note: `the calls of one run of a judge: one for each paragraph and rule family, and one for every ${batch} units that are judged without their paragraph; each call carries the planted texts of its family${advice ? '; advice is one run and gives no verdict' : `, and a question needs ${judges === 1 ? 'one passing judge' : `${judges} passing judges of different models`}`}` };
        break;
      }
      out.runs.push(await run({ project, paper, slug, dir, writer: who, provider, model, settings, need, list: result.list, check, batch, parallel, timeout, runner, gate: result.state.hash, state: result.state, advice }));
    }
    out.result = verify(project, paper, { ...check, dry });
    // The replacements a judge wrote, from the calls in which it also improved the planted wordy sentence.
    if (advice) out.advice = out.runs.flatMap(r => r.calls.filter(c => c.state === 'ok' && c.planted.length && c.planted.every(p => p.met)).flatMap(c => c.answers.flatMap(a => Object.values(a.items).filter(x => x.v === 'fail')
      .map(x => ({ unit: a.unit, where: out.result.state.units[a.unit]?.where ?? null, at: out.result.state.units[a.unit]?.at ?? null, criterion: x.criterion, sentence: x.sentence, reason: x.reason })))));
  } finally { fs.rmSync(lock, { force: true }); }
  return out;
}
// What the runs did, for the report to the user.
export function summary(out) {
  const name = r => `${r.provider}, ${judgeModel(r.requestedModel, r.configured)}${r.models.length ? ` (reported: ${r.models.join(', ')})` : ''}`;
  const runs = out.runs.map(r => {
    if (r.state === 'failed') return `Run ${r.id} of the judges FAILED: ${r.error}`;
    const ok = r.calls.filter(c => c.state === 'ok'), tally = {}, use = Object.entries(r.usage).filter(([k]) => /tokens|cost/.test(k)).map(([k, v]) => `${k} ${v}`).join(', ');
    for (const c of ok) for (const p of c.planted) { const t = tally[p.rule] ||= [0, 0]; t[1]++; if (p.met) t[0]++; }
    const total = Object.values(tally).reduce((a, t) => [a[0] + t[0], a[1] + t[1]], [0, 0]), low = Object.entries(tally).filter(([, t]) => t[0] * FIT[1] < t[1] * FIT[0]).map(([rule]) => rule);
    const missed = ok.flatMap(c => c.planted.filter(p => !p.met).map(p => `${p.id} in call ${c.n}`)), lost = r.calls.filter(c => c.state !== 'ok'), refused = ok.reduce((n, c) => n + c.refused.length, 0);
    return [`Run ${r.id} of the judges${r.advice ? ', for advice and no verdict' : ''} (${name(r)}; writer ${r.writer}): ${r.calls.length} calls with ${r.calls.reduce((n, c) => n + c.units, 0)} units of the manuscript.`,
      `Planted texts answered as registered: ${total[0]} of ${total[1]}${total[1] ? ` (${Object.entries(tally).map(([rule, t]) => `${rule} ${t[0]}/${t[1]}`).join(', ')})` : ''}.`,
      ...(missed.length ? [`Missed: ${missed.join('; ')}. The answers of those calls on those rules are not used.`] : []),
      ...(low.length && !r.advice ? [`Below ${FIT[0]} in ${FIT[1]}, so none of this run's answers is used for: ${low.join(', ')}.`] : []),
      ...(lost.length ? [`${lost.length} calls failed (${[...new Set(lost.map(c => c.error))].join('; ').slice(0, 300)}).`] : []), ...(refused ? [`${refused} answers refused.`] : []),
      `${Math.round(r.usage.ms / 1000)} s of call time${use ? `, ${use}` : ''}.`,
      ...r.seeds.filter(s => s.status === 'unplanted').map(s => `Not planted: ${s.id} (${s.note}).`), ...(r.unseeded.length ? [`Not asked, no defect could be seeded for the family: ${r.unseeded.join(', ')}.`] : [])].join(' ');
  });
  const advice = out.advice ? [`Advice, no part of the verification: ${out.advice.length} better sentences were written under the ranked criteria. A replacement stands for what the judge could see, its paragraph: check a changed claim against the notes before taking it.`,
    ...out.advice.map(a => `- ${a.where ?? 'unit'}${a.at ? ` ${a.at}` : ''} unit ${a.unit}, criterion ${a.criterion} (${CRITERIA[a.criterion - 1]}): ${a.sentence} Reason: ${a.reason}`)] : [];
  return [...runs, ...advice, ...(out.plan ? [`Plan (no model was called): ${JSON.stringify(out.plan)}`] : []), ...(!out.runs.length && !out.plan ? [out.advice ? 'No sentence has passed every verdict yet: advice is asked for those that have.' : 'No question awaits a judge.'] : []), '', report(out.slug, out.result)].join('\n');
}
