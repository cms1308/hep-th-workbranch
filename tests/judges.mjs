// A judge injected in place of a provider process (no model is called). It answers the planted texts as they are
// registered and passes every question of the manuscript, unless `decide(call, entry, item)` returns a verdict ("pass",
// "fail"), a whole answer (an object) or false (the question is left out). `log` receives every call.
import path from 'node:path';
import { write, writeJSON } from '../harness/core.mjs';
import { judge } from '../harness/judge.mjs';
import { outlineView, groundsView } from '../harness/verify.mjs';

export const answerer = (decide = () => undefined, log = []) => async (command, args, options) => {
  const { call } = options, value = {};
  log.push(call);
  for (const e of call.entries) for (const i of e.items) {
    const said = decide(call, e, i), verdict = typeof said === 'string' ? said : i.expect ?? 'pass';
    if (said === false) continue;
    value[i.key] = said && typeof said === 'object' ? said : { verdict, reason: 'Fixture judge.', evidence: (e.text || i.tag).slice(0, 12), ...(i.better ? { sentence: verdict === 'fail' ? 'A shorter sentence.' : '', criterion: verdict === 'fail' ? 5 : 0 } : {}) };
  }
  if (call.provider === 'codex') {
    writeJSON(path.join(options.dir, 'response.json'), value);
    write(path.join(options.dir, 'stdout.jsonl'), '{"type":"thread.started","thread_id":"fixture"}\n{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":10}}\n');
  } else writeJSON(path.join(options.dir, 'stdout.jsonl'), { subtype: 'success', is_error: false, session_id: 'fixture', structured_output: value, modelUsage: { 'fixture-model': {} }, usage: { input_tokens: 100, output_tokens: 10 }, total_cost_usd: 0.01 });
};
// Registries that fit the manuscript as it stands: an outline whose entries are kept and a paragraph without one gets a plain entry,
// and grounds in which a sentence without an entry is typed as a transition.
export function sketch(project, paper = 'paper') {
  const grounds = JSON.parse(groundsView(project, paper, { skeleton: true }));
  for (const e of grounds.sentences) if (!e.type) e.type = 'transition';
  writeJSON(path.join(project, paper, 'GROUNDS.json'), grounds);
  const outline = JSON.parse(outlineView(project, paper, { skeleton: true }));
  if (!outline.claims[0].id) outline.claims = [{ id: 'fixture', claim: 'The fixture states what it establishes.' }];
  for (const s of outline.sections) for (const e of s.paragraphs) if (!e.role) Object.assign(e, { role: 'setup', does: 'States a sentence of the fixture.' });
  writeJSON(path.join(project, paper, 'OUTLINE.json'), outline);
}
// Sound judges pass what the manuscript awaits.
export const settle = (root, check, options = {}) => judge(root, 'demo', 'paper', { writer: 'claude', runner: answerer(), ...check, ...options });
