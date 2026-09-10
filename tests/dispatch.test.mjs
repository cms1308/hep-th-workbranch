import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { request, status, invocation, execute } from '../harness/dispatch.mjs';
import { git, write, writeJSON } from '../harness/core.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hep-dispatch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'projects', 'example');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'user.email', 'test@example.invalid']);
  for (const name of ['PROJECT.md', 'STATE.md', 'PLAN.md']) write(path.join(project, name), 'Fixture\n');
  git(project, ['add', '.']); git(project, ['commit', '-qm', 'fixture']);
  return { root, project };
}
const ready = () => ({ verdict: 'ready', report: 'Checked the stated identity independently.', blocking_findings: [], checks: ['Independent derivation'], limitations: ['Fixture only'] });
function response(provider, options, value = ready()) {
  if (provider === 'codex') {
    writeJSON(path.join(options.dir, 'response.json'), value);
    write(path.join(options.dir, 'stdout.jsonl'), '{"type":"thread.started","thread_id":"test"}\n{"type":"turn.completed"}\n');
  } else writeJSON(path.join(options.dir, 'stdout.jsonl'), { subtype: 'success', is_error: false, session_id: 'test', structured_output: value });
}

for (const provider of ['codex', 'claude']) test(`${provider} records a valid review and resume does not redispatch`, async t => {
  const { root, project } = fixture(t); let count = 0;
  const run = await request(root, 'example', 'step-3', provider, { runner: async (_, args, options) => {
    count++; assert.ok(options.prompt.includes('step-3')); response(provider, options);
  } });
  assert.equal(run.state, 'completed'); assert.equal(run.sessionId, 'test');
  assert.equal(status(root, 'example', run.id).current, true);
  assert.equal(count, 1);
  write(path.join(project, 'PLAN.md'), 'Changed criterion');
  assert.equal(status(root, 'example', run.id).current, false);
});

test('concurrent dispatch is rejected and changed inputs cannot pass', async t => {
  const { root, project } = fixture(t);
  const result = await request(root, 'example', 'plan', 'codex', { runner: async (_, __, options) => {
    await assert.rejects(request(root, 'example', 'plan', 'claude'), /EEXIST/);
    response('codex', options);
    write(path.join(project, 'STATE.md'), 'Concurrent edit');
  } });
  assert.equal(result.state, 'failed'); assert.match(result.error, /changed/);
});

for (const variant of ['missing', 'blockers', 'no checks', 'provider error', 'crash']) test(`rejects ${variant} and releases lock`, async t => {
  const { root } = fixture(t);
  const result = await request(root, 'example', 'paper', 'claude', { runner: async (_, __, options) => {
    if (variant === 'crash') throw Error('Provider unavailable');
    if (variant === 'missing') return;
    const value = ready();
    if (variant === 'blockers') value.blocking_findings.push('Unresolved error');
    if (variant === 'no checks') value.checks = [];
    response('claude', options, value);
    if (variant === 'provider error') writeJSON(path.join(options.dir, 'stdout.jsonl'), { subtype: 'error_max_turns', structured_output: value });
  } });
  assert.equal(result.state, 'failed');
  assert.equal(fs.existsSync(path.join(root, '.harness-local/reviews/example/active.lock')), false);
});

test('rejects unsafe project, target and nested invocation', async t => {
  const { root } = fixture(t);
  assert.throws(() => status(root), /slug/);
  await assert.rejects(request(root, '../escape', 'plan', 'codex'), /slug/);
  await assert.rejects(request(root, 'example', 'anything', 'codex'), /Target/);
  const old = process.env.HEP_REVIEW_CHILD; process.env.HEP_REVIEW_CHILD = '1';
  try { await assert.rejects(request(root, 'example', 'plan', 'codex'), /Nested/); }
  finally { if (old === undefined) delete process.env.HEP_REVIEW_CHILD; else process.env.HEP_REVIEW_CHILD = old; }
});

test('native process preserves stdin and arguments without shell expansion', async t => {
  const { root } = fixture(t);
  const dir = path.join(root, 'process'); fs.mkdirSync(dir);
  const prompt = 'literal $HOME; `command` and 한글\nnext line';
  await execute(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { cwd: root, dir, prompt });
  assert.equal(fs.readFileSync(path.join(dir, 'stdout.jsonl'), 'utf8'), prompt);
  await assert.rejects(execute(process.execPath, ['-e', 'process.exit(7)'], { cwd: root, dir, prompt: '' }), /7/);
  await assert.rejects(execute(path.join(root, 'missing-executable'), [], { cwd: root, dir, prompt: '' }), /ENOENT/);
});

test('provider arguments restrict review tools and preserve explicit models', () => {
  const claude = invocation('claude', '/tmp', 'requested-model');
  assert.ok(claude.args.includes('dontAsk'));
  assert.equal(claude.args.at(-1), 'requested-model');
  assert.equal(claude.args[claude.args.indexOf('--tools') + 1].includes('Bash'), false);
  assert.ok(invocation('codex', '/tmp').args.includes('read-only'));
});
