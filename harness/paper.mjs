import fs from 'node:fs';
import path from 'node:path';
import { read, json, writeJSON, sha, safePath } from './core.mjs';

const normal = s => s.replace(/\r\n/g, '\n');
const clean = s => normal(s).replace(/<!-- harness-review:[\s\S]*?-->\n?/g, '');
const docHash = p => fs.existsSync(p) ? sha(clean(read(p))) : null;
export function sourceFiles(project, entry = 'paper/main.tex', seen = new Set(), base = path.posix.dirname(entry)) {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const file = safePath(project, entry);
  const text = normal(read(file));
  const files = [{ file: entry, text }];
  // Literal local input/include is supported. Dynamic TeX imports require human review.
  for (const m of text.replace(/(?<!\\)%[^\n]*/g, '').matchAll(/\\(?:input|include)\s*\{([^}]+)\}/g)) {
    let rel = m[1].endsWith('.tex') ? m[1] : m[1] + '.tex';
    rel = path.posix.join(base, rel);
    files.push(...sourceFiles(project, rel, seen, base));
  }
  return files;
}
export function blocks(files) {
  return files.flatMap(({ file, text }) => {
    const body = text.includes('\\begin{document}') ? text.split('\\begin{document}')[1].split('\\end{document}')[0] : text;
    return body.split(/\n\s*\n/).map(s => s.trim()).filter(s => s && s.replace(/(?<!\\)%[^\n]*/g, '').trim()).map(text => ({
      file, hash: sha(text), anchor: text.replace(/(?<!\\)%[^\n]*/g, '').trim().split(/\s+/).slice(0, 6).join(' '),
      citations: [...text.replace(/(?<!\\)%[^\n]*/g, '').matchAll(/\\cite\w*\*?(?:\[[^\]]*\])*\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim()))
    }));
  });
}
export function scanPaper(project, { persist = true } = {}) {
  const file = path.join(project, 'paper', 'REVIEW.json');
  const old = fs.existsSync(file) ? json(file) : { version: 1, next_id: 1, units: [] };
  const sources = sourceFiles(project);
  const sourceHash = sha(sources.map(s => s.file + '\n' + s.text).join('\n'));
  const bibs = new Set();
  for (const source of sources) {
    for (const m of source.text.replace(/(?<!\\)%[^\n]*/g, '').matchAll(/\\(?:bibliography|addbibresource)(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) {
      for (const name of m[1].split(',')) bibs.add(path.posix.join('paper', name.trim().endsWith('.bib') ? name.trim() : name.trim() + '.bib'));
    }
  }
  const bibHash = sha([...bibs].sort().map(name => name + '\n' + normal(read(safePath(project, name)))).join('\n'));
  const mapHash = docHash(path.join(project, 'paper', 'PUNCHLINES.md'));
  const ledgerHash = docHash(path.join(project, 'paper', 'CITATIONS.md'));
  let next = old.next_id;
  const available = new Set(old.units.map(u => u.id));
  const units = blocks(sources).map(block => {
    // Reordering exact blocks retains IDs. Ambiguous identical blocks are not guessed.
    let matches = old.units.filter(u => available.has(u.id) && u.file === block.file && u.hash === block.hash);
    if (matches.length !== 1) matches = old.units.filter(u => available.has(u.id) && u.file === block.file && u.anchor === block.anchor);
    const prior = matches.length === 1 ? matches[0] : null;
    if (prior) available.delete(prior.id);
    const unit = { ...block, id: prior?.id || `p${String(next++).padStart(5, '0')}`, reviews: prior?.reviews || {} };
    unit.status = {};
    for (const kind of ['map', 'citations']) {
      const review = unit.reviews[kind];
      unit.status[kind] = !review ? 'UNREVIEWED' : review.hash === unit.hash && review.source_hash === sourceHash && (kind !== 'citations' || review.bib_hash === bibHash) && review.document_hash === (kind === 'map' ? mapHash : ledgerHash) ? 'CURRENT' : 'STALE';
    }
    return unit;
  });
  const removed = [...(old.removed || []), ...old.units.filter(u => available.has(u.id))];
  const result = { version: 1, next_id: next, source_hash: sourceHash, bib_hash: bibHash, map_hash: mapHash, ledger_hash: ledgerHash, units, removed };
  if (persist) writeJSON(file, result);
  return result;
}
export function attest(project, kind, ids, reviewer, note) {
  if (!['map', 'citations'].includes(kind) || !reviewer || !note || !ids.length) throw Error('Review requires kind, explicit IDs, reviewer, and a description of the checks performed.');
  const state = scanPaper(project, { persist: false });
  const doc = kind === 'map' ? 'PUNCHLINES.md' : 'CITATIONS.md';
  const text = read(path.join(project, 'paper', doc));
  for (const id of ids) {
    const unit = state.units.find(u => u.id === id);
    if (!unit) throw Error(`Unknown source ID: ${id}`);
    if (!text.includes(`[${id}]`)) throw Error(`Add [${id}] to the reviewed entry in ${doc} first.`);
    if (kind === 'citations') {
      const rows = text.split('\n').filter(line => line.startsWith('|') && line.split('|')[1]?.includes(`[${id}]`));
      for (const key of unit.citations) {
        const matches = rows.filter(line => line.split('|')[2]?.trim() === key);
        if (!matches.length || matches.some(line => /\b(?:STALE|UNREVIEWED|UNCHECKED)\b/.test(line))) throw Error(`A completed ledger row for (${id}, ${key}) is required. Partial-key reviews cannot attest the whole block.`);
      }
    }
    unit.reviews[kind] = { hash: unit.hash, source_hash: state.source_hash, bib_hash: state.bib_hash, document_hash: kind === 'map' ? state.map_hash : state.ledger_hash, reviewer, note, date: new Date().toISOString() };
    unit.status[kind] = 'CURRENT';
  }
  writeJSON(path.join(project, 'paper', 'REVIEW.json'), state);
  return state;
}
