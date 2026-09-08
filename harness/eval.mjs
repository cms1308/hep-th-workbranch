import fs from 'node:fs';
import path from 'node:path';
import { ROOT, read, json, writeJSON, write, sha } from './core.mjs';

export function prepare(root, id, destination) {
  const task = json(path.join(root, 'evals/cases.json')).cases.find(c => c.id === id);
  if (!task) throw Error(`Unknown case: ${id}`);
  if (fs.existsSync(destination)) throw Error('Use a new evaluation directory.');
  fs.mkdirSync(destination, { recursive: true });
  const policy = ['PROTOCOL.md', 'MEMORY.md', 'EVIDENCE.md', 'PAPER-REVIEW.md'].map(f => read(path.join(root, 'harness', f))).join('\n\n');
  write(path.join(destination, 'prompt.md'), `# Evaluation task\n\n${task.task}\n\n## Materials\n\n${task.material}\n\nReturn JSON with {"decisions": {...}, "explanation": "..."}.\nUse only this package; do not inspect the source repository or expected answers.\n\n## Harness instructions\n\n${policy}`);
  writeJSON(path.join(destination, 'case.json'), { id, policy_sha256: sha(policy), case_sha256: sha(JSON.stringify(task)) });
  return destination;
}
export function grade(root, id, answer) {
  const expected = json(path.join(root, 'evals/expected.json'))[id];
  if (!expected) throw Error(`Unknown case: ${id}`);
  const checks = Object.entries(expected).map(([key, value]) => ({ key, expected: value, actual: answer.decisions?.[key] ?? null, pass: answer.decisions?.[key] === value }));
  return { id, passed: checks.filter(c => c.pass).length, total: checks.length, checks, explanation_review: 'PENDING HUMAN REVIEW', metadata: answer.metadata || null };
}
if (process.argv[1]?.endsWith('eval.mjs')) {
  try {
    const [command, id, file] = process.argv.slice(2);
    const result = command === 'prepare' ? prepare(ROOT, id, path.resolve(file)) : command === 'grade' ? grade(ROOT, id, json(path.resolve(file))) : (() => { throw Error('Use prepare <case> <new-directory> or grade <case> <answer.json>'); })();
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
