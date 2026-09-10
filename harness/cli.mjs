import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, json, wiki, git, safePath, writeJSON } from './core.mjs';
import { queue, flush } from './checkpoint.mjs';
import { scanPaper, attest } from './paper.mjs';
import { runEvidence } from './evidence.mjs';
import { request, status } from './dispatch.mjs';

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
  if (fs.existsSync(path.join(project, 'paper', 'main.tex'))) {
    let paper;
    try { paper = scanPaper(project, { persist: false }); }
    catch (e) { findings.push(`Paper scan failed: ${e.message}`); return findings; }
    const counts = {};
    for (const u of paper.units) for (const [kind, status] of Object.entries(u.status)) counts[`${kind}:${status}`] = (counts[`${kind}:${status}`] || 0) + 1;
    findings.push(`Paper review coverage (source blocks, including displays): ${JSON.stringify(counts)}`);
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
  if (cmd === 'attest') {
    const [slug, kind, reviewer, note, ...ids] = rest;
    return attest(safePath(root, `projects/${slug}`), kind, ids, reviewer, note);
  }
  if (cmd === 'run') {
    const result = runEvidence(safePath(root, `projects/${rest[0]}`), rest[1]);
    if (result.execution !== 'PASS') process.exitCode = 1;
    return result;
  }
  if (cmd === 'hook') {
    const input = jsonInput();
    if (input.hook_event_name === 'Stop') {
      const results = flush(root);
      const bad = results.filter(r => !r.ok || r.push === 'no-upstream');
      // Advisory warning: never block Stop and create an agent retry loop.
      if (bad.length) return { systemMessage: `Checkpoint needs attention: ${JSON.stringify(bad)}. See .harness-local/checkpoints.jsonl. Do not retry unchanged failures in a loop.` };
      return {};
    }
    let warning = '';
    try { wiki(root); } catch (e) { warning = e.message; }
    const pending = path.join(root, '.harness-local', 'pending');
    if (fs.existsSync(pending) && fs.readdirSync(pending).length) warning += ' Pending checkpoint jobs exist; inspect them before queueing overlapping files.';
    return { hookSpecificOutput: { hookEventName: input.hook_event_name || 'SessionStart', additionalContext: `Read harness/PROTOCOL.md. At turn end queue only files this task changed and flush; Stop is a fallback. ${warning}` } };
  }
  throw Error('Commands: review-request <slug> --target <plan|step-N|paper> --reviewer <codex|claude> [--model <model>] | review-status <slug> [id] | review-resume <slug> <id> | paths | check [slug...] | queue <repo> <message> <files...> | flush [--local-only] | paper-scan <slug> | attest <slug> <map|citations> <reviewer> <note> <ids...> | run <slug> <spec.json> | hook');
}
function jsonInput() {
  const input = fs.readFileSync(0, 'utf8').trim();
  return input ? JSON.parse(input) : {};
}
export async function entry(args) {
  try { const result = await main(args); if (result !== undefined) console.log(JSON.stringify(result, null, 2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await entry();
