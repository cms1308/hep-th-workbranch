import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { request, status, invocation, execute, configured, JUDGE_INSTRUCTIONS } from '../harness/dispatch.mjs';
import { git, write, writeJSON } from '../harness/core.mjs';
// The CLI takes the writer and the reviewer from the app that runs it; these tests run as if outside both.
for (const k of ['CLAUDECODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID']) delete process.env[k];

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
    // The snapshot is named by HEAD and its file; the hashes of every file stay out of the prompt, whose length a provider caps.
    assert.ok(options.prompt.includes(git(project, ['rev-parse', 'HEAD']).trim()) && options.prompt.includes(path.join(options.dir, 'run.json')));
    assert.ok(!options.prompt.includes(JSON.parse(fs.readFileSync(path.join(options.dir, 'run.json'), 'utf8')).snapshot.files['PLAN.md']));
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

test('a judge call carries the judge instruction, no tool and no user configuration, and is given the configured model and effort', t => {
  const codex = invocation('codex', '/tmp', 'm', { narrow: true, effort: 'xhigh' }).args, set = codex.flatMap((x, i) => x === '-c' ? [codex[i + 1]] : []);
  assert.ok(codex.includes('--ignore-user-config'));
  for (const c of [`model_instructions_file=${JSON.stringify(JUDGE_INSTRUCTIONS)}`, 'model_reasoning_effort="xhigh"', 'features.shell_tool=false', 'features.multi_agent=false', 'include_environment_context=false', 'web_search="disabled"'])
    assert.ok(set.includes(c), c);
  assert.ok(!codex.includes('--disable'), 'a feature that the CLI does not know must not stop the call');
  assert.deepEqual(codex.slice(-2), ['--model', 'm']);
  const claude = invocation('claude', '/tmp', 'c', { narrow: true, effort: 'high' }).args;
  assert.equal(claude[claude.indexOf('--system-prompt') + 1], fs.readFileSync(JUDGE_INSTRUCTIONS, 'utf8').trim());
  assert.deepEqual([claude[claude.indexOf('--setting-sources') + 1], claude[claude.indexOf('--effort') + 1], claude[claude.indexOf('--tools') + 1]], ['', 'high', '']);
  assert.ok(claude.includes('--disable-slash-commands'));
  for (const review of [invocation('codex', '/tmp').args, invocation('claude', '/tmp').args])
    assert.ok(!review.includes('--ignore-user-config') && !review.includes('--system-prompt'), 'a review keeps its tools and configuration');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hep-config-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.writeFileSync(path.join(home, 'config.toml'), 'notify = ["x"]\nmodel = "gpt-x"\nmodel_reasoning_effort = "xhigh"\n\n[profiles.other]\nmodel = "gpt-y"\n');
  writeJSON(path.join(home, 'settings.json'), { model: 'fable', effortLevel: 'max' });
  assert.deepEqual(configured('codex', { CODEX_HOME: home }), { model: 'gpt-x', effort: 'xhigh' }, 'a value in a later table is not the configured one');
  assert.deepEqual(configured('claude', { CLAUDE_CONFIG_DIR: home }), { model: 'fable', effort: 'max' });
  assert.deepEqual(configured('codex', { CODEX_HOME: path.join(home, 'missing') }), { model: null, effort: null });
});
