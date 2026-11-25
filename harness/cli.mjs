import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, json, wiki, git, safePath, writeJSON } from './core.mjs';
import { queue, flush } from './checkpoint.mjs';
import { scanPaper, attest } from './paper.mjs';
import { runEvidence } from './evidence.mjs';
import { request, status } from './dispatch.mjs';
import { load } from './tex.mjs';
import { verify, report, stopGate, toolEvent } from './verify.mjs';
import { judge, summary } from './judge.mjs';
import { build as buildCorpus, load as loadCorpus, attest as attestCorpus, key as phraseKey } from './corpus.mjs';

export function checkProject(project) {
  const findings = [];
  const state = read(path.join(project, 'STATE.md'));
  if (state.split('\n').length > 200 || Buffer.byteLength(state) > 16000) findings.push('STATE exceeds the 200-line / 16-KB advisory budget.');
  for (const name of ['Status', 'Current step']) if ((state.match(new RegExp(`^## ${name}$`, 'gm')) || []).length !== 1) findings.push(`Expected exactly one ${name} section.`);
  for (const m of state.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (!/^(https?:|mailto:)/.test(m[1]) && !fs.existsSync(safePath(project, m[1]))) findings.push(`Missing STATE link: ${m[1]}`);
  }
  const plan = fs.existsSync(path.join(project, 'PLAN.md')) ? read(path.join(project, 'PLAN.md')) : state;
  for (const m of plan.matchAll(/^[-*] \[ \][\s\S]*?(?=^[-*] \[[ xX]\]|^## |$(?![\s\S]))/gm)) if (!/verify\s*:/i.test(m[0])) findings.push(`Unchecked step lacks verify criterion: ${m[0].split('\n')[0].slice(0, 140)}`);
  if (fs.existsSync(path.join(project, 'paper', 'main.tex')) && fs.existsSync(path.join(project, 'paper', 'REVIEW.json'))) {
    let paper;
    try { paper = scanPaper(project, { persist: false }); }
    catch (e) { findings.push(`Paper scan failed: ${e.message}`); return findings; }
    const counts = {};
    for (const u of paper.units) {
      for (const kind of ['map', 'citations']) {
        if (kind === 'map' ? !u.reviews.map : !u.citations.length) continue;
        const key = `${kind}:${u.status[kind]}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    if (Object.keys(counts).length) findings.push(`Paper review tracking (advisory; cited blocks and existing map attestations): ${JSON.stringify(counts)}`);
  }
  return findings;
}
export async function main(args = process.argv.slice(2), root = ROOT) {
  const [cmd, ...rest] = args;
  if (cmd === 'review-status' || cmd === 'review-resume') return status(root, rest[0], rest[1]);
  if (cmd === 'review-request') {
    const [slug, ...options] = rest;
    const values = {};
    for (let i = 0; i < options.length; i += 2) {
      if (!['--target', '--reviewer', '--model'].includes(options[i]) || !options[i + 1] || values[options[i]]) throw Error('Expected --target, --reviewer and optional --model, each once');
      values[options[i]] = options[i + 1];
    }
    const result = await request(root, slug, values['--target'], values['--reviewer'], { model: values['--model'] });
    if (result.state !== 'completed') process.exitCode = 1;
    return result;
  }
  if (cmd === 'paths') return { harness: root, wiki: wiki(root), node: process.execPath, platform: process.platform };
  if (cmd === 'check') {
    const names = rest.length ? rest : fs.readdirSync(path.join(root, 'projects')).filter(n => fs.existsSync(path.join(root, 'projects', n, 'STATE.md')));
    return Object.fromEntries(names.map(n => [n, checkProject(safePath(root, `projects/${n}`))]));
  }
  if (cmd === 'queue') {
    const [repo, message, ...files] = rest;
    return queue(root, repo, files, message);
  }
  if (cmd === 'flush') {
    const results = flush(root, { push: !rest.includes('--local-only') });
    if (results.some(r => !r.ok)) process.exitCode = 1;
    return results;
  }
  if (cmd === 'paper-scan') return scanPaper(safePath(root, `projects/${rest[0]}`));
  if (cmd === 'paper-verify' || cmd === 'paper-units') {
    const [slug, ...options] = rest, paper = options[0]?.startsWith('paper') ? options.shift() : 'paper', project = safePath(root, `projects/${slug}`);
    if (cmd === 'paper-units') {
      const filter = new RegExp(options[0] || '', 'i');
      return load(project, `${paper}/main.tex`).units.filter(u => u.kind !== 'paragraph' && filter.test(u.prose)).map(u => ({ id: u.id, kind: u.kind, where: u.where, at: `${u.file}:${u.line}`, text: u.prose, numbers: u.numbers.map(n => n.key) }));
    }
    const wip = options.includes('--wip') ? options[options.indexOf('--wip') + 1] : undefined;
    if (options.includes('--wip') && !wip) throw Error('--wip needs the reason the manuscript is unfinished');
    const result = verify(project, paper, { wip, ...(options.includes('--no-build') ? { build: () => null } : {}) });
    if (!result.state.complete) process.exitCode = 1;
    return report(slug, result, { pending: options.includes('--pending') });
  }
  if (cmd === 'paper-judge') {
    const [slug, ...options] = rest, paper = options[0]?.startsWith('paper') ? options.shift() : 'paper', values = {};
    for (let i = 0; i < options.length; i++) {
      if (['--no-build', '--dry-run', '--all-units'].includes(options[i]) && !values[options[i]]) values[options[i]] = true;
      else if (['--writer', '--model', '--batch', '--parallel', '--limit', '--family'].includes(options[i]) && options[i + 1] && !values[options[i]]) values[options[i]] = options[++i];
      else throw Error('Expected --writer <claude|codex> and optional --model <model[,model]>, --batch <n>, --parallel <n>, --limit <n>, --family <id[,id]>, --all-units, --no-build, --dry-run, each once');
    }
    const count = name => { if (values[name] === undefined) return undefined; const n = Number(values[name]); if (!Number.isInteger(n) || n < 1) throw Error(`${name} needs a positive integer`); return n; };
    const out = await judge(root, slug, paper, { writer: values['--writer'], models: values['--model']?.split(',') ?? [], batch: count('--batch'), parallel: count('--parallel'), limit: count('--limit'), families: values['--family']?.split(','), all: !!values['--all-units'], dry: !!values['--dry-run'], ...(values['--no-build'] ? { build: () => null } : {}) });
    if (!out.result.state.complete || out.runs.some(r => r.state !== 'done')) process.exitCode = 1;
    return summary(out);
  }
  if (cmd === 'corpus-build') {
    const at = rest.indexOf('--cutoff');
    if (at >= 0 && !rest[at + 1]) throw Error('--cutoff needs a date (YYYY-MM-DD)');
    const corpus = buildCorpus(root, { cutoff: at < 0 ? undefined : rest[at + 1] }), excluded = {};
    for (const e of corpus.excluded) excluded[e.reason] = (excluded[e.reason] || 0) + 1;
    return { documents: corpus.documents, words: corpus.words, cutoff: corpus.cutoff, hash: corpus.hash, excluded, file: '.harness-local/corpus.json' };
  }
  if (cmd === 'corpus-count') {
    const corpus = loadCorpus(root);
    if (!corpus) throw Error('The corpus is not built: run `node harness/cli.mjs corpus-build`.');
    const found = attestCorpus(corpus, rest.map(phraseKey));
    return rest.map(phrase => { const f = found.get(phraseKey(phrase)) || { papers: 0, count: 0, ids: [] }; return { phrase, papers: f.papers, occurrences: f.count, examples: f.ids.slice(0, 5) }; });
  }
  if (cmd === 'attest') {
    const [slug, kind, reviewer, note, ...ids] = rest;
    return attest(safePath(root, `projects/${slug}`), kind, ids, reviewer, note);
  }
  if (cmd === 'run') {
    const result = runEvidence(safePath(root, `projects/${rest[0]}`), rest[1]);
    if (result.execution !== 'PASS') process.exitCode = 1;
    return result;
  }
  if (cmd === 'hook') return hook(root, jsonInput());
  throw Error('Commands: review-request <slug> --target <plan|step-N|paper> --reviewer <codex|claude> [--model <model>] | review-status <slug> [id] | review-resume <slug> <id> | paths | check [slug...] | queue <repo> <message> <files...> | flush [--local-only] | paper-scan <slug> | paper-verify <slug> [paper-dir] [--no-build] [--pending] [--wip <reason>] | paper-judge <slug> [paper-dir] --writer <claude|codex> [--model <model[,model]>] [--batch <n>] [--parallel <n>] [--limit <n>] [--family <id[,id]>] [--all-units] [--no-build] [--dry-run] | paper-units <slug> [paper-dir] [filter] | corpus-build [--cutoff <YYYY-MM-DD>] | corpus-count <phrase...> | attest <slug> <map|citations> <reviewer> <note> <ids...> | run <slug> <spec.json> | hook');
}
// Never throws: a gate error must not break the provider's hook.
const guarded = action => { try { return action(); } catch (e) { return { block: '', notes: [`Verification gate error: ${e.message}`] }; } };
export function hook(root, input) {
  if (input.hook_event_name === 'Stop') {
    const bad = flush(root).filter(r => !r.ok || r.push === 'no-upstream'), gate = guarded(() => stopGate(root, input));
    // A failed checkpoint stays advisory: never an agent retry loop. A manuscript this session changed
    // and did not verify blocks the end of the turn, at most BLOCK_LIMIT times for one text.
    const notes = [...(bad.length ? [`Checkpoint needs attention: ${JSON.stringify(bad)}. See .harness-local/checkpoints.jsonl. Do not retry unchanged failures in a loop.`] : []), ...gate.notes];
    return { ...(gate.block ? { decision: 'block', reason: gate.block } : {}), ...(notes.length ? { systemMessage: notes.join(' ') } : {}) };
  }
  if (/^(Pre|Post)ToolUse$/.test(input.hook_event_name)) return void guarded(() => (toolEvent(root, input), { notes: [] }));   // no output: the tool call proceeds
  let warning = '';
  try { wiki(root); } catch (e) { warning = e.message; }
  const pending = path.join(root, '.harness-local', 'pending');
  if (fs.existsSync(pending) && fs.readdirSync(pending).length) warning += ' Pending checkpoint jobs exist; inspect them before queueing overlapping files.';
  return { hookSpecificOutput: { hookEventName: input.hook_event_name || 'SessionStart', additionalContext: `Read harness/PROTOCOL.md. At turn end queue only files this task changed and flush; Stop is a fallback. ${warning}` } };
}
function jsonInput() {
  const input = fs.readFileSync(0, 'utf8').trim();
  return input ? JSON.parse(input) : {};
}
export async function entry(args) {
  try { const result = await main(args); if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await entry();
