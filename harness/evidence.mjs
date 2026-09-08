import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { sha, read, json, writeJSON, safePath, git } from './core.mjs';

const kinds = ['analytic-proof', 'finite-series', 'numerical', 'literature', 'imported-unverified'];
export function validateSpec(project, spec) {
  for (const name of ['id', 'claim', 'scope', 'assumptions', 'criterion', 'evidence_kind', 'dependencies', 'inputs', 'command', 'environment', 'independent_check']) {
    if (spec[name] === undefined || spec[name] === '' || spec[name] === null) throw Error(`Missing evidence field: ${name}`);
  }
  if (!kinds.includes(spec.evidence_kind)) throw Error('Unknown evidence kind');
  if (!/^[A-Za-z0-9_-]+$/.test(spec.id)) throw Error('Invalid evidence ID');
  if (/REPLACE|<placeholder>/i.test(JSON.stringify(spec))) throw Error('Fill the verification template before running.');
  if (typeof spec.environment !== 'object' || Array.isArray(spec.environment)) throw Error('Environment must record actual runtime/package versions.');
  if (spec.timeout_ms !== undefined && (!Number.isInteger(spec.timeout_ms) || spec.timeout_ms < 1 || spec.timeout_ms > 43200000)) throw Error('timeout_ms must be 1..43200000.');
  if (!Array.isArray(spec.command) || !spec.command.length || spec.command.some(s => typeof s !== 'string')) throw Error('Command must be a nonempty argv array');
  for (const name of ['dependencies', 'inputs', 'assumptions']) if (!Array.isArray(spec[name])) throw Error(`${name} must be an array`);
  for (const f of spec.inputs) if (!fs.statSync(safePath(project, f)).isFile()) throw Error(`Not an input file: ${f}`);
  return spec;
}
export function runEvidence(project, specFile) {
  const spec = validateSpec(project, json(safePath(project, specFile)));
  const inputs = Object.fromEntries([...new Set([specFile, ...spec.inputs])].map(f => [f, sha(fs.readFileSync(safePath(project, f)))]));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
  const runDir = safePath(project, `calc/runs/${spec.id}/${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  const started = Date.now();
  // The author-provided command is executed without a shell; no inferred command or eval.
  const r = spawnSync(spec.command[0], spec.command.slice(1), { cwd: project, encoding: 'utf8', windowsHide: true, timeout: spec.timeout_ms || 60000, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(runDir, 'stdout.txt'), r.stdout || '');
  fs.writeFileSync(path.join(runDir, 'stderr.txt'), (r.stderr || '') + (r.error ? '\n' + r.error.message : ''));
  let commit = null;
  try { commit = git(project, ['rev-parse', 'HEAD']).trim(); } catch { /* First calculation can precede the first commit. */ }
  const result = { version: 1, ...spec, inputs_sha256: inputs, git_commit: commit, platform: process.platform, architecture: process.arch, node: process.version, started: stamp, duration_ms: Date.now() - started, exit_code: r.status, execution: r.status === 0 && !r.error ? 'PASS' : 'FAIL', interpretation: 'UNREVIEWED', stdout_sha256: sha(read(path.join(runDir, 'stdout.txt'))), stderr_sha256: sha(read(path.join(runDir, 'stderr.txt'))) };
  // A zero exit is execution evidence, never automatic proof or promotion of a claim.
  writeJSON(path.join(runDir, 'run.json'), result);
  return { directory: path.relative(project, runDir), ...result };
}
