// Side-by-side report: assemble the effective context for every target file
// with no layers at all vs. the full stack — the difference is the article's
// argument in a table.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assembleContext, summarize, validateSource } from '../public/layers.mjs';
import { TARGETS } from '../public/sources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = await Promise.all(
  ['global.json', 'project.json', 'local.json', 'rules-api.json', 'rules-ui.json', 'skill-pr-review.json']
    .map(f => readFile(`${root}examples/${f}`, 'utf8').then(JSON.parse)),
);

for (const s of sources) {
  const problems = validateSource(s);
  if (problems.length) {
    console.error(`source ${s.name || '?'} is invalid: ${problems.join('; ')}`);
    process.exit(1);
  }
}

const W = { key: 18, val: 22, from: 16 };

console.log('Context Assembly Lab — effective context per target file\n');
console.log(`Layers available: ${sources.length} (incl. invoked skill "pr-review")\n`);

for (const { path, note } of TARGETS) {
  const bare = assembleContext([], path);
  const full = assembleContext(sources, path);
  console.log(`== ${path} — ${note}`);
  console.log(`   bare model: ${summarize(bare).instructionBlocks} instruction blocks, ${summarize(bare).settingsResolved} settings — everything is a guess`);
  console.log(`   layers applied: ${full.applied.join(' → ')}`);
  const skipped = full.skipped.map(s => `${s.source} (${s.reason})`).join(', ');
  if (skipped) console.log(`   skipped: ${skipped}`);
  console.log(`\n   ${'setting'.padEnd(W.key)}${'resolved'.padEnd(W.val)}${'winner'.padEnd(W.from)}overridden contenders`);
  for (const [key, r] of Object.entries(full.settings)) {
    const losers = r.contenders.slice(0, -1).map(c => `${c.value}@${c.source}`).join(', ') || '—';
    console.log(`   ${key.padEnd(W.key)}${String(r.value).padEnd(W.val)}${r.winner.padEnd(W.from)}${losers}`);
  }
  const denied = Object.entries(full.permissions).filter(([, p]) => p.state === 'denied');
  const ask = Object.entries(full.permissions).filter(([, p]) => p.state === 'ask');
  console.log(`\n   denied: ${denied.map(([r]) => r).join(' · ') || 'none'}`);
  console.log(`   ask:    ${ask.map(([r]) => r).join(' · ') || 'none'}`);
  console.log(`   hooks:  ${full.hooks.map(h => `${h.id}@${h.event}`).join(' · ') || 'none'}`);
  console.log('');
}

console.log('-- invoked layer --');
const invoked = assembleContext(sources, TARGETS[0].path, { invoke: ['pr-review'] });
console.log(`invoke "pr-review" on ${TARGETS[0].path}: +${invoked.blocks.length - assembleContext(sources, TARGETS[0].path).blocks.length} instruction blocks, +settings ${Object.keys(invoked.settings).filter(k => invoked.settings[k].winner === 'skill-pr-review').join(',')}, hook ${invoked.hooks.filter(h => h.source === 'skill-pr-review').map(h => h.id).join(',')}`);

console.log('\nLesson: the same model + the same repo produce different context per file — because layers merge, override, and enforce differently at each path.');
