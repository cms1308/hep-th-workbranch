// A judge injected in place of a provider process (no model is called). It answers the planted texts as they are
// registered and passes every question of the manuscript, unless `decide(call, item)` returns a verdict ("pass",
// "fail"), a whole answer (an object) or false (the question is left out). `log` receives every call.
import path from 'node:path';
import { write, writeJSON } from '../harness/core.mjs';
import { judge } from '../harness/judge.mjs';

export const answerer = (decide = () => undefined, log = []) => async (command, args, options) => {
  const { call } = options, value = {};
  log.push(call);
  for (const i of call.items) {
    const said = decide(call, i), verdict = typeof said === 'string' ? said : call.expect?.[i.id] ?? 'pass';
    if (said === false) continue;
    value[i.id] = said && typeof said === 'object' ? said : { verdict, reason: 'Fixture judge.', evidence: (call.text || i.q).slice(0, 12), ...(i.better ? { sentence: verdict === 'fail' ? 'A shorter sentence.' : '', criterion: verdict === 'fail' ? 5 : 0 } : {}) };
  }
  if (call.provider === 'codex') {
    writeJSON(path.join(options.dir, 'response.json'), value);
    write(path.join(options.dir, 'stdout.jsonl'), '{"type":"thread.started","thread_id":"fixture"}\n{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":10}}\n');
  } else writeJSON(path.join(options.dir, 'stdout.jsonl'), { subtype: 'success', is_error: false, session_id: 'fixture', structured_output: value, modelUsage: { 'fixture-model': {} }, usage: { input_tokens: 100, output_tokens: 10 }, total_cost_usd: 0.01 });
};
// Two sound judges pass what the manuscript awaits.
export const settle = (root, check, options = {}) => judge(root, 'demo', 'paper', { writer: 'claude', runner: answerer(), ...check, ...options });
