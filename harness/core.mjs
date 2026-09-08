import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export const read = file => fs.readFileSync(file, 'utf8');
export const json = file => JSON.parse(read(file));
export function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}
export const writeJSON = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
export function inside(base, candidate) {
  const rel = path.relative(fs.realpathSync(base), fs.realpathSync(candidate));
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
export function safePath(base, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..' || p.toLowerCase() === '.git')) throw Error(`Unsafe path: ${relative}`);
  const target = path.resolve(base, relative);
  let existing = target;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  if (!inside(base, existing)) throw Error(`Path escapes repository: ${relative}`);
  return target;
}
export function run(command, args, { cwd = ROOT, timeout = 30000, env = {}, input } = {}) {
  const r = spawnSync(command, args, { cwd, timeout, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env }, input, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw Error(`${command} ${args[0]} failed: ${r.error?.message || r.stderr?.trim() || r.stdout?.trim() || `exit ${r.status}`}`);
  return r.stdout;
}
export const git = (repo, args, options = {}) => run('git', ['-C', repo, ...args], options);
export function repository(root, relative = '.') {
  const repo = relative === '.' ? root : safePath(root, relative);
  if (!inside(root, repo) || !fs.existsSync(path.join(repo, '.git'))) throw Error(`Not a harness repository: ${repo}`);
  const actual = fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel']).trim());
  if (actual !== fs.realpathSync(repo)) throw Error(`Not a repository root: ${repo}`);
  return repo;
}
export function wiki(root = ROOT, override = process.env.HEP_WIKI_DIR) {
  const valid = p => fs.existsSync(path.join(p, 'Index.md')) && fs.existsSync(path.join(p, 'wiki'));
  if (override) {
    const p = path.resolve(root, override);
    if (!valid(p)) throw Error(`HEP_WIKI_DIR is not a vault: ${p}`);
    return p;
  }
  const parent = path.dirname(root);
  const candidates = fs.readdirSync(parent, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(parent, d.name)).filter(valid);
  if (candidates.length !== 1) throw Error(`Expected one sibling wiki (Index.md + wiki/); found ${candidates.length}. Set HEP_WIKI_DIR locally.`);
  return candidates[0];
}
export function withLock(root, name, action) {
  const dir = path.join(root, '.harness-local', 'locks');
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, sha(name) + '.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw Error(`Another checkpoint owns the lock for ${name}; inspect ${lock} before retrying.`); }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, time: new Date().toISOString(), name }));
  try { return action(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
