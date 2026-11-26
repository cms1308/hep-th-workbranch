// Manuscript verification, stages 1 to 4 of harness/design/paper-verification.md: registered
// rules with failing and passing texts, the checks decided by code (stage 2: terms and standard
// notation against the literature corpus), hash-bound verdicts in paper/VERIFY.json and the gate
// read by the Stop hook. Stage 3: what only a reader can decide becomes a question to independent
// judges (harness/judge.mjs runs them); their answers count only through the run records the CLI
// keeps under .harness-local/verdicts/, and VERIFY.json counts only as the CLI wrote it. Stage 4:
// the outline of the manuscript (paper/OUTLINE.json: its central claims, and one entry for every
// paragraph) is a registry that code holds to the text and that the judges are shown.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { read, json, write, writeJSON, sha, safePath, run, wiki } from './core.mjs';
import { flatten, decompose, symbols, value, expand, numberWord, contentWords } from './tex.mjs';
import { load as storedCorpus, fromTex, attest, key as gram, symbolPapers, ATTESTED } from './corpus.mjs';

export const TOOL = 1;                                   // raise when the decomposition or a check changes meaning: every verdict is judged again
export const JUDGE = 4;                                  // raise when a question, the prompt, the schema or the reading of an answer changes: every independent verdict is asked again
// Corpus papers needed before single words are compared with it: a smaller corpus lacks common words, so their absence there says nothing.
export const WORD_PAPERS = 20;
// The share of a word's corpus occurrences that must stand in an attested pair for that pair to count as a term the word opens.
export const COLLOCATION = 0.2;
export const JUDGES = 1;                                 // judges that must pass a question unless the manuscript's RULES.json asks for more ("judges": n); one failing judge fails it
export const FIT = [9, 10];                              // share of a rule's planted texts a run must answer as registered for its answers on that rule to count
export const SHORTER = [4, 5];                           // a replacement that is only shorter counts when it has at most this share of the unit's words
// Ranked criteria of "better" (user decision 2026-11-25). The eighth: on a tie the existing sentence stays. Since 2026-11-26 the
// search for a better sentence gives advice on request and no verdict (user decision, on its measured behavior).
export const CRITERIA = ['physical and mathematical correctness', "the user's decisions", 'harness rules', 'completeness of the information the argument needs', 'no redundancy', 'terminology attested in the literature', 'the shorter text'];
// What a paragraph does for the argument, as its outline entry names it. No paragraph is forced to carry a result.
export const ROLES = ['motivation', 'setup', 'definition', 'review', 'derivation', 'result', 'evidence', 'interpretation', 'transition', 'outlook'];
export const SHOWN = ['entry', 'claims', 'setting'];     // what of the outline a rule judged by a reader can show the judge with a paragraph
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

const squash = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const MAIN = 'manuscript';
const sound = e => !!e && ROLES.includes(e.role) && typeof e.does === 'string' && !!e.does.trim();
// The outline held against the text. An entry belongs to a block: a body paragraph with the list items after it, or a run of
// items that follows no paragraph. The sections of an outline are matched to the headings of level 1 to 3 by title, and the
// entries of a section to its blocks in order. The setting of the manuscript and of a section points to sentences of the text;
// each is shown, in its own words, with the paragraphs of its scope that stand after the paragraph holding it. `seeds`: the
// outlines of planted texts, each for the units of its own file.
function outlined(doc, main, seeds = {}) {
  const shape = (o, name) => {
    if (o === null || o === undefined) return null;
    const bad = why => { throw Error(`${name}: ${why}`); };
    if (typeof o !== 'object' || Array.isArray(o)) bad('an outline is an object with "claims" and "sections"');
    for (const key of ['claims', 'sections', 'setting']) if (o[key] !== undefined && !Array.isArray(o[key])) bad(`"${key}" must be a list`);
    for (const s of o.sections || []) if (!s || typeof s !== 'object' || (s.title !== undefined && typeof s.title !== 'string') || (s.paragraphs !== undefined && !Array.isArray(s.paragraphs)) || (s.setting !== undefined && !Array.isArray(s.setting))) bad('a section has "title" (the TeX of its heading, empty for the paragraphs before the first heading), "paragraphs" (a list of entries) and optionally "setting" (a list of pointers to sentences)');
    return o;
  };
  const scopes = new Map(), scopeOf = new Map(), blockOf = new Map(), sections = new Map(), secOf = new Map(), byId = new Map(doc.units.map(u => [u.id, u]));
  const enter = name => scopes.get(name) || scopes.set(name, { name, source: shape(name === MAIN ? main : seeds[name], name === MAIN ? 'OUTLINE.json' : `the outline of the planted text ${name}`), front: { unit: null, level: 0, blocks: [], subs: [] }, sections: [] }).get(name);
  let scope = null, sec = null, cur = null;
  for (const u of doc.units) {
    const name = String(u.file ?? '').startsWith('seed:') ? u.file : MAIN;
    if (scope?.name !== name) { scope = enter(name); sec = scope.sections.at(-1) ?? scope.front; cur = null; }
    scopeOf.set(u.id, scope);
    if (u.kind === 'title') {
      cur = null;                                        // a heading of any level ends a block
      if (u.level < 1 || u.level > 3) continue;
      const parent = scope.sections.findLast(s => s.level < u.level) ?? null;
      parent?.subs.push(u.text);
      sec = { unit: u, level: u.level, blocks: [], subs: [], parent };
      scope.sections.push(sec); sections.set(u.id, sec);
    } else if (u.kind === 'paragraph') secOf.set(u.id, sec);
    if (u.kind === 'paragraph' && (u.role === 'body' || u.role === 'item')) {
      if (u.role === 'body' || !cur) { cur = { lead: u, members: [], section: sec }; sec.blocks.push(cur); }
      cur.members.push(u); blockOf.set(u.id, cur);
    }
  }
  const norm = title => squash(expand(String(title ?? ''), doc.macros)), problems = [];
  // A pointer to a sentence of the setting: `label:`, a unit id, or a passage that stands in exactly one sentence of the scope.
  const resolve = (sc, ref, where) => {
    const mine = doc.units.filter(u => u.kind === 'sentence' && scopeOf.get(u.id) === sc), named = typeof ref === 'string' && ref.trim();
    const hit = !named ? [] : ref.startsWith('label:') ? [byId.get(doc.labels[ref.slice(6)])].filter(u => u && scopeOf.get(u.id) === sc) : byId.has(ref) ? [byId.get(ref)].filter(u => scopeOf.get(u.id) === sc) : mine.filter(u => u.text.includes(ref) || u.prose.includes(ref));
    if (hit.length === 1 && hit[0].kind === 'sentence') return hit[0];
    if (sc.name === MAIN) problems.push(`the setting ${JSON.stringify(ref)} of ${where} ${!named ? 'is not a pointer to a sentence' : hit.length > 1 ? `stands in ${hit.length} sentences: point to one` : hit.length ? 'points to a unit that is not a sentence' : 'matches no sentence of the manuscript'}`);
    return null;
  };
  // Is any paragraph of the scope after the paragraph that holds the setting sentence?
  const reaches = (s, inside) => doc.units.some(p => p.kind === 'paragraph' && p.index > byId.get(s.paragraph).index && p.id !== s.paragraph && inside(p));
  for (const sc of scopes.values()) {
    const src = sc.source, own = sc.name === MAIN, ids = new Set();
    sc.claims = [];
    if (!src) continue;
    for (const c of src.claims || []) {
      if (c && /^[a-z0-9-]+$/.test(c.id || '') && !ids.has(c.id) && typeof c.claim === 'string' && c.claim.trim()) { ids.add(c.id); sc.claims.push({ id: c.id, claim: squash(c.claim) }); }
      else if (own) problems.push(`the central claim ${JSON.stringify(c?.id ?? c)} needs an id of its own (lowercase letters, digits and hyphens) and its statement in "claim"`);
    }
    if (own && !sc.claims.length) problems.push('the outline registers no central claim: "claims" states what the manuscript establishes, each claim with the restrictions it holds under');
    const pool = (src.sections || []).map(s => ({ s, title: norm(s.title), used: false }));
    for (const s of [sc.front, ...sc.sections]) {
      if (!s.unit && !s.blocks.length) continue;         // nothing stands before the first heading
      const hit = pool.find(p => !p.used && p.title === (s.unit ? s.unit.text : ''));
      if (hit) hit.used = true;
      s.listed = !!hit; s.entries = hit?.s.paragraphs ?? [];
      s.aligned = s.listed && s.entries.length === s.blocks.length;
      if (s.aligned) s.blocks.forEach((b, i) => { b.entry = s.entries[i]; });
      const where = s.unit ? `the section ${JSON.stringify(s.unit.text)}` : 'the paragraphs before the first heading';
      s.setting = (hit?.s.setting ?? []).map(ref => resolve(sc, ref, where)).filter(Boolean);
      if (own) for (const t of s.setting) if (!reaches(t, p => { for (let x = secOf.get(p.id); x; x = x.parent) if (x === s) return true; return false; })) problems.push(`the setting ${JSON.stringify(t.text.slice(0, 60))} of ${where} stands after every paragraph it would be shown with`);
    }
    sc.setting = (src.setting ?? []).map(ref => resolve(sc, ref, 'the manuscript')).filter(Boolean);
    if (own) for (const t of sc.setting) if (!reaches(t, p => scopeOf.get(p.id) === sc)) problems.push(`the setting ${JSON.stringify(t.text.slice(0, 60))} of the manuscript stands after every paragraph it would be shown with`);
    if (own) for (const p of pool.filter(p => !p.used)) problems.push(`the outline section ${JSON.stringify(p.title || '(no title)')} matches no ${p.title ? 'Section, Subsection or Subsubsection' : 'paragraph before the first heading'} of the manuscript`);
  }
  // The setting shown with a unit: the sentences of the manuscript and of the sections around its paragraph that stand before it.
  const settingOf = (u, p, block) => {
    const at = block?.lead ?? p, sc = scopeOf.get(u.id);
    if (!at || !sc?.source) return [];
    const all = [...(sc.setting ?? [])];
    for (let x = secOf.get(at.id); x; x = x.parent) all.push(...(x.setting ?? []));
    return [...new Set(all)].filter(s => s.index < at.index && !(block?.members ?? [p]).some(m => m.id === s.paragraph)).sort((a, b) => a.index - b.index).map(s => s.text);
  };
  const of = u => { const p = u.kind === 'paragraph' ? u : byId.get(u.paragraph), block = (p && blockOf.get(p.id)) ?? null; return { block, entry: sound(block?.entry) ? block.entry : null, claims: scopeOf.get(u.id)?.claims ?? [], setting: settingOf(u, p, block) }; };
  const own = scopes.get(MAIN);
  return { present: !!main, problems, of, has: u => !!scopeOf.get(u.id)?.source, section: u => sections.get(u.id) ?? null, setting: () => own?.setting ?? [],
    counts: main && own ? { claims: own.claims.length, setting: [...own.setting, ...own.sections.flatMap(s => s.setting ?? []), ...(own.front.setting ?? [])].length, sections: own.sections.filter(s => s.listed).length, entries: [own.front, ...own.sections].reduce((n, s) => n + s.blocks.filter(b => sound(b.entry)).length, 0) } : null };
}

// Sentence grounds (design, "Sentence grounds"). Every sentence has one entry of GROUNDS.json: its type and the passages it rests
// on, each shown to the judge in its own words. `seeds`: the grounds of planted texts, each for the units of its own file.
export const TYPES = ['result', 'derivation', 'cited', 'definition', 'transition'];
const LINKED = new Set(['result', 'derivation', 'cited']);  // the types that rest on something and need a link
const QUOTE = 4, PASSAGE = 4000;                             // words a quote has at least; characters of a passage shown at most
const CITE = /\\(?:no)?cite[a-zA-Z]*\*?(?:\s*\[[^\]]*\])*\s*\{([^}]*)\}/g;
export const citedKeys = text => [...String(text).matchAll(CITE)].flatMap(m => m[1].split(',').map(k => k.trim()).filter(Boolean));
// The bibliography of a manuscript: key -> eprint (arXiv id) or null, from the texts of its .bib files.
export function bibliography(texts) {
  const out = new Map();
  for (const text of texts) for (const m of String(text).matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,([\s\S]*?)(?=\n\s*@\w+\s*\{|$)/g)) {
    const e = /\beprint\s*=\s*[{"]\s*([^}"]+?)\s*[}"]/i.exec(m[2]);
    out.set(m[1], e ? e[1].replace(/^arXiv:/i, '') : null);
  }
  return out;
}
// The passage of a text around a quote: the block between blank lines that holds it, or a window of the text around it.
function around(text, quote) {
  const q = squash(quote);
  if (q.split(' ').length < QUOTE) return { error: `the quote ${JSON.stringify(quote)} has fewer than ${QUOTE} words` };
  const window = (s, i) => s.slice(Math.max(0, i - PASSAGE / 2), i + q.length + PASSAGE / 2);
  const block = String(text).split(/\n\s*\n/).find(b => squash(b).includes(q));
  if (block !== undefined) { const b = squash(block); return { passage: b.length <= PASSAGE ? block.trim() : window(b, b.indexOf(q)) }; }
  const all = squash(text), i = all.indexOf(q);
  return i < 0 ? {} : { passage: window(all, i) };
}
function grounded(doc, main, seeds = {}, { file = () => null, bib = new Map(), sources = () => undefined } = {}) {
  const byId = new Map(doc.units.map(u => [u.id, u])), problems = [], scopeName = u => String(u.file ?? '').startsWith('seed:') ? u.file : MAIN;
  const cut = s => JSON.stringify((s = String(s)).length > 80 ? `${s.slice(0, 80)}…` : s);
  const shape = (o, name) => {
    if (o === null || o === undefined) return null;
    const bad = why => { throw Error(`${name}: ${why}`); };
    if (typeof o !== 'object' || Array.isArray(o) || (o.sentences !== undefined && !Array.isArray(o.sentences))) bad('a registry of grounds is an object with "sentences", a list of entries');
    for (const e of o.sentences || []) if (!e || typeof e !== 'object' || typeof e.at !== 'string' || (e.links !== undefined && !Array.isArray(e.links))) bad('an entry has "at" (a label, a unit id or a passage of its sentence), "type" and optionally "links" (a list)');
    return o;
  };
  const registries = [[MAIN, shape(main, 'GROUNDS.json')], ...Object.entries(seeds || {}).map(([name, o]) => [name, shape(o, `the grounds of the planted text ${name}`)])].filter(([, o]) => o);
  const scoped = new Set(registries.map(([name]) => name)), entries = new Map(), cache = new Map();
  const find = (ref, pool) => ref.startsWith('label:') ? [byId.get(doc.labels[ref.slice(6)])].filter(u => u && pool.includes(u)) : byId.has(ref) ? [byId.get(ref)].filter(u => pool.includes(u)) : pool.filter(u => u.text.includes(ref) || (u.prose ?? '').includes(ref));
  for (const [name, o] of registries) {
    const pool = doc.units.filter(u => u.kind === 'sentence' && scopeName(u) === name);
    for (const e of o.sentences || []) {
      const hit = e.at.trim() ? find(e.at, pool) : [];
      if (hit.length === 1) entries.set(hit[0].id, [...(entries.get(hit[0].id) || []), { ...e, scope: name }]);
      else if (name === MAIN) problems.push(`the entry ${cut(e.at)} of GROUNDS.json ${hit.length ? `stands in ${hit.length} sentences: point to one` : 'matches no sentence of the manuscript'}`);
    }
  }
  // A link as the judge is shown it: its kind, where it comes from and the passage; or why it cannot be shown.
  const link = (l, u, scope) => ({ kind: l?.at !== undefined ? 'at' : l?.file !== undefined ? 'file' : l?.cite !== undefined ? 'cite' : null, ...resolve(l, u, scope) });
  const resolve = (l, u, scope) => {
    if (!l || typeof l !== 'object') return { error: 'a link is an object with "at", with "file" and "quote", or with "cite" and "quote"' };
    if (l.at !== undefined) {
      const pool = doc.units.filter(x => (x.kind === 'sentence' || x.kind === 'title') && scopeName(x) === scope), hit = typeof l.at === 'string' && l.at.trim() ? find(l.at, pool) : [];
      if (hit.length !== 1) return { error: `the link ${cut(l.at)} ${hit.length ? `stands in ${hit.length} places of the manuscript: point to one` : 'matches no place of the manuscript'}` };
      if (hit[0].id === u.id) return { error: 'the sentence links to itself' };
      return { from: 'the manuscript', passage: squash((hit[0].paragraph ? byId.get(hit[0].paragraph) : hit[0]).text).slice(0, PASSAGE) };
    }
    const named = l.file ?? l.cite;
    if (l.file === undefined && l.cite === undefined) return { error: 'a link names "at", "file" or "cite"' };
    if (typeof l.quote !== 'string') return { error: `the link to ${named} has no "quote": copy the passage it rests on` };
    if (l.file !== undefined) {
      let text;
      try { text = file(l.file); } catch (e) { return { error: `${l.file}: ${e.message}` }; }
      if (text === null || text === undefined) return { error: `${l.file} does not exist` };
      const a = around(text, l.quote);
      return a.passage ? { from: l.file, passage: a.passage } : { error: a.error ?? `the quote ${cut(l.quote)} is not in ${l.file}` };
    }
    if (!citedKeys(u.text).includes(l.cite)) return { error: `the sentence does not cite ${l.cite}` };
    if (!bib.has(l.cite)) return { error: `${l.cite} is not in the bibliography` };
    const id = bib.get(l.cite);
    if (!id) return { error: `${l.cite} has no eprint in the bibliography, so its source cannot be read in the wiki` };
    const files = sources(id);
    if (files === undefined) return { unjudged: `the wiki is not found, so the source of ${l.cite} cannot be read` };
    if (!files) return { error: `arXiv:${id} (${l.cite}) is not among the wiki sources: it has to be ingested before a sentence can rest on it` };
    for (const [name, text] of Object.entries(files)) { const a = around(text, l.quote); if (a.error) return { error: a.error }; if (a.passage) return { from: `${l.cite} (arXiv:${id}, ${name})`, passage: a.passage }; }
    return { error: `the quote ${cut(l.quote)} is not in the source of arXiv:${id} (${l.cite})` };
  };
  const of = u => cache.get(u.id) || cache.set(u.id, (entries.get(u.id) || []).map(e => ({ at: e.at, type: e.type ?? null, links: (e.links || []).map(l => link(l, u, e.scope)) }))).get(u.id);
  return { present: !!main, problems, of, has: u => scoped.has(scopeName(u)), entry: u => { const es = entries.get(u.id) || []; return es.length === 1 ? es[0] : null; },
    counts: main ? [...entries].filter(([id]) => scopeName(byId.get(id)) === MAIN).reduce((c, [, es]) => { for (const e of es) c[e.type] = (c[e.type] || 0) + 1; return c; }, {}) : null };
}

function context(doc, { lexicon = {}, facts = {}, file, build: builder, baseline = null, corpus: source = () => null, outline: plan = {}, grounds: plan2 = {}, bib = new Map(), sources = () => undefined }) {
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
  // Names that contain numerals (FACTS.json "names"): a case, a configuration, an entry of a table, or a standard name such as
  // $\mathcal N=1$. A numeral inside one names something and counts nothing, so it needs no fact: the declaration has one
  // ground instead, the sentence that defines the name (`at`) or the literature (`standard`), judged once on that sentence or on
  // the first use. A form in $...$ is an inline formula and covers the numerals of a formula written exactly so; any other form
  // is prose and covers the numerals inside an occurrence of it.
  const named = (facts.names || []).map((d, i) => {
    const forms = typeof d?.name === 'string' ? [d.name] : d?.name;
    if (!Array.isArray(forms) || !forms.length || !forms.every(f => typeof f === 'string' && f.trim()) || (d.at === undefined) === (d.standard !== true))
      throw Error(`FACTS.json names[${i}]: a name is {"name": a phrase or a formula in $...$, or a list of them, "at": the sentence that defines it} or the same with "standard": true in place of "at"`);
    return { forms: forms.map(f => f.trim()), at: d.at, standard: d.standard === true, scope: d.scope ?? MAIN, site: d.at === undefined ? null : unit(d.at) ?? null, first: null };
  });
  const flat = t => String(t).replace(/\s+/g, ''), scopeOf = u => String(u.file ?? '').startsWith('seed:') ? u.file : MAIN;
  const spans = (prose, form) => { const out = [], a = prose.toLowerCase(), b = form.toLowerCase(); for (let i = a.indexOf(b); i >= 0; i = a.indexOf(b, i + 1)) out.push([i, i + b.length]); return out; };
  const naming = (u, n) => named.find(d => d.scope === scopeOf(u) && d.forms.some(f => /^\$[\s\S]*\$$/.test(f) ? n.formula !== undefined && flat((u.math || [])[n.formula]) === flat(f.slice(1, -1))
    : !!n.span && spans(u.prose, f).some(([a, b]) => a <= n.span[0] && n.span[1] <= b))) ?? null;
  for (const u of doc.units) for (const n of u.numbers || []) { const d = naming(u, n); if (d && !d.first) d.first = u; }
  for (const d of named) if (!d.first) orphans.push(`name ${d.forms.join(', ')}`);
  for (const u of doc.units) if (u.kind === 'sentence') for (const w of u.prose.split(/\s+/).slice(1)) for (const part of w.split(/[-/–]/)) { const m = /^[("'[]*([A-Z][A-Za-z]*)/.exec(part); if (m) capitals.add(m[1]); }
  // Candidate terms of a unit: its hyphenated compounds and its pairs of adjacent content words, by corpus key.
  // A number word, a roman numeral and a possessive end a phrase: the word after them starts another ("Type III | theories", "fifteen | theories", "the node's | fixed point").
  const closes = w => numberWord(w) || /^[ivx]+$|['’]s?$/.test(w);
  const single = w => /^[a-z][a-z'’]{3,}$/.test(w) && !numberWord(w) && !/^[ivx]+$/.test(w);
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
      if (i && !closes(ws[i - 1])) out.set(gram(`${ws[i - 1]} ${w}`), { text: show(`${ws[i - 1]} ${w}`), parts: [ws[i - 1], w].filter(x => x.includes('-')).map(gram).filter(k => k.includes(' ')),
        words: [ws[i - 1], w].flatMap(x => x.split('-')).filter(single).map(gram), ...(i + 1 < ws.length && !closes(w) ? { next: gram(`${w} ${ws[i + 1]}`), second: gram(w) } : {}) });
    });
    // Single words, lower case and of four letters or more (a capital marks a name or the start of a sentence).
    for (const w of contentWords(u.prose)) for (const p of w.split('-')) if (single(p) && !out.has(gram(p))) out.set(gram(p), { text: `"${p}"`, single: true });
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
    return entry ? [entry.kind, entry.term, ...(entry.kind === 'ordinary' ? [entry.note] : [])] : n === null ? ['no-corpus'] : [c.single ? (occurs.get(c.key) > 1 ? 'word-recurrent' : 'word-once') : c.compound ? 'compound' : occurs.get(c.key) > 1 ? 'recurrent' : 'once', n, occurs.get(c.key)];
  };
  const wide = () => (corpus()?.papers?.length ?? 0) >= WORD_PAPERS;
  const occurrences = k => occurs.has(k) && papers(k) !== null ? counts.get(k).count : 0;
  const opens = c => !!c.next && occurs.has(c.next) && occurs.has(c.second) && papers(c.next) >= ATTESTED && occurrences(c.next) >= COLLOCATION * occurrences(c.second);
  const lone = k => papers(k) !== null && papers(k) < ATTESTED && !ground(k);          // a compound that is a finding by itself: the pairs containing it add nothing
  return { hash: doc.hash, unit, used, symbol: k => table.get(k), terms, uses, naming, names: u => named.filter(d => d.first && (d.standard ? d.first === u : d.site === u)), orphans, facts: facts.facts || {}, file, capitals, baseline, corpus, approved, outline: outlined(doc, plan.main ?? null, plan.seeds), grounds: grounded(doc, plan2.main ?? null, plan2.seeds, { file, bib, sources }),
    // Single words only against a corpus of WORD_PAPERS papers or more; a pair is left out when one of its words is a finding by itself.
    // A pair whose second word opens a term with the word after it is a modifier before that term ("unitary | fixed point"), left out
    // against a corpus wide enough to compare the modifier as a word. A term: an attested pair whose first word stands in it in at least
    // a fifth of its corpus occurrences ("fixed point", not "argument uses").
    term: u => candidates(u).filter(c => c.single ? wide() : c.compound || (!c.parts.some(lone) && !(wide() && c.words.some(k => occurs.has(k) && lone(k))) && !(wide() && opens(c)))).map(c => [c.text, ...status(c)]),
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
      // After the numerals: the names this unit defines, or first uses if they are standard.
      return [...u.numbers.map(n => {
        const nm = ctx.naming(u, n);
        if (nm) return [n.key, 'name', nm.forms[0], nm.standard ? 'standard' : nm.site?.id ?? null, nm.site ? nm.site.index <= u.index : null, nm.site?.where ?? null];
        const id = uses[n.key], f = id === undefined ? null : ctx.facts[id];
        if (!f) return [n.key, id ?? null];
        if (f.file !== undefined) { const text = ctx.file(f.file); return [n.key, id, f, text === null ? null : sha(text), ctx.file(path.posix.join(path.posix.dirname(f.file), 'run.json'))]; }
        const d = ctx.unit(f.at);
        return [n.key, id, f, d?.id ?? null, d ? d.index <= u.index : null, d?.where];
      }), ...ctx.names(u).map(d => ['defines', d.forms, d.standard, d.first.id, d.first.text])];
    },
    judge(u, rule, ctx, inputs) {
      const fail = [], pending = [], ask = [];
      for (const [, forms, standard, , first] of inputs.slice(u.numbers.length)) {
        const list = forms.map(f => `«${f}»`).join(', ');
        pending.push(`the name ${list} is declared ${standard ? 'standard' : 'defined here'}: whether ${standard ? 'it is a standard name' : 'this sentence defines it'} needs the independent verdict`);
        ask.push({ tag: forms[0], q: standard
          ? `The manuscript declares ${list} a standard name: the numerals in it belong to the name of an object (the 1 of $\\mathcal N=1$ supersymmetry belongs to the name of the algebra) and state no result of the manuscript, and the name needs no definition. Its first use in the manuscript is the unit. Pass if hep-th papers commonly write it with this meaning without defining it, and the unit uses it with that meaning. Fail otherwise.`
          : `The writer declares ${list} a name defined by the unit: the numerals in it say which object is meant (a case, a configuration given by the numbers that define it, an entry of a table) and state no result of the manuscript. Its first use in the manuscript: «${first}». Pass if the unit defines or introduces what each of these names, and that use reads it as that name. Fail if the unit does not define it, or if a numeral in the name is a count or a value that the manuscript reports as a result.` });
      }
      u.numbers.forEach((n, i) => {
        const [key, id, f, a, b, where] = inputs[i];
        if (id === 'name') {
          if (a === null) fail.push(`"${key}" stands in the name «${f}», whose definition site is not in the manuscript`);
          else if (a !== 'standard' && !b) fail.push(`"${key}" stands in the name «${f}», used before its definition at ${where}`);
          return;
        }
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
          ...of('recurrent').map(([t, , n, m]) => `${t} (corpus papers: ${n}, sentences or titles here: ${m}) ${needs}`),
          ...of('word-recurrent').map(([t, , n, m]) => `the word ${t} (corpus papers: ${n}, sentences or titles here: ${m}) ${needs}`)],
        pending: [...of('once').map(([t, , n]) => `${t} (corpus papers: ${n}) occurs once: whether it is a term needs the independent verdict`),
          ...of('word-once').map(([t, , n]) => `the word ${t} (corpus papers: ${n}) occurs once: whether it is ordinary English needs the independent verdict`),
          ...of('ordinary').map(([t, , term]) => `${t} is declared ordinary wording (LEXICON "${term}"): the declaration needs the independent verdict`)],
        ask: [...of('word-once').map(([t, , n]) => ({ tag: t, q: `The word ${t} occurs once in the manuscript and in ${n} of the ${ctx.papers()} papers of the literature corpus. Pass if it is an ordinary English word used in its ordinary sense. Fail if it is a word coined for this manuscript, or a technical term or label that the literature does not use.` })),
          ...of('once').map(([t, , n]) => ({ tag: t, q: `${t} occurs once in the manuscript and in ${n} of the ${ctx.papers()} papers of the literature corpus. Pass if it is ordinary wording read literally (for example a subject and its verb, or an adjective and its noun). Fail if it is used as a technical term or as a label, which needs attestation in the literature or a definition.` })),
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
  // The outline contract (stage 4). Code: the manuscript has an outline with a central claim, every Section is listed in it, and
  // every paragraph (with the list items after it) has exactly one entry with a role. Whether a heading names what stands under
  // it awaits the independent verdict. A paragraph gets its verdict here once its Section is listed with as many entries as paragraphs.
  outline: {
    units: u => u.kind === 'document' || u.kind === 'paragraph' || (u.kind === 'title' && u.level >= 1 && u.level <= 3),
    applies(u, rule, ctx) {
      if (u.kind === 'document') return true;
      if (!ctx.outline.has(u)) return false;
      if (u.kind === 'title') return true;
      const b = ctx.outline.of(u).block;
      return !!b && b.lead === u && (!b.section.unit || b.section.aligned);
    },
    inputs(u, rule, ctx) {
      const o = ctx.outline, s = u.kind === 'title' ? o.section(u) : null;
      return u.kind === 'document' ? [o.present, o.problems] : s ? [s.listed, s.blocks.length, s.entries.length, s.aligned ? s.blocks.map(b => b.entry ?? null) : null, s.subs] : [o.of(u).block.section.listed, o.of(u).block.entry ?? null];
    },
    judge(u, rule, ctx) {
      const o = ctx.outline;
      if (u.kind === 'document') return { fail: o.present ? o.problems : ['the manuscript has no outline: paper/OUTLINE.json registers its central claims and gives every paragraph one entry (node harness/cli.mjs paper-outline <slug> [paper-dir] --skeleton prints the Sections and paragraphs to fill in)'] };
      if (u.kind === 'title') {
        const s = o.section(u), n = s.blocks.length;
        if (!s.listed) return { fail: ['the outline has no section with this title'] };
        if (!s.aligned) return { fail: [`${n} paragraph${n === 1 ? ' stands' : 's stand'} under this heading and the outline lists ${s.entries.length}: every paragraph, with the list items after it, has exactly one entry`] };
        if (!s.blocks.every(b => sound(b.entry))) return { fail: ['an entry under this heading is not valid (it is listed with its paragraph)'] };
        if (!n && !s.subs.length) return {};
        const parts = [n ? `Under it stand${n === 1 ? 's one paragraph' : ` ${n} paragraphs`}, to which the outline of the manuscript gives ${n === 1 ? 'this entry' : 'these entries'} (the role of the paragraph, then what it does): ${s.blocks.map((b, i) => `(${i + 1}) ${b.entry.role}: ${squash(b.entry.does)}`).join(' ')}` : 'No paragraph stands directly under it.',
          ...(s.subs.length ? [`The parts under it have the headings ${s.subs.map(t => `«${t}»`).join(', ')}.`] : [])];
        return { pending: ['whether the heading covers what stands under it needs the independent verdict'],
          ask: [{ tag: u.text, q: `The unit is a heading of the manuscript. ${parts.join(' ')} Pass if the heading covers what each of these parts does: a part that only introduces, connects or sums up the others is covered with them. Fail if the heading promises something that none of the parts does (for example a review where nothing is reviewed, or a derivation where results are only quoted), or if a part does something else than the heading names (for example a paragraph on another case than the one in the heading).` }] };
      }
      const { section, entry: e } = o.of(u).block;
      if (!e) return { fail: [section.listed ? `${section.blocks.length} paragraph${section.blocks.length === 1 ? ' stands' : 's stand'} before the first heading and the outline lists ${section.entries.length}: every paragraph has exactly one entry` : 'the paragraph has no outline entry: the paragraphs before the first heading need an outline section with an empty title'] };
      return { fail: [...(ROLES.includes(e.role) ? [] : [`its outline entry has the role ${JSON.stringify(e.role ?? null)}: name one of ${ROLES.join(', ')}`]), ...(typeof e.does === 'string' && e.does.trim() ? [] : ['its outline entry does not say what the paragraph does ("does")'])] };
    },
  },
  // Sentence grounds. Code: every sentence has one entry, of a known type, with the links its type needs, whose passages stand where
  // they say. Whether the passages establish the sentence, or whether a sentence typed as needing none states something that needs
  // one, awaits the independent verdict, which reads the sentence in its paragraph (`reads`). A sound entry awaits the judge, so a
  // passing text of the rule may await it (`asks`).
  grounds: {
    reads: true, asks: true,
    units: u => u.kind === 'sentence' || u.kind === 'document',
    applies: (u, rule, ctx) => u.kind === 'document' || ctx.grounds.has(u),
    inputs: (u, rule, ctx) => u.kind === 'document' ? [ctx.grounds.present, ctx.grounds.problems] : ctx.grounds.of(u),
    judge(u, rule, ctx, inputs) {
      if (u.kind === 'document') return { fail: ctx.grounds.present ? ctx.grounds.problems : ['the manuscript has no GROUNDS.json: every sentence needs an entry with its type and the passages it rests on (node harness/cli.mjs paper-grounds <slug> [paper-dir] --skeleton prints the entries to fill in)'] };
      if (!inputs.length) return { fail: ['the sentence has no entry in GROUNDS.json'] };
      if (inputs.length > 1) return { fail: [`${inputs.length} entries of GROUNDS.json point to this sentence`] };
      const [{ at, type, links }] = inputs, fail = [], unjudged = [], needs = LINKED.has(type);
      if (!TYPES.includes(type)) fail.push(`its type ${JSON.stringify(type)} is none of ${TYPES.join(', ')}`);
      else if (needs && !links.length) fail.push(`a sentence of the type ${type} needs a link to what it rests on`);
      else if (type === 'cited' && !links.some(l => l.kind === 'cite')) fail.push('a sentence of the type cited needs a link to a passage of a source it cites');
      for (const l of links) { if (l.error) fail.push(l.error); if (l.unjudged) unjudged.push(l.unjudged); }
      if (fail.length || unjudged.length) return { fail, unjudged };
      const shown = links.map((l, i) => `Passage ${i + 1}, from ${l.from}:\n<<<\n${l.passage}\n>>>`).join('\n');
      const q = needs ? `The writer types the unit as a ${type} and gives ${links.length === 1 ? 'this passage' : 'these passages'} as what it rests on, copied from the sources named.\n${shown}\nDo the passages establish what the unit states, read in its paragraph and under its headings? Pass if they state or directly imply every part of its claim: its subject, its direction or sign, its conditions and its range. Fail if the unit states more than they support (a wider range, a dropped condition, another case), something other than they state, or a step they do not contain. Judge whether the passages support the unit, not whether the passages are right.`
        : `The writer types the unit as a ${type}: a sentence that ${type === 'definition' ? 'defines notation or a term' : 'introduces, orders or connects parts of the argument'} and therefore rests on no source. Pass if the unit states no result, no step of a derivation and no claim attributed to the literature. Fail if it states any of these, since such a sentence needs a ground.`;
      return { pending: [`whether ${needs ? 'its passages establish it' : 'it rests on nothing'} needs the independent verdict`], ask: [{ tag: `"${at}"`, q }] };
    },
  },
  // Kinds that only a reader can decide: no code verdict, one question to the independent judges for each unit (a sentence, or
  // with "unit": "paragraph" a paragraph). `shows`: what of the outline the judge is shown with the unit; the rule then applies
  // where the outline has it (the entry of a paragraph is asked about once, on the paragraph that opens its block).
  judge: { reader: true, units: (u, rule) => u.kind === (rule.unit ?? 'sentence') && (!rule.roles || rule.roles.includes(u.role)),
    applies: (u, rule, ctx) => (rule.shows ?? []).every(what => { const o = ctx.outline.of(u); return what === 'entry' ? !!o.entry && (u.kind !== 'paragraph' || o.block.lead === u) : what === 'claims' ? o.claims.length > 0 : true; }),
    ask: rule => rule.question },
  better: { reader: true, advice: true, units: (u, rule) => prose(u) && (!rule.roles || rule.roles.includes(u.role)), ask: () => 'Can you write a sentence that is strictly better than the unit under the ranked criteria stated above?' },
};
// The rule family of one call to a judge: a reader rule joins the family it names (default "content"); a code rule and the search for a better sentence (advice, no verdict) are families of their own.
export const family = rule => rule.kind === 'judge' ? rule.family ?? 'content' : rule.id;
// The items of a question that a sample or a seeded defect designates: by the numeral, the symbol, or the quoted phrase the item is about.
export const designates = (tag, item) => item === undefined || tag === item || tag.startsWith(`"${item}"`);
// The unit of a sample that a reader rule is tested on: the one containing `at`, the last one without it.
export function target(units, check, rule, s) {
  const found = units.filter(u => check.units(u, rule) && (s.at === undefined || u.text.includes(s.at) || u.prose?.includes(s.at)));
  return s.at === undefined ? found.at(-1) ?? null : found.length === 1 ? found[0] : null;
}
// What of the outline the calls of each rule family show the judge: the union over the family's rules.
const showing = list => list.reduce((m, r) => (r.kind === 'judge' && r.shows?.length ? m.set(family(r), new Set([...(m.get(family(r)) || []), ...r.shows])) : m), new Map());

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
  const shown = s => JSON.stringify(s.tex).slice(0, 140), subject = { units: u => check.units(u, rule), applies: (u, ctx) => !check.applies || check.applies(u, rule, ctx) };
  if (check.reader) {
    if (rule.kind === 'judge' && !(typeof rule.question === 'string' && rule.question.trim())) refuse('a rule judged by a reader needs its question: what passes and what fails');
    if (!/^[a-z0-9-]+$/.test(family(rule))) refuse('the family must be lowercase letters, digits and hyphens');
    if (rule.unit !== undefined && !['sentence', 'paragraph'].includes(rule.unit)) refuse('its unit is "sentence" (the default) or "paragraph"');
    if (rule.shows !== undefined && !(Array.isArray(rule.shows) && rule.shows.every(what => SHOWN.includes(what)))) refuse(`"shows" lists what of the outline the judge is shown with the unit: ${SHOWN.join(', ')}`);
    for (const want of ['fail', 'pass']) for (const s of (rule[want] ?? []).map(sample)) {
      if (!OPENING.test(s.tex ?? '')) refuse(`its ${want}ing text must open with its own \\section heading, since a judge sees the headings above every unit (or be an abstract, which has none): ${shown(s)}`);
      let aim, ctx;
      try { const made = probe(s, () => null); ctx = made.ctx; aim = target(made.doc.units, check, rule, s); } catch (e) { refuse(`its ${want}ing text cannot be read (${e.message}): ${shown(s)}`); }
      if (!aim) refuse(`its ${want}ing text has ${s.at === undefined ? `no ${rule.unit ?? 'sentence'} the rule applies to` : `no single ${rule.unit ?? 'sentence'} containing ${JSON.stringify(s.at)}`}: ${shown(s)}`);
      if (!subject.applies(aim, ctx)) refuse(`its ${want}ing text lacks what the rule shows the judge (${rule.shows.join(', ')}): give it its own "outline", with the claims and an entry for each paragraph: ${shown(s)}`);
    }
  } else {
    const all = (doc, ctx) => [...doc.units, DOCUMENT].filter(u => subject.units(u) && subject.applies(u, ctx));
    for (const want of ['fail', 'pass']) for (const s of rule[want].map(sample)) {
      let seen;
      try { const { doc, ctx } = probe(s, () => s.corpus ? fromTex(texts(s)) : null); seen = all(doc, ctx).map(u => outcome(check, u, rule, ctx).v); } catch (e) { refuse(`its check cannot run (${e.message})`); }
      if (want === 'fail' ? !seen.includes('fail') : seen.some(v => v !== 'pass' && !(check.asks && v === 'pending'))) refuse(`its check ${want === 'fail' ? 'does not flag the failing text' : 'does not pass the passing text'} ${shown(s)}`);
    }
    // What the code check leaves to a reader is tested on the judges by the rule's judge samples: each must reach the independent verdict.
    if (rule.judge && (!rule.judge.fail?.length || !rule.judge.pass?.length)) refuse('its judge samples need at least one text that must fail and one that must pass');
    for (const want of ['fail', 'pass']) for (const s of (rule.judge?.[want] ?? []).map(sample)) {
      let reached;
      try { const { doc, ctx } = probe(s, () => fromTex(texts(s))); reached = all(doc, ctx).some(u => { const o = outcome(check, u, rule, ctx); return o.v === 'pending' && o.ask.some(a => designates(a.tag, s.item)); }); } catch (e) { refuse(`its judge sample cannot be read (${e.message})`); }
      if (!reached) refuse(`its judge sample does not reach the independent verdict (the code check must leave ${s.item === undefined ? 'a question' : JSON.stringify(s.item)} awaiting it): ${shown(s)}`);
    }
  }
  const { source, fail, pass, judge, ...effective } = rule;
  return { ...rule, hash: sha(JSON.stringify(effective)) };
}
// A text that a judge is shown must not inherit the headings of whatever stands before it: it opens with its own \section, or it is an abstract.
const OPENING = /^\s*\\(?:section\*?\s*\{|begin\s*\{abstract\})/;
// A sample of a rule as a manuscript of its own, with the registries it carries.
// The corpus of a sample: its texts, each given as TeX or as {"tex", "copies"} (a text standing for that many papers).
const texts = s => (s.corpus || []).flatMap(c => typeof c === 'string' ? [c] : Array(c.copies ?? 1).fill(c.tex));
const probe = (s, corpus) => { const doc = decompose(lines(s.tex)); return { doc, ctx: context({ ...doc, hash: 'sample' }, { lexicon: s.lexicon, facts: s.facts, file: rel => s.files?.[rel] ?? null, build: () => s.build ?? null, baseline: s.baseline, corpus, outline: { main: s.outline ?? null }, grounds: { main: s.grounds ?? null }, bib: bibliography([s.bib ?? '']), sources: id => s.sources ? s.sources[id] ?? null : undefined }) }; };
export function rules(project, paper = 'paper') {
  const all = [...json(BASE).rules, ...(optional(path.join(project, paper, 'RULES.json')).rules || [])];
  const twice = all.map(r => r.id).find((id, i, ids) => ids.indexOf(id) !== i);
  if (twice) throw Error(`Rule ${twice} is registered twice.`);
  const list = all.map(admit), own = new Set(list.filter(r => r.kind !== 'judge').map(r => r.id)), clash = list.find(r => r.kind === 'judge' && own.has(family(r)));
  if (clash) throw Error(`Rule ${clash.id} refused: its family ${family(clash)} is the id of a rule that is a family of its own.`);
  // The calls of a family show the judge what any of its rules shows, for every unit of the call. A planted text without it
  // would stand out among the paragraphs of the manuscript, so every text of such a family carries its own outline. A rule
  // that shows the outline therefore joins a family whose other rules are judged with the outline as well, or has its own.
  // The setting is shown only where a sentence of it stands before a paragraph, so a family that shows it needs at least one text
  // with a paragraph that is shown one: planted paragraphs with and without a setting then stand in every call, as real ones do.
  const shows = showing(list), seen = new Set();
  for (const rule of list.filter(r => r.kind === 'judge' && shows.has(family(r)))) for (const s of [...(rule.fail ?? []), ...(rule.pass ?? [])].map(sample)) {
    const { doc, ctx } = probe(s, () => null), need = shows.get(family(rule)), leads = doc.units.filter(u => u.kind === 'paragraph' && ctx.outline.of(u).block?.lead === u);
    if (leads.some(u => ctx.outline.of(u).setting.length)) seen.add(family(rule));
    const lacks = [...(need.has('entry') && leads.some(u => !ctx.outline.of(u).entry) ? ['an entry for each of its paragraphs'] : []), ...(need.has('claims') && doc.units.some(u => u.kind === 'sentence' && !ctx.outline.of(u).claims.length) ? ['its central claims'] : [])];
    const cause = list.find(r => r.kind === 'judge' && family(r) === family(rule) && r.shows?.length && (r.id === rule.id || !rule.shows?.length));
    if (lacks.length) throw Error(`Rule ${cause.id} refused: it shows the judge the outline in the calls of the family ${family(rule)}, so every text of that family needs an "outline" of its own with ${lacks.join(' and ')}, and a text of ${rule.id === cause.id ? 'the rule' : `the rule ${rule.id}`} has none (give the rule a family of its own, or the text its outline): ${JSON.stringify(s.tex).slice(0, 140)}`);
  }
  for (const [name, need] of shows) if (need.has('setting') && !seen.has(name)) throw Error(`Rule ${list.find(r => r.kind === 'judge' && family(r) === name && r.shows?.includes('setting')).id} refused: it shows the judge the setting in the calls of the family ${name}, so at least one text of that family needs an "outline" whose setting points to a sentence before one of its paragraphs`);
  return list;
}

const part = (project, paper, name) => { const file = path.join(project, paper, name); return fs.existsSync(file) ? read(file) : ''; };
// source: the manuscript sources; gate: everything a verdict was computed from (except calculation outputs, the corpus and the run records of the judges, read at verification).
export function fingerprint(project, paper = 'paper') {
  const flat = flatten(project, `${paper}/main.tex`);
  return { flat, source: flat.hash, gate: sha(JSON.stringify([TOOL, JUDGE, flat.hash, read(BASE), ...['RULES.json', 'LEXICON.json', 'FACTS.json', 'OUTLINE.json', 'GROUNDS.json'].map(n => part(project, paper, n))])) };
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
  const units = {}, questions = [], advice = [], heads = [], byId = new Map(doc.units.map(u => [u.id, u])), reading = new Set(list.filter(r => CHECKS[r.kind].reader || CHECKS[r.kind].reads).map(family));
  const shows = showing(list), contract = list.find(r => r.kind === 'outline')?.id;
  let judged = 0, total = 0;
  for (const u of [...doc.units, { ...DOCUMENT }]) {
    const above = heads.slice(1, u.kind === 'title' ? Math.max(u.level, 1) : undefined).filter(Boolean), checks = {}, asked = new Map(), wished = new Map();
    if (u.kind === 'title' && u.level > 0) { heads.length = u.level; heads[u.level] = u.prose; }
    for (const rule of list) {
      const check = CHECKS[rule.kind];
      if (!check.units(u, rule) || (check.applies && !check.applies(u, rule, ctx))) continue;
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
      // A rule of a reader is judged in the paragraph of its unit (with the list items that belong to it), under its headings, and
      // with what the family shows of the outline: the entry of the paragraph and the central claims. A question that code left
      // open is about the unit alone. `needs`: the code verdicts on the outline that must stand before the question is asked.
      const read = reading.has(name), o = ctx.outline.of(u), show = shows.get(name), whole = u.kind === 'paragraph';
      const q = { unit: u.id, family: name, kind: u.kind, where: u.where, file: u.file ?? null, text: read && whole ? '' : u.text ?? '',
        context: !read ? '' : o.block ? o.block.members.map(m => m.text).join('\n\n') : whole ? u.text : u.paragraph ? byId.get(u.paragraph).text : '', headings: read && u.role !== 'abstract' ? above : [],
        aside: read ? { ...(show?.has('setting') && o.setting.length ? { setting: o.setting } : {}), ...(show?.has('entry') && o.entry ? { entry: `${o.entry.role}. ${squash(o.entry.does)}` } : {}), ...(show?.has('claims') && o.claims.length ? { claims: o.claims.map(c => c.claim) } : {}) } : {},
        needs: read && show && contract ? [['document', contract], ...(o.block?.section.unit ? [[o.block.section.unit.id, contract]] : []), ...(o.block ? [[o.block.lead.id, contract]] : [])] : [],
        items: items.map((a, i) => ({ id: a.id ?? `item-${i + 1}`, rule: a.rule, tag: a.tag ?? a.id, q: a.q, ...(a.better ? { better: true } : {}) })) };
      into.push({ ...q, key: sha(JSON.stringify([JUDGE, q.family, q.kind, q.text, q.context, q.headings, q.aside, q.items.map(i => [i.id, i.q, !!i.better])])).slice(0, 16) });
    }
    if (Object.keys(checks).length) units[u.id] = { kind: u.kind, where: u.where, ...(u.file ? { at: `${u.file}:${u.line}` } : {}), checks };
  }
  return { units, questions, advice, judged, total };
}
// Read-only: the units of a manuscript, the code verdict of every (unit, rule) and the questions for the judges. `extra` appends
// lines and registry entries to a copy of the manuscript (the seeded defects of a run of the judges). Nothing is written.
// The TeX sources of a paper in the wiki, by arXiv id: undefined when no wiki is found, null when the paper is not among its sources.
export function wikiSources(root) {
  let vault = null, seen = new Map();
  try { vault = wiki(root); } catch { /* no wiki on this computer */ }
  return id => {
    if (!vault) return undefined;
    if (!seen.has(id)) {
      const dir = path.join(vault, 'sources', 'arxiv', String(id).replace(/\//g, '-'), 'tex');
      seen.set(id, !fs.existsSync(dir) ? null : Object.fromEntries(fs.readdirSync(dir, { recursive: true }).filter(f => /\.tex$/i.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort().map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')])));
    }
    return seen.get(id);
  };
}
export function examine(project, paper = 'paper', { build: builder = () => null, corpus = () => storedCorpus(path.resolve(project, '..', '..')), sources = wikiSources(path.resolve(project, '..', '..')), baseline = null, prior, run, extra } = {}) {
  const print = fingerprint(project, paper), own = print.flat.lines, end = own.findIndex(l => l.text.includes('\\end{document}')), cut = end < 0 ? own.length : end;
  const doc = { ...decompose(extra ? [...own.slice(0, cut), ...extra.lines, ...own.slice(cut)] : own), hash: print.source }, list = rules(project, paper);
  let lexicon = optional(path.join(project, paper, 'LEXICON.json')), facts = optional(path.join(project, paper, 'FACTS.json'));
  if (extra) { lexicon = { symbols: [...(lexicon.symbols || []), ...extra.symbols], terms: [...(lexicon.terms || []), ...extra.terms] }; facts = { facts: { ...facts.facts, ...extra.facts }, uses: { ...facts.uses, ...extra.uses }, names: [...(facts.names || []), ...(extra.names || [])] }; }
  const plan = path.join(project, paper, 'OUTLINE.json'), outline = { main: fs.existsSync(plan) ? json(plan) : null, seeds: extra?.outlines };
  const support = path.join(project, paper, 'GROUNDS.json'), grounds = { main: fs.existsSync(support) ? json(support) : null, seeds: extra?.grounds };
  const dir = path.join(project, paper), bib = bibliography(fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.endsWith('.bib')).map(n => read(path.join(dir, n))) : []);
  const ctx = context(doc, { lexicon, facts, outline, grounds, bib, sources, build: builder, corpus, baseline, file: rel => { const file = safePath(project, rel); return fs.existsSync(file) ? read(file) : null; } });
  // Enrollment: the overfull boxes of the first build are the baseline against which later ones are new.
  if (!ctx.baseline) { const first = ctx.build(); if (first?.log !== undefined) ctx.baseline = { overfull: overfull(first.log) }; }
  return { print, doc, ctx, list, ...assess(doc, ctx, list, prior, run) };
}

// Every sentence next to its entry in GROUNDS.json: its type and its links, with what code finds wrong. skeleton: the JSON of the
// registry with the entries that stand and an empty entry, pointed to by a passage of its own, for every sentence without one.
export function groundsView(project, paper = 'paper', { skeleton = false } = {}) {
  const doc = decompose(flatten(project, `${paper}/main.tex`).lines), file = path.join(project, paper, 'GROUNDS.json'), main = fs.existsSync(file) ? json(file) : null;
  const dir = path.join(project, paper), bib = bibliography(fs.readdirSync(dir).filter(n => n.endsWith('.bib')).map(n => read(path.join(dir, n))));
  const g = grounded(doc, main, {}, { file: rel => { const f = safePath(project, rel); return fs.existsSync(f) ? read(f) : null; }, bib, sources: wikiSources(path.resolve(project, '..', '..')) });
  const sentences = doc.units.filter(u => u.kind === 'sentence');
  // The shortest opening of a sentence's TeX, five words or more, that no other sentence contains.
  const pointer = u => { const own = /\\label\s*\{([^}]*)\}/.exec(u.text); if (own && sentences.filter(x => x.text.includes(own[0])).length === 1) return `label:${own[1]}`;
    const w = u.text.split(' '); for (let n = Math.min(5, w.length); n <= w.length; n++) { const p = w.slice(0, n).join(' '); if (sentences.filter(x => x.text.includes(p) || x.prose.includes(p)).length === 1) return p; } return u.text; };
  if (skeleton) return JSON.stringify({ version: 1, sentences: sentences.flatMap(u => { const kept = (main?.sentences ?? []).filter(e => g.of(u).some(x => x.at === e.at)); return kept.length ? kept : [{ at: pointer(u), type: '', links: [] }]; }) }, null, 2);
  const line = u => { const es = g.of(u), e = es[0], faults = es.length === 1 ? [...(TYPES.includes(e.type) ? [] : [`type ${JSON.stringify(e.type)}`]), ...(LINKED.has(e.type) && !e.links.length ? ['no link'] : []), ...e.links.filter(l => l.error || l.unjudged).map(l => l.error || l.unjudged)] : [];
    return `  ${u.where}: ${!es.length ? 'NO ENTRY' : es.length > 1 ? `${es.length} ENTRIES` : `[${e.type}] ${e.links.map(l => l.from ?? 'a link that cannot be shown').join('; ') || 'no link'}`}${faults.length ? ` (PROBLEM: ${faults.join('; ')})` : ''}\n      | ${u.text.slice(0, 100)}`; };
  const done = sentences.filter(u => g.of(u).length === 1).length;
  return [`Grounds of ${path.basename(project)}/${paper}: GROUNDS.json ${main ? 'read' : 'absent'}, ${done} of ${sentences.length} sentences with one entry. Types: ${TYPES.join(', ')} (the first three need a link).`,
    ...g.problems.map(p => `PROBLEM: ${p}`), ...sentences.map(line)].join('\n');
}

// The outline next to the text it is held against: every heading of level 1 to 3 with its paragraphs and their entries.
// skeleton: the JSON of an outline for this text, with the entries that stand and an empty one where one is missing.
export function outlineView(project, paper = 'paper', { skeleton = false } = {}) {
  const doc = decompose(flatten(project, `${paper}/main.tex`).lines), file = path.join(project, paper, 'OUTLINE.json'), main = fs.existsSync(file) ? json(file) : null, o = outlined(doc, main);
  const front = doc.units.filter(u => u.kind === 'paragraph' && o.of(u).block?.lead === u && !o.of(u).block.section.unit), heads = doc.units.filter(u => o.section(u)), plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const entries = s => s.aligned ? s.blocks.map(b => b.entry) : [...(s.entries ?? []), ...Array.from({ length: Math.max(0, s.blocks.length - (s.entries?.length ?? 0)) }, () => ({ role: '', does: '' }))];
  const kept = (title, s) => { const had = (main?.sections ?? []).find(x => squash(expand(String(x?.title ?? ''), doc.macros)) === title)?.setting; return { title, ...(had?.length ? { setting: had } : {}), paragraphs: entries(s) }; };
  if (skeleton) return JSON.stringify({ version: 1, claims: main?.claims?.length ? main.claims : [{ id: '', claim: '' }], setting: main?.setting ?? [],
    sections: [...(front.length ? [kept('', o.of(front[0]).block.section)] : []), ...heads.map(u => kept(u.text, o.section(u)))] }, null, 2);
  const shown = list => list.map(t => `  setting: ${t.where} | ${t.text.slice(0, 90)}`);
  const line = u => { const b = o.of(u).block, e = b.entry, items = b.members.length - 1; return `  ${u.where}${items ? ` (with ${plural(items, 'list item', 'list items')})` : ''}: ${e ? `[${e.role ?? ''}] ${squash(e.does)}` : 'NO ENTRY'}\n      | ${u.text.slice(0, 90)}`; };
  return [`Outline of ${path.basename(project)}/${paper}: OUTLINE.json ${main ? 'read' : 'absent'}. Roles: ${ROLES.join(', ')}.`,
    ...(main ? ['Central claims:', ...(main.claims || []).map(c => `- (${c?.id ?? '?'}) ${squash(c?.claim)}`), ...(o.setting().length ? ['Setting of the manuscript:', ...shown(o.setting())] : [])] : []), ...o.problems.map(p => `PROBLEM: ${p}`),
    ...(front.length ? ['Before the first heading:', ...shown(o.of(front[0]).block.section.setting ?? []), ...front.map(line)] : []),
    ...heads.flatMap(u => { const s = o.section(u); return [`${u.where} ${u.prose}: ${plural(s.blocks.length, 'paragraph', 'paragraphs')}${main ? `, ${s.listed ? plural(s.entries.length, 'entry', 'entries') : 'NOT IN THE OUTLINE'}${s.listed && !s.aligned ? ' (THE NUMBERS DIFFER)' : ''}` : ''}`, ...shown(s.setting ?? []), ...s.blocks.map(b => line(b.lead))]; })].join('\n');
}

// The answers of the judges, read from the run records the CLI wrote on this computer. Every call carries the planted texts of
// the rules it asks. An answer on a rule counts when its call answered every planted text of that rule as registered (a seeded
// defect among them), when its run answered FIT of that rule's planted texts as registered, and when its judge is not of the
// vendor of a writer of the unit (settle). Everything is computed from the calls of the record, never from a summary stored in it.
export function recorded(project, paper) {
  const dir = ledger(project, paper), index = new Map(), runs = new Map(), found = [];
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    try { const run = json(path.join(dir, name, 'run.json')); if (run.id === name && run.tool === JUDGE && Array.isArray(run.calls)) found.push(run); } catch { /* not a run record */ }
  }
  for (const run of found.sort((a, b) => `${a.started} ${a.id}` < `${b.started} ${b.id}` ? -1 : 1)) {
    if (run.advice) continue;                                                                        // a run of advice holds no verdict
    const calls = run.calls.filter(c => c.state === 'ok'), tally = {};
    for (const c of calls) for (const p of c.planted || []) { const t = tally[p.rule] ||= { planted: 0, met: 0 }; t.planted++; if (p.met === true) t.met++; }
    const fit = rule => !!tally[rule] && tally[rule].met * FIT[1] >= tally[rule].planted * FIT[0];
    const sound = (c, rule) => { const own = (c.planted || []).filter(p => p.rule === rule); return own.some(p => p.want === 'fail') && own.every(p => p.met === true); };
    for (const c of calls) for (const a of c.answers || []) {
      const kept = Object.fromEntries(Object.entries(a.items || {}).filter(([, x]) => fit(x.rule) && sound(c, x.rule)));
      if (!Object.keys(kept).length) continue;
      const key = `${a.unit}|${c.family}|${a.key}`;
      index.set(key, [...(index.get(key) || []), { run: run.id, n: c.n, provider: run.provider, model: run.requestedModel ?? MODEL, answers: kept }]);
    }
    const sum = pick => Object.values(tally).reduce((n, t) => n + t[pick], 0);
    runs.set(run.id, { id: run.id, time: run.started, provider: run.provider, model: run.requestedModel ?? null, ...(run.configured ? { configured: run.configured } : {}), models: run.models || [], calls: run.calls.length, planted: sum('planted'), met: sum('met'),
      unfit: Object.keys(tally).filter(rule => !fit(rule)).sort(), missed: [...new Set(calls.flatMap(c => (c.planted || []).filter(p => p.met !== true).map(p => p.id)))].sort() });
  }
  return { index, runs };
}
export const MODEL = 'default';                          // how a judge is told apart when no model was named for its run
export const AUTHORS = ['claude', 'codex'];                // the vendors whose models write and judge
export const judgeKey = (provider, model) => `${provider}:${model ?? MODEL}`;
// Whether a judge of `provider` may give a verdict on a unit written by `writers`: not one of them, unless both vendors wrote it
// (then each judges it, independent of the other's part). A unit whose writer is unknown has no eligible judge.
export const eligible = (writers = [], provider) => writers.length > 0 && (AUTHORS.every(v => writers.includes(v)) || !writers.includes(provider));
// Who wrote each unit: a sentence or title keeps the vendor recorded for its text (`wrote`) while the text is unchanged, and new or
// changed text is the writer's of this verification. A paragraph, a heading (with all that stands under it) and the document are
// written by every vendor that wrote one of their sentences (`writers`), which decides who may judge their questions.
function authorship(doc, old, writer) {
  const wrote = new Map(), writers = new Map(), leaf = u => u.kind === 'sentence' || u.kind === 'title';
  for (const u of doc.units) if (leaf(u)) { const had = old?.units?.[u.id]?.wrote; wrote.set(u.id, had?.length ? had : writer ? [writer] : []); }
  const union = ids => [...new Set(ids.flatMap(id => wrote.get(id) ?? []))].sort();
  for (const u of doc.units) if (u.kind === 'sentence') writers.set(u.id, union([u.id]));
  for (const u of doc.units) if (u.kind === 'paragraph') writers.set(u.id, union(u.sentences));
  doc.units.forEach((u, i) => {
    if (u.kind !== 'title') return;
    const under = [];
    for (let j = i + 1; j < doc.units.length && !(doc.units[j].kind === 'title' && doc.units[j].level <= u.level); j++) if (leaf(doc.units[j])) under.push(doc.units[j].id);
    writers.set(u.id, union([u.id, ...under]));
  });
  writers.set('document', union([...wrote.keys()]));
  return { wrote, writers };
}
// The model a run asked for: one named for it, else the one configured for the provider (passed explicitly by the call), else the provider's default.
export const judgeModel = (named, conf) => `${named ? `model ${named}` : conf?.model ? `configured model ${conf.model}` : 'provider default model'}${conf?.effort ? ` at effort ${conf.effort}` : ''}`;
const judgeName = r => `${r.provider}, ${judgeModel(r.model, r.configured)}${r.models?.length ? ` (reported: ${r.models.join(', ')})` : ''}`;
// The independent verdicts into the checks: one failing run fails a (unit, rule), `judges` passing judges pass it, fewer leave it
// awaiting. Judges are told apart by model: the runs of one model give one passing vote, since they read alike (measured: design
// record). q.lacks: for each rule of the question that still needs a judge, the models that have passed it.
function settle(units, questions, rec, judges) {
  const used = new Map();
  for (const q of questions) {
    const records = (rec.index.get(`${q.unit}|${q.family}|${q.key}`) || []).filter(b => eligible(units[q.unit].writers, b.provider));
    const mixed = AUTHORS.every(v => (units[q.unit].writers || []).includes(v));
    q.lacks = {};
    for (const rule of new Set(q.items.map(i => i.rule))) {
      const c = units[q.unit].checks[rule], items = q.items.filter(i => i.rule === rule), seen = new Set();
      const read = records.filter(b => items.every(i => b.answers[i.id])).map(b => ({ ...b, bad: items.filter(i => b.answers[i.id].v === 'fail') })), failed = read.filter(b => b.bad.length);
      const votes = read.filter(b => b.bad.length || (!seen.has(judgeKey(b.provider, b.model)) && seen.add(judgeKey(b.provider, b.model))));
      // A unit both vendors wrote passes only when a judge of each passes it: each is independent of the other's part.
      const enough = seen.size >= judges && (!mixed || AUTHORS.every(v => [...seen].some(k => k.startsWith(`${v}:`))));
      if (!failed.length && !enough) q.lacks[rule] = seen;
      if (!votes.length) continue;
      c.by = { q: q.key, runs: votes.map(b => [b.run, b.n, b.bad.length ? 'fail' : 'pass']) };
      for (const b of votes) used.set(b.run, (used.get(b.run) || 0) + 1);
      if (failed.length) {
        c.v = 'fail';
        c.e = failed.flatMap(b => b.bad.map(i => { const a = b.answers[i.id], who = `judge ${judgeName(rec.runs.get(b.run))} (run ${b.run})`;
          return `${i.tag === i.id ? '' : `${i.tag}: `}${who} fails it: ${a.reason} Evidence: "${a.evidence}"`; }));
      } else if (enough) { c.v = 'pass'; delete c.e; }
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
// writer: the vendor whose model wrote the text that is new since the last verification (the last declaration when omitted); the
// vendors that wrote a unit supply no verdict on it, unless both did.
export function verify(project, paper = 'paper', { build: builder = () => build(project, paper), corpus = () => storedCorpus(path.resolve(project, '..', '..')), sources, wip, writer, dry = false, now = new Date() } = {}) {
  const old = sealed(project, paper) ? json(stateFile(project, paper)) : null, id = crypto.randomBytes(4).toString('hex');
  const { print, doc, ctx, list, units, questions, advice, judged, total } = examine(project, paper, { build: builder, corpus, ...(sources ? { sources } : {}), baseline: old?.baseline ?? null, prior: (unit, rule) => old?.units?.[unit]?.checks?.[rule], run: id });
  const who = writer ?? declaredWriter(project, paper), rec = recorded(project, paper), judges = required(project, paper), by = authorship(doc, old, who);
  for (const [unit, u] of Object.entries(units)) { if (by.wrote.has(unit)) u.wrote = by.wrote.get(unit); u.writers = by.writers.get(unit) ?? []; }
  const used = settle(units, questions, rec, judges);
  const tally = list.filter(rule => !CHECKS[rule.kind].advice).map(rule => Object.values(units).reduce((c, u) => (u.checks[rule.id] && c[u.checks[rule.id].v]++, c), { id: rule.id, kind: rule.kind, pass: 0, fail: 0, pending: 0, unjudged: 0 }));
  const pick = (...which) => Object.entries(units).flatMap(([unit, u]) => Object.entries(u.checks).filter(([, c]) => which.includes(c.v)).map(([rule, c]) => ({ unit, rule, where: u.where, at: u.at, verdict: c.v, evidence: c.e })));
  const sentences = doc.units.filter(prose), lit = ctx.corpus(), open = pick('fail', 'unjudged'), awaiting = pick('pending');
  const state = { version: 2, tool: TOOL, paper, hash: print.gate, source_hash: print.source, run: { id, time: now.toISOString(), judged, total }, complete: !open.length && !awaiting.length,
    counts: { sentences: sentences.length, paragraphs: doc.units.filter(u => u.kind === 'paragraph').length, titles: doc.units.filter(u => u.kind === 'title').length,
      numbers: sentences.reduce((n, u) => n + u.numbers.length, 0), symbols: new Set(sentences.flatMap(u => [...ctx.used(u)])).size, terms: new Set(sentences.flatMap(u => u.terms)).size },
    rules: tally, orphans: ctx.orphans, baseline: ctx.baseline, corpus: lit && { hash: lit.hash, cutoff: lit.cutoff, documents: lit.documents, words: lit.words, built: lit.built }, approved: [...ctx.approved].sort(), outline: ctx.outline.counts, grounds: ctx.grounds.counts,
    independent: { writer: who, judges, awaiting: awaiting.length, rest: Object.values(units).reduce((n, u) => n + Object.values(u.checks).filter(c => c.by && c.v !== 'pending').length, 0),
      runs: [...rec.runs.values()].map(r => ({ ...r, answers: used.get(r.id) || 0 })) },
    wip: wip ? { hash: print.gate, declared: now.toISOString(), note: wip, units: [...open, ...awaiting].map(({ unit, rule, where }) => ({ unit, rule, where })) } : old?.wip?.hash === print.gate ? old.wip : null, units };
  const text = serialize(state);
  if (dry) return { state, open, awaiting, questions, advice, list };       // a plan: nothing is written, and a manuscript is not enrolled by it
  write(stateFile(project, paper), text);
  writeJSON(sealFile(project, paper), { file: sha(text), run: id, time: now.toISOString(), writer: who });
  return { state, open, awaiting, questions, advice, list };
}

const LIMITS = 'Not judged at this stage: whether the notes, the data and the cited sources that a sentence rests on are themselves right (that is the review of the calculations and cite-check), and anything in them beyond the passages its entry in GROUNDS.json quotes (a judge sees a sentence with its paragraph and its headings, the passages it rests on, and under the rules of the outline its entry and the central claims, nothing else); whether the outline registers the right central claims, beyond the results that the abstract states; a restriction made once for a whole Section, which the judge of a later paragraph sees only under claim-scope and only when the outline registers the sentence as its setting; the headings of `\\paragraph` level and the title of the paper; whether a sentence could be better (the search for a better sentence gives advice on request, `paper-judge --advice`, and no verdict); single words and the wording of a phrase beyond its adjacent word pairs and hyphenated compounds; numerals in display equations and table cells; one, ordinals and comparisons with zero; indices of symbols.';
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
    state.grounds ? `Grounds: ${Object.values(state.grounds).reduce((n, k) => n + k, 0)} sentences with an entry in GROUNDS.json (${Object.entries(state.grounds).sort().map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}).` : 'Grounds: none (GROUNDS.json).',
    state.outline ? `Outline: ${state.outline.claims} central claim${state.outline.claims === 1 ? '' : 's'}, ${state.outline.setting ? `${state.outline.setting} sentence${state.outline.setting === 1 ? '' : 's'} of the setting, ` : ''}${state.outline.sections} Section${state.outline.sections === 1 ? '' : 's'} and ${state.outline.entries} paragraph entr${state.outline.entries === 1 ? 'y' : 'ies'} (OUTLINE.json).` : 'Outline: none (OUTLINE.json).',
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
