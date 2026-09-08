import fs from 'node:fs';
import path from 'node:path';
import { ROOT, json, writeJSON } from './core.mjs';

// No shell variables or machine-specific paths. Node receives the hook stdin.
export const hookCommand = `node -e "const f=require('node:fs'),p=require('node:path');let d=process.cwd();while(!f.existsSync(p.join(d,'harness','cli.mjs'))){const n=p.dirname(d);if(n===d)throw Error('Cannot locate hep-th harness');d=n;}import(require('node:url').pathToFileURL(p.join(d,'harness','cli.mjs')).href).then(m=>m.entry(['hook']));"`;
export function installHooks(root = ROOT) {
  for (const file of ['.claude/settings.json', '.codex/hooks.json']) {
    const target = path.join(root, file);
    const config = fs.existsSync(target) ? json(target) : {};
    config.hooks ||= {};
    for (const event of ['SessionStart', 'Stop']) {
      const groups = config.hooks[event] || [];
      const others = groups.map(group => ({ ...group, hooks: group.hooks.filter(h => !(h.statusMessage?.startsWith('Research harness:') || (h.command?.includes('Auto-commit: harness update') && h.command?.includes('CLAUDE_PROJECT_DIR')))) })).filter(g => g.hooks.length);
      config.hooks[event] = [...others, { hooks: [{ type: 'command', command: hookCommand, timeout: event === 'Stop' ? 300 : 15, statusMessage: `Research harness: ${event === 'Stop' ? 'checkpoint queued files' : 'load shared workflow'}` }] }];
    }
    writeJSON(target, config);
  }
}
if (process.argv[1]?.endsWith('install-hooks.mjs')) { installHooks(); console.log('Updated both provider hook configurations.'); }
