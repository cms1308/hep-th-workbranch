import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, git, sha, wiki, safePath, writeJSON } from '../harness/core.mjs';
import { queue, flush } from '../harness/checkpoint.mjs';
import { scanPaper, attest, sourceFiles } from '../harness/paper.mjs';
import { runEvidence } from '../harness/evidence.mjs';
import { migrateState, sections } from '../harness/migrate-state.mjs';
import { sync } from '../harness/sync.mjs';
import { hookCommand, installHooks } from '../harness/install-hooks.mjs';
import { checkProject, main } from '../harness/cli.mjs';
import { prepare, grade } from '../harness/eval.mjs';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hep harness 한글 '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(root, name, text = '') { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
function init(root) {
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'Harness Test']);
  put(root, '.gitignore', '.harness-local/\nprojects/\n');
  git(root, ['add', '.gitignore']); git(root, ['commit', '-m', 'initial']);
}

test('wiki resolves renamed sibling, refuses ambiguity, and supports local override', t => {
  const p = temp(t), root = path.join(p, 'hep-th-workbranch'); fs.mkdirSync(root);
  put(p, 'renamed wiki/Index.md'); fs.mkdirSync(path.join(p, 'renamed wiki/wiki'));
  assert.equal(wiki(root), path.join(p, 'renamed wiki'));
  put(p, 'another/Index.md'); fs.mkdirSync(path.join(p, 'another/wiki'));
  assert.throws(() => wiki(root), /found 2/);
  assert.equal(wiki(root, '../renamed wiki'), path.join(p, 'renamed wiki'));
  assert.throws(() => safePath(root, '../another/Index.md'), /Unsafe/);
  assert.throws(() => safePath(root, '.GIT/config'), /Unsafe/);
});

test('checkpoint commits selected nested-repo files, preserves user changes and retries nothing', t => {
  const root = temp(t); init(root);
  const project = path.join(root, 'projects', 'example'); init(project);
  put(project, 'STATE.md', 'ours'); put(project, 'user.txt', 'user');
  queue(root, 'projects/example', ['STATE.md'], 'step');
  const [r] = flush(root, { push: false });
  assert.equal(r.ok, true); assert.equal(r.push, 'not-requested');
  assert.match(git(project, ['status', '--porcelain']), /user.txt/);
  assert.doesNotMatch(git(project, ['status', '--porcelain']), /STATE.md/);
  assert.deepEqual(flush(root), []);
});

test('changed-after-queue files and unrelated staged user changes are never committed', t => {
  const root = temp(t); init(root); put(root, 'a.md', 'a');
  queue(root, '.', ['a.md'], 'test'); put(root, 'a.md', 'changed');
  assert.match(flush(root)[0].error, /changed after queueing/);
  assert.equal(git(root, ['log', '-1', '--format=%s']).trim(), 'initial');
  fs.rmSync(path.join(root, '.harness-local/pending'), { recursive: true });
  put(root, 'user.md', 'staged user edit'); git(root, ['add', 'user.md']);
  queue(root, '.', ['a.md'], 'test');
  assert.match(flush(root)[0].error, /Unrelated staged/);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'user.md');
});

test('literal filenames, deletions and missing upstream are handled explicitly', t => {
  const root = temp(t); init(root); put(root, '[data].md', 'old');
  queue(root, '.', ['[data].md'], 'literal'); assert.equal(flush(root)[0].push, 'no-upstream');
  fs.unlinkSync(path.join(root, '[data].md'));
  queue(root, '.', ['[data].md'], 'delete'); assert.equal(flush(root)[0].ok, true);
  assert.equal(git(root, ['ls-files', '[data].md']).trim(), '');
  assert.throws(() => queue(root, '.', ['.git/config'], 'bad'), /Unsafe/);
  assert.throws(() => queue(root, '.', ['.harness-local'], 'bad'), /Runtime/);
});

test('a rejected remote push records the local commit and keeps its retry job', t => {
  const top = temp(t), root = path.join(top, 'work'), remote = path.join(top, 'remote.git');
  init(root); fs.mkdirSync(remote); git(remote, ['init', '--bare']);
  git(root, ['remote', 'add', 'origin', remote]); git(root, ['push', '-u', 'origin', 'main']);
  const other = path.join(top, 'other'); git(top, ['clone', '-b', 'main', remote, other]);
  git(other, ['config', 'user.email', 'test@example.invalid']); git(other, ['config', 'user.name', 'Other']);
  put(other, 'remote.md', 'remote'); git(other, ['add', 'remote.md']); git(other, ['commit', '-m', 'remote']); git(other, ['push']);
  put(root, 'local.md', 'local'); queue(root, '.', ['local.md'], 'local');
  const [r] = flush(root);
  assert.equal(r.ok, false); assert.equal(r.push, 'failed'); assert.match(r.commit, /^[a-f0-9]{40}$/);
  assert.equal(r.head, git(root, ['rev-parse', 'HEAD']).trim());
  assert.equal(fs.readdirSync(path.join(root, '.harness-local/pending')).length, 1);
  const [retry] = flush(root); assert.equal(retry.commit, 'unchanged'); assert.equal(retry.push, 'failed');
});

test('unchanged remote push succeeds and clears the queued job', t => {
  const top = temp(t), root = path.join(top, 'work'), remote = path.join(top, 'remote.git');
  init(root); fs.mkdirSync(remote); git(remote, ['init', '--bare']); git(root, ['remote', 'add', 'origin', remote]); git(root, ['push', '-u', 'origin', 'main']);
  put(root, 'a', 'a'); queue(root, '.', ['a'], 'a'); assert.equal(flush(root)[0].push, 'success');
  assert.equal(git(remote, ['rev-parse', 'refs/heads/main']).trim(), git(root, ['rev-parse', 'HEAD']).trim());
});

test('state migration preserves original bytes and every whole section, and refuses a rerun', t => {
  const root = temp(t);
  put(root, 'PROJECT.md', '# Formulation');
  const state = '# STATE\r\n\r\n## Status\r\nold\r\n\r\n## Plan\r\n- [ ] test\r\n  verify: exact\r\n\r\n## Established results\r\nR1 $x=1$\r\n\r\n## Established results (continued)\r\nR2 unverified\r\n\r\n## Paper\r\nDo not restore user cut.\r\n\r\n## Current step\r\nnext\r\n\r\n## Open questions / gotchas\r\nfailed branch\r\n';
  put(root, 'STATE.md', state);
  migrateState(root, { status: 'waiting', next: 'review', decisions: 'keep cut', results: 'R1, R2', gotchas: 'pending' });
  assert.equal(fs.readFileSync(path.join(root, 'notes/state-before-2026-09-08.md'), 'utf8'), state);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'notes/state-migration.json')));
  assert.equal(manifest.original_sha256, sha(state));
  for (const part of sections(state.replace(/\r\n/g, '\n'))) {
    const route = manifest.sections.find(s => s.sha256_lf === sha(part.content));
    assert.ok(fs.readFileSync(path.join(root, route.destination), 'utf8').includes(part.content));
  }
  assert.throws(() => migrateState(root, {}), /Already migrated/);
  assert.deepEqual(checkProject(root), []);
});

function paper(root) {
  put(root, 'paper/main.tex', '\\begin{document}\nA claim with six stable opening words \\cite{A,B}.\n\n\\input{parts/body}\n\n\\bibliography{refs}\n\\end{document}\n');
  put(root, 'paper/parts/body.tex', 'Another claim has its own opening words.\n\n\\input{parts/tail}\n');
  put(root, 'paper/parts/tail.tex', 'Tail text.');
  put(root, 'paper/refs.bib', '@article{A,title={A}}\n@article{B,title={B}}');
  put(root, 'paper/PUNCHLINES.md', '# Map'); put(root, 'paper/CITATIONS.md', '# Ledger');
}
test('paper scanner includes nested TeX, preserves IDs on moves and invalidates edited claims', t => {
  const root = temp(t); paper(root);
  const s = scanPaper(root); assert.equal(sourceFiles(root).length, 3);
  const u = s.units.find(x => x.citations.length);
  assert.equal(u.status.map, 'UNREVIEWED');
  put(root, 'paper/PUNCHLINES.md', `# Map\n[${u.id}] claim`);
  attest(root, 'map', [u.id], 'reviewer', 'checked claim');
  assert.equal(scanPaper(root).units.find(x => x.id === u.id).status.map, 'CURRENT');
  const file = path.join(root, 'paper/main.tex');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('\\cite{A,B}', 'changed \\cite{A,B}'));
  const changed = scanPaper(root).units.find(x => x.id === u.id);
  assert.ok(changed); assert.equal(changed.status.map, 'STALE');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('A claim with six stable opening words changed \\cite{A,B}.\n\n', '').replace('\\bibliography', 'A claim with six stable opening words changed \\cite{A,B}.\n\n\\bibliography'));
  assert.ok(scanPaper(root).units.find(x => x.id === u.id));
});

test('citation review requires every key on this block and bib edits invalidate it', t => {
  const root = temp(t); paper(root); const s = scanPaper(root); const u = s.units.find(x => x.citations.length);
  put(root, 'paper/CITATIONS.md', `| [${u.id}] | A | SUPPORTS | ORIGINAL |\n| [other] | B | SUPPORTS | ORIGINAL |`);
  assert.throws(() => attest(root, 'citations', [u.id], 'r', 'only A checked'), /completed ledger row/);
  put(root, 'paper/CITATIONS.md', `| [${u.id}] | A | SUPPORTS | ORIGINAL |\n| [${u.id}] | B | SUPPORTS | ORIGINAL |`);
  attest(root, 'citations', [u.id], 'r', 'both sources checked');
  assert.equal(scanPaper(root).units.find(x => x.id === u.id).status.citations, 'CURRENT');
  put(root, 'paper/refs.bib', '@article{A,title={different source}}');
  assert.equal(scanPaper(root).units.find(x => x.id === u.id).status.citations, 'STALE');
});

test('verification records failure, input hashes and environment without promoting interpretation', t => {
  const root = temp(t); put(root, 'calc/check.mjs', 'process.exit(3)');
  const spec = { id: 'R1', claim: 'finite result', scope: 'through q^3', assumptions: [], criterion: 'assert exact', evidence_kind: 'finite-series', dependencies: [], inputs: ['calc/check.mjs'], command: [process.execPath, 'calc/check.mjs'], environment: { node: process.version }, independent_check: 'unavailable' };
  writeJSON(path.join(root, 'calc/checks/R1.json'), spec);
  const r = runEvidence(root, 'calc/checks/R1.json');
  assert.equal(r.execution, 'FAIL'); assert.equal(r.exit_code, 3); assert.equal(r.interpretation, 'UNREVIEWED');
  assert.equal(r.inputs_sha256['calc/check.mjs'], sha('process.exit(3)'));
  assert.ok(fs.existsSync(path.join(root, r.directory, 'run.json')));
});

test('failed verification propagates a nonzero CLI exit after saving its manifest', async t => {
  const root = temp(t), project = path.join(root, 'projects', 'example');
  put(project, 'calc/fail.mjs', 'process.exit(4)');
  writeJSON(path.join(project, 'calc/spec.json'), { id: 'R1', claim: 'test', scope: 'n=1', assumptions: [], criterion: 'exit zero', evidence_kind: 'numerical', dependencies: [], inputs: ['calc/fail.mjs'], command: [process.execPath, 'calc/fail.mjs'], environment: { node: process.version }, independent_check: 'not available' });
  const saved = process.exitCode;
  try {
    const r = await main(['run', 'example', 'calc/spec.json'], root);
    assert.equal(process.exitCode, 1); assert.equal(r.execution, 'FAIL');
  } finally { process.exitCode = saved; }
});

test('a live checkpoint lock prevents another writer without deleting its lock', t => {
  const root = temp(t); init(root); put(root, 'a', 'a'); queue(root, '.', ['a'], 'a');
  const lock = path.join(root, '.harness-local', 'locks', sha(root) + '.lock');
  put(root, path.relative(root, lock), 'another process');
  assert.match(flush(root)[0].error, /Another checkpoint owns/);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'another process');
  assert.equal(git(root, ['log', '-1', '--format=%s']).trim(), 'initial');
});

test('generated adapters remain synchronized', () => assert.deepEqual(sync(ROOT, true), []));

test('evaluation packages omit the answer key and grading catches a known overclaim', t => {
  const root = temp(t), bundle = path.join(root, 'package');
  prepare(ROOT, 'finite-order', bundle);
  assert.deepEqual(fs.readdirSync(bundle).sort(), ['case.json', 'prompt.md']);
  assert.ok(!fs.readFileSync(path.join(bundle, 'prompt.md'), 'utf8').includes('maximum_checked_power": 6'));
  const good = grade(ROOT, 'finite-order', { decisions: { all_orders: false, evidence_kind: 'finite-series', maximum_checked_power: 6 } });
  const bad = grade(ROOT, 'finite-order', { decisions: { all_orders: true, evidence_kind: 'analytic-proof', maximum_checked_power: 6 } });
  assert.equal(good.passed, good.total); assert.ok(bad.passed < bad.total);
  assert.equal(good.explanation_review, 'PENDING HUMAN REVIEW');
});

test('hook installation is idempotent and preserves unrelated hooks/settings', t => {
  const root = temp(t);
  writeJSON(path.join(root, '.claude/settings.json'), { unrelated: true, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'unrelated' }] }] } });
  installHooks(root); const first = fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8');
  installHooks(root); assert.equal(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'), first);
  assert.equal(JSON.parse(first).hooks.Stop.length, 2); assert.equal(JSON.parse(first).unrelated, true);
});

test('shared hook bootstrap runs from a nested folder with spaces on the current OS shell', t => {
  const dir = temp(t), root = path.join(dir, 'project root');
  put(root, 'harness/cli.mjs', 'export function entry(args) { console.log(JSON.stringify({args,cwd:process.cwd()})); }');
  fs.mkdirSync(path.join(root, 'projects', 'nested'), { recursive: true });
  const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
  const args = process.platform === 'win32' ? ['-NoProfile', '-Command', hookCommand] : ['-c', hookCommand];
  const r = spawnSync(shell, args, { cwd: path.join(root, 'projects/nested'), encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout.trim()).args, ['hook']);
});
