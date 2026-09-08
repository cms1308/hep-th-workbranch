import fs from 'node:fs';
import path from 'node:path';
import { read, write, writeJSON, sha, ROOT } from './core.mjs';

export function sections(text) {
  const matches = [...text.matchAll(/^## .+$/gm)];
  return matches.map((m, i) => ({ title: m[0].slice(3), content: text.slice(m.index, matches[i + 1]?.index ?? text.length) }));
}
export function migrateState(project, summary, date = '2026-09-08') {
  const marker = path.join(project, 'notes', 'state-migration.json');
  if (fs.existsSync(marker)) throw Error(`Already migrated: ${project}`);
  // Read the complete original formulation/state; transformation is lossless section routing.
  read(path.join(project, 'PROJECT.md'));
  const original = fs.readFileSync(path.join(project, 'STATE.md'));
  const text = original.toString('utf8').replace(/\r\n/g, '\n');
  const slug = path.basename(project);
  const archive = `notes/state-before-${date}.md`;
  const docs = {
    'RESULTS.md': `# RESULTS — ${slug}\n\nDetailed result catalog migrated without changing evidence grades or result IDs.\nNew entries follow harness/EVIDENCE.md. Existing entries were not rerun in this migration.\n\n`,
    'PLAN.md': `# PLAN — ${slug}\n\nFull plan preserved from STATE. Criteria in indented continuation lines belong to the\npreceding step. Fix any missing criterion before starting that step.\n\n`,
    'DECISIONS.md': `# DECISIONS — ${slug}\n\n${summary.decisions}\n\n## Legacy standing decisions\n\nThe Paper block below is preserved verbatim from STATE. It mixes standing decisions\nand their historical explanations. Read its relevant subsections before paper edits;\nthe latest explicit user decision wins. Move superseded explanations to HISTORY when\nresolving a particular rule; do not infer a new rule during this migration.\n\n`,
    'HISTORY.md': `# HISTORY — ${slug}\n\n## ${date} — memory layout migration\n\nThe original STATE is preserved byte-for-byte in [the archive](${archive}).\nSection hashes are recorded in [the migration manifest](notes/state-migration.json).\nThis migration changes file organization only; it does not reverify physics or approve\npending author decisions. Old version and dirty-worktree statements below are historical\nobservations; inspect Git and the current manuscript before relying on them.\n\n`,
    'OPEN-QUESTIONS.md': `# OPEN-QUESTIONS — ${slug}\n\nDetailed issues and operational gotchas preserved from STATE. Historical resolved items\nare retained to avoid losing failed approaches; the current blockers are linked in STATE.\n\n`
  };
  const routed = [];
  for (const section of sections(text)) {
    const destination = section.title.startsWith('Established results') ? 'RESULTS.md' : section.title === 'Plan' ? 'PLAN.md' : section.title === 'Paper' ? 'DECISIONS.md' : section.title.startsWith('Open questions') || section.title === 'Database access' ? 'OPEN-QUESTIONS.md' : 'HISTORY.md';
    docs[destination] += section.content + '\n';
    routed.push({ title: section.title, destination, sha256_lf: sha(section.content) });
  }
  const short = `# STATE — ${slug}\n\n## Status\n\n${summary.status}\n\nMemory layout updated ${date}; research status is inherited from the recorded work,\nnot newly verified by this infrastructure change.\n\n## Current step\n\n${summary.next}\n\n## Required reading\n\n- [Problem and conventions](PROJECT.md) and [standing decisions](DECISIONS.md).\n- [Complete plan](PLAN.md), [detailed results](RESULTS.md) and the notes for the selected step.\n- [Open questions and gotchas](OPEN-QUESTIONS.md); read the issues relevant to the task.\n- [Prior stopping-point detail](HISTORY.md#current-step) before resuming pending paper/research work.\n\n## Established results\n\n${summary.results}\n\nDetailed formulas, evidence and existing result IDs are in [RESULTS.md](RESULTS.md).\n\n## Plan\n\nSee [PLAN.md](PLAN.md). Completed and open step numbers are preserved.\n\n## Paper\n\n${summary.paper || 'No JHEP manuscript is maintained in this project.'}\nStanding rules are in [DECISIONS.md](DECISIONS.md).\n\n## Open questions / gotchas\n\n${summary.gotchas}\n\nFull record: [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).\n\n## History\n\n[Past state and decisions](HISTORY.md); [original STATE](${archive}).\n`;
  for (const name of Object.keys(docs)) if (fs.existsSync(path.join(project, name))) throw Error(`Refusing to overwrite ${name}`);
  if (fs.existsSync(path.join(project, archive))) throw Error(`Archive exists: ${archive}`);
  fs.mkdirSync(path.join(project, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(project, archive), original);
  for (const [name, content] of Object.entries(docs)) write(path.join(project, name), content);
  // Verify every entire source section in its destination before replacing STATE.
  for (const section of sections(text)) {
    const route = routed.find(r => r.sha256_lf === sha(section.content));
    if (!read(path.join(project, route.destination)).includes(section.content)) throw Error(`Migration lost ${section.title}`);
  }
  write(path.join(project, 'STATE.md'), short);
  writeJSON(marker, { version: 1, date, original: archive, original_sha256: sha(original), original_bytes: original.length, sections: routed, migrated_state_sha256: sha(short) });
  return { slug, old_lines: text.split('\n').length, new_lines: short.split('\n').length, original_sha256: sha(original) };
}
