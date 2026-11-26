import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
    const stat = fs.existsSync(file) || fs.lstatSync(file, { throwIfNoEntry: false }) ? fs.lstatSync(file) : null;
    if (stat && stat.isSymbolicLink()) return [name, sha(Buffer.from(`symlink:${fs.readlinkSync(file)}`))];
    if (stat && !stat.isFile()) throw Error(`Unsupported review input: ${name}`);
    return [name, stat ? sha(fs.readFileSync(file)) : null];
  })) };
}

export function executable(provider) {
  const override = process.env[`HEP_${provider.toUpperCase()}_BIN`];
  if (override) return override;
  const native = path.join(os.homedir(), '.local', 'bin', provider + (process.platform === 'win32' ? '.exe' : ''));
  return fs.existsSync(native) ? native : provider;
}

// The instruction a judge's call carries in place of the provider's own: the question is all in the prompt.
export const JUDGE_INSTRUCTIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'judge-instructions.md');
// Codex features whose tools or notices a judge does not use. Set by -c, which ignores a name the CLI does not know (--disable stops on it).
const IDLE = ['shell_tool', 'unified_exec', 'multi_agent', 'image_generation', 'goals', 'plugins', 'apps', 'browser_use', 'browser_use_external', 'computer_use', 'in_app_browser',
  'sleep_tool', 'skill_search', 'tool_suggest', 'code_mode_host', 'hooks', 'view_image'];
const toml = value => JSON.stringify(value);                // a TOML basic string has the escapes of JSON
// The vendor of the app running this process: Codex marks its shell with CODEX_THREAD_ID (checked first, since a Codex launched
// from Claude Code inherits CLAUDECODE), Claude Code with CLAUDECODE=1. Null outside both.
export function runningVendor(env = process.env) {
  if (env.CODEX_THREAD_ID || env.CODEX_SESSION_ID) return 'codex';
  return env.CLAUDECODE === '1' ? 'claude' : null;
}
// The model and effort the user configured for a provider, which a judge's call passes explicitly since it leaves the configuration out.
export function configured(provider, env = process.env) {
  try {
    if (provider === 'codex') {
      const text = fs.readFileSync(path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml'), 'utf8').split(/^\s*\[/m)[0];
      const key = name => text.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'))?.[1] || null;
      return { model: key('model'), effort: key('model_reasoning_effort') };
    }
    const settings = json(path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json'));
    return { model: typeof settings.model === 'string' ? settings.model : null, effort: typeof settings.effortLevel === 'string' ? settings.effortLevel : null };
  } catch { return { model: null, effort: null }; }
}
// narrow: a call that carries everything in its prompt (a verdict on one unit). It runs outside any repository, without tools, keeps no session,
// and carries the judge's instruction instead of the provider's, without the user's configuration (measured: design record).
export function invocation(provider, dir, model, { narrow = false, schema: shape = schema, effort = null } = {}) {
  const lean = provider === 'codex'
    ? ['--ignore-user-config', ...['include_permissions_instructions=false', 'include_apps_instructions=false', 'include_collaboration_mode_instructions=false', 'include_environment_context=false',
      'web_search="disabled"', `model_instructions_file=${toml(JUDGE_INSTRUCTIONS)}`, ...IDLE.map(f => `features.${f}=false`), ...(effort ? [`model_reasoning_effort=${toml(effort)}`] : [])].flatMap(c => ['-c', c])]
    : ['--system-prompt', fs.readFileSync(JUDGE_INSTRUCTIONS, 'utf8').trim(), '--disable-slash-commands', '--setting-sources', '', ...(effort ? ['--effort', effort] : [])];
  const args = provider === 'codex'
    ? ['exec', '--sandbox', 'read-only', ...(narrow ? ['--skip-git-repo-check', '--ephemeral', ...lean] : []), '--json', '--output-schema', path.join(dir, 'schema.json'), '-o', path.join(dir, 'response.json'), '-']
    : ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(shape), '--permission-mode', 'dontAsk', '--tools', narrow ? '' : 'Read,Glob,Grep,WebFetch,WebSearch', ...(narrow ? ['--strict-mcp-config', '--no-session-persistence', ...lean] : [])];
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
    const timer = options.timeout ? setTimeout(() => child.kill(), options.timeout) : null;
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', (code, signal) => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`Reviewer exited ${code ?? signal}; inspect stderr.log`)); });
    child.stdin.on('error', () => {});
    child.stdin.end(options.prompt);
    options.started?.(child.pid);
  });
}

// The answer a provider left in `dir` after a completed call: the structured value, the session, and the models and usage it reported.
export function collect(provider, dir) {
  if (provider === 'codex') {
    const value = json(path.join(dir, 'response.json'));
    const events = read(path.join(dir, 'stdout.jsonl')).split('\n').filter(Boolean).map(line => JSON.parse(line));
    if (!events.some(e => e.type === 'turn.completed') || events.some(e => e.type === 'turn.failed' || e.type === 'error')) throw Error('Codex did not complete successfully');
    return { value, sessionId: events.find(e => e.type === 'thread.started')?.thread_id || null, models: [], usage: events.findLast(e => e.type === 'turn.completed').usage || null };
  }
  const envelope = json(path.join(dir, 'stdout.jsonl'));
  if (envelope.is_error || envelope.subtype !== 'success') throw Error('Claude did not complete successfully');
  return { value: envelope.structured_output, sessionId: envelope.session_id || null, models: Object.keys(envelope.modelUsage || {}), usage: envelope.usage ? { ...envelope.usage, cost_usd: envelope.total_cost_usd } : null };
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
  if (!/^(plan|step-(0|[1-9][0-9]*)|paper)$/.test(target)) throw Error('Target must be plan, step-N (N a non-negative integer), or paper');
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
    const prompt = `You are the external ${provider} reviewer, not the author. Harness root: ${root}. Project: ${project}. Target: ${target}.\nRead harness/PROTOCOL.md, project PROJECT.md, STATE.md, PLAN.md, DECISIONS.md if present and linked evidence. Read harness/skills/research-review/SKILL.md (for paper its manuscript review); for paper also read PAPER-STYLE.md, harness/PAPER-REVIEW.md and the cite-check shared skill.\nThis delegated invocation is report-only: do not edit files, update STATE, checkpoint, or dispatch agents/CLIs. Return those proposed updates in the report for the lead session to record. Do not execute project scripts in this invocation. Independently check central claims by derivation, limiting cases and primary-source reading. When new executable evidence is necessary, return inconclusive with the exact requested check; the lead must arrange a separate recorded verification and re-review. For paper review check physical claims against notes, the manuscript argument and any useful section outline, and citations against primary sources. A missing paragraph map or untracked source block is not a blocking finding. Definitions, motivation and transitions can serve the argument without a new result claim. Do not approve scientific or citation checks you did not perform; report their actual scope.\nRead the target and its dependencies; report stable finding IDs, exact evidence locations, fixes, supported scope, independence limits and next action in English. No scientific claim is established by model agreement alone. A ready verdict requires all agreed criteria supported. Actual model identity must be reported only if known; otherwise say unknown. Reviewed snapshot: ${JSON.stringify(record.snapshot)}.\nReturn the required JSON object, with the complete Markdown review in report.`;
    fs.writeFileSync(path.join(dir, 'prompt.txt'), prompt);
    const call = invocation(provider, dir, model);
    await runner(call.command, call.args, { cwd: root, dir, prompt, started: pid => { record.childPid = pid; writeJSON(path.join(dir, 'run.json'), record); } });
    const got = collect(provider, dir);
    record.sessionId = got.sessionId;
    record.result = validate(got.value);
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
