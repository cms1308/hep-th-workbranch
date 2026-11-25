// Manuscript decomposition: TeX sources -> titles, paragraphs, sentences, with the numbers,
// symbols and candidate terms of each sentence. Pure code, no model. Specification:
// harness/design/paper-verification.md ("Units and grounds").
import path from 'node:path';
import { read, sha, safePath } from './core.mjs';

const L = '⟦', R = '⟧';                      // mask brackets: inline math M, display D, reference R, citation C
const squash = s => s.replace(/\s+/g, ' ').trim();
export const uncomment = line => line.replace(/(?<!\\)((?:\\\\)*)%.*$/, '$1');

// Index just past the balanced group opening at text[i] ('{' or '['); -1 when it does not close.
export function group(text, i) {
  const square = text[i] === '[';
  for (let j = i, depth = 0; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') j++;
    else if (c === '{') depth++;
    else if (c === '}') { if (!--depth && !square) return j + 1; }
    else if (c === ']' && square && !depth) return j + 1;
  }
  return -1;
}
// One optional [..] and up to `count` {..} arguments after position i.
export function args(text, i, count = 1) {
  const out = { opt: null, list: [], end: i }, gap = /[ \t]*\n?[ \t]*/y;
  const next = () => { gap.lastIndex = out.end; return out.end + gap.exec(text)[0].length; };
  if (text[next()] === '[') { const s = next(), e = group(text, s); if (e > 0) { out.opt = text.slice(s + 1, e - 1); out.end = e; } }
  while (out.list.length < count && text[next()] === '{') {
    const s = next(), e = group(text, s);
    if (e < 0) break;
    out.list.push({ text: text.slice(s + 1, e - 1), off: s + 1 });
    out.end = e;
  }
  return out;
}

// Sources in reading order, literal \input/\include inlined, comments and comment blocks removed.
export function flatten(project, entry = 'paper/main.tex') {
  const base = path.posix.dirname(entry), files = [], lines = [], seen = new Set();
  const add = rel => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const text = read(safePath(project, rel)).replace(/\r\n/g, '\n');
    files.push({ file: rel, text });
    let skip = null;
    text.split('\n').forEach((raw, i) => {
      if (skip) { if (skip.test(raw)) skip = null; return; }
      let line = uncomment(raw);
      if (raw.trim() && !line.trim()) return;           // a comment-only line does not end a paragraph
      if (/\\begin\{comment\}/.test(line)) { skip = /\\end\{comment\}/; return; }
      if (/^\s*\\iffalse\b/.test(line)) { skip = /^\s*\\fi\b/; return; }
      for (let m; (m = /\\(?:input|include)\s*\{([^}]+)\}/.exec(line));) {
        if (line.slice(0, m.index).trim()) lines.push({ file: rel, line: i + 1, text: line.slice(0, m.index) });
        add(path.posix.join(base, m[1].endsWith('.tex') ? m[1] : m[1] + '.tex'));
        line = line.slice(m.index + m[0].length);
        if (!line.trim()) return;
      }
      lines.push({ file: rel, line: i + 1, text: line });
    });
  };
  add(entry);
  return { files, lines, hash: sha(files.map(f => f.file + '\n' + f.text).join('\n')) };
}

// Argument-free macros of the preamble (\def, \newcommand, \DeclareMathOperator).
export function macros(pre) {
  const out = {};
  const take = (name, i, wrap = s => s) => { const e = group(pre, i); if (e > 0) out[name] = wrap(pre.slice(i + 1, e - 1).trim()); };
  for (const m of pre.matchAll(/\\g?def\s*(\\[A-Za-z@]+)\s*(?=\{)/g)) take(m[1], m.index + m[0].length);
  for (const m of pre.matchAll(/\\(?:re)?newcommand\*?\s*(?:\{\s*(\\[A-Za-z@]+)\s*\}|(\\[A-Za-z@]+))\s*(?=\{)/g)) take(m[1] || m[2], m.index + m[0].length);
  for (const m of pre.matchAll(/\\DeclareMathOperator\*?\s*\{\s*(\\[A-Za-z@]+)\s*\}\s*(?=\{)/g)) take(m[1], m.index + m[0].length, s => `\\mathrm{${s}}`);
  return out;
}
export function expand(text, table, depth = 6) {
  const names = Object.keys(table).filter(n => !table[n].includes('\n')).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const re = new RegExp('(?<!\\\\)(?:' + names.map(n => n.replace(/[\\@]/g, '\\$&')).join('|') + ')(?![A-Za-z@])', 'g');
  for (let i = 0; i < depth; i++) { const next = text.replace(re, m => table[m]); if (next === text) break; text = next; }
  return text;
}

const DISPLAY = /^(equation|align|alignat|flalign|eqnarray|gather|multline|displaymath)\*?$/;
const FLOAT = /^(figure|table|sidewaystable|sidewaysfigure|wrapfigure|subfigure|subtable|longtable)\*?$/;
const OPAQUE = /^(tabular|tabularx|array|tikzpicture|scope|picture|verbatim|lstlisting|minted|thebibliography|acknowledgments|ytableau|filecontents)\*?$/;
const HEAD = { title: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 4, subparagraph: 5 };
const META = /^(author|affiliation|emailAdd|keywords|arxivnumber|preprint|dedicated|collaboration|date|bibliography|bibliographystyle)$/;
const NEXT = /\n[ \t]*\n\s*|(?<!\\)\$\$?|\\\[|\\begin\s*\{([A-Za-z*]+)\}|\\(title|abstract|section|subsection|subsubsection|paragraph|subparagraph|caption|appendix|acknowledgments|item|maketitle|tableofcontents|newpage|clearpage|author|affiliation|emailAdd|keywords|arxivnumber|preprint|dedicated|collaboration|date|bibliography|bibliographystyle)\b\*?/g;

// Body text -> ordered raw titles and paragraphs (pieces of prose and display mathematics).
function parse(src) {
  const out = [];
  let cur = null, role = 'body', mute = false;
  const open = () => cur ||= { kind: 'paragraph', role, pieces: [], labels: [] };
  const flush = () => { if (cur && !mute && cur.pieces.some(p => p.display !== undefined || p.text.trim())) out.push(cur); cur = null; };
  const text = (a, b) => {
    if (a >= b) return;
    const last = open().pieces.at(-1);
    if (last && last.text !== undefined && last.off + last.text.length === a) return void (last.text += src.slice(a, b));
    while (a < b && /\s/.test(src[a])) a++;                // a piece starts at its first character, so that its line is the line of its text
    cur.pieces.push({ text: src.slice(a, b), off: a });
  };
  const envEnd = (name, from) => {
    const re = new RegExp(`\\\\(begin|end)\\s*\\{${name.replace(/\*/g, '\\*')}\\}`, 'g');
    re.lastIndex = from;
    for (let depth = 1, m; (m = re.exec(src));) { depth += m[1] === 'begin' ? 1 : -1; if (!depth) return m; }
    return null;
  };
  const region = (arg, r) => { const before = out.length; scan(arg.off, arg.off + arg.text.length, r); return out[before]; };
  const captions = (a, b) => {
    const re = /\\caption\*?\s*(?=[[{])/g, labels = [...src.slice(a, b).matchAll(/\\label\s*\{([^}]*)\}/g)].map(m => m[1]);
    re.lastIndex = a;
    for (let m, first = true; (m = re.exec(src)) && m.index < b;) {
      const x = args(src, m.index + m[0].length);
      if (!x.list[0]) continue;
      const made = region(x.list[0], 'caption');
      if (made && first) { made.labels.push(...labels); first = false; }
      re.lastIndex = x.end;
    }
  };
  function scan(a, b, r) {
    flush();
    const saved = role, re = new RegExp(NEXT.source, 'g');
    role = r; re.lastIndex = a;
    let pos = a;
    for (let m; (m = re.exec(src)) && m.index < b;) {
      text(pos, m.index);
      pos = re.lastIndex;
      const tok = m[0];
      if (tok[0] === '\n') flush();
      else if (tok === '$') {
        let e = pos;
        while (e < b && src[e] !== '$') e += src[e] === '\\' ? 2 : 1;
        text(m.index, pos = Math.min(b, e + 1));
      } else if (tok === '$$' || tok === '\\[') {
        const close = tok === '$$' ? '$$' : '\\]', found = src.indexOf(close, pos), e = found < 0 || found > b ? b : found;
        open().pieces.push({ display: src.slice(pos, e), raw: src.slice(m.index, Math.min(b, e + 2)), off: m.index });
        pos = Math.min(b, e + 2);
      } else if (m[1]) {
        const end = envEnd(m[1], pos), stop = end ? end.index : b, after = end ? end.index + end[0].length : b, bare = m[1].replace(/\*$/, '');
        if (DISPLAY.test(m[1])) open().pieces.push({ display: src.slice(pos, stop), raw: src.slice(m.index, after), off: m.index });
        else if (FLOAT.test(m[1])) { flush(); captions(pos, stop); }
        else if (!OPAQUE.test(m[1])) { scan(args(src, pos, /^(minipage|multicols)$/.test(bare) ? 1 : 0).end, stop, /^(itemize|enumerate|description)$/.test(bare) ? 'item' : bare === 'abstract' ? 'abstract' : role); role = r; }
        pos = after;
      } else if (m[2] in HEAD) {
        flush(); mute = false;
        const x = args(src, pos);
        if (x.list[0]) {
          const label = /^\s*\\label\s*\{([^}]*)\}/.exec(src.slice(x.end, x.end + 200));
          out.push({ kind: 'title', level: HEAD[m[2]], text: x.list[0].text, off: m.index, labels: label ? [label[1]] : [] });
          pos = x.end + (label ? label[0].length : 0);
        }
      } else if (m[2] === 'abstract' || m[2] === 'caption') {
        const x = args(src, pos);
        if (x.list[0]) { region(x.list[0], m[2]); role = r; pos = x.end; }
      } else if (META.test(m[2])) pos = args(src, pos, 2).end;
      else {
        flush();
        if (m[2] === 'acknowledgments') mute = true;
        if (m[2] === 'appendix') out.push({ kind: 'appendix' });
        if (m[2] === 'item') pos = args(src, pos, 0).end;
      }
      re.lastIndex = pos;
    }
    text(pos, b);
    flush();
    role = saved;
  }
  scan(0, src.length, 'body');
  return out;
}

const KEEP2 = /^(href|textcolor)$/;                       // second argument is prose
const DROP = /^(label|vspace|hspace|vskip|hskip|setlength|addtolength|renewcommand|newcommand|providecommand|setcounter|addtocounter|includegraphics|input|include|bibliography|bibliographystyle|color|url|hypersetup|pagestyle|thispagestyle|phantom|hphantom|vphantom|rule|footnotemark|index|hypertarget|captionsetup|pagenumbering|numberwithin|ytableausetup|usepackage)$/;
const REF = /^(ref|eqref|autoref|cref|Cref|pageref|nameref|vref)$/;
// Prose view of masked TeX: commands removed, references and citations as marks, text arguments kept.
export function plain(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c !== '\\') { out += c === '~' ? ' ' : c === '{' || c === '}' ? '' : c; i++; continue; }
    const re = /\\([A-Za-z@]+\*?|[\s\S]?)/y;
    re.lastIndex = i;
    const name = re.exec(s)[1], bare = name.replace(/\*$/, '');
    i = re.lastIndex;
    if (!/^[A-Za-z@]/.test(name)) out += /[%&$#_]/.test(name) ? name : /[\\ ;:\n]/.test(name) ? ' ' : '';
    else if (REF.test(bare) || /^(no)?cite/.test(bare)) { i = args(s, i).end; out += L + (REF.test(bare) ? 'R' : 'C') + R; }
    else if (bare === 'texorpdfstring') { const x = args(s, i, 2); out += plain(x.list[0]?.text || ''); i = x.end; }
    else if (KEEP2.test(bare)) { const x = args(s, i, 2); out += plain(x.list[1]?.text || ''); i = x.end; }
    else if (DROP.test(bare)) i = args(s, i, 9).end;
    else if (bare === 'ldots' || bare === 'dots') out += '…';
    else if (/^(ss|ae|oe|o|l|aa|i|j)$/i.test(bare)) out += bare;
    // any other command: its braces are transparent, so a text argument stays visible as prose
  }
  return squash(out.replace(/``|''/g, '"').replace(/(?<!-)--(?!-)/g, '–'));
}

const NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, dozen: 12 };
const UNIT = 'two|three|four|five|six|seven|eight|nine', WORD = Object.keys(NUM).join('|');
export const numberWord = w => w.toLowerCase().split('-').every(part => part in NUM);     // two, twenty-two, hundred
const DIGITS = /(?<![\w.,⟦])(?<![A-Za-z]-)\d+(?:,\d{3})*(?:\.\d+)?(?![\w]|-[A-Za-z]|\.\d|,\d{3})/g;
const WORDS = new RegExp(`(?<![\\w-])(?:${WORD})(?:-(?:${UNIT}))?(?: (?:hundred|thousand|million))*(?![\\w]|-[A-Za-z])`, 'gi');
const REL = /^(?:=|<|>|\\(?:neq|ne|leq|le|geq|ge|simeq|approx|sim|equiv|to|rightarrow|in|propto|ll|gg|lesssim|gtrsim|cong)(?![A-Za-z]))/;
const tidy = s => s.replace(/\\left|\\right|\\[bB]igg?[lr]?(?![A-Za-z])|\\[,;!: ]|\{,\}|\s+/g, '');

// Sides of the relations in one inline formula that are closed numeric expressions.
export function numericSides(math) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < math.length; i++) {
    const c = math[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (!depth) {
      const m = REL.exec(math.slice(i));
      if (m) { parts.push(math.slice(start, i)); i += m[0].length - 1; start = i + 1; }
      else if (c === '\\') i += /^\\(?:[A-Za-z]+|.)?/.exec(math.slice(i))[0].length - 1;
    } else if (c === '\\') i++;
  }
  parts.push(math.slice(start));
  return parts.map(tidy).filter(s => /\d/.test(s) && !(parts.length > 1 && s === '0') && /^[\d.,+\-/*()[\]^{}]*$/.test(s.replace(/\\[td]?frac|\\sqrt|\\times|\\cdot|\\%|\\pi|\\[{}]/g, '')));
}
// Numeric value of a closed TeX expression: a number, an array for a tuple or list, null when not evaluable.
export function value(tex) {
  const s = tidy(String(tex)).replace(/\\[td]?frac/g, '\\frac').replace(/\\times|\\cdot/g, '*').replace(/\\\{/g, '(').replace(/\\\}/g, ')').replace(/\\%/g, '');
  let i = 0;
  const fail = () => { throw Error('not numeric'); };
  const close = c => s[i++] === c || fail();
  const arg = () => s[i] === '{' ? (i++, [expr(), close('}')][0]) : /\d/.test(s[i]) ? +s[i++] : atom();
  function atom() {
    if (s.startsWith('\\frac', i)) { i += 5; const a = arg(); return a / arg(); }
    if (s.startsWith('\\sqrt', i)) { i += 5; return Math.sqrt(arg()); }
    if (s.startsWith('sqrt(', i)) { i += 4; return Math.sqrt(atom()); }
    if (s.startsWith('\\pi', i)) { i += 3; return Math.PI; }
    if (s[i] === '(') { i++; return [list(), close(')')][0]; }
    if (s[i] === '{') { i++; return [expr(), close('}')][0]; }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i)) || fail();
    i += m[0].length;
    return +m[0];
  }
  const power = () => { const v = atom(); return s[i] === '^' ? (i++, Math.pow(v, arg())) : v; };
  const unary = () => s[i] === '-' ? (i++, -unary()) : s[i] === '+' ? (i++, unary()) : power();
  function term() {
    for (let v = unary(); ;) {
      if (s[i] === '*') { i++; v *= unary(); }
      else if (s[i] === '/') { i++; v /= unary(); }
      else if (i < s.length && /[\d({]/.test(s[i]) || s.startsWith('\\frac', i) || s.startsWith('\\sqrt', i) || s.startsWith('\\pi', i) || s.startsWith('sqrt(', i)) v *= power();
      else return v;
    }
  }
  function expr() { for (let v = term(); ;) { if (s[i] === '+') { i++; v += term(); } else if (s[i] === '-') { i++; v -= term(); } else return v; } }
  function list() { const v = [expr()]; while (s[i] === ',') { i++; v.push(expr()); } return v.length === 1 ? v[0] : v; }
  try {
    const v = list();
    return i === s.length && [v].flat().every(x => typeof x === 'number' && Number.isFinite(x)) ? v : null;
  } catch { return null; }
}
function words(token) {
  let total = 0, cur = 0;
  for (const w of token.toLowerCase().split(/[- ]/)) { const v = NUM[w]; if (v >= 100) { cur = (cur || 1) * v; if (v >= 1000) { total += cur; cur = 0; } } else cur += v; }
  return total + cur;
}
// Numerals of a sentence in reading order: digits and number words in the prose, numeric sides of inline formulas.
export function numbers(prose, math) {
  const found = [];
  for (const m of prose.matchAll(DIGITS)) found.push({ pos: m.index, token: m[0], value: +m[0].replace(/,/g, ''), decimals: (m[0].split('.')[1] || '').length });
  for (const m of prose.matchAll(WORDS)) found.push({ pos: m.index, token: m[0].toLowerCase(), value: words(m[0]), decimals: 0 });
  let k = 0;
  for (const m of prose.matchAll(new RegExp(L + 'M' + R, 'g'))) {
    numericSides(math[k++] || '').forEach((token, j) => found.push({ pos: m.index + j / 1000, token, value: value(token), decimals: /^[-+]?\d+\.\d+$/.test(token) ? token.split('.')[1].length : /^[-+]?\d+$/.test(token) ? 0 : null }));
  }
  const seen = {};
  return found.sort((a, b) => a.pos - b.pos).map(({ pos, ...n }) => { const c = seen[n.token] = (seen[n.token] || 0) + 1; return { ...n, key: c > 1 ? `${n.token}#${c}` : n.token }; });
}

const SKIP = new Set('frac tfrac dfrac sqrt left right big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr Biggl Biggr cdot times div pm mp le leq ge geq neq ne simeq approx sim equiv to rightarrow leftarrow leftrightarrow Rightarrow Leftrightarrow Longrightarrow longrightarrow mapsto in notin subset subseteq supset supseteq cup cap setminus otimes oplus wedge vee propto ll gg lesssim gtrsim cong infty partial nabla hbar sum prod int oint quad qquad ldots cdots dots vdots ddots displaystyle textstyle scriptstyle scriptscriptstyle nonumber notag limits nolimits langle rangle lvert rvert lVert rVert vert Vert mid ast star dagger prime circ bullet forall exists neg not underbrace overbrace hline toprule midrule bottomrule cr bigoplus bigotimes bigwedge bigcup bigcap log ln exp sin cos tan sinh cosh tanh cot sec csc arcsin arccos arctan dim det ker deg gcd min max sup inf lim limsup liminf arg hom Pr mod bmod pmod binom stackrel overset underset iff implies lceil rceil lfloor rfloor allowbreak Longleftrightarrow xrightarrow xleftarrow begin end'.split(' '));
const NOARG = /^(label|tag|hspace|vspace|phantom|hphantom|vphantom|color|ref|eqref|cite|begin|end)$/;
const FONT = { mathcal: 'mathcal', cal: 'mathcal', mathbb: 'mathbb', mathfrak: 'mathfrak', mathbf: 'mathbf', boldsymbol: 'mathbf', bm: 'mathbf', mathsf: 'mathsf', mathscr: 'mathscr', mathtt: 'mathtt', mathit: 'mathit' };
const ROMAN = /^(mathrm|rm|text|textrm|textnormal|mbox|hbox|operatorname|textit|textbf)$/, NAME = /^(mathrm|rm|operatorname)$/;
const ACCENT = { bar: 'bar', overline: 'bar', tilde: 'tilde', widetilde: 'tilde', hat: 'hat', widehat: 'hat', vec: 'vec', dot: 'dot', ddot: 'ddot', check: 'check' };
const CONNECTIVE = /^(and|or|for|if|with|where|when|at|in|of|to|the|otherwise|else|so|is|are|on|as|by|all|any|each|from|then)$/i;
// {\cal X}, {\rm x} and the like -> \cal{X}, \rm{x}
const fonts = s => { for (let m; (m = /\{\s*\\(cal|rm|bf|it|sf|tt)(?![A-Za-z])\s*/.exec(s));) { const e = group(s, m.index); if (e < 0) break; s = `${s.slice(0, m.index)}\\${m[1]}{${s.slice(m.index + m[0].length, e - 1)}}${s.slice(e)}`; } return s; };
const letters = s => s.replace(/\\[A-Za-z]+|[{}\s\\]/g, '');

// Symbols of formulas: letters, Greek and other commands, font and accent forms, with a roman
// subscript as part of the name (N_{bif}); other sub- and superscripts are indices and ignored.
export function symbols(formulas, names = []) {
  const multi = [...names].sort((a, b) => b.length - a.length), out = new Set();
  const walk = raw => {
    const s = fonts(raw), keys = [];
    let last = false;
    const one = i => {                                   // one TeX argument starting at i -> [text, end]
      while (s[i] === ' ') i++;
      if (s[i] === '{') { const e = group(s, i); return e < 0 ? [s.slice(i + 1), s.length] : [s.slice(i + 1, e - 1), e]; }
      if (s[i] === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)), end = i + m[0].length;
        if (!(m[1] in FONT) && !ROMAN.test(m[1]) && !(m[1] in ACCENT)) return [m[0], end];
        const [, e] = one(end);
        return [s.slice(i, e), e];
      }
      return [s[i] || '', i + 1];
    };
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === '_' || c === '^') {
        const [body, e] = one(i + 1), roman = /^\s*\\(mathrm|rm|text|textrm|textnormal|mbox|operatorname)(?![A-Za-z])/.test(body);
        if (c === '_' && last && roman && letters(body)) keys[keys.length - 1] += `_{${letters(body)}}`;
        i = e;
        continue;
      }
      if (c === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)), name = m[1];
        i += m[0].length;
        last = false;
        if (!/^[A-Za-z]/.test(name) || SKIP.has(name)) { if (name === 'begin' || name === 'end') i = args(s, i).end; continue; }
        if (NOARG.test(name)) { i = args(s, i).end; continue; }
        const [body, e] = name in FONT || ROMAN.test(name) || name in ACCENT ? one(i) : ['', i];
        i = e;
        if (name in FONT) { if (/^[A-Za-z]+$/.test(body.trim())) { keys.push(`\\${FONT[name]}{${body.trim()}}`); last = true; } else keys.push(...walk(body)); }
        else if (ROMAN.test(name)) { if (/^[A-Za-z]+$/.test(body.trim()) && !CONNECTIVE.test(body.trim()) && (NAME.test(name) || /^\s*[_^]/.test(s.slice(e)))) { keys.push(`\\mathrm{${body.trim()}}`); last = true; } }
        else if (name in ACCENT) { const inner = walk(body); if (inner.length === 1) { keys.push(`\\${ACCENT[name]}{${inner[0]}}`); last = true; } else keys.push(...inner); }
        else { keys.push(`\\${name}`); last = true; }
        continue;
      }
      if (/[A-Za-z]/.test(c)) {
        const name = multi.find(n => s.startsWith(n, i)) || c;
        keys.push(name); last = true; i += name.length;
        continue;
      }
      if (!/[{}\s']/.test(c)) last = false;
      i++;
    }
    return keys;
  };
  for (const f of formulas) for (const k of walk(f)) out.add(k);
  return out;
}

const STOP = new Set(`a an the this that these those it its their our we us they them there here
 is are was were be been being am do does did done has have had having can could may might must shall should will would cannot
 and or but nor so yet for if then else than as while whereas because since although though unless until whether when where which who whom whose what how why
 of in on at by to from with without within into onto over under above below between among through during before after about against along across around near via per up down out off
 not no only also both either neither each every all any some such same other another more most less least very much many few several own just even still again further now thus hence therefore however moreover namely respectively one`.split(/\s+/));
// A prose view cut at marks and punctuation; each segment is its tokens in order, null for a token that is not a word.
export const segments = prose => prose.split(new RegExp(`${L}[A-Z]${R}|[.,;:!?()\\[\\]"–…]|---`)).map(s => s.split(/\s+/).filter(Boolean).map(w => /^[A-Za-z][A-Za-z'’-]*$/.test(w) ? w : null));
// Candidate terms: maximal runs of content words (two or more words, or one hyphenated compound).
export function terms(prose) {
  const out = [];
  for (const segment of segments(prose)) {
    let run = [];
    const end = () => { if (run.length > 1 || run[0]?.includes('-')) out.push(run.join(' ').toLowerCase()); run = []; };
    for (const w of segment) { if (w && !STOP.has(w.toLowerCase())) run.push(w); else end(); }
    end();
  }
  return out;
}

const ABBR = new Set('e.g i.e cf vs eq eqs fig figs sec secs ref refs tab app no resp al viz approx ch p pp'.split(' '));
const terminal = d => /[.?!]$/.test(d.replace(/\\(?:label\s*\{[^}]*\}|end\s*\{[^}]*\}|nonumber|notag|quad|qquad|[,;!: ])|[\s~]/g, ''));
// One paragraph -> its sentences, with a formula interrupting a sentence kept inside it.
function split(pieces) {
  const math = [], disp = [], starts = [];
  let p = '';
  for (const piece of pieces) {
    starts.push([p.length, piece.off]);
    if (piece.display !== undefined) { disp.push(piece); p += ` ${L}D${disp.length - 1}${R} `; continue; }
    p += piece.text.replace(/(?<!\\)\$((?:\\[\s\S]|[^$\\])*)\$|\\\(([\s\S]*?)\\\)/g, (all, a, b) => { math.push(a ?? b); return `${L}M${math.length - 1}${R}`; }).replace(/\s+/g, ' ');
  }
  const cuts = [0], re = new RegExp(`([.?!])(?:''|["')\\]}]|\\\\label\\s*\\{[^}]*\\})*(?= +(?:[(\\[\`"])*(?:[A-Z\\d\\\\]|${L}[MD]))|${L}D(\\d+)${R}`, 'g');
  for (let m; (m = re.exec(p));) {
    if (m[2] !== undefined) { if (terminal(disp[+m[2]].display) || /^ *[A-Z]/.test(p.slice(re.lastIndex))) cuts.push(re.lastIndex); }
    else if (m[1] !== '.' || !ABBR.has((/([A-Za-z]+(?:\.[A-Za-z]+)*)$/.exec(p.slice(0, m.index))?.[1] || '').toLowerCase())) cuts.push(re.lastIndex);
  }
  cuts.push(p.length);
  const out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const masked = p.slice(cuts[k], cuts[k + 1]), lead = masked.length - masked.trimStart().length;
    if (!masked.trim()) continue;
    const bare = !/[A-Za-z]/.test(masked.replace(new RegExp(`${L}[MD]\\d+${R}`, 'g'), ''));
    if (bare && out.length) { out.at(-1).masked += ' ' + masked.trim(); continue; }      // a formula alone belongs to the sentence before it
    out.push({ masked: masked.trim(), off: starts.findLast(([at]) => at <= cuts[k] + lead)[1] });
  }
  return out.map(({ masked, off }) => {
    const m = [], d = [];
    const marks = masked.replace(new RegExp(`${L}([MD])(\\d+)${R}`, 'g'), (all, kind, n) => { (kind === 'M' ? m : d).push(kind === 'M' ? math[+n] : disp[+n]); return L + kind + R; });
    let i = 0, j = 0;
    const tex = marks.replace(new RegExp(`${L}([MD])${R}`, 'g'), (all, kind) => kind === 'M' ? `$${m[i++]}$` : d[j++].raw);
    return { off, marks, tex, math: m, displays: d.map(x => x.display) };
  });
}

// Lines of the flattened sources -> units in reading order, the label map and the macro table.
export function decompose(lines) {
  const b = lines.findIndex(l => l.text.includes('\\begin{document}')), e = lines.findIndex(l => l.text.includes('\\end{document}'));
  const pre = lines.slice(0, Math.max(b, 0)), preText = pre.map(l => l.text).join('\n'), table = macros(preText), front = new Set();
  const lineOf = off => preText.slice(0, off).split('\n').length - 1;
  for (const m of preText.matchAll(/\\(?:title|abstract)\b/g)) {            // JHEP declares the title and abstract in the preamble
    const x = args(preText, m.index + m[0].length);
    if (x.list[0]) for (let i = lineOf(m.index); i <= lineOf(x.end - 1); i++) front.add(i);
  }
  const body = [...pre.filter((l, i) => front.has(i)), ...lines.slice(b + 1, e < 0 ? undefined : e)].map(l => ({ ...l, text: expand(l.text, table) }));
  const src = body.map(l => l.text).join('\n'), offsets = [];
  body.reduce((o, l) => (offsets.push(o), o + l.text.length + 1), 0);
  const at = off => { const l = body[offsets.findLastIndex(o => o <= off)] || { file: '', line: 0 }; return { file: l.file, line: l.line }; };
  const units = [], labels = {}, count = new Map(), counter = [0, 0, 0];
  let appendix = false, sec = '', par = 0;
  const id = (kind, text) => { const h = sha(kind + '\n' + text).slice(0, 12), n = (count.get(h) || 0) + 1; count.set(h, n); return n > 1 ? `${h}~${n}` : h; };
  const add = u => { u.index = units.length; units.push(u); return u; };
  const paragraph = raw => {
    const notes = [];
    for (const piece of raw.pieces) {
      if (piece.text === undefined) continue;
      for (let m; (m = /\\(?:table)?footnote\s*(?=[[{])/.exec(piece.text));) {
        const x = args(piece.text, m.index + m[0].length);
        if (!x.list[0]) break;
        notes.push({ kind: 'paragraph', role: 'footnote', labels: [], pieces: [{ text: x.list[0].text, off: piece.off }] });
        piece.text = piece.text.slice(0, m.index) + piece.text.slice(x.end);
      }
    }
    const parts = split(raw.pieces).map(s => ({ ...s, prose: plain(s.marks) })).filter(s => s.prose);
    if (!parts.length) return notes.forEach(paragraph);
    const tex = squash(raw.pieces.map(p => p.raw ?? p.text).join(' ')), where = raw.role === 'body' || raw.role === 'item' ? `${sec ? '§' + sec : 'front'} ¶${++par}` : `${raw.role}${sec ? ' in §' + sec : ''}`;
    const p = add({ id: id('paragraph', tex), kind: 'paragraph', role: raw.role, text: tex, ...at(raw.pieces[0].off), where, sentences: [],
      runs: raw.pieces.filter(x => x.text !== undefined).map(x => { let o = x.off; return x.text.split('\n').map(text => { const line = { text, ...at(o) }; o += text.length + 1; return line; }); }) });
    let rest = [...raw.labels];
    parts.forEach((s, k) => {
      const prose = s.prose, own = [...s.tex.matchAll(/\\label\s*\{([^}]*)\}/g)].map(m => m[1]);
      const u = add({ id: id('sentence', squash(s.tex)), kind: 'sentence', role: raw.role, text: squash(s.tex), marks: s.marks, prose, math: s.math, displays: s.displays,
        ...at(s.off), where: `${where} s${k + 1}`, paragraph: p.id, numbers: numbers(prose, s.math), terms: terms(prose) });
      p.sentences.push(u.id);
      for (const l of [...own, ...(k ? [] : rest)]) labels[l] = u.id;
      if (!k) rest = [];
    });
    for (const n of notes) paragraph(n);
  };
  for (const raw of parse(src)) {
    if (raw.kind === 'appendix') { appendix = true; counter.fill(0); continue; }
    if (raw.kind === 'paragraph') { paragraph(raw); continue; }
    if (raw.level >= 1 && raw.level <= 3) {
      counter[raw.level - 1]++; counter.fill(0, raw.level);
      sec = counter.slice(0, raw.level).map((n, i) => i || !appendix ? n : String.fromCharCode(64 + n)).join('.');
      par = 0;
    }
    const math = [], marks = raw.text.replace(/(?<!\\)\$((?:\\[\s\S]|[^$\\])*)\$/g, (all, a) => { math.push(a); return L + 'M' + R; });
    const u = add({ id: id('title', squash(raw.text)), kind: 'title', role: 'title', level: raw.level, text: squash(raw.text), marks, prose: plain(marks), math, displays: [], ...at(raw.off),
      where: raw.level === 0 ? 'title' : raw.level > 3 ? `§${sec} heading` : `§${sec}` });
    u.numbers = []; u.terms = terms(u.prose);
    for (const l of raw.labels) labels[l] = u.id;
  }
  return { units, labels, macros: table };
}
export const load = (project, entry) => { const flat = flatten(project, entry); return { ...flat, ...decompose(flat.lines) }; };
