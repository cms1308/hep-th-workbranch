// Manuscript verification, stages 1 and 2 of harness/design/paper-verification.md: registered
// rules with failing and passing texts, the checks decided by code (stage 2: terms and standard
// notation against the literature corpus), hash-bound verdicts in paper/VERIFY.json and the gate
// read by the Stop hook. Independent verdicts are stage 3.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { read, json, write, writeJSON, sha, safePath, run } from './core.mjs';
import { flatten, decompose, symbols, value, expand, numberWord } from './tex.mjs';
import { load as storedCorpus, fromTex, attest, key as gram, symbolPapers, ATTESTED } from './corpus.mjs';

export const TOOL = 1;                                   // raise when the decomposition or a check changes meaning: every verdict is judged again
const BASE = fileURLToPath(new URL('./rules.json', import.meta.url));
const R_MARK = '⟦R⟧', D_MARK = '⟦D⟧';
const DOCUMENT = { id: 'document', kind: 'document', role: 'document', where: 'document' };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const optional = file => fs.existsSync(file) ? json(file) : {};

const NOUN = '(?:sub)?sections?|figures?|tables?|equations?|appendix|appendices|chapters?';
const REFERENCE = [
  new RegExp(`\\b(?:${NOUN}|(?:secs?|figs?|eqs?|eqns?|tabs?|apps?)\\.?)\\s*(?:${R_MARK}|\\(?\\d|[A-Z]\\b)`),
  new RegExp(`\\b(?:[Tt]his|[Tt]hese|[Tt]he (?:following|previous|preceding|next|above|present))\\s+(?:${NOUN})\\b`),
  new RegExp(`\\b(?:${NOUN})\\s+(?:below|above)\\b`),
];
const COMMANDS = /^(?:\\[A-Za-z@]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})*\s*)+$/;

function close(a, d, decimals) {
  if (typeof d !== 'number') return false;
  return decimals === 0 ? a === d : decimals ? Math.abs(a - d) <= 0.5 * 10 ** -decimals * (1 + 1e-9) : Math.abs(a - d) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(d));
}
// Does the numeral of the manuscript agree with the value read from the calculation output?
export function agrees(n, data) {
  const d = typeof data === 'string' ? value(data) ?? data : data;
  if (n.value === null || d === null || d === undefined || typeof d === 'string') return String(d) === n.token;
  if (Array.isArray(n.value) || Array.isArray(d)) return Array.isArray(n.value) && Array.isArray(d) && n.value.length === d.length && n.value.every((x, i) => close(x, d[i], null));
  return close(n.value, d, n.decimals);
}
function factValue(fact, text) {
  if (fact.pointer !== undefined) return fact.pointer.split('/').slice(1).reduce((v, k) => v?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], JSON.parse(text));
  return fact.pattern ? new RegExp(fact.pattern, 'm').exec(text)?.[1] : text.trim();
}
// A table header repeated from the previous page with no row after it (a long table split badly).
export function strandedHeaders(pages) {
  const lines = pages.map(p => p.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l && !/^[–-]?\s*\d+\s*[–-]?$/.test(l)));
  const out = [];
  for (let i = 1; i < lines.length; i++) lines[i].forEach((l, j) => {
    const before = lines[i - 1].indexOf(l), next = lines[i][j + 1];
    if (!/[A-Za-z]{2}/.test(l) || before < 0 || lines[i - 1][before + 1] === undefined) return;   // a header has words; fragments of formulas repeat too
    if (next === undefined || /^Table \d+[.:]/.test(next)) out.push(`page ${i + 1}: the repeated table header "${l.slice(0, 60)}" stands without a row`);
  });
  return out;
}
export const overfull = log => [...log.matchAll(/^Overfull \\[hv]box \(([\d.]+pt) too (?:wide|high)\) (.*?)(?: at lines? [\d-]+)?$/gm)].map(m => `${m[1]} ${m[2].trim()}`);
// Default build: latexmk, then the page texts of the PDF.
export function build(project, paper) {
  const cwd = path.join(project, paper), tool = (name, args, timeout) => {
    try { return { out: run(process.env[`HEP_${name.toUpperCase()}_BIN`] || name, args, { cwd, timeout }) }; }
    catch (e) { return /ENOENT/.test(e.message) ? { unavailable: `${name} is not installed` } : { failed: `${name} failed: ${e.message.slice(-300)}` }; }
  };
  const made = tool('latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', 'main.tex'], 600000);
  if (!made.out && made.out !== '') return made;
  const pages = tool('pdftotext', ['-layout', 'main.pdf', '-'], 120000);
  if (!pages.out && pages.out !== '') return pages;
  return { log: fs.readFileSync(path.join(cwd, 'main.log'), 'latin1'), pages: pages.out.split('\f') };
}

function context(doc, { lexicon = {}, facts = {}, file, build: builder, baseline = null, corpus: source = () => null }) {
  const byId = new Map(doc.units.map(u => [u.id, u]));
  const unit = ref => byId.get(typeof ref === 'string' && ref.startsWith('label:') ? doc.labels[ref.slice(6)] : ref);
  const entries = lexicon.symbols || [], names = entries.map(e => e.symbol).filter(s => /^[A-Za-z]{2,}$/.test(s)), table = new Map();
  for (const e of entries) {
    const keys = names.includes(e.symbol) ? [e.symbol] : [...symbols([expand(e.symbol, doc.macros)], names)];
    if (keys.length !== 1) throw Error(`LEXICON symbol ${JSON.stringify(e.symbol)} must be one symbol; it reads as ${JSON.stringify(keys)}.`);
    table.set(keys[0], e);
  }
  const cache = new Map(), used = u => cache.get(u.id) || cache.set(u.id, symbols([...(u.math || []), ...(u.displays || [])], names)).get(u.id);
  const terms = (lexicon.terms || []).filter(t => t.at !== undefined).map(t => ({ ...t, re: new RegExp(`(?<![A-Za-z-])${esc(t.term).replace(/ /g, '\\s+')}(?:e?s)?(?![A-Za-z-])`, 'i') }));
  const uses = new Map(), orphans = [], capitals = new Set();
  for (const [k, v] of Object.entries(facts.uses || {})) { const u = unit(k); if (u) uses.set(u.id, v); else orphans.push(k); }
  for (const u of doc.units) if (u.kind === 'sentence') for (const w of u.prose.split(/\s+/).slice(1)) for (const part of w.split(/[-/–]/)) { const m = /^[("'[]*([A-Z][A-Za-z]*)/.exec(part); if (m) capitals.add(m[1]); }
  // Candidate terms of a unit: its hyphenated compounds and its pairs of adjacent content words, by corpus key.
  // A number word, a roman numeral and a possessive end a phrase: the word after them starts another ("Type III | theories", "fifteen | theories", "the node's | fixed point").
  const closes = w => numberWord(w) || /^[ivx]+$|['’]s?$/.test(w);
  const lex = (lexicon.terms || []).map(t => {
    const kind = ['at', 'approved', 'ordinary'].filter(k => t[k] !== undefined);
    if (kind.length !== 1 || !gram(String(t.term ?? ''))) throw Error(`LEXICON term ${JSON.stringify(t.term)} needs exactly one of at (its definition site), approved (the user's words and their date) or ordinary (why it is wording and not a term).`);
    return { term: t.term, kind: kind[0], key: ` ${gram(t.term)} ` };
  });
  const found = new Map(), occurs = new Map(), approved = new Set();
  const candidates = u => found.get(u.id) || found.set(u.id, (() => {
    const out = new Map();
    for (const run of u.terms || []) run.split(' ').forEach((w, i, ws) => {
      const show = t => t === run ? `"${t}"` : `"${t}" in "${run}"`;
      if (w.includes('-') && gram(w).includes(' ') && !numberWord(w)) out.set(gram(w), { text: show(w), compound: true });
      if (i && !closes(ws[i - 1])) out.set(gram(`${ws[i - 1]} ${w}`), { text: show(`${ws[i - 1]} ${w}`), parts: [ws[i - 1], w].filter(x => x.includes('-')).map(gram).filter(k => k.includes(' ')) });
    });
    return [...out].map(([key, c]) => ({ key, ...c }));
  })()).get(u.id);
  for (const u of doc.units) if (u.kind === 'sentence' || u.kind === 'title') for (const c of candidates(u)) occurs.set(c.key, (occurs.get(c.key) || 0) + 1);
  let built, read, counts;
  const corpus = () => read === undefined ? (read = source() ?? null) : read;
  const papers = k => corpus() ? (counts ||= attest(corpus(), occurs.keys())).get(k).papers : null;
  const ground = k => lex.find(t => t.key.includes(` ${k} `));
  // The ground of a candidate: attested, a LEXICON entry (its kind and term), or the finding with its corpus papers and its units in the manuscript.
  const status = c => {
    const n = papers(c.key), entry = ground(c.key);
    if (n >= ATTESTED) return ['attested'];
    if (entry?.kind === 'approved') approved.add(entry.term);
    return entry ? [entry.kind, entry.term] : n === null ? ['no-corpus'] : [c.compound ? 'compound' : occurs.get(c.key) > 1 ? 'recurrent' : 'once', n, occurs.get(c.key)];
  };
  const lone = k => papers(k) !== null && papers(k) < ATTESTED && !ground(k);          // a compound that is a finding by itself: the pairs containing it add nothing
  return { hash: doc.hash, unit, used, symbol: k => table.get(k), terms, uses, orphans, facts: facts.facts || {}, file, capitals, baseline, corpus, approved,
    term: u => candidates(u).filter(c => c.compound || !c.parts.some(lone)).map(c => [c.text, ...status(c)]),
    standard: [...table].filter(([, e]) => e.at === undefined).map(([k, e]) => [e.symbol, k]), symbolPapers: k => corpus() ? symbolPapers(corpus(), k) : null,
    build: () => built === undefined ? (built = builder()) : built };
}

const prose = u => u.kind === 'sentence';
const CHECKS = {
  banned: {
    units: (u, rule) => (u.kind === 'sentence' || u.kind === 'title') && (!rule.roles || rule.roles.includes(u.role)),
    judge(u, rule) { const hit = new RegExp(rule.pattern, rule.flags ?? 'i').exec(rule.in === 'tex' ? u.text : u.prose); return hit ? { fail: [`"${hit[0]}"`] } : {}; },
  },
  'reference-capital': {
    units: prose,
    judge(u) { return { fail: REFERENCE.map(re => re.exec(u.prose)?.[0]).filter(Boolean).map(hit => `"${hit}": a document reference starts with a capital letter`) }; },
  },
  'sentence-case-title': {
    units: u => u.kind === 'title',
    inputs(u, rule, ctx) {
      const kept = w => /[A-Z].*[A-Z]/.test(w) || /^[IVXLC]+$/.test(w) || w.length === 1 || ctx.capitals.has(w);
      return u.prose.split(/\s+/).map((raw, i) => [...raw.split(/[-/–]/).entries()].map(([j, part]) => {
        const w = /^[("'[]*([A-Za-z]*)/.exec(part)[1];
        return !w ? null : i + j === 0 ? (/^[a-z]/.test(w) && !/^[a-z]$/.test(w) ? `the first word "${w}" is not capitalized` : null) : /^[A-Z]/.test(w) && !kept(w) ? `"${w}" is capitalized in the title and nowhere in the running text` : null;
      })).flat().filter(Boolean);
    },
    judge: (u, rule, ctx, inputs) => ({ fail: inputs }),
  },
  'aside-punctuation': {
    units: prose,
    judge(u) {
      const p = u.prose, pending = [];
      for (const m of p.matchAll(/;|(?<!\d):(?!\d)/g)) {
        const rest = p.slice(m.index + 1).trim();
        if (m[0] === ';' || (rest && !rest.startsWith(D_MARK))) pending.push(`${m[0] === ';' ? 'semicolon' : 'colon'} at "${p.slice(Math.max(0, m.index - 30), m.index + 20)}": whether it is an aside needs the independent verdict`);
      }
      return { fail: /---|—/.test(p) ? ['an em-dash sets off an aside: use parentheses or split the sentence'] : [], pending };
    },
  },
  'hard-wrap': {
    units: u => u.kind === 'paragraph',
    judge(u) {
      return { fail: u.runs.map(run => run.filter(l => l.text.trim() && !COMMANDS.test(l.text.trim()))).filter(lines => lines.length > 1)
        .map(lines => `${lines[1].file}:${lines[1].line} prose is wrapped over ${lines.length} source lines ("${lines[1].text.trim().slice(0, 40)}")`) };
    },
  },
  'defined-before-use': {
    units: u => prose(u) || u.kind === 'document',
    inputs(u, rule, ctx) {
      if (u.kind === 'document') return ctx.standard.map(([symbol, k]) => [symbol, ctx.symbolPapers(k)]);
      const site = (name, e, has) => { const d = e?.at === undefined ? null : ctx.unit(e.at); return [name, !e ? 'none' : e.at === undefined ? 'standard' : !d ? 'lost' : !has(d) ? 'absent' : d.index > u.index ? `late ${d.where}` : 'ok', d?.id ?? null]; };
      return [...[...ctx.used(u)].sort().map(k => site(k, ctx.symbol(k), d => ctx.used(d).has(k))),
        ...ctx.terms.filter(t => t.re.test(u.prose)).map(t => site(`"${t.term}"`, t, d => t.re.test(d.prose)))];
    },
    judge(u, rule, ctx, inputs) {
      if (u.kind === 'document') {
        const list = pick => inputs.filter(([, n]) => pick(n)).map(([s]) => s).join(', '), none = n => n === null, known = n => n >= ATTESTED;
        return { unjudged: inputs.some(([, n]) => none(n)) ? [`standard notation cannot be attested, the corpus is not built (node harness/cli.mjs corpus-build): ${list(none)}`] : [],
          fail: inputs.filter(([, n]) => !none(n) && !known(n)).map(([s, n]) => `${s} is declared standard notation (corpus papers with it in their mathematics: ${n}): it needs a definition site`),
          pending: inputs.some(([, n]) => known(n)) ? [`declared standard notation, present in the corpus, its meaning needs the independent verdict: ${list(known)}`] : [] };
      }
      const text = { none: 'has no LEXICON entry (no definition site)', lost: 'has a definition site that is not in the manuscript', absent: 'does not occur at its definition site' };
      return { fail: inputs.filter(([, s]) => s !== 'ok' && s !== 'standard').map(([k, s]) => s.startsWith('late') ? `${k} is used before its definition at ${s.slice(5)}` : `${k} ${text[s]}`) };
    },
  },
  'number-bound': {
    units: prose,
    inputs(u, rule, ctx) {
      const uses = ctx.uses.get(u.id) || {};
      return u.numbers.map(n => {
        const id = uses[n.key], f = id === undefined ? null : ctx.facts[id];
        if (!f) return [n.key, id ?? null];
        if (f.file !== undefined) { const text = ctx.file(f.file); return [n.key, id, f, text === null ? null : sha(text), ctx.file(path.posix.join(path.posix.dirname(f.file), 'run.json'))]; }
        const d = ctx.unit(f.at);
        return [n.key, id, f, d?.id ?? null, d ? d.index <= u.index : null, d?.where];
      });
    },
    judge(u, rule, ctx, inputs) {
      const fail = [], pending = [];
      u.numbers.forEach((n, i) => {
        const [key, id, f, a, b, where] = inputs[i];
        if (!f) return fail.push(id === null ? `"${key}" is not bound to a fact` : `"${key}" is bound to the unknown fact ${id}`);
        if (f.file !== undefined) {
          if (a === null) return fail.push(`"${key}": ${f.file} of fact ${id} does not exist`);
          if (b !== null && JSON.parse(b).execution !== 'PASS') return fail.push(`"${key}": the evidence run of fact ${id} did not pass`);
          let data;
          try { data = factValue(f, ctx.file(f.file)); } catch (e) { return fail.push(`"${key}": fact ${id} cannot be read (${e.message})`); }
          if (!agrees(n, data)) fail.push(`"${key}" disagrees with fact ${id} = ${JSON.stringify(data)} (${f.file})`);
        } else if (a === null) fail.push(`"${key}": fact ${id} points to a unit that is not in the manuscript`);
        else if (!b) fail.push(`"${key}": fact ${id} points to ${where}, after this sentence`);
        else pending.push(`"${key}" is stated at ${where} (fact ${id}): whether that explains it needs the independent verdict`);
      });
      return { fail, pending };
    },
  },
  'term-attested': {
    units: u => u.kind === 'sentence' || u.kind === 'title',
    inputs: (u, rule, ctx) => ctx.term(u),
    judge(u, rule, ctx, inputs) {
      const of = kind => inputs.filter(([, k]) => k === kind), missing = of('no-corpus').map(([t]) => t), needs = 'needs attested wording, a definition site or the user\'s approval';
      return { unjudged: missing.length ? [`the corpus is not built (node harness/cli.mjs corpus-build): ${missing.join(', ')}`] : [],
        fail: [...of('compound').map(([t, , n]) => `${t} (corpus papers with or without the hyphen: ${n}) ${needs}`),
          ...of('recurrent').map(([t, , n, m]) => `${t} (corpus papers: ${n}, sentences or titles here: ${m}) ${needs}`)],
        pending: [...of('once').map(([t, , n]) => `${t} (corpus papers: ${n}) occurs once: whether it is a term needs the independent verdict`),
          ...of('ordinary').map(([t, , term]) => `${t} is declared ordinary wording (LEXICON "${term}"): the declaration needs the independent verdict`)] };
    },
  },
  build: {
    units: u => u.kind === 'document',
    inputs: (u, rule, ctx) => [ctx.hash, ctx.baseline],
    judge(u, rule, ctx) {
      const b = ctx.build();
      if (!b) return { unjudged: ['the manuscript was not built in this run'] };
      if (b.unavailable) return { unjudged: [b.unavailable] };
      if (b.failed) return { fail: [b.failed] };
      const known = [...(ctx.baseline?.overfull ?? [])], fresh = overfull(b.log).filter(x => { const i = known.indexOf(x); return i < 0 || !known.splice(i, 1); });
      return { fail: [...fresh.map(x => `new overfull box: ${x}`), ...strandedHeaders(b.pages),
        ...[...b.log.matchAll(/^LaTeX Warning: ((?:Reference|Citation) `[^']*').* undefined/gm)].map(m => `undefined: ${m[1]}`)] };
    },
  },
};

function outcome(check, u, rule, ctx) {
  const r = check.judge(u, rule, ctx, check.inputs?.(u, rule, ctx));
  const v = r.unjudged?.length ? 'unjudged' : r.fail?.length ? 'fail' : r.pending?.length ? 'pending' : 'pass';
  return v === 'pass' ? { v } : { v, e: r[v] };
}
// A rule is registered only if its check flags its failing texts and passes its passing texts.
function admit(rule) {
  const refuse = why => { throw Error(`Rule ${rule.id || JSON.stringify(rule).slice(0, 60)} refused: ${why}`); };
  if (!/^[a-z0-9-]+$/.test(rule.id || '')) refuse('the id must be lowercase letters, digits and hyphens');
  const check = CHECKS[rule.kind] || refuse(`unknown check kind ${rule.kind} (code checks: ${Object.keys(CHECKS).join(', ')}; a rule only a reader can judge waits for the independent verdict of stage 3)`);
  if (!rule.source) refuse('record where the rule comes from (document, decision or the user\'s words)');
  if (!rule.fail?.length || !rule.pass?.length) refuse('it needs at least one text that must fail and one that must pass');
  for (const want of ['fail', 'pass']) for (const sample of rule[want]) {
    const s = typeof sample === 'string' ? { tex: sample } : sample;
    const doc = decompose(s.tex.split('\n').map((text, i) => ({ file: 'sample', line: i + 1, text })));
    const ctx = context({ ...doc, hash: 'sample' }, { lexicon: s.lexicon, facts: s.facts, file: rel => s.files?.[rel] ?? null, build: () => s.build ?? null, baseline: s.baseline, corpus: () => s.corpus ? fromTex(s.corpus) : null });
    let seen;
    try { seen = [...doc.units, DOCUMENT].filter(u => check.units(u, rule)).map(u => outcome(check, u, rule, ctx).v); } catch (e) { refuse(`its check cannot run (${e.message})`); }
    if (want === 'fail' ? !seen.includes('fail') : seen.some(v => v !== 'pass')) refuse(`its check ${want === 'fail' ? 'does not flag the failing text' : 'does not pass the passing text'} ${JSON.stringify(s.tex).slice(0, 140)}`);
  }
  const { source, fail, pass, ...effective } = rule;
  return { ...rule, hash: sha(JSON.stringify(effective)) };
}
export function rules(project, paper = 'paper') {
  const all = [...json(BASE).rules, ...(optional(path.join(project, paper, 'RULES.json')).rules || [])];
  const twice = all.map(r => r.id).find((id, i, ids) => ids.indexOf(id) !== i);
  if (twice) throw Error(`Rule ${twice} is registered twice.`);
  return all.map(admit);
}

const part = (project, paper, name) => { const file = path.join(project, paper, name); return fs.existsSync(file) ? read(file) : ''; };
// source: the manuscript sources; gate: everything a verdict was computed from (except calculation outputs and the corpus, read at verification).
export function fingerprint(project, paper = 'paper') {
  const flat = flatten(project, `${paper}/main.tex`);
  return { flat, source: flat.hash, gate: sha(JSON.stringify([TOOL, flat.hash, read(BASE), ...['RULES.json', 'LEXICON.json', 'FACTS.json'].map(n => part(project, paper, n))])) };
}
const stateFile = (project, paper) => path.join(project, paper, 'VERIFY.json');
const serialize = ({ units, ...head }) => JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "units": {\n${Object.entries(units).map(([id, u]) => `    ${JSON.stringify(id)}: ${JSON.stringify(u)}`).join(',\n')}\n  }\n}\n`);

// Judge every (unit, rule) pair whose content or dependencies changed; keep the other verdicts.
export function verify(project, paper = 'paper', { build: builder = () => build(project, paper), corpus = () => storedCorpus(path.resolve(project, '..', '..')), wip, now = new Date() } = {}) {
  const print = fingerprint(project, paper), doc = { ...decompose(print.flat.lines), hash: print.source };
  const old = fs.existsSync(stateFile(project, paper)) ? json(stateFile(project, paper)) : null, list = rules(project, paper);
  const ctx = context(doc, { lexicon: optional(path.join(project, paper, 'LEXICON.json')), facts: optional(path.join(project, paper, 'FACTS.json')), build: builder, corpus, baseline: old?.baseline ?? null,
    file: rel => { const file = safePath(project, rel); return fs.existsSync(file) ? read(file) : null; } });
  const id = crypto.randomBytes(4).toString('hex'), units = {};
  // Enrollment: the overfull boxes of the first build are the baseline against which later ones are new.
  if (!ctx.baseline) { const first = ctx.build(); if (first?.log !== undefined) ctx.baseline = { overfull: overfull(first.log) }; }
  let judged = 0, total = 0;
  for (const u of [...doc.units, { ...DOCUMENT, id: 'document' }]) {
    const checks = {};
    for (const rule of list) {
      const check = CHECKS[rule.kind];
      if (!check.units(u, rule)) continue;
      const k = sha(JSON.stringify([TOOL, rule.hash, u.kind === 'document' ? '' : u.id.split('~')[0], check.inputs?.(u, rule, ctx) ?? null])).slice(0, 16), prior = old?.units?.[u.id]?.checks?.[rule.id];
      total++;
      if (prior?.k === k && prior.v !== 'unjudged') { checks[rule.id] = prior; continue; }
      judged++;
      checks[rule.id] = { ...outcome(check, u, rule, ctx), k, r: id };
    }
    if (Object.keys(checks).length) units[u.id] = { kind: u.kind, where: u.where, ...(u.file ? { at: `${u.file}:${u.line}` } : {}), checks };
  }
  const tally = list.map(rule => Object.values(units).reduce((c, u) => (u.checks[rule.id] && c[u.checks[rule.id].v]++, c), { id: rule.id, kind: rule.kind, pass: 0, fail: 0, pending: 0, unjudged: 0 }));
  const sentences = doc.units.filter(prose), lit = ctx.corpus(), open = Object.entries(units).flatMap(([unit, u]) => Object.entries(u.checks).filter(([, c]) => c.v === 'fail' || c.v === 'unjudged').map(([rule, c]) => ({ unit, rule, where: u.where, at: u.at, verdict: c.v, evidence: c.e })));
  const state = { version: 1, tool: TOOL, paper, hash: print.gate, source_hash: print.source, run: { id, time: now.toISOString(), judged, total }, complete: !open.length,
    counts: { sentences: sentences.length, paragraphs: doc.units.filter(u => u.kind === 'paragraph').length, titles: doc.units.filter(u => u.kind === 'title').length,
      numbers: sentences.reduce((n, u) => n + u.numbers.length, 0), symbols: new Set(sentences.flatMap(u => [...ctx.used(u)])).size, terms: new Set(sentences.flatMap(u => u.terms)).size },
    rules: tally, orphans: ctx.orphans, baseline: ctx.baseline, corpus: lit && { hash: lit.hash, cutoff: lit.cutoff, documents: lit.documents, words: lit.words, built: lit.built }, approved: [...ctx.approved].sort(),
    wip: wip ? { hash: print.gate, declared: now.toISOString(), note: wip, units: open.map(({ unit, rule, where }) => ({ unit, rule, where })) } : old?.wip?.hash === print.gate ? old.wip : null, units };
  write(stateFile(project, paper), serialize(state));
  return { state, open };
}

const LIMITS = 'Not judged at this stage: the meaning of a sentence, a paragraph, a Section and the document (independent verdict, stage 3 and 4); single words and the wording of a phrase beyond its adjacent word pairs and hyphenated compounds; numerals in display equations and table cells; one, ordinals and comparisons with zero; indices of symbols.';
// The completion report: the only evidence of verification that a report to the user may cite.
export function report(slug, { state, open }, { pending = false } = {}) {
  const c = state.counts, rows = state.rules.map(r => `| ${r.id} | ${r.pass} | ${r.fail} | ${r.pending} | ${r.unjudged} |`);
  const waiting = state.rules.reduce((n, r) => n + r.pending, 0);
  const listed = pending ? Object.entries(state.units).flatMap(([unit, u]) => Object.entries(u.checks).filter(([, x]) => x.v === 'pending').map(([rule, x]) => ({ unit, rule, where: u.where, at: u.at, verdict: 'pending', evidence: x.e }))) : [];
  const line = f => `- [${f.rule}] ${f.where}${f.at ? ` ${f.at}` : ''} unit ${f.unit} (${f.verdict}): ${(f.evidence || []).join('; ')}`;
  return [`Manuscript verification: projects/${slug}/${state.paper}, ${state.run.time}, run ${state.run.id}`,
    `Source ${state.source_hash.slice(0, 12)}. Judged in this run: ${state.run.judged} of ${state.run.total} verdicts (the rest unchanged since an earlier run).`,
    `Units: ${c.sentences} sentences, ${c.paragraphs} paragraphs, ${c.titles} titles, ${c.numbers} numerals, ${c.symbols} symbols, ${c.terms} candidate terms.`, '',
    '| rule | pass | fail | awaiting independent verdict | not judged |', '| --- | ---: | ---: | ---: | ---: |', ...rows, '',
    state.corpus ? `Corpus: ${state.corpus.documents} hep-th papers, ${state.corpus.words} words, inspected sources dated before ${state.corpus.cutoff} (${state.corpus.hash.slice(0, 12)}).` : 'Corpus: not built (node harness/cli.mjs corpus-build).',
    ...(state.approved.length ? [`Terms that pass on the user's approval recorded in LEXICON: ${state.approved.join('; ')}.`] : []),
    'Independent verdicts, seeded defects and judging models: not implemented (stage 3).', LIMITS,
    ...(state.orphans.length ? [`FACTS uses that match no sentence of the manuscript: ${state.orphans.join(', ')}`] : []),
    state.complete ? `Status: code checks complete, no failure${waiting ? `; ${waiting} verdicts await the independent verdict` : ''}.` : `Status: INCOMPLETE, ${open.filter(f => f.verdict === 'fail').length} failing and ${open.filter(f => f.verdict === 'unjudged').length} not judged.`,
    ...(state.wip ? [`Work in progress declared ${state.wip.declared}: ${state.wip.note} (${state.wip.units.length} unverified verdicts, listed below; report them to the user).`] : []),
    ...open.map(line), ...listed.map(line)].join('\n');
}

// Enrolled manuscripts: a paper directory holding VERIFY.json. Nothing else is gated.
export function enrolled(root) {
  const projects = path.join(root, 'projects');
  if (!fs.existsSync(projects)) return [];
  return fs.readdirSync(projects).flatMap(slug => { const dir = path.join(projects, slug); return !fs.statSync(dir).isDirectory() ? [] : fs.readdirSync(dir).filter(n => n.startsWith('paper') && fs.existsSync(path.join(dir, n, 'VERIFY.json'))).map(paper => ({ slug, paper, project: dir })); });
}
export function standing(project, paper) {
  try {
    const state = json(stateFile(project, paper)), print = fingerprint(project, paper), current = state.hash === print.gate;
    return { source: print.source, verified: current && state.complete, wip: state.wip?.hash === print.gate, open: current ? state.rules.reduce((n, r) => n + r.fail + r.unjudged, 0) : null };
  } catch (e) { return { source: null, verified: false, wip: false, open: null, error: e.message }; }
}
// For the queue: manuscript directories among the queued files that are enrolled and not verified.
export function unverified(root, repoName, files) {
  const dirs = new Set();
  for (const name of files) {
    const parts = path.join(repoName, name).split(path.sep).filter(p => p !== '.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (!parts[i].startsWith('paper') || !fs.existsSync(path.join(root, ...parts.slice(0, i + 1), 'VERIFY.json'))) continue;
      if (!standing(path.join(root, ...parts.slice(0, i)), parts[i]).verified) dirs.add(parts.slice(0, i + 1).join('/'));
    }
  }
  return [...dirs];
}

const sessionDir = (root, input) => path.join(root, '.harness-local', 'verify-sessions', String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_'));
const mark = (dir, m, kind) => path.join(dir, `${m.slug}--${m.paper}.${kind}`);
const sourceOf = m => { try { return flatten(m.project, `${m.paper}/main.tex`).hash; } catch { return 'unreadable'; } };
const names = (text, m) => new RegExp(`projects/${esc(m.slug)}/${esc(m.paper)}(?![\\w-])`).test(text) || (text.includes(m.slug) && new RegExp(`(?<![\\w./-])${esc(m.paper)}(?![\\w-])`).test(text));
// PreToolUse and PostToolUse of a shell or editing tool. A session has changed an enrolled manuscript
// when its sources differ across one of the session's own tool calls and a tool input of the session
// has named it. Sessions working elsewhere are never held to account for it.
export function toolEvent(root, input) {
  const list = enrolled(root);
  if (!list.length) return;
  const dir = sessionDir(root, input), text = JSON.stringify(input.tool_input ?? '').replace(/\\+/g, '/'), call = String(input.tool_use_id || 'call').replace(/[^A-Za-z0-9_-]/g, '_');
  for (const m of list) {
    const before = mark(dir, m, `pre-${call}`), source = sourceOf(m);
    if (names(text, m)) write(mark(dir, m, 'aware'), '');
    if (input.hook_event_name === 'PreToolUse') write(before, source);
    else if (fs.existsSync(before)) {
      if (read(before) !== source && fs.existsSync(mark(dir, m, 'aware'))) write(mark(dir, m, 'touched'), '');
      fs.rmSync(before);
    }
  }
}
export const BLOCK_LIMIT = 3;
// Stop: a manuscript this session changed must be verified or declared work in progress.
export function stopGate(root, input) {
  const dir = sessionDir(root, input), blocks = [], notes = [];
  if (!fs.existsSync(dir)) return { block: '', notes };
  const file = path.join(dir, 'blocked.json'), blocked = fs.existsSync(file) ? json(file) : {};
  for (const m of enrolled(root)) {
    const key = `${m.slug}/${m.paper}`, now = standing(m.project, m.paper), source = sourceOf(m);
    for (const name of fs.readdirSync(dir).filter(n => n.startsWith(`${m.slug}--${m.paper}.pre-`))) {          // a call that failed or was interrupted reported no end
      if (read(path.join(dir, name)) !== source && fs.existsSync(mark(dir, m, 'aware'))) write(mark(dir, m, 'touched'), '');
      fs.rmSync(path.join(dir, name));
    }
    if (!fs.existsSync(mark(dir, m, 'touched'))) continue;
    const tried = blocked[key]?.source === source ? blocked[key].count : 0;
    if (!now.verified && !now.wip && tried < BLOCK_LIMIT) {
      blocked[key] = { source, count: tried + 1 };
      blocks.push(`projects/${key} was changed in this session and is not verified${now.error ? ` (${now.error})` : now.open === null ? ' (no verification of its current text)' : ` (${now.open} failing or unjudged verdicts)`}. Run \`node harness/cli.mjs paper-verify ${m.slug} ${m.paper}\`, fix what it lists and run it again; or declare work in progress with \`--wip "<reason>"\` and give the user the list of unverified units it prints. Do not report the manuscript as finished. (block ${tried + 1} of ${BLOCK_LIMIT})`);
      continue;
    }
    if (!now.verified) notes.push(now.wip ? `Manuscript projects/${key}: work in progress declared, verification incomplete.` : `Manuscript projects/${key} ends this turn UNVERIFIED after ${BLOCK_LIMIT} blocks.`);
    fs.rmSync(mark(dir, m, 'touched'));
    delete blocked[key];
  }
  writeJSON(file, blocked);
  return { block: blocks.join('\n'), notes };
}
