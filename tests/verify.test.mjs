import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from '../harness/core.mjs';
import { load, numbers, numericSides, value, symbols, terms, plain } from '../harness/tex.mjs';
import { verify, rules, report, strandedHeaders, overfull, standing, BLOCK_LIMIT } from '../harness/verify.mjs';
import { build as buildCorpus, load as loadCorpus, fromTex, attest, key, fold, symbolPapers } from '../harness/corpus.mjs';
import { installHooks, toolMatcher } from '../harness/install-hooks.mjs';
import { queue, flush } from '../harness/checkpoint.mjs';
import { hook, main, checkProject } from '../harness/cli.mjs';
import { settle } from './judges.mjs';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hep verify 한글 '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(root, name, content = '') { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2)); }
// A project with one manuscript; extra maps project-relative paths to contents.
function make(t, tex, extra = {}) {
  const root = temp(t), project = path.join(root, 'projects', 'demo');
  put(project, 'paper/main.tex', tex);
  for (const [name, content] of Object.entries(extra)) put(project, name, content);
  return { root, project };
}
// An empty corpus: every word pair of the fixtures below occurs once and awaits the independent verdict.
const built = { build: () => ({ log: '', pages: ['text'] }), corpus: () => fromTex([]) };
const failing = (r, rule) => r.open.filter(f => f.rule === rule && f.verdict === 'fail').flatMap(f => f.evidence);
const verdicts = (r, rule, v) => Object.values(r.state.units).filter(u => u.checks[rule]?.v === v).length;
const edit = (project, from, to, file = 'paper/main.tex') => { const p = path.join(project, file), s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(from)); fs.writeFileSync(p, s.replace(from, to)); };

const MAIN = String.raw`\documentclass{article}
\def\CN{{\cal N}}
\newcommand{\be}{\begin{equation}}
\newcommand{\ee}{\end{equation}}
\title{Fixed points of two-node quivers}
\abstract{We study $\CN=1$ quivers.}
\begin{document}
\maketitle
\section{Introduction}\label{sec:intro}
We study quivers with gauge group $SU(N)$, where $N$ is the rank. The one-loop coefficient is % a comment
\be
b = 3N - N_f\,,\label{eq:b}
\ee
where $N_f$ is the number of flavors, e.g. $N_f=2$. In all, 208 theories remain (see Section~\ref{sec:list}).\footnote{Ten of them are listed in Fig.~\ref{fig:a}.}
% a comment line inside the source does not end the paragraph

\input{sections/list}

\begin{figure}
\includegraphics[width=3cm]{a.pdf}
\caption{The six flows. Case (3) is excluded.}\label{fig:a}
\end{figure}
\renewcommand{\arraystretch}{1.4}

\acknowledgments
We thank J. Doe for 3 discussions.
\end{document}
`;
const LIST = String.raw`\section{The list}\label{sec:list}
The theories are of three kinds:
\begin{itemize}[leftmargin=2em]
\item Type I has $a\simeq 0.152$.
\item Type II has a central charge $27/128$.
\end{itemize}
`;

test('decomposition: titles, paragraphs and sentences across inputs, macros, displays, lists, captions and footnotes', t => {
  const { project } = make(t, MAIN, { 'paper/sections/list.tex': LIST });
  const doc = load(project, 'paper/main.tex'), sentences = doc.units.filter(u => u.kind === 'sentence');
  assert.deepEqual(doc.units.filter(u => u.kind === 'title').map(u => [u.where, u.prose]), [['title', 'Fixed points of two-node quivers'], ['§1', 'Introduction'], ['§2', 'The list']]);
  assert.deepEqual(sentences.map(u => [u.role, u.prose]), [
    ['abstract', 'We study ⟦M⟧ quivers.'],
    ['body', 'We study quivers with gauge group ⟦M⟧, where ⟦M⟧ is the rank.'],
    ['body', 'The one-loop coefficient is ⟦D⟧ where ⟦M⟧ is the number of flavors, e.g. ⟦M⟧.'],
    ['body', 'In all, 208 theories remain (see Section ⟦R⟧).'],
    ['footnote', 'Ten of them are listed in Fig. ⟦R⟧.'],
    ['body', 'The theories are of three kinds:'],
    ['item', 'Type I has ⟦M⟧.'],
    ['item', 'Type II has a central charge ⟦M⟧.'],
    ['caption', 'The six flows.'],
    ['caption', 'Case (3) is excluded.'],
  ]);
  assert.deepEqual(sentences.map(u => u.numbers.map(n => n.key)), [['1'], [], ['2'], ['208'], ['ten'], ['three'], ['0.152'], ['27/128'], ['six'], ['3']]);
  const by = text => sentences.find(u => u.prose.includes(text));
  assert.equal(by('The one-loop').displays.length, 1);
  assert.ok(by('We study ⟦M⟧ quivers').text.includes('{\\cal N}=1'), 'preamble macros are expanded');
  assert.equal(by('Type II has').file, 'paper/sections/list.tex'); assert.equal(by('Type II has').line, 5);
  assert.equal(by('In all').where, '§1 ¶1 s3'); assert.equal(by('In all').file, 'paper/main.tex');
  assert.equal(doc.labels['eq:b'], by('The one-loop').id); assert.equal(doc.labels['fig:a'], by('The six flows').id);
  assert.equal(doc.units.find(u => u.id === doc.labels['sec:list']).prose, 'The list');
  assert.equal(new Set(doc.units.map(u => u.id)).size, doc.units.length);
  assert.equal(load(project, 'paper/main.tex').units[3].id, doc.units[3].id, 'unit ids are content hashes');
});

test('numerals, numeric formulas, symbols, prose view and candidate terms are extracted by fixed rules', () => {
  assert.deepEqual(numbers('We find 208 theories, 4 of rank-2 type in 4d, twenty-two with two-node quivers, thirty-five in all and 1,024 more at 0.5.', []).map(n => [n.key, n.value]),
    [['208', 208], ['4', 4], ['twenty-two', 22], ['thirty-five', 35], ['1,024', 1024], ['0.5', 0.5]]);
  assert.deepEqual(numbers('Both ⟦M⟧ and ⟦M⟧ hold, as do 3 and 3.', ['\\CN=1', 'N_f=1']).map(n => n.key), ['1', '1#2', '3', '3#2']);
  assert.deepEqual(numericSides('r_{\\rm bif}=3-\\tfrac{\\sqrt{73}}{3}\\simeq0.152'), ['3-\\tfrac{\\sqrt{73}}{3}', '0.152']);
  assert.ok(Math.abs(value('3-\\tfrac{\\sqrt{73}}{3}') - 0.152) < 5e-4);
  assert.deepEqual([numericSides('g_1\\neq0'), numericSides('SU(2)'), numericSides('O(1/N)'), numericSides('(0,1,4)')], [[], [], [], ['(0,1,4)']]);
  assert.deepEqual([value('(0,1,4)'), value('\\tfrac12'), value('45{,}221'), value('27/128'), value('N/2')], [[0, 1, 4], 0.5, 45221, 0.2109375, null]);
  assert.ok(Math.abs(value('-\\frac{7}{2}+\\frac{3\\sqrt{5}}{2}') + 0.1459) < 1e-4);
  assert.deepEqual([...symbols(['SU(N)\\times SU(N)', 'N^{(a)}_{\\rm rank\\text{-}2}', 'N_{\\text{bif}}', '{\\cal N}=1', '\\tilde Q', 'b_0^{(2)}(\\mathcal{A})', '\\text{Type}^{(a)}', 'x \\text{ and } y'], ['SU'])],
    ['SU', 'N', 'N_{rank-2}', 'N_{bif}', '\\mathcal{N}', '\\tilde{Q}', 'b', '\\mathcal{A}', '\\mathrm{Type}', 'x', 'y']);
  assert.equal(plain('In Section~\\ref{a} \\cite[p.~3]{b} we \\emph{prove} it\\renewcommand{\\arraystretch}{1.4}.'), 'In Section ⟦R⟧ ⟦C⟧ we prove it.');
  const found = terms('In the saddle scenario the symmetry-quotient method counts the one-pair theories.');
  for (const coined of ['saddle scenario', 'symmetry-quotient method', 'one-pair theories']) assert.ok(found.some(x => x.includes(coined)), coined);
});

test('a rule is refused unless its check flags its failing text and passes its passing text', t => {
  const { project } = make(t, 'The critical point is unstable.');
  const rule = { id: 'no-saddle', kind: 'banned', pattern: '\\bsaddle', source: 'user 2026-11-25: "saddle 별로야"', fail: ['In the saddle scenario the flow ends.'], pass: ['The critical point is not a local maximum.'] };
  const register = r => put(project, 'paper/RULES.json', { version: 1, rules: [r] });
  register(rule); assert.equal(rules(project).length, rules(path.join(project, 'none')).length + 1);
  register({ ...rule, fail: ['The mirror theory flows there.'] }); assert.throws(() => verify(project, 'paper', built), /no-saddle refused: its check does not flag the failing text/);
  register({ ...rule, pass: ['A saddle point of the trial function.'] }); assert.throws(() => rules(project), /does not pass the passing text/);
  register({ ...rule, pass: [] }); assert.throws(() => rules(project), /one text that must fail and one that must pass/);
  register({ ...rule, source: '' }); assert.throws(() => rules(project), /where the rule comes from/);
  register({ ...rule, pattern: '(' }); assert.throws(() => rules(project), /no-saddle refused: its check cannot run/);
  register({ ...rule, kind: 'oracle' }); assert.throws(() => rules(project), /unknown check kind oracle \(decided by code: .*; decided by the independent verdict: judge, better\)/);
  register({ ...rule, kind: 'judge' }); assert.throws(() => rules(project), /no-saddle refused: a rule judged by a reader needs its question/);
  register({ ...rule, id: 'hard-wrap' }); assert.throws(() => rules(project), /registered twice/);
  assert.ok(!fs.existsSync(path.join(project, 'paper/VERIFY.json')), 'a refused rule produces no verdict file');
});

test('banned words, reference capitals, sentence-case titles, aside punctuation and hard wraps are flagged where they occur', t => {
  const { project } = make(t, String.raw`\section{Conformal Window}
The saddle-type point is unstable, as shown in section~\ref{s}.

This Section follows Seiberg duality --- as expected --- and SQCD.

\subsection{Seiberg duality and SQCD: a review}
Three flows remain: the first is trivial.
The second is wrapped onto a new line.

We find:
\begin{equation}
x=y.
\end{equation}
`, { 'paper/RULES.json': { version: 1, rules: [{ id: 'no-saddle', kind: 'banned', pattern: '\\bsaddle', source: 'user 2026-11-25', fail: ['the saddle scenario'], pass: ['a critical point'] }] } });
  const r = verify(project, 'paper', built);
  assert.deepEqual(failing(r, 'no-saddle'), ['"saddle"']);
  assert.match(failing(r, 'reference-capital').join(), /^"section ⟦R⟧"/); assert.equal(failing(r, 'reference-capital').length, 1);
  assert.deepEqual(failing(r, 'sentence-case-title'), ['"Window" is capitalized in the title and nowhere in the running text']);
  assert.equal(failing(r, 'aside-punctuation').length, 1); assert.match(failing(r, 'aside-punctuation')[0], /em-dash/);
  assert.equal(verdicts(r, 'aside-punctuation', 'pending'), 1, 'a colon inside a sentence waits for the independent verdict; a colon before a display passes');
  assert.match(failing(r, 'hard-wrap').join(), /paper\/main\.tex:8 prose is wrapped over 2 source lines/); assert.equal(failing(r, 'hard-wrap').length, 1);
  assert.equal(r.state.complete, false);
});

test('a symbol or defined term needs a definition site that contains it and precedes its use', t => {
  const tex = String.raw`The coupling $g$ is relevant when $b>0$, as is the effective Type.

We denote by $g$ the gauge coupling of the group $SU(N)$ and call $t$ the effective Type.\label{def}
`;
  const lexicon = { symbols: [{ symbol: 'g', at: 'label:def' }, { symbol: 'SU', standard: 'special unitary group' }, { symbol: 't', at: 'label:nowhere' }], terms: [{ term: 'effective Type', at: 'label:def' }] };
  const { project } = make(t, tex, { 'paper/LEXICON.json': lexicon });
  const lit = { ...built, corpus: () => fromTex(['The gauge group is $SU(N)$.', 'We gauge $SU(N)\\times U(1)$.', 'Only this paper writes $N_{\\rm bif}$.']) };
  let r = verify(project, 'paper', lit);
  assert.deepEqual(failing(r, 'defined-before-use').sort(), ['"effective Type" is used before its definition at front ¶2 s1', 'N has no LEXICON entry (no definition site)', 'b has no LEXICON entry (no definition site)',
    'g is used before its definition at front ¶2 s1', 't has a definition site that is not in the manuscript']);
  assert.match(r.state.units.document.checks['defined-before-use'].e[0], /declared standard notation, present in the corpus.*SU/);
  assert.equal(r.state.units.document.checks['defined-before-use'].v, 'pending', 'standard notation found in the corpus still awaits the verdict on its meaning');
  assert.match(verify(project, 'paper', { ...built, corpus: () => null }).state.units.document.checks['defined-before-use'].e[0], /cannot be attested, the corpus is not built.*SU/);
  put(project, 'paper/main.tex', String.raw`We denote by $g$ the gauge coupling of the group $SU(N)$ of rank $N$, by $b$ its one-loop coefficient, and call $t$ the effective Type.\label{def}

The coupling $g$ is relevant when $b>0$, as is the effective Type.
`);
  put(project, 'paper/LEXICON.json', { ...lexicon, symbols: [...lexicon.symbols.slice(0, 2), ...['t', 'N', 'b'].map(symbol => ({ symbol, at: 'label:def' }))] });
  r = verify(project, 'paper', lit);
  assert.deepEqual(failing(r, 'defined-before-use'), []);
  put(project, 'paper/LEXICON.json', { ...lexicon, symbols: [{ symbol: 'g', at: 'label:def' }, { symbol: 'SU', standard: 'special unitary group' }, { symbol: 'N', standard: 'rank' }, { symbol: 'b', standard: 'one-loop coefficient' }, { symbol: 't', standard: 'effective Type' }] });
  assert.deepEqual(failing(verify(project, 'paper', lit), 'defined-before-use'), ['b is declared standard notation (corpus papers with it in their mathematics: 0): it needs a definition site', 't is declared standard notation (corpus papers with it in their mathematics: 0): it needs a definition site'],
    'notation declared standard must occur in the mathematics of two corpus papers');
  put(project, 'paper/LEXICON.json', { symbols: [{ symbol: 'N_f + g', at: 'label:def' }] });
  assert.throws(() => verify(project, 'paper', built), /must be one symbol/);
});

test('a numeral must be bound to a calculation output that agrees with it, or to the place that states it', t => {
  const tex = String.raw`We find 208 theories, of which ten are free.\label{s1}

The central charge is $a\simeq 0.2109$, exactly $27/128$, for the $(0,1,4)$ configuration.\label{s2}

Six cases arise and 17 remain.\label{s3}
`;
  const facts = { facts: { total: { file: 'calc/out.json', pointer: '/total' }, free: { file: 'calc/out.json', pointer: '/free' }, a: { file: 'calc/out.json', pointer: '/a' }, config: { file: 'calc/log.txt', pattern: '^config = (.*)$' }, cases: { at: 'label:s3' }, later: { at: 'label:s3' } },
    uses: { 'label:s1': { 208: 'total', ten: 'free' }, 'label:s2': { '0.2109': 'a', '27/128': 'a', '(0,1,4)': 'config' }, 'label:s3': { six: 'cases' }, 'label:gone': { 5: 'total' } } };
  const { project } = make(t, tex, { 'paper/FACTS.json': facts, 'calc/out.json': { total: 208, free: 9, a: '27/128' }, 'calc/log.txt': 'run\nconfig = (0,1,4)\n' });
  let r = verify(project, 'paper', built);
  assert.deepEqual(failing(r, 'number-bound'), ['"ten" disagrees with fact free = 9 (calc/out.json)', '"17" is not bound to a fact']);
  assert.match(r.state.units[load(project).labels.s3].checks['number-bound'].e.join(), /"17" is not bound/);
  assert.deepEqual(r.state.orphans, ['label:gone']);
  edit(project, 'ten are free', 'nine are free'); edit(project, ' and 17 remain', '');
  put(project, 'paper/FACTS.json', { ...facts, uses: { ...facts.uses, 'label:s1': { 208: 'total', nine: 'free' } } });
  r = verify(project, 'paper', built);
  assert.deepEqual(failing(r, 'number-bound'), []);
  assert.equal(verdicts(r, 'number-bound', 'pending'), 1, 'a stated number waits for the independent verdict');
  const before = r.state.units, ids = load(project).labels;
  put(project, 'calc/out.json', { total: 204, free: 9, a: '27/128' });                 // the data change: only the sentences that use it are judged again
  r = verify(project, 'paper', built);
  assert.deepEqual(failing(r, 'number-bound'), ['"208" disagrees with fact total = 204 (calc/out.json)']);
  const again = Object.entries(r.state.units).filter(([id, u]) => Object.entries(u.checks).some(([rule, c]) => c.r !== before[id].checks[rule].r)).map(([id]) => id).sort();
  assert.deepEqual(again, [ids.s1, ids.s2].sort());
  put(project, 'calc/out.json', { total: 208, free: 9, a: '27/128' }); put(project, 'calc/run.json', { execution: 'FAIL' });
  assert.match(failing(verify(project, 'paper', built), 'number-bound').join(), /the evidence run of fact total did not pass/);
  fs.rmSync(path.join(project, 'calc/run.json'));
  put(project, 'paper/FACTS.json', { ...facts, uses: { 'label:s1': { 208: 'later', nine: 'missing' } } });
  assert.deepEqual(failing(verify(project, 'paper', built), 'number-bound').slice(0, 2), ['"208": fact later points to front ¶3 s1, after this sentence', '"nine" is bound to the unknown fact missing']);
});

// A vault next to the harness root: sources/arxiv/<name>/meta.json and tex/.
function vault(t, papers) {
  const base = temp(t), root = path.join(base, 'harness'), dir = path.join(base, 'vault');
  fs.mkdirSync(root); put(dir, 'Index.md'); put(dir, 'wiki/page.md');
  for (const [name, meta, files] of papers) { put(dir, `sources/arxiv/${name}/meta.json`, { arxiv_id: name, date: '2010-01-01', categories: ['hep-th'], ...meta }); for (const [f, text] of Object.entries(files)) put(dir, `sources/arxiv/${name}/tex/${f}`, text); }
  return { root, dir };
}
const filler = 'The superpotential preserves the flavor symmetry of the gauge theory. '.repeat(12);
test('the corpus holds the hep-th sources dated before the cutoff, as word sequences that stop at mathematics, references and punctuation', async t => {
  const latex = String.raw`\documentclass{article}
\newcommand{\be}{\begin{equation}}
\newcommand{\ee}{\end{equation}}
\def\CN{{\cal N}}
\newcommand{\spurious}[1]{macro body words}
\title{Not read}
\begin{document}
\section{Conformal Windows}
The conformal window of the $\CN=1$ gauge theory is wide. % the comment words
The single-node quivers have a window $x$ boundary and a window \cite{a} edge.
\be
a = \mathrm{Tr}\, R^3 \text{ display words} \,,\label{eq:a}
\ee
The gauge theory has Seiberg duality for $N_f$$>N_c$ adjacent formulas.

Massless quarks appear here.\footnote{The node's couplings run.}
\input{sec}
\bibliography{refs}
After the bibliography nothing is read.
\end{document}
`, harvmac = String.raw`\def\Title#1#2{\centerline{#1 definition words}}
\def\listrefs{\immediate\closeout}
\lref\ref{An author, a reference title.}
\Title{HUTP}{Conformal windows again}
\newsec{The model}
The conformal window of single node quivers $SU(N)$ is known.
\eqn\central{ a = c \,, }
` + filler + '\n\\listrefs\n\\bye\n';
  const { root, dir } = vault(t, [
    ['1001.0001', { updated: '2020-03-01' }, { 'paper.tex': latex, 'sec.tex': filler + filler + filler, 'other.tex': 'An unused file with stray words.', 'main.tex': 'archive\u0000\u0000 \\begin{document} ' + 'Archived junk words. '.repeat(400) }],
    ['hep-th-0001001', { arxiv_id: 'hep-th/0001001', updated: '2024-11-24' }, { 'paper.tex': harvmac, 'short.tex': 'x' }],
    ['2411.00001', { updated: '2024-11-25' }, { 'main.tex': filler }],
    ['1001.0003', { updated: '2020-03-01', categories: ['math.AG'] }, { 'main.tex': filler }],
    ['1001.0004', { updated: '2020-03-01' }, {}],
    ['1001.0005', { updated: '2020-03-01' }, { 'main.tex': 'Too short to count.' }],
  ]);
  const now = new Date(2026, 10, 25), c = buildCorpus(root, { dir, now }), n = phrase => attest(c, [key(phrase)]).get(key(phrase)).papers;
  assert.deepEqual([c.cutoff, c.papers.map(p => p.id), c.documents], ['2024-11-25', ['1001.0001', 'hep-th/0001001'], 2], 'the cutoff is two calendar years before the build and is exclusive');
  assert.deepEqual(c.excluded, [{ id: '1001.0003', reason: 'not hep-th' }, { id: '1001.0004', reason: 'no TeX source' }, { id: '1001.0005', reason: 'fewer than 100 words extracted' }, { id: '2411.00001', reason: 'inspected source not dated before the cutoff' }]);
  assert.deepEqual(['conformal window', 'conformal windows', 'Conformal Window', 'single-node quivers', 'single node quiver', 'flavor symmetry', 'gauge theory'].map(n), [2, 2, 2, 2, 2, 2, 2], 'case, the plural and the hyphen do not distinguish a wording');
  assert.deepEqual(['Seiberg duality', "node couplings", 'massless quarks', 'adjacent formulas'].map(n), [1, 1, 1, 1], 'two adjacent inline formulas open no display');
  assert.deepEqual(['window boundary', 'window edge', 'HUTPConformal', 'HUTP conformal', 'duality massless', 'wide the single', 'comment words', 'display words', 'macro body', 'definition words', 'reference title', 'stray words', 'bibliography nothing', 'not read', 'here the node', 'run the superpotential', 'junk words'].map(n), new Array(17).fill(0),
    'mathematics, a citation, a sentence end, a paragraph end, a footnote, comments, displays, definitions and the bibliography do not join or supply words');
  assert.deepEqual(['\\mathcal{N}', 'SU', 'Tr', 'a', 'N_{bif}'].map(k => symbolPapers(c, k)), [1, 1, 1, 2, 0]);
  assert.deepEqual(['theories', 'classes', 'windows', "node's", 'analysis', 'gauss', 'has'].map(fold), ['theory', 'class', 'window', 'node', 'analysis', 'gauss', 'has']);
  assert.equal(c.words, c.docs.flat().filter(w => w !== '|').length);
  const stored = loadCorpus(root);
  assert.deepEqual([stored.hash, stored.docs, stored.symbols], [c.hash, c.docs, c.symbols]); assert.equal(buildCorpus(root, { dir, now: new Date(2026, 10, 26) }).hash === c.hash, false, 'a later build has a later cutoff');
  assert.equal(buildCorpus(root, { dir, now, cutoff: '2024-11-25' }).hash, c.hash, 'the same sources and cutoff give the same corpus');
  assert.deepEqual(buildCorpus(root, { dir, now, cutoff: '2021-01-01' }).papers.map(p => p.id), ['1001.0001'], 'an earlier cutoff narrows the corpus');
  assert.deepEqual(c.papers.map(p => p.root), ['1001.0001/tex/paper.tex', 'hep-th-0001001/tex/paper.tex'], 'the root file opens the document, even when an input file is larger and an archive is stored as main.tex');
  assert.throws(() => buildCorpus(root, { dir, now, cutoff: '2025-06-01' }), /not after 2024-11-25/);
  fs.appendFileSync(path.join(dir, 'sources/arxiv/1001.0001/tex/sec.tex'), ' One more sentence.');
  assert.notEqual(buildCorpus(root, { dir, now }).hash, c.hash, 'a changed source changes the corpus');
  const saved = process.env.HEP_WIKI_DIR;
  try {
    delete process.env.HEP_WIKI_DIR;
    const made = await main(['corpus-build', '--cutoff', '2021-01-01'], root);
    assert.deepEqual([made.documents, made.cutoff, made.excluded['inspected source not dated before the cutoff']], [1, '2021-01-01', 2]);
    assert.deepEqual(await main(['corpus-count', 'conformal windows', 'saddle scenario'], root), [{ phrase: 'conformal windows', papers: 1, occurrences: 2, examples: ['1001.0001'] }, { phrase: 'saddle scenario', papers: 0, occurrences: 0, examples: [] }]);
  } finally { if (saved !== undefined) process.env.HEP_WIKI_DIR = saved; }
  put(root, '.harness-local/corpus.json', { ...JSON.parse(fs.readFileSync(path.join(root, '.harness-local/corpus.json'), 'utf8')), version: 0 });
  assert.equal(loadCorpus(root), null, 'a corpus of another version is not used');
  await assert.rejects(main(['corpus-count', 'x'], root), /corpus is not built/);
});

test('a term needs the corpus, a definition site or the user\'s approval: the coined labels of the origin fail and their replacements pass', t => {
  const lit = ['Both gauge couplings are asymptotically free, and the conformal window is wide. A bifundamental pair connects the two nodes.',
    'The gauge couplings are asymptotically free. Conformal windows of each bifundamental pair were found.'];
  const corpus = { build: built.build, corpus: () => fromTex(lit) };
  const { project } = make(t, String.raw`\section{The saddle scenario}
In the saddle scenario both gauge couplings are asymptotically free.\label{s1}

The conformal windows of $N_{\rm bif}$ bifundamental pairs are wide.\label{s2}

The flow-pattern argument uses an imbalanced node.\label{s3}

An imbalanced node decides nothing.\label{s4}
`);
  const term = (r, label) => r.state.units[label === 'title' ? Object.keys(r.state.units).find(id => r.state.units[id].kind === 'title') : load(project).labels[label]].checks['term-attested'];
  const needs = "needs attested wording, a definition site or the user's approval", saddle = `"saddle scenario" (corpus papers: 0, sentences or titles here: 2) ${needs}`, node = `"imbalanced node" (corpus papers: 0, sentences or titles here: 2) ${needs}`;
  let r = verify(project, 'paper', corpus);
  assert.deepEqual(['title', 's1', 's2', 's3', 's4'].map(l => term(r, l).v), ['fail', 'fail', 'pass', 'fail', 'fail']);
  assert.deepEqual([term(r, 'title').e, term(r, 's1').e, term(r, 's4').e], [[saddle], [saddle], [node.replace('" (', '" in "imbalanced node decides nothing" (')]], 'a pair absent from the corpus fails when the manuscript repeats it');
  assert.deepEqual(term(r, 's3').e, [`"flow-pattern" in "flow-pattern argument uses" (corpus papers with or without the hyphen: 0) ${needs}`, node], 'an unattested compound fails where it stands, and is reported once');
  assert.match(report('demo', r), /Corpus: 2 hep-th papers, \d+ words, inspected sources dated before sample \([0-9a-f]{12}\)\./);
  const lexicon = { terms: [{ term: 'imbalanced node', at: 'label:s3' }, { term: 'node decides', ordinary: 'subject and verb' }, { term: 'flow pattern', approved: 'user, 2026-11-25: "flow pattern은 써도 돼"' }] };
  put(project, 'paper/LEXICON.json', lexicon);
  r = verify(project, 'paper', corpus);
  assert.deepEqual(['title', 's1', 's2', 's3', 's4'].map(l => term(r, l).v), ['fail', 'fail', 'pass', 'pending', 'pending'], 'a definition site and an approval are grounds; what only a reader can judge waits');
  const once = pair => `"${pair}" in "flow-pattern argument uses" (corpus papers: 0) occurs once: whether it is a term needs the independent verdict`;
  assert.deepEqual(term(r, 's3').e, [once('flow-pattern argument'), once('argument uses')]);
  assert.deepEqual(term(r, 's4').e, ['"decides nothing" in "imbalanced node decides nothing" (corpus papers: 0) occurs once: whether it is a term needs the independent verdict', '"node decides" in "imbalanced node decides nothing" is declared ordinary wording (LEXICON "node decides"): the declaration needs the independent verdict']);
  assert.deepEqual(r.state.approved, ['flow pattern']); assert.match(report('demo', r), /Terms that pass on the user's approval recorded in LEXICON: flow pattern\./);
  edit(project, '\\section{The saddle scenario}', '\\section{Case (5)}'); edit(project, 'In the saddle scenario both', 'In case (5) both');
  r = verify(project, 'paper', corpus);
  assert.deepEqual(failing(r, 'term-attested'), [], 'the replacement passes'); assert.equal(term(r, 's1').v, 'pass');
  const before = r.state.units;
  r = verify(project, 'paper', { ...corpus, corpus: () => fromTex([...lit, 'The argument uses the anomaly.', 'This argument uses unitarity.']) });
  assert.equal(r.state.run.judged, 1); assert.deepEqual(term(r, 's3').e, [once('flow-pattern argument')]);
  assert.deepEqual(Object.keys(r.state.units).filter(id => r.state.units[id].checks['term-attested']?.r !== before[id].checks['term-attested']?.r), [load(project).labels.s3], 'a larger corpus changes only the verdicts whose grounds it changes');
  r = verify(project, 'paper', { ...corpus, corpus: () => null });
  assert.deepEqual(['s1', 's2', 's3'].map(l => term(r, l).v), ['unjudged', 'unjudged', 'unjudged']); assert.equal(r.state.complete, false); assert.match(report('demo', r), /Corpus: not built/);
  assert.match(term(r, 's3').e[0], /the corpus is not built .*"flow-pattern argument" in "flow-pattern argument uses", "argument uses" in "flow-pattern argument uses"$/, 'without the corpus a LEXICON ground still holds and the rest is not judged');
  put(project, 'paper/LEXICON.json', { terms: [{ term: 'imbalanced node', at: 'label:s3', approved: 'user' }] });
  assert.throws(() => verify(project, 'paper', corpus), /LEXICON term "imbalanced node" needs exactly one of at/);
  const other = make(t, 'The Type III theories and the fifteen quivers share the node\'s couplings, twenty-two in all.\n\nThe Type III theories and the fifteen quivers keep the node\'s couplings.');
  r = verify(other.project, 'paper', corpus);
  assert.deepEqual(failing(r, 'term-attested'), new Array(2).fill(`"type iii" in "type iii theories" (corpus papers: 0, sentences or titles here: 2) ${needs}`), 'a roman numeral, a number word and a possessive end a phrase');
});

test('build defects: new overfull boxes, a table header without rows, undefined references; no build is not a pass', t => {
  const { project } = make(t, 'One sentence.');
  const box = n => `Overfull \\hbox (${n}pt too wide) in paragraph at lines 3--4\n`, pages = ['Type a b\n1 2 3\n- 1 -', 'Type a b\n4 5 6\n- 2 -'];
  let r = verify(project, 'paper', { build: () => ({ unavailable: 'latexmk is not installed' }) });
  assert.equal(r.state.complete, false); assert.deepEqual(r.open.map(f => [f.rule, f.verdict]), [['build-defects', 'unjudged']]); assert.equal(r.state.baseline, null);
  r = verify(project, 'paper', { build: () => ({ log: box('46.87863'), pages }) });
  assert.deepEqual([r.open, r.state.units.document.checks['build-defects'].v], [[], 'pass'], 'boxes present at enrollment are the baseline'); assert.deepEqual(r.state.baseline, { overfull: ['46.87863pt in paragraph'] });
  edit(project, 'One', 'Another');
  r = verify(project, 'paper', { build: () => ({ log: box('46.87863') + box('2.5') + "LaTeX Warning: Citation `Doe:2020' on page 1 undefined on input line 3.\n", pages: [pages[0], 'Type a b\nTable 1. The theories.\n- 2 -'] }) });
  assert.deepEqual(failing(r, 'build-defects'), ['new overfull box: 2.5pt in paragraph', 'page 2: the repeated table header "Type a b" stands without a row', "undefined: Citation `Doe:2020'"]);
  edit(project, 'Another', 'A third');
  assert.deepEqual(failing(verify(project, 'paper', { build: () => ({ failed: 'latexmk failed: undefined control sequence' }) }), 'build-defects'), ['latexmk failed: undefined control sequence']);
  assert.deepEqual(strandedHeaders(['a\nfooter line', 'b\nfooter line']), []);
  assert.deepEqual(strandedHeaders(['(1) (2)\ntext\n\u2013 1 \u2013', 'more\n(1) (2)\nTable 1: The theories.\n\u2013 2 \u2013']), [], 'superscripts set on their own line are not a table header');
  assert.deepEqual(overfull('Overfull \\hbox (1.5pt too wide) detected at line 9\n'), ['1.5pt detected']);
});

test('a change invalidates the verdicts of the changed unit and of its dependents, and no others', t => {
  const { project } = make(t, String.raw`We denote by $g$ the gauge coupling.\label{def}

The coupling $g$ is relevant. A second sentence stays.

A third paragraph mentions nothing.
`, { 'paper/LEXICON.json': { symbols: [{ symbol: 'g', at: 'label:def' }] } });
  const first = verify(project, 'paper', built), ids = u => Object.keys(u).sort();
  const second = verify(project, 'paper', built);
  assert.equal(second.state.run.judged, 0); assert.deepEqual(second.state.units, first.state.units);
  const fresh = (r, before) => Object.entries(r.state.units).filter(([id, u]) => Object.values(u.checks).some(c => c.r === r.state.run.id)).map(([id]) => r.state.units[id].where).sort();
  edit(project, 'A second sentence stays.', 'A second sentence changes.');
  const third = verify(project, 'paper', built);
  assert.deepEqual(fresh(third), ['document', 'front ¶2', 'front ¶2 s2'], 'the sentence, its paragraph and the build of the document');
  for (const [id, u] of Object.entries(third.state.units)) if (first.state.units[id] && id !== 'document') assert.deepEqual(u, first.state.units[id]);
  assert.equal(ids(third.state.units).length, ids(first.state.units).length);
  edit(project, 'the gauge coupling.', 'the gauge coupling constant.');
  const fourth = verify(project, 'paper', built);
  assert.deepEqual(fresh(fourth), ['document', 'front ¶1', 'front ¶1 s1', 'front ¶2 s1'], 'the definition, its paragraph and the sentence that uses the defined symbol');
  const pure = JSON.parse(fs.readFileSync(path.join(project, 'paper/VERIFY.json'), 'utf8'));
  assert.deepEqual(pure.units, fourth.state.units); assert.equal(pure.source_hash, standing(project, 'paper').source);
});

const stop = (root, session = 'session-a') => hook(root, { hook_event_name: 'Stop', session_id: session });
// One tool call of a session: the events around it, and optionally a change of the manuscript made while it runs.
function call(root, session, tool_input, during = () => {}, { id = 'c1', end = true } = {}) {
  assert.equal(hook(root, { hook_event_name: 'PreToolUse', session_id: session, tool_name: 'Bash', tool_input, tool_use_id: id }), undefined);
  during();
  if (end) assert.equal(hook(root, { hook_event_name: 'PostToolUse', session_id: session, tool_name: 'Bash', tool_input, tool_use_id: id }), undefined);
}
test('the Stop hook blocks the session that changed an enrolled manuscript, no other session, and releases on verification or declared work in progress', async t => {
  const { root, project } = make(t, 'A sentence about section~\\ref{s}.');
  const file = path.join(project, 'paper/main.tex'), text = n => () => fs.appendFileSync(file, `\n\nMore text ${n}.\n`);
  put(root, 'projects/plain/paper/main.tex', 'An ordinary draft.');
  call(root, 'session-a', { file_path: file, old_string: 'A', new_string: 'One' }, text('alpha'));
  assert.deepEqual(stop(root), {}, 'a manuscript that is not enrolled is never gated');
  assert.deepEqual(fs.readdirSync(path.join(root, 'projects/plain/paper')), ['main.tex']); assert.ok(!fs.existsSync(path.join(root, '.harness-local/verify-sessions')));
  assert.equal(verify(project, 'paper', built).state.complete, false);                  // enrollment
  call(root, 'session-b', { command: 'python3 calc/long_run.py' }, () => call(root, 'session-a', { file_path: file, old_string: 'x', new_string: 'y' }, text('beta')));
  call(root, 'session-c', { command: 'grep -n text projects/demo/paper/main.tex' });
  assert.deepEqual(stop(root, 'session-b'), {}, 'a session working elsewhere is not blocked, even if the change fell inside one of its calls');
  assert.deepEqual(stop(root, 'session-c'), {}, 'reading the manuscript is not changing it');
  let out = stop(root);
  assert.equal(out.decision, 'block'); assert.match(out.reason, /projects\/demo\/paper was changed in this session and is not verified \(no verification of its current text\).*paper-verify demo paper.*block 1 of 3/s);
  verify(project, 'paper', built);
  out = stop(root); assert.equal(out.decision, 'block'); assert.match(out.reason, /1 failing or unjudged verdicts.*block 2 of 3/s);
  edit(project, 'section~', 'Section~'); verify(project, 'paper', built);
  assert.match(stop(root).reason, /\(0 failing or unjudged verdicts, 8 awaiting the independent verdict\).*paper-judge demo paper --writer/s, 'what awaits the independent verdict holds the turn as a failure does');
  assert.equal((await settle(root, built)).result.state.complete, true);
  assert.deepEqual(stop(root), {}, 'verified: released'); assert.deepEqual(stop(root), {});
  call(root, 'session-a', { file_path: '/scratch/fix.py', content: 'open("projects/demo/paper/main.tex")' });      // a script that names the manuscript
  call(root, 'session-a', { command: 'python3 /scratch/fix.py' }, text('in this section~\\ref{t}'), { id: 'c2' });   // and a call that runs it
  assert.equal(stop(root).decision, 'block', 'a scripted edit is attributed through the earlier tool input');
  const wip = verify(project, 'paper', { ...built, wip: 'Section 3 is being rewritten' });
  assert.deepEqual(wip.state.wip.units.map(u => u.rule), ['reference-capital', 'scope-stated', 'in-place'], 'the failure and what awaits the judges for the added sentence');
  assert.match(report('demo', wip), /Work in progress declared .*Section 3 is being rewritten \(3 unverified verdicts.*\(pending\): awaits the independent verdict/s);
  out = stop(root); assert.equal(out.decision, undefined); assert.match(out.systemMessage, /projects\/demo\/paper: work in progress declared/);
  assert.deepEqual(stop(root), {}, 'released until the session changes the manuscript again');
  call(root, 'session-a', { command: 'cd projects/demo && sed -i s/a/b/ paper/main.tex' }, text('gamma'), { end: false });  // a call that fails reports no end
  for (let i = 1; i <= BLOCK_LIMIT; i++) assert.match(stop(root).reason, new RegExp(`block ${i} of ${BLOCK_LIMIT}`), 'a declaration is bound to the text it was made for');
  out = stop(root); assert.equal(out.decision, undefined); assert.match(out.systemMessage, /ends this turn UNVERIFIED after 3 blocks/);
  put(project, 'paper/RULES.json', '{ not json'); call(root, 'session-a', { command: 'sed -i s/a/b/ projects/demo/paper/main.tex' }, text('delta'));
  assert.match(stop(root).reason, /is not verified \(/, 'an unreadable registry blocks instead of breaking the hook');
  fs.rmSync(path.join(project, 'paper/main.tex')); assert.equal(stop(root).decision, 'block', 'a missing manuscript is reported, not thrown');
});

test('queued commits of an unverified enrolled manuscript are marked; the installer adds the tool events once', async t => {
  const { root, project } = make(t, 'A sentence in section~\\ref{s}.');
  for (const repo of [root, project]) { git(repo, ['init', '-b', 'main']); git(repo, ['config', 'user.email', 'test@example.invalid']); git(repo, ['config', 'user.name', 'Harness Test']); }
  put(root, '.gitignore', '.harness-local/\nprojects/\n');
  assert.equal(queue(root, 'projects/demo', ['paper/main.tex'], 'Edit the draft').message, 'Edit the draft', 'not enrolled: no mark');
  fs.rmSync(path.join(root, '.harness-local/pending'), { recursive: true });
  verify(project, 'paper', built);
  const job = queue(root, 'projects/demo', ['paper/main.tex', 'paper/VERIFY.json'], 'Edit the draft');
  assert.equal(job.message, 'Edit the draft\n\nManuscript-Verification: incomplete (projects/demo/paper)'); assert.match(job.notice, /read the complete manuscript/);
  assert.equal(flush(root, { push: false })[0].ok, true); assert.match(git(project, ['log', '-1', '--format=%B']), /Manuscript-Verification: incomplete/);
  edit(project, 'section~', 'Section~'); verify(project, 'paper', built);
  assert.match(queue(root, '.', ['projects/demo/paper/main.tex'], 'Awaiting the judges').message, /Manuscript-Verification: incomplete/);
  await settle(root, built);
  assert.equal(queue(root, '.', ['projects/demo/paper/main.tex'], 'Verified').message, 'Verified');
  installHooks(root); installHooks(root);
  for (const config of ['.claude/settings.json', '.codex/hooks.json']) {
    const hooks = JSON.parse(fs.readFileSync(path.join(root, config), 'utf8')).hooks;
    assert.deepEqual(Object.keys(hooks).sort(), ['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop']);
    for (const event of ['PreToolUse', 'PostToolUse']) assert.deepEqual(hooks[event].map(g => [g.matcher, g.hooks.length]), [[toolMatcher, 1]]);
    assert.equal(hooks.Stop[0].matcher, undefined);
  }
});

test('paper-verify prints the completion table and fails its exit status while a verdict is open; ordinary checks are untouched', async t => {
  const { root, project } = make(t, 'We find 204 theories in section~\\ref{s}.');
  put(project, 'STATE.md', '## Status\nDrafting\n\n## Current step\nCorrect wording.\n');
  const saved = process.exitCode;
  try {
    const text = await main(['paper-verify', 'demo', '--no-build'], root);
    assert.equal(process.exitCode, 1);
    assert.match(text, /\| rule \| pass \| fail \| awaiting independent verdict \| not judged \|/); assert.match(text, /\| number-bound \| 0 \| 1 \| 0 \| 0 \|/);
    assert.match(text, /Status: INCOMPLETE, 2 failing and 1 not judged\./); assert.match(text, /- \[number-bound\] front ¶1 s1 paper\/main\.tex:1 unit [0-9a-f]{12} \(fail\): "204" is not bound to a fact/);
    assert.match(text, /Independent verdicts: none recorded on this computer\./); assert.match(text, /Awaiting the independent verdict: 2 \(node harness\/cli\.mjs paper-judge demo paper/);
    const units = await main(['paper-units', 'demo', 'theories'], root);
    assert.deepEqual(units.map(u => [u.kind, u.where, u.numbers]), [['sentence', 'front ¶1 s1', ['204']]]);
  } finally { process.exitCode = saved; }
  assert.deepEqual(checkProject(project), []);
});
