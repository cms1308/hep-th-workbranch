import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { git, read, json, sha, safePath, repository, writeJSON } from './core.mjs';

export const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['ready', 'corrections required', 'inconclusive'] },
    report: { type: 'string' },
    blocking_findings: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'string' } },
    limitations: { type: 'array', items: { type: 'string' } },
  }, required: ['verdict', 'report', 'blocking_findings', 'checks', 'limitations'],
};

export function snapshot(project) {
  const files = git(project, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
  return { head: git(project, ['rev-parse', 'HEAD']).trim(), files: Object.fromEntries([...new Set(files)].sort().map(name => {
    const file = safePath(project, name);
    if (fs.existsSync(file) && !fs.statSync(file).isFile()) throw Error(`Unsupported review input: ${name}`);
    return [name, fs.existsSync(file) ? sha(fs.readFileSync(file)) : null];
  })) };
}

export function executable(provider) {
  const override = process.env[`HEP_${provider.toUpperCase()}_BIN`];
  if (override) return override;
  const native = path.join(os.homedir(), '.local', 'bin', provider + (process.platform === 'win32' ? '.exe' : ''));
  return fs.existsSync(native) ? native : provider;
}

export function invocation(provider, dir, model) {
  const args = provider === 'codex'
    ? ['exec', '--sandbox', 'read-only', '--json', '--output-schema', path.join(dir, 'schema.json'), '-o', path.join(dir, 'response.json'), '-']
    : ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--permission-mode', 'dontAsk', '--tools', 'Read,Glob,Grep,WebFetch,WebSearch'];
  if (model) args.push('--model', model);
  return { command: executable(provider), args };
}

export function execute(command, args, options) {
  return new Promise((resolve, reject) => {
    const out = fs.openSync(path.join(options.dir, 'stdout.jsonl'), 'w');
    const err = fs.openSync(path.join(options.dir, 'stderr.log'), 'w');
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true, shell: false,
      env: { ...process.env, HEP_REVIEW_CHILD: '1' }, stdio: ['pipe', out, err] });
    fs.closeSync(out); fs.closeSync(err);
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0 ? resolve() : reject(Error(`Reviewer exited ${code ?? signal}; inspect stderr.log`)));
    child.stdin.on('error', () => {});
    child.stdin.end(options.prompt);
    options.started?.(child.pid);
  });
}

export function validate(value) {
  if (!value || !schema.properties.verdict.enum.includes(value.verdict) || typeof value.report !== 'string' || !value.report.trim()) throw Error('Missing or invalid review report');
  for (const key of ['blocking_findings', 'checks', 'limitations']) if (!Array.isArray(value[key]) || value[key].some(x => typeof x !== 'string')) throw Error(`Invalid ${key}`);
  if (value.verdict === 'ready' && (value.blocking_findings.length || !value.checks.length)) throw Error('Ready requires checks and no blocking findings');
  return value;
}

function location(root, slug, id) {
  if (typeof slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(slug)) throw Error('Invalid project slug');
  if (id && !/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid run ID');
  return safePath(root, `.harness-local/reviews/${slug}${id ? '/' + id : ''}`);
}

export function status(root, slug, id) {
  const base = location(root, slug, id);
  if (!id) return fs.existsSync(base) ? fs.readdirSync(base).filter(n => /^[a-f0-9-]{36}$/.test(n)).map(n => status(root, slug, n)) : [];
  const record = json(path.join(base, 'run.json'));
  const project = repository(root, `projects/${slug}`);
  return { ...record, current: JSON.stringify(snapshot(project)) === JSON.stringify(record.snapshot) };
}

export async function request(root, slug, target, provider, { model, runner = execute } = {}) {
  if (process.env.HEP_REVIEW_CHILD) throw Error('Nested reviewer dispatch is prohibited');
  if (!['codex', 'claude'].includes(provider)) throw Error('Reviewer must be codex or claude');
  if (!/^(plan|step-[1-9][0-9]*|paper)$/.test(target)) throw Error('Target must be plan, step-N, or paper');
  const base = location(root, slug);
  const project = repository(root, `projects/${slug}`);
  for (const name of ['PROJECT.md', 'STATE.md', 'PLAN.md']) if (!fs.existsSync(path.join(project, name))) throw Error(`Missing ${name}`);
  fs.mkdirSync(base, { recursive: true });
  const lock = path.join(base, 'active.lock');
  const fd = fs.openSync(lock, 'wx');
  const id = crypto.randomUUID();
  const dir = location(root, slug, id);
  fs.writeFileSync(fd, JSON.stringify({ id, pid: process.pid })); fs.closeSync(fd);
  const record = { id, slug, target, provider, requestedModel: model || null, state: 'running', started: new Date().toISOString() };
  try {
    record.snapshot = snapshot(project);
    writeJSON(path.join(dir, 'run.json'), record);
    writeJSON(path.join(dir, 'schema.json'), schema);
    const prompt = `You are the external ${provider} reviewer, not the author. Harness root: ${root}. Project: ${project}. Target: ${target}.\nRead harness/PROTOCOL.md, project PROJECT.md, STATE.md, PLAN.md, DECISIONS.md if present and linked evidence. Read harness/skills/research-review/SKILL.md for plan/calculation review; for paper read PAPER-STYLE.md, harness/PAPER-REVIEW.md and the proofread and cite-check shared skills.\nThis delegated invocation is report-only: do not edit files, update STATE, checkpoint, or dispatch agents/CLIs. Return those proposed updates in the report for the lead session to record. Do not execute project scripts in this invocation. Independently check central claims by derivation, limiting cases and primary-source reading. When new executable evidence is necessary, return inconclusive with the exact requested check; the lead must arrange a separate recorded verification and re-review. For paper review check physical claims against notes, the argument and paragraph map, and citations against primary sources; do not approve unchecked coverage.\nRead the target and its dependencies; report stable finding IDs, exact evidence locations, fixes, supported scope, independence limits and next action in English. No scientific claim is established by model agreement alone. A ready verdict requires all agreed criteria supported. Actual model identity must be reported only if known; otherwise say unknown. Reviewed snapshot: ${JSON.stringify(record.snapshot)}.\nReturn the required JSON object, with the complete Markdown review in report.`;
    fs.writeFileSync(path.join(dir, 'prompt.txt'), prompt);
    const call = invocation(provider, dir, model);
    await runner(call.command, call.args, { cwd: root, dir, prompt, started: pid => { record.childPid = pid; writeJSON(path.join(dir, 'run.json'), record); } });
    let value;
    if (provider === 'codex') {
      value = json(path.join(dir, 'response.json'));
      const events = read(path.join(dir, 'stdout.jsonl')).split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (!events.some(e => e.type === 'turn.completed') || events.some(e => e.type === 'turn.failed' || e.type === 'error')) throw Error('Codex did not complete successfully');
      record.sessionId = events.find(e => e.type === 'thread.started')?.thread_id || null;
    } else {
      const envelope = json(path.join(dir, 'stdout.jsonl'));
      if (envelope.is_error || envelope.subtype !== 'success') throw Error('Claude did not complete successfully');
      record.sessionId = envelope.session_id || null;
      value = envelope.structured_output;
    }
    record.result = validate(value);
    if (JSON.stringify(snapshot(project)) !== JSON.stringify(record.snapshot)) throw Error('Project changed during review; result cannot be accepted');
    record.state = 'completed';
  } catch (error) {
    record.state = 'failed'; record.error = error.message;
  } finally {
    record.finished = new Date().toISOString();
    writeJSON(path.join(dir, 'run.json'), record);
    fs.unlinkSync(lock);
  }
  return record;
}
