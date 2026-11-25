// Literature corpus of the term check, stage 2 of harness/design/paper-verification.md: the
// primary hep-th sources of the wiki whose inspected version is dated strictly before the cutoff
// (PAPER-REVIEW, "Language and content check", item 4). Built into .harness-local/corpus.json;
// the wiki is only read.
import fs from 'node:fs';
import path from 'node:path';
import { json, write, sha, wiki } from './core.mjs';
import { group, macros, expand, plain, symbols, segments, uncomment } from './tex.mjs';

export const VERSION = 1;                                // raise when the extraction or the folding changes: an older corpus is refused
export const ATTESTED = 2;                               // corpus papers a wording must occur in; one paper does not establish it
const BREAK = '|', MIN_WORDS = 100;
const DISPLAY = 'equation|align|alignat|flalign|eqnarray|gather|multline|displaymath|subequations';
const OPAQUE = 'tabular|tabularx|array|longtable|tikzpicture|picture|verbatim|lstlisting|minted|filecontents|ytableau';
const file = root => path.join(root, '.harness-local', 'corpus.json');

// One word -> its comparison form: lower case, no possessive, singular.
export function fold(word) {
  const w = word.toLowerCase().replace(/['’]s?$/, '');
  return w.length < 4 ? w : w.endsWith('ies') ? w.slice(0, -3) + 'y' : /(?:ss|sh|ch|x|z)es$/.test(w) ? w.slice(0, -2) : w.endsWith('s') && !/(?:ss|us|is)$/.test(w) ? w.slice(0, -1) : w;
}
// A phrase -> its key: the folded words in order, a hyphen counting as a space.
export const key = phrase => phrase.split(/[\s-]+/).filter(Boolean).map(fold).join(' ');
// Words of a prose view in reading order, BREAK where two words are not adjacent in one phrase.
function words(prose) {
  const out = [];
  const cut = () => { if (out.at(-1) !== BREAK) out.push(BREAK); };
  for (const segment of segments(prose)) {
    for (const w of segment) { if (w) out.push(...w.split('-').filter(Boolean).map(fold)); else cut(); }
    cut();
  }
  return out;
}

// Every command matched by `re` (ending just before its '{') with its balanced group -> replace(group text).
function groups(s, re, replace) {
  let out = '', pos = 0;
  for (let m; (m = re.exec(s));) {
    const b = m.index + m[0].length, e = group(s, b);
    if (e < 0) continue;
    out += s.slice(pos, m.index) + replace(s.slice(b + 1, e - 1));
    pos = re.lastIndex = e;
  }
  return out + s.slice(pos);
}
// Macro, environment and harvmac reference definitions removed, so that their bodies are not read as prose.
function undefine(s) {
  const re = /\\(?:([gex]?def|[ln]ref)|((?:re)?newcommand|providecommand|DeclareMathOperator|DeclareRobustCommand)\*?|(?:re)?newenvironment\*?)(?![A-Za-z@])/g;
  let out = '', pos = 0;
  for (let m; (m = re.exec(s));) {
    let i = m.index + m[0].length, left = m[1] ? 1 : m[2] ? 2 : 3;      // groups in braces still to skip
    if (m[1]) { i = s.indexOf('{', i); if (i < 0 || i - m.index > 200) continue; }
    else { const name = /\s*\\[A-Za-z@]+/y; name.lastIndex = i; if (m[2] && name.exec(s)) { i = name.lastIndex; left--; } }
    for (; left > 0; left--) {
      const gap = /(?:\s|\[[^\]]*\])*/y;
      gap.lastIndex = i; gap.exec(s);
      const e = s[gap.lastIndex] === '{' ? group(s, gap.lastIndex) : -1;
      if (e < 0) break;
      i = e;
    }
    out += s.slice(pos, m.index) + ' ';
    pos = re.lastIndex = Math.max(i, re.lastIndex);
  }
  return out + s.slice(pos);
}
// One TeX source -> its words (mathematics, references, punctuation and paragraph ends break a phrase) and the symbols of its mathematics.
export function extract(raw) {
  const table = macros(raw), formulas = [];
  let s = undefine(raw);                                 // first, so that \Title and \listrefs are found in the text and not in harvmac's own definitions
  const head = /\\Title\b/.exec(s), begin = s.indexOf('\\begin{document}');
  s = head ? s.slice(head.index) : begin < 0 ? s : s.slice(begin + 16);
  s = expand(s.split(/\\(?:begin\s*\{thebibliography\}|bibliography\s*\{|listrefs\b|bye\b|end\s*\{document\})/)[0], table);
  s = s.replace(new RegExp(`\\\\begin\\s*\\{((?:${DISPLAY})\\*?)\\}([\\s\\S]*?)\\\\end\\s*\\{\\1\\}`, 'g'), (all, name, body) => { formulas.push(body); return ' ⟦D⟧ '; });
  s = groups(s, /\\eqna?\s*\\[A-Za-z@]+\s*(?=\{)/g, body => { formulas.push(body); return ' ⟦D⟧ '; });
  s = s.replace(new RegExp(`\\\\begin\\s*\\{((?:${OPAQUE})\\*?)\\}[\\s\\S]*?\\\\end\\s*\\{\\1\\}`, 'g'), ' ⟦D⟧ ');
  // One pass from left to right, as TeX reads: in "$a$$b$" the two dollars between the formulas open no display.
  s = s.replace(/(?<!\\)\$\$([\s\S]*?)\$\$|(?<!\\)\\\[([\s\S]*?)\\\]|(?<!\\)\$((?:\\[\s\S]|[^$\\\n]|\n(?![ \t]*\n))*)\$|\\\(([\s\S]*?)\\\)/g,
    (all, a, b, c, d) => { formulas.push(a ?? b ?? c ?? d); return a === undefined && b === undefined ? '⟦M⟧' : ' ⟦D⟧ '; });
  s = groups(s, /\\(?:title|chapter|(?:sub){0,2}section|(?:sub)?paragraph|caption|footnote|foot|newsec|subsec)\*?\s*(?:\[[^\]]*\]\s*)?(?=\{)/g, text => ` ⟦P⟧ ${text} ⟦P⟧ `);
  s = s.replace(/\n[ \t]*\n|\\(?:item|par)(?![A-Za-z])|\\(?:begin|end)\s*\{[^}]*\}(?:\[[^\]]*\])?/g, ' ⟦P⟧ ');
  s = s.replace(/\}\{/g, '} ⟦P⟧ {');                    // two arguments of one command are two texts (\Title{number}{title})
  const keys = new Set();
  for (const f of formulas) {
    try { for (const k of symbols([f])) keys.add(k); } catch { /* a formula the symbol reader cannot follow contributes its letter runs only */ }
    for (const m of f.matchAll(/(?<![\\A-Za-z@])[A-Za-z]{2,}(?![A-Za-z])/g)) keys.add(m[0]);     // multi-letter names (SU, Tr)
  }
  return { words: words(plain(s)), keys: [...keys].sort() };
}
// A file of a paper with its literal \input and \include files, comments removed.
function source(dir, name, seen = new Set()) {
  const target = path.resolve(dir, name);
  if (seen.has(target) || !target.startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return '';
  seen.add(target);
  const text = fs.readFileSync(target, 'utf8').replace(/\r\n?/g, '\n').split('\n').map(raw => { const line = uncomment(raw); return raw.trim() && !line.trim() ? null : line; }).filter(line => line !== null).join('\n');
  return text.replace(/\\(?:input|include)(?![A-Za-z])\s*(?:\{([^}]+)\}|([^\s{}\\%]+))/g, (all, a, b) => { const n = (a || b).trim(); return source(dir, /\.[A-Za-z]+$/.test(n) ? n : `${n}.tex`, seen); });
}

const assemble = (head, docs) => ({ ...head, documents: docs.length, words: docs.reduce((n, d) => n + d.words.filter(w => w !== BREAK).length, 0), docs: docs.map(d => d.words), symbols: docs.map(d => d.keys) });
// A corpus held in memory, one TeX text for each paper (rule samples and tests).
export function fromTex(list, cutoff = 'sample') {
  const docs = list.map(extract);
  return assemble({ version: VERSION, cutoff, built: null, hash: sha(JSON.stringify(docs)), papers: docs.map((d, i) => ({ id: `sample-${i + 1}` })), excluded: [] }, docs);
}
// Build the corpus from the wiki sources and store it. The cutoff is two calendar years before `now` unless an earlier one is given.
export function build(root, { dir, now = new Date(), cutoff } = {}) {
  const limit = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  cutoff ??= limit;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || cutoff > limit) throw Error(`The cutoff must be a date (YYYY-MM-DD) not after ${limit}: language evidence comes from versions released at least two years before the review.`);
  const base = path.join(dir ?? wiki(root), 'sources', 'arxiv'), papers = [], excluded = [], docs = [];
  for (const name of fs.readdirSync(base).sort()) {
    const meta = path.join(base, name, 'meta.json'), tex = path.join(base, name, 'tex');
    if (!fs.existsSync(meta)) continue;
    const m = json(meta), id = m.arxiv_id || name, drop = reason => excluded.push({ id, reason });
    if (!(m.categories || []).includes('hep-th')) { drop('not hep-th'); continue; }
    if (!m.updated || m.updated >= cutoff) { drop('inspected source not dated before the cutoff'); continue; }
    // A file named .tex that holds a zero byte is an archive stored under that name, not a source.
    const files = fs.existsSync(tex) ? fs.readdirSync(tex).filter(f => f.endsWith('.tex') && !fs.readFileSync(path.join(tex, f)).subarray(0, 8192).includes(0)).sort() : [];
    if (!files.length) { drop('no TeX source'); continue; }
    // The root file: the one that opens the document (a large chapter file is not it); without any (harvmac), main.tex or the largest file.
    const roots = files.filter(f => fs.readFileSync(path.join(tex, f), 'utf8').includes('\\begin{document}')), pool = roots.length ? roots : files;
    const main = pool.includes('main.tex') ? 'main.tex' : pool.reduce((a, b) => fs.statSync(path.join(tex, b)).size > fs.statSync(path.join(tex, a)).size ? b : a);
    let doc;
    try { doc = extract(source(tex, main)); } catch (e) { drop(`extraction failed (${e.message.slice(0, 80)})`); continue; }
    const count = doc.words.filter(w => w !== BREAK).length;
    if (count < MIN_WORDS) { drop(`fewer than ${MIN_WORDS} words extracted`); continue; }
    papers.push({ id, date: m.date, updated: m.updated, root: `${name}/tex/${main}`, words: count, text: sha(JSON.stringify(doc)).slice(0, 16) });
    docs.push(doc);
  }
  const corpus = assemble({ version: VERSION, cutoff, built: now.toISOString(), hash: sha(JSON.stringify([VERSION, cutoff, papers.map(p => [p.id, p.text])])), papers, excluded }, docs);
  write(file(root), JSON.stringify({ ...corpus, docs: corpus.docs.map(d => d.join(' ')) }));
  return corpus;
}
// The stored corpus, or null when none was built by this version.
export function load(root) {
  if (!fs.existsSync(file(root))) return null;
  const stored = json(file(root));
  return stored.version === VERSION ? { ...stored, docs: stored.docs.map(d => d.split(' ')) } : null;
}
// For each key: the corpus papers that contain that word sequence, and its occurrences.
export function attest(corpus, keys) {
  const first = new Map(), out = new Map();
  for (const k of keys) {
    const g = k.split(' ');
    if (!k || out.has(k)) continue;
    out.set(k, { papers: 0, count: 0, ids: [] });
    if (first.has(g[0])) first.get(g[0]).push([k, g]); else first.set(g[0], [[k, g]]);
  }
  corpus.docs.forEach((doc, d) => {
    for (let i = 0; i < doc.length; i++) {
      const list = first.get(doc[i]);
      if (!list) continue;
      for (const [k, g] of list) {
        if (!g.every((w, j) => doc[i + j] === w)) continue;
        const o = out.get(k), id = corpus.papers[d].id;
        if (o.ids.at(-1) !== id) { o.papers++; o.ids.push(id); }
        o.count++;
      }
    }
  });
  return out;
}
// Corpus papers whose mathematics contains the symbol key.
export const symbolPapers = (corpus, k) => corpus.symbols.filter(keys => keys.includes(k)).length;
