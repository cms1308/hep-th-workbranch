import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, sha, git, json, writeJSON, repository, safePath, withLock } from './core.mjs';

function fingerprint(repo, name) {
  const p = safePath(repo, name);
  if (!fs.existsSync(p)) return 'deleted';
  if (!fs.lstatSync(p).isFile()) throw Error(`Queue files individually, not directories or symlinks: ${name}`);
  return sha(fs.readFileSync(p));
}
export function queue(root, repoName, files, message) {
  const repo = repository(root, repoName);
  if (!files.length) throw Error('List the files changed by this task. No implicit git add -A.');
  const job = { id: crypto.randomUUID(), repo: repoName, message, created: new Date().toISOString(), files: {} };
  for (const name of [...new Set(files)]) {
    if (name.split(/[\\/]/).includes('.harness-local')) throw Error('Runtime files cannot be queued.');
    job.files[name] = fingerprint(repo, name);
  }
  writeJSON(path.join(root, '.harness-local', 'pending', job.id + '.json'), job);
  return job;
}
export function checkpoint(root, job, { push = true } = {}) {
  const repo = repository(root, job.repo);
  return withLock(root, repo, () => {
    for (const [name, expected] of Object.entries(job.files)) {
      if (fingerprint(repo, name) !== expected) throw Error(`File changed after queueing: ${job.repo}/${name}. Review and replace the pending job.`);
    }
    if (git(repo, ['diff', '--name-only', '--diff-filter=U']).trim()) throw Error('Resolve merge conflicts before checkpointing.');
    for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      const markerPath = git(repo, ['rev-parse', '--git-path', marker]).trim();
      if (fs.existsSync(path.resolve(repo, markerPath))) throw Error(`Git operation in progress: ${marker}`);
    }
    git(repo, ['symbolic-ref', '--quiet', 'HEAD']);
    const names = Object.keys(job.files);
    const staged = git(repo, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
    if (staged.some(n => !names.includes(n))) throw Error('Unrelated staged files exist; preserve the user index and checkpoint separately.');
    // --literal-pathspecs prevents filenames from becoming Git pathspec expressions.
    git(repo, ['--literal-pathspecs', 'add', '-A', '--', ...names]);
    let commit = 'unchanged';
    if (git(repo, ['diff', '--cached', '--name-only']).trim()) {
      git(repo, ['commit', '-m', job.message || 'Checkpoint research harness work'], { timeout: 60000 });
      commit = git(repo, ['rev-parse', 'HEAD']).trim();
    }
    let upstream;
    try { upstream = git(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).trim(); } catch { /* Local-only repository. */ }
    const result = { repo: job.repo, commit, head: git(repo, ['rev-parse', 'HEAD']).trim(), push: push ? 'no-upstream' : 'not-requested' };
    if (push && upstream) {
      // No pull, rebase, force push, or guessed remote/branch. A rejection is visible.
      const branch = git(repo, ['symbolic-ref', '--short', 'HEAD']).trim();
      const remote = git(repo, ['config', '--get', `branch.${branch}.remote`]).trim();
      const ref = git(repo, ['config', '--get', `branch.${branch}.merge`]).trim();
      try {
        git(repo, ['push', '--porcelain', remote, `HEAD:${ref}`], { timeout: 45000 });
        result.push = 'success';
      } catch (e) { result.push = 'failed'; result.error = e.message; }
    }
    return result;
  });
}
export function flush(root = ROOT, options = {}) {
  const pending = path.join(root, '.harness-local', 'pending');
  if (!fs.existsSync(pending)) return [];
  const results = [];
  for (const file of fs.readdirSync(pending).filter(f => f.endsWith('.json'))) {
    const p = path.join(pending, file);
    let job;
    try {
      job = json(p);
      const result = checkpoint(root, job, options);
      results.push({ id: job.id, ok: result.push !== 'failed', ...result });
      if (result.push !== 'failed') fs.unlinkSync(p);
    } catch (e) { results.push({ id: job?.id || file, repo: job?.repo, ok: false, error: e.message }); }
  }
  for (const result of results) {
    const log = path.join(root, '.harness-local', 'checkpoints.jsonl');
    fs.appendFileSync(log, JSON.stringify({ time: new Date().toISOString(), ...result }) + '\n');
  }
  return results;
}
