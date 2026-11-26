// Manuscript verification, stages 1 to 3 of harness/design/paper-verification.md: registered
// rules with failing and passing texts, the checks decided by code (stage 2: terms and standard
// notation against the literature corpus), hash-bound verdicts in paper/VERIFY.json and the gate
// read by the Stop hook. Stage 3: what only a reader can decide becomes a question to independent
// judges (harness/judge.mjs runs them); their answers count only through the run records the CLI
// keeps under .harness-local/verdicts/, and VERIFY.json counts only as the CLI wrote it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { read, json, write, writeJSON, sha, safePath, run } from './core.mjs';
import { flatten, decompose, symbols, value, expand, numberWord } from './tex.mjs';
import { load as storedCorpus, fromTex, attest, key as gram, symbolPapers, ATTESTED } from './corpus.mjs';

export const TOOL = 1;                                   // raise when the decomposition or a check changes meaning: every verdict is judged again
export const JUDGE = 2;                                  // raise when a question, the prompt, the schema or the reading of an answer changes: every independent verdict is asked again
export const JUDGES = 1;                                 // judges that must pass a question unless the manuscript's RULES.json asks for more ("judges": n); one failing judge fails it
export const FIT = [9, 10];                              // share of a rule's planted texts a run must answer as registered for its answers on that rule to count
export const SHORTER = [4, 5];                           // a replacement that is only shorter counts when it has at most this share of the unit's words
// Ranked criteria of "better" (user decision 2026-11-25). The eighth: on a tie the existing sentence stays. Since 2026-11-26 the
// search for a better sentence gives advice on request and no verdict (user decision, on its measured behavior).
export const CRITERIA = ['physical and mathematical correctness', "the user's decisions", 'harness rules', 'completeness of the information the argument needs', 'no redundancy', 'terminology attested in the literature', 'the shorter text'];
const AWAIT = 'awaits the independent verdict';
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
    return { term: t.term, kind: kind[0], key: ` ${gram(t.term)} `, note: String(t[kind[0]]) };
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
    return entry ? [entry.kind, entry.term, ...(entry.kind === 'ordinary' ? [entry.note] : [])] : n === null ? ['no-corpus'] : [c.compound ? 'compound' : occurs.get(c.key) > 1 ? 'recurrent' : 'once', n, occurs.get(c.key)];
  };
  const lone = k => papers(k) !== null && papers(k) < ATTESTED && !ground(k);          // a compound that is a finding by itself: the pairs containing it add nothing
  return { hash: doc.hash, unit, used, symbol: k => table.get(k), terms, uses, orphans, facts: facts.facts || {}, file, capitals, baseline, corpus, approved,
    term: u => candidates(u).filter(c => c.compound || !c.parts.some(lone)).map(c => [c.text, ...status(c)]),
    standard: [...table].filter(([, e]) => e.at === undefined).map(([k, e]) => [e.symbol, k, typeof e.standard === 'string' ? e.standard : null]), symbolPapers: k => corpus() ? symbolPapers(corpus(), k) : null,
    first: k => doc.units.find(u => u.kind === 'sentence' && used(u).has(k)) ?? null, papers: () => corpus()?.documents ?? 0,
    build: () => built === undefined ? (built = builder()) : built };
}

const prose = u => u.kind === 'sentence';
export const CHECKS = {
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
      const p = u.prose, pending = [], ask = [];
      for (const m of p.matchAll(/;|(?<!\d):(?!\d)/g)) {
        const rest = p.slice(m.index + 1).trim(), name = m[0] === ';' ? 'semicolon' : 'colon', near = p.slice(Math.max(0, m.index - 30), m.index + 20);
        if (m[0] !== ';' && (!rest || rest.startsWith(D_MARK))) continue;
        pending.push(`${name} at "${near}": whether it is an aside needs the independent verdict`);
        ask.push({ tag: near, q: `The ${name} in "${near}" (in this excerpt a formula, a reference or a citation of the unit appears as a mark in double brackets). Pass if it introduces a list, an equation, a definition or an explanation that the sentence needs, or joins two statements that belong in one sentence. Fail if what it sets off is an aside, which belongs in parentheses or in a sentence of its own.` });
      }
      return { fail: /---|—/.test(p) ? ['an em-dash sets off an aside: use parentheses or split the sentence'] : [], pending, ask };
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
      if (u.kind === 'document') return ctx.standard.map(([symbol, k, meaning]) => [symbol, ctx.symbolPapers(k), meaning, ctx.first(k)?.id ?? null]);
      const site = (name, e, has) => { const d = e?.at === undefined ? null : ctx.unit(e.at); return [name, !e ? 'none' : e.at === undefined ? 'standard' : !d ? 'lost' : !has(d) ? 'absent' : d.index > u.index ? `late ${d.where}` : 'ok', d?.id ?? null]; };
      return [...[...ctx.used(u)].sort().map(k => site(k, ctx.symbol(k), d => ctx.used(d).has(k))),
        ...ctx.terms.filter(t => t.re.test(u.prose)).map(t => site(`"${t.term}"`, t, d => t.re.test(d.prose)))];
    },
    judge(u, rule, ctx, inputs) {
      if (u.kind === 'document') {
        const list = pick => inputs.filter(([, n]) => pick(n)).map(([s]) => s).join(', '), none = n => n === null, known = n => n >= ATTESTED;
        return { unjudged: inputs.some(([, n]) => none(n)) ? [`standard notation cannot be attested, the corpus is not built (node harness/cli.mjs corpus-build): ${list(none)}`] : [],
          fail: inputs.filter(([, n]) => !none(n) && !known(n)).map(([s, n]) => `${s} is declared standard notation (corpus papers with it in their mathematics: ${n}): it needs a definition site`),
          pending: inputs.some(([, n]) => known(n)) ? [`declared standard notation, present in the corpus, its meaning needs the independent verdict: ${list(known)}`] : [],
          ask: inputs.filter(([, n]) => known(n)).map(([s, , meaning, first]) => ({ tag: s, q: `The manuscript declares $${s}$ standard notation that needs no definition${meaning ? `, with the meaning "${meaning}"` : ', and states no meaning'}. ${first ? `Its first use in the manuscript: «${ctx.unit(first).text}».` : 'No sentence of the manuscript uses it.'} Pass if hep-th papers commonly use this symbol with this meaning without defining it, and the manuscript uses it with that meaning. Fail otherwise.` })) };
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
      const fail = [], pending = [], ask = [];
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
        else {
          pending.push(`"${key}" is stated at ${where} (fact ${id}): whether that explains it needs the independent verdict`);
          ask.push({ tag: key, q: `The numeral "${key}" of the unit is bound to this earlier statement of the manuscript: «${ctx.unit(f.at).text}». Pass if that statement states this number, or fixes it directly, for the same quantity. Fail if the number differs from it, counts something else, or is not explained there.` });
        }
      });
      return { fail, pending, ask };
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
          ...of('ordinary').map(([t, , term]) => `${t} is declared ordinary wording (LEXICON "${term}"): the declaration needs the independent verdict`)],
        ask: [...of('once').map(([t, , n]) => ({ tag: t, q: `${t} occurs once in the manuscript and in ${n} of the ${ctx.papers()} papers of the literature corpus. Pass if it is ordinary wording read literally (for example a subject and its verb, or an adjective and its noun). Fail if it is used as a technical term or as a label, which needs attestation in the literature or a definition.` })),
          ...of('ordinary').map(([t, , term, note]) => ({ tag: t, q: `The author declares "${term}" ordinary wording and not a term, with the reason "${note}". Pass if ${t} is ordinary wording read literally in the unit. Fail if it is used there as a technical term or as a label coined for this manuscript.` }))] };
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
  // Kinds that only a reader can decide: no code verdict, one question to the independent judges for each sentence.
  judge: { reader: true, units: (u, rule) => prose(u) && (!rule.roles || rule.roles.includes(u.role)), ask: rule => rule.question },
  better: { reader: true, advice: true, units: (u, rule) => prose(u) && (!rule.roles || rule.roles.includes(u.role)), ask: () => 'Can you write a sentence that is strictly better than the unit under the ranked criteria stated above?' },
};
// The rule family of one call to a judge: a reader rule joins the family it names (default "content"); a code rule and the search for a better sentence (advice, no verdict) are families of their own.
export const family = rule => rule.kind === 'judge' ? rule.family ?? 'content' : rule.id;
// The items of a question that a sample or a seeded defect designates: by the numeral, the symbol, or the quoted phrase the item is about.
export const designates = (tag, item) => item === undefined || tag === item || tag.startsWith(`"${item}"`);
// The sentence of a sample that a reader rule is tested on: the one containing `at`, the last one without it.
export function target(units, check, rule, s) {
  const found = units.filter(u => check.units(u, rule) && (s.at === undefined || u.text.includes(s.at) || u.prose.includes(s.at)));
  return s.at === undefined ? found.at(-1) ?? null : found.length === 1 ? found[0] : null;
}

function outcome(check, u, rule, ctx) {
  const r = check.judge(u, rule, ctx, check.inputs?.(u, rule, ctx));
  const v = r.unjudged?.length ? 'unjudged' : r.fail?.length ? 'fail' : r.pending?.length ? 'pending' : 'pass';
  return { ...(v === 'pass' ? { v } : { v, e: r[v] }), ...(v === 'pending' ? { ask: r.ask || [] } : {}) };
}
const sample = s => typeof s === 'string' ? { tex: s } : s;
const lines = (tex, file = 'sample') => tex.split('\n').map((text, i) => ({ file, line: i + 1, text }));
// A rule is registered only if its check flags its failing texts and passes its passing texts. A rule that only a
// reader can judge has no code check: its failing texts are the defects seeded into every run of the judges and its
// passing texts are the texts a judge must leave alone, so that every run repeats the registration test (harness/judge.mjs).
function admit(rule) {
  const refuse = why => { throw Error(`Rule ${rule.id || JSON.stringify(rule).slice(0, 60)} refused: ${why}`); };
  if (!/^[a-z0-9-]+$/.test(rule.id || '')) refuse('the id must be lowercase letters, digits and hyphens');
  const kinds = reader => Object.keys(CHECKS).filter(k => !CHECKS[k].reader === !reader).join(', ');
  const check = CHECKS[rule.kind] || refuse(`unknown check kind ${rule.kind} (decided by code: ${kinds(false)}; decided by the independent verdict: ${kinds(true)})`);
  if (!rule.source) refuse('record where the rule comes from (document, decision or the user\'s words)');
  // The search for a better sentence has failing texts only: no text is beyond improvement by registration.
  if (rule.kind === 'better' ? !rule.fail?.length || rule.pass !== undefined : !rule.fail?.length || !rule.pass?.length) refuse(rule.kind === 'better' ? 'it needs at least one text that a judge must improve, and takes no passing text: no text is beyond improvement by registration' : 'it needs at least one text that must fail and one that must pass');
  const probe = (s, corpus) => { const doc = decompose(lines(s.tex)); return { doc, ctx: context({ ...doc, hash: 'sample' }, { lexicon: s.lexicon, facts: s.facts, file: rel => s.files?.[rel] ?? null, build: () => s.build ?? null, baseline: s.baseline, corpus }) }; };
  const shown = s => JSON.stringify(s.tex).slice(0, 140);
  if (check.reader) {
    if (rule.kind === 'judge' && !(typeof rule.question === 'string' && rule.question.trim())) refuse('a rule judged by a reader needs its question: what passes and what fails');
    if (!/^[a-z0-9-]+$/.test(family(rule))) refuse('the family must be lowercase letters, digits and hyphens');
    for (const want of ['fail', 'pass']) for (const s of (rule[want] ?? []).map(sample)) {
      if (!/^\s*\\section\*?\s*\{/.test(s.tex ?? '')) refuse(`its ${want}ing text must open with its own \\section heading, since a judge sees the headings above every unit: ${shown(s)}`);
      if (!target(decompose(lines(s.tex)).units, check, rule, s)) refuse(`its ${want}ing text has ${s.at === undefined ? 'no sentence the rule applies to' : `no single sentence containing ${JSON.stringify(s.at)}`}: ${shown(s)}`);
    }
  } else {
    for (const want of ['fail', 'pass']) for (const s of rule[want].map(sample)) {
      let seen;
      try { const { doc, ctx } = probe(s, () => s.corpus ? fromTex(s.corpus) : null); seen = [...doc.units, DOCUMENT].filter(u => check.units(u, rule)).map(u => outcome(check, u, rule, ctx).v); } catch (e) { refuse(`its check cannot run (${e.message})`); }
      if (want === 'fail' ? !seen.includes('fail') : seen.some(v => v !== 'pass')) refuse(`its check ${want === 'fail' ? 'does not flag the failing text' : 'does not pass the passing text'} ${shown(s)}`);
    }
    // What the code check leaves to a reader is tested on the judges by the rule's judge samples: each must reach the independent verdict.
    if (rule.judge && (!rule.judge.fail?.length || !rule.judge.pass?.length)) refuse('its judge samples need at least one text that must fail and one that must pass');
    for (const want of ['fail', 'pass']) for (const s of (rule.judge?.[want] ?? []).map(sample)) {
      let reached;
      try { const { doc, ctx } = probe(s, () => fromTex(s.corpus || [])); reached = [...doc.units, DOCUMENT].filter(u => check.units(u, rule)).some(u => { const o = outcome(check, u, rule, ctx); return o.v === 'pending' && o.ask.some(a => designates(a.tag, s.item)); }); } catch (e) { refuse(`its judge sample cannot be read (${e.message})`); }
      if (!reached) refuse(`its judge sample does not reach the independent verdict (the code check must leave ${s.item === undefined ? 'a question' : JSON.stringify(s.item)} awaiting it): ${shown(s)}`);
    }
  }
  const { source, fail, pass, judge, ...effective } = rule;
  return { ...rule, hash: sha(JSON.stringify(effective)) };
}
export function rules(project, paper = 'paper') {
  const all = [...json(BASE).rules, ...(optional(path.join(project, paper, 'RULES.json')).rules || [])];
  const twice = all.map(r => r.id).find((id, i, ids) => ids.indexOf(id) !== i);
  if (twice) throw Error(`Rule ${twice} is registered twice.`);
  const list = all.map(admit), own = new Set(list.filter(r => r.kind !== 'judge').map(r => r.id)), clash = list.find(r => r.kind === 'judge' && own.has(family(r)));
  if (clash) throw Error(`Rule ${clash.id} refused: its family ${family(clash)} is the id of a rule that is a family of its own.`);
  return list;
}

const part = (project, paper, name) => { const file = path.join(project, paper, name); return fs.existsSync(file) ? read(file) : ''; };
// source: the manuscript sources; gate: everything a verdict was computed from (except calculation outputs, the corpus and the run records of the judges, read at verification).
export function fingerprint(project, paper = 'paper') {
  const flat = flatten(project, `${paper}/main.tex`);
  return { flat, source: flat.hash, gate: sha(JSON.stringify([TOOL, JUDGE, flat.hash, read(BASE), ...['RULES.json', 'LEXICON.json', 'FACTS.json'].map(n => part(project, paper, n))])) };
}
const stateFile = (project, paper) => path.join(project, paper, 'VERIFY.json');
const serialize = ({ units, ...head }) => JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "units": {\n${Object.entries(units).map(([id, u]) => `    ${JSON.stringify(id)}: ${JSON.stringify(u)}`).join(',\n')}\n  }\n}\n`);
// Run metadata of the CLI, local to this computer and never committed: the seal of its last VERIFY.json and one directory for each run of the judges.
export const ledger = (project, paper) => path.resolve(project, '..', '..', '.harness-local', 'verdicts', path.basename(project), paper);
const sealFile = (project, paper) => path.join(ledger(project, paper), 'seal.json');
// VERIFY.json counts only as the CLI wrote it: its bytes must be the ones whose hash the CLI recorded at its last write.
function sealed(project, paper) {
  try { return json(sealFile(project, paper)).file === sha(read(stateFile(project, paper))); } catch { return false; }
}
// The vendor whose model wrote the manuscript, as last declared to the CLI on this computer, or null.
export function declaredWriter(project, paper) {
  try { return json(sealFile(project, paper)).writer ?? null; } catch { return null; }
}

// Every (unit, rule): the code verdict, or a placeholder for a rule only a reader can judge; and the questions put to the judges,
// one for each unit and rule family. The key of a question covers all that a judge is shown and asked. `advice`: the questions of
// the search for a better sentence, which give no verdict and are asked on request only.
function assess(doc, ctx, list, prior = () => undefined, run = null) {
  const units = {}, questions = [], advice = [], heads = [], byId = new Map(doc.units.map(u => [u.id, u])), reading = new Set(list.filter(r => CHECKS[r.kind].reader).map(family));
  let judged = 0, total = 0;
  for (const u of [...doc.units, { ...DOCUMENT }]) {
    const above = heads.slice(1, u.kind === 'title' ? Math.max(u.level, 1) : undefined).filter(Boolean), checks = {}, asked = new Map(), wished = new Map();
    if (u.kind === 'title' && u.level > 0) { heads.length = u.level; heads[u.level] = u.prose; }
    for (const rule of list) {
      const check = CHECKS[rule.kind];
      if (!check.units(u, rule)) continue;
      if (check.advice) { wished.set(family(rule), [{ id: rule.id, rule: rule.id, q: check.ask(rule), better: true }]); continue; }
      const base = [TOOL, rule.hash, u.kind === 'document' ? '' : u.id.split('~')[0]], old = prior(u.id, rule.id);
      const k = sha(JSON.stringify(check.reader ? base : [...base, check.inputs?.(u, rule, ctx) ?? null])).slice(0, 16), same = old?.k === k && old.v !== 'unjudged';
      total++;
      if (same && !check.reader && old.v !== 'pending' && !old.by) { checks[rule.id] = old; continue; }       // decided by code and unchanged
      if (!same) judged++;
      const { ask = [], ...code } = check.reader ? { v: 'pending', e: [AWAIT], ask: [{ id: rule.id, q: check.ask(rule) }] } : outcome(check, u, rule, ctx);
      checks[rule.id] = { ...code, k, r: same ? old.r : run };
      if (ask.length) asked.set(family(rule), [...(asked.get(family(rule)) || []), ...ask.map(a => ({ ...a, rule: rule.id }))]);
    }
    for (const [into, from] of [[questions, asked], [advice, wished]]) for (const [name, items] of from) {
      // A rule about a sentence is judged in its paragraph, under its headings. A question that code left open is about the sentence alone.
      const q = { unit: u.id, family: name, kind: u.kind, where: u.where, file: u.file ?? null, text: u.text ?? '', context: reading.has(name) && u.paragraph ? byId.get(u.paragraph).text : '', headings: reading.has(name) ? above : [],
        items: items.map((a, i) => ({ id: a.id ?? `item-${i + 1}`, rule: a.rule, tag: a.tag ?? a.id, q: a.q, ...(a.better ? { better: true } : {}) })) };
      into.push({ ...q, key: sha(JSON.stringify([JUDGE, q.family, q.kind, q.text, q.context, q.headings, q.items.map(i => [i.id, i.q, !!i.better])])).slice(0, 16) });
    }
    if (Object.keys(checks).length) units[u.id] = { kind: u.kind, where: u.where, ...(u.file ? { at: `${u.file}:${u.line}` } : {}), checks };
  }
  return { units, questions, advice, judged, total };
}
// Read-only: the units of a manuscript, the code verdict of every (unit, rule) and the questions for the judges. `extra` appends
// lines and registry entries to a copy of the manuscript (the seeded defects of a run of the judges). Nothing is written.
export function examine(project, paper = 'paper', { build: builder = () => null, corpus = () => storedCorpus(path.resolve(project, '..', '..')), baseline = null, prior, run, extra } = {}) {
  const print = fingerprint(project, paper), own = print.flat.lines, end = own.findIndex(l => l.text.includes('\\end{document}')), cut = end < 0 ? own.length : end;
  const doc = { ...decompose(extra ? [...own.slice(0, cut), ...extra.lines, ...own.slice(cut)] : own), hash: print.source }, list = rules(project, paper);
  let lexicon = optional(path.join(project, paper, 'LEXICON.json')), facts = optional(path.join(project, paper, 'FACTS.json'));
  if (extra) { lexicon = { symbols: [...(lexicon.symbols || []), ...extra.symbols], terms: [...(lexicon.terms || []), ...extra.terms] }; facts = { facts: { ...facts.facts, ...extra.facts }, uses: { ...facts.uses, ...extra.uses } }; }
  const ctx = context(doc, { lexicon, facts, build: builder, corpus, baseline, file: rel => { const file = safePath(project, rel); return fs.existsSync(file) ? read(file) : null; } });
  // Enrollment: the overfull boxes of the first build are the baseline against which later ones are new.
  if (!ctx.baseline) { const first = ctx.build(); if (first?.log !== undefined) ctx.baseline = { overfull: overfull(first.log) }; }
  return { print, doc, ctx, list, ...assess(doc, ctx, list, prior, run) };
}

// The answers of the judges, read from the run records the CLI wrote on this computer. Every call carries the planted texts of
// the rules it asks. An answer on a rule counts when its call answered every planted text of that rule as registered (a seeded
// defect among them), when its run answered FIT of that rule's planted texts as registered, and when its judge is not of the
// writer's vendor. Everything is computed from the calls of the record, never from a summary stored in it.
export function recorded(project, paper, writer) {
  const dir = ledger(project, paper), index = new Map(), runs = new Map(), found = [];
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    try { const run = json(path.join(dir, name, 'run.json')); if (run.id === name && run.tool === JUDGE && Array.isArray(run.calls)) found.push(run); } catch { /* not a run record */ }
  }
  for (const run of found.sort((a, b) => `${a.started} ${a.id}` < `${b.started} ${b.id}` ? -1 : 1)) {
    if (!writer || run.writer !== writer || run.provider === writer || run.advice) continue;         // a run of advice holds no verdict
    const calls = run.calls.filter(c => c.state === 'ok'), tally = {};
    for (const c of calls) for (const p of c.planted || []) { const t = tally[p.rule] ||= { planted: 0, met: 0 }; t.planted++; if (p.met === true) t.met++; }
    const fit = rule => !!tally[rule] && tally[rule].met * FIT[1] >= tally[rule].planted * FIT[0];
    const sound = (c, rule) => { const own = (c.planted || []).filter(p => p.rule === rule); return own.some(p => p.want === 'fail') && own.every(p => p.met === true); };
    for (const c of calls) for (const a of c.answers || []) {
      const kept = Object.fromEntries(Object.entries(a.items || {}).filter(([, x]) => fit(x.rule) && sound(c, x.rule)));
      if (!Object.keys(kept).length) continue;
      const key = `${a.unit}|${c.family}|${a.key}`;
      index.set(key, [...(index.get(key) || []), { run: run.id, n: c.n, model: run.requestedModel ?? MODEL, answers: kept }]);
    }
    const sum = pick => Object.values(tally).reduce((n, t) => n + t[pick], 0);
    runs.set(run.id, { id: run.id, time: run.started, provider: run.provider, model: run.requestedModel ?? null, models: run.models || [], calls: run.calls.length, planted: sum('planted'), met: sum('met'),
      unfit: Object.keys(tally).filter(rule => !fit(rule)).sort(), missed: [...new Set(calls.flatMap(c => (c.planted || []).filter(p => p.met !== true).map(p => p.id)))].sort() });
  }
  return { index, runs };
}
export const MODEL = 'default';                          // how a judge is told apart when no model was named for its run
const judgeName = r => `${r.provider}, ${r.model ? `model ${r.model}` : 'provider default model'}${r.models?.length ? ` (reported: ${r.models.join(', ')})` : ''}`;
// The independent verdicts into the checks: one failing run fails a (unit, rule), `judges` passing judges pass it, fewer leave it
// awaiting. Judges are told apart by model: the runs of one model give one passing vote, since they read alike (measured: design
// record). q.lacks: for each rule of the question that still needs a judge, the models that have passed it.
function settle(units, questions, rec, judges) {
  const used = new Map();
  for (const q of questions) {
    const records = rec.index.get(`${q.unit}|${q.family}|${q.key}`) || [];
    q.lacks = {};
    for (const rule of new Set(q.items.map(i => i.rule))) {
      const c = units[q.unit].checks[rule], items = q.items.filter(i => i.rule === rule), seen = new Set();
      const read = records.filter(b => items.every(i => b.answers[i.id])).map(b => ({ ...b, bad: items.filter(i => b.answers[i.id].v === 'fail') })), failed = read.filter(b => b.bad.length);
      const votes = read.filter(b => b.bad.length || (!seen.has(b.model) && seen.add(b.model)));
      if (!failed.length && seen.size < judges) q.lacks[rule] = seen;
      if (!votes.length) continue;
      c.by = { q: q.key, runs: votes.map(b => [b.run, b.n, b.bad.length ? 'fail' : 'pass']) };
      for (const b of votes) used.set(b.run, (used.get(b.run) || 0) + 1);
      if (failed.length) {
        c.v = 'fail';
        c.e = failed.flatMap(b => b.bad.map(i => { const a = b.answers[i.id], who = `judge ${judgeName(rec.runs.get(b.run))} (run ${b.run})`;
          return `${i.tag === i.id ? '' : `${i.tag}: `}${who} fails it: ${a.reason} Evidence: "${a.evidence}"`; }));
      } else if (seen.size >= judges) { c.v = 'pass'; delete c.e; }
    }
    q.open = Object.keys(q.lacks).length > 0;
  }
  return used;
}
// The judges a manuscript requires for a pass: one, or the number its RULES.json asks for.
function required(project, paper) {
  const n = optional(path.join(project, paper, 'RULES.json')).judges ?? JUDGES;
  if (!Number.isInteger(n) || n < 1) throw Error(`RULES.json: "judges" must be a whole number of judges, at least 1 (it is ${JSON.stringify(n)}).`);
  return n;
}

// Judge every (unit, rule) pair whose content or dependencies changed; keep the other verdicts; take the independent verdicts from the run records.
// writer: the vendor whose model wrote the manuscript (the last declaration is kept when omitted); a judge of that vendor supplies no verdict.
export function verify(project, paper = 'paper', { build: builder = () => build(project, paper), corpus = () => storedCorpus(path.resolve(project, '..', '..')), wip, writer, dry = false, now = new Date() } = {}) {
  const old = sealed(project, paper) ? json(stateFile(project, paper)) : null, id = crypto.randomBytes(4).toString('hex');
  const { print, doc, ctx, list, units, questions, advice, judged, total } = examine(project, paper, { build: builder, corpus, baseline: old?.baseline ?? null, prior: (unit, rule) => old?.units?.[unit]?.checks?.[rule], run: id });
  const who = writer ?? declaredWriter(project, paper), rec = recorded(project, paper, who), judges = required(project, paper), used = settle(units, questions, rec, judges);
  const tally = list.filter(rule => !CHECKS[rule.kind].advice).map(rule => Object.values(units).reduce((c, u) => (u.checks[rule.id] && c[u.checks[rule.id].v]++, c), { id: rule.id, kind: rule.kind, pass: 0, fail: 0, pending: 0, unjudged: 0 }));
  const pick = (...which) => Object.entries(units).flatMap(([unit, u]) => Object.entries(u.checks).filter(([, c]) => which.includes(c.v)).map(([rule, c]) => ({ unit, rule, where: u.where, at: u.at, verdict: c.v, evidence: c.e })));
  const sentences = doc.units.filter(prose), lit = ctx.corpus(), open = pick('fail', 'unjudged'), awaiting = pick('pending');
  const state = { version: 2, tool: TOOL, paper, hash: print.gate, source_hash: print.source, run: { id, time: now.toISOString(), judged, total }, complete: !open.length && !awaiting.length,
    counts: { sentences: sentences.length, paragraphs: doc.units.filter(u => u.kind === 'paragraph').length, titles: doc.units.filter(u => u.kind === 'title').length,
      numbers: sentences.reduce((n, u) => n + u.numbers.length, 0), symbols: new Set(sentences.flatMap(u => [...ctx.used(u)])).size, terms: new Set(sentences.flatMap(u => u.terms)).size },
    rules: tally, orphans: ctx.orphans, baseline: ctx.baseline, corpus: lit && { hash: lit.hash, cutoff: lit.cutoff, documents: lit.documents, words: lit.words, built: lit.built }, approved: [...ctx.approved].sort(),
    independent: { writer: who, judges, awaiting: awaiting.length, rest: Object.values(units).reduce((n, u) => n + Object.values(u.checks).filter(c => c.by && c.v !== 'pending').length, 0),
      runs: [...rec.runs.values()].map(r => ({ ...r, answers: used.get(r.id) || 0 })) },
    wip: wip ? { hash: print.gate, declared: now.toISOString(), note: wip, units: [...open, ...awaiting].map(({ unit, rule, where }) => ({ unit, rule, where })) } : old?.wip?.hash === print.gate ? old.wip : null, units };
  const text = serialize(state);
  if (dry) return { state, open, awaiting, questions, advice, list };       // a plan: nothing is written, and a manuscript is not enrolled by it
  write(stateFile(project, paper), text);
  writeJSON(sealFile(project, paper), { file: sha(text), run: id, time: now.toISOString(), writer: who });
  return { state, open, awaiting, questions, advice, list };
}

const LIMITS = 'Not judged at this stage: the meaning of a paragraph, a Section and the document, the outline and the scope of central claims (stage 4); whether a sentence is correct or supported by the notes, the data or the cited source (a judge sees the sentence, its paragraph and its headings, nothing else); whether a sentence could be better (the search for a better sentence gives advice on request, `paper-judge --advice`, and no verdict); single words and the wording of a phrase beyond its adjacent word pairs and hyphenated compounds; numerals in display equations and table cells; one, ordinals and comparisons with zero; indices of symbols.';
// The completion report: the only evidence of verification that a report to the user may cite.
export function report(slug, { state, open, awaiting = [] }, { pending = false } = {}) {
  const c = state.counts, ind = state.independent, rows = state.rules.map(r => `| ${r.id} | ${r.pass} | ${r.fail} | ${r.pending} | ${r.unjudged} |`);
  const line = f => `- [${f.rule}] ${f.where}${f.at ? ` ${f.at}` : ''} unit ${f.unit} (${f.verdict}): ${(f.evidence || []).join('; ')}`;
  return [`Manuscript verification: projects/${slug}/${state.paper}, ${state.run.time}, run ${state.run.id}`,
    `Source ${state.source_hash.slice(0, 12)}. Judged in this run: ${state.run.judged} of ${state.run.total} verdicts (the rest unchanged since an earlier run).`,
    `Units: ${c.sentences} sentences, ${c.paragraphs} paragraphs, ${c.titles} titles, ${c.numbers} numerals, ${c.symbols} symbols, ${c.terms} candidate terms.`, '',
    '| rule | pass | fail | awaiting independent verdict | not judged |', '| --- | ---: | ---: | ---: | ---: |', ...rows, '',
    state.corpus ? `Corpus: ${state.corpus.documents} hep-th papers, ${state.corpus.words} words, inspected sources dated before ${state.corpus.cutoff} (${state.corpus.hash.slice(0, 12)}).` : 'Corpus: not built (node harness/cli.mjs corpus-build).',
    ...(state.approved.length ? [`Terms that pass on the user's approval recorded in LEXICON: ${state.approved.join('; ')}.`] : []),
    ind.runs.length ? `Independent verdicts: writer ${ind.writer}. ${ind.rest} verdicts rest on the runs of the judges recorded on this computer. A pass needs ${ind.judges === 1 ? 'one judge' : `${ind.judges} judges of different models (named with --model)`}, and one failing judge fails the unit. The answers of a call on a rule count when the call answered all planted texts of that rule as registered, and those of a run when it answered ${FIT[0]} in ${FIT[1]} of them.`
      : `Independent verdicts: none recorded on this computer${ind.writer ? ` (writer ${ind.writer})` : ''}.`,
    ...ind.runs.map(r => `- run ${r.id} (${judgeName(r)}): ${r.calls} calls, ${r.met} of ${r.planted} planted texts answered as registered${r.missed.length ? ` (missed: ${r.missed.join(', ')})` : ''}, ${r.answers} verdicts rest on it${r.unfit.length ? `; below ${FIT[0]} in ${FIT[1]} and not used for: ${r.unfit.join(', ')}` : ''}`), LIMITS,
    ...(state.orphans.length ? [`FACTS uses that match no sentence of the manuscript: ${state.orphans.join(', ')}`] : []),
    state.complete ? 'Status: verification complete: no failure, nothing unjudged, nothing awaiting the independent verdict.'
      : `Status: INCOMPLETE, ${open.filter(f => f.verdict === 'fail').length} failing and ${open.filter(f => f.verdict === 'unjudged').length} not judged.${ind.awaiting ? ` Awaiting the independent verdict: ${ind.awaiting} (node harness/cli.mjs paper-judge ${slug} ${state.paper} --writer <claude|codex>).${open.length ? ' A unit with a failing or unjudged verdict is put to a judge only after that is settled.' : ''}` : ''}`,
    ...(state.wip ? [`Work in progress declared ${state.wip.declared}: ${state.wip.note} (${state.wip.units.length} unverified verdicts, listed below; report them to the user).`] : []),
    ...open.map(line), ...(pending || state.wip ? awaiting.map(line) : [])].join('\n');
}

// Enrolled manuscripts: a paper directory holding VERIFY.json. Nothing else is gated.
export function enrolled(root) {
  const projects = path.join(root, 'projects');
  if (!fs.existsSync(projects)) return [];
  return fs.readdirSync(projects).flatMap(slug => { const dir = path.join(projects, slug); return !fs.statSync(dir).isDirectory() ? [] : fs.readdirSync(dir).filter(n => n.startsWith('paper') && fs.existsSync(path.join(dir, n, 'VERIFY.json'))).map(paper => ({ slug, paper, project: dir })); });
}
export function standing(project, paper) {
  try {
    const state = json(stateFile(project, paper)), print = fingerprint(project, paper), current = state.hash === print.gate, count = (...which) => current ? state.rules.reduce((n, r) => n + which.reduce((m, v) => m + r[v], 0), 0) : null;
    if (!sealed(project, paper)) return { source: print.source, verified: false, wip: false, open: null, awaiting: null, error: 'VERIFY.json does not carry the run metadata of this computer\'s CLI: it was written or changed by other means, or comes from another computer' };
    return { source: print.source, verified: current && state.complete, wip: state.wip?.hash === print.gate, open: count('fail', 'unjudged'), awaiting: count('pending') };
  } catch (e) { return { source: null, verified: false, wip: false, open: null, awaiting: null, error: e.message }; }
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
      blocks.push(`projects/${key} was changed in this session and is not verified${now.error ? ` (${now.error})` : now.open === null ? ' (no verification of its current text)' : ` (${now.open} failing or unjudged verdicts, ${now.awaiting} awaiting the independent verdict)`}. Run \`node harness/cli.mjs paper-verify ${m.slug} ${m.paper}\`, fix what it lists, run \`node harness/cli.mjs paper-judge ${m.slug} ${m.paper} --writer <claude|codex>\` for the verdicts that await the judges and fix what they fail; or declare work in progress with \`--wip "<reason>"\` and give the user the list of unverified units it prints. Do not report the manuscript as finished. (block ${tried + 1} of ${BLOCK_LIMIT})`);
      continue;
    }
    if (!now.verified) notes.push(now.wip ? `Manuscript projects/${key}: work in progress declared, verification incomplete.` : `Manuscript projects/${key} ends this turn UNVERIFIED after ${BLOCK_LIMIT} blocks.`);
    fs.rmSync(mark(dir, m, 'touched'));
    delete blocked[key];
  }
  writeJSON(file, blocked);
  return { block: blocks.join('\n'), notes };
}
