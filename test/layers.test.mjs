import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleContext, summarize, validateSource, SCOPE_RANK } from '../public/layers.mjs';
import { SOURCES, TARGETS } from '../public/sources.mjs';

const API = 'src/api/users.ts';
const UI = 'src/ui/Button.tsx';
const SCRIPTS = 'scripts/seed.ts';

test('instruction blocks are ordered broad → specific', () => {
  const ctx = assembleContext(SOURCES, API, { invoke: ['pr-review'] });
  const scopes = ctx.blocks.map(b => b.scope);
  const ranks = scopes.map(s => SCOPE_RANK[s]);
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks, 'blocks must be in ascending scope rank');
  assert.equal(ctx.blocks[0].source, 'user-global');
  assert.equal(ctx.blocks.at(-1).source, 'skill-pr-review');
});

test('api target: most-specific settings win', () => {
  const { settings } = assembleContext(SOURCES, API);
  assert.equal(settings.indent.value, 4);           // project beats global's 2
  assert.equal(settings.indent.winner, 'project-shared');
  assert.equal(settings.testRunner.value, 'node:test'); // path rule beats project's vitest
  assert.equal(settings.testRunner.winner, 'rules-api');
  assert.equal(settings.quoteStyle.value, 'double');    // local beats global
  assert.equal(settings.quoteStyle.winner, 'dev-local');
  assert.equal(settings.maxFunctionLines.value, 40);    // api rule beats project's 50
  assert.equal(settings.commitStyle.value, 'conventional'); // uncontested global
  // winner trace keeps the losers visible
  assert.deepEqual(
    settings.testRunner.contenders.map(c => `${c.value}@${c.source}`),
    ['vitest@project-shared', 'node:test@rules-api'],
  );
});

test('ui target: the ui path rule resolves differently than api', () => {
  const { settings, applied, skipped } = assembleContext(SOURCES, UI);
  assert.equal(settings.testRunner.value, 'vitest');       // no ui override — project stands
  assert.equal(settings.maxFunctionLines.value, 30);       // ui rule beats project's 50
  assert.equal(settings.quoteStyle.value, 'single');       // path rule beats dev-local's double
  assert.equal(settings.quoteStyle.winner, 'rules-ui');
  assert.ok(applied.includes('rules-ui'));
  assert.ok(!applied.includes('rules-api'));
  assert.deepEqual(skipped.find(s => s.source === 'rules-api').reason, 'path-mismatch');
});

test('scripts target: no path rule — project and global resolve everything', () => {
  const { settings, applied } = assembleContext(SOURCES, SCRIPTS);
  assert.equal(settings.testRunner.value, 'vitest');
  assert.equal(settings.quoteStyle.value, 'double');
  assert.deepEqual(applied, ['user-global', 'project-shared', 'dev-local']);
});

test('deny wins over allow across scopes — even from a narrower layer', () => {
  const { permissions } = assembleContext(SOURCES, API);
  const env = permissions['read .env*'];
  assert.equal(env.state, 'denied');
  assert.equal(env.decidedBy, 'user-global');
  assert.deepEqual(env.lists.allow, ['rules-api']); // the override attempt stays visible
  assert.equal(permissions['bash git push --force*'].state, 'denied');
  assert.equal(permissions['bash git push *'].state, 'ask');
  assert.equal(permissions['bash npm test*'].state, 'allowed');
});

test('hooks are additive across every applicable layer', () => {
  const api = assembleContext(SOURCES, API);
  assert.deepEqual(
    api.hooks.map(h => h.id).sort(),
    ['block-secret-output', 'typecheck-after-edit', 'validate-api-schema'],
  );
  const ui = assembleContext(SOURCES, UI);
  assert.deepEqual(
    ui.hooks.map(h => h.id).sort(),
    ['a11y-smoke', 'block-secret-output', 'typecheck-after-edit'],
  );
  // a narrower layer can refine a hook id but never remove it
  const refined = [
    ...SOURCES,
    { name: 'rules-strict', scope: 'path', appliesTo: 'src/api/**',
      hooks: [{ id: 'typecheck-after-edit', event: 'before-commit', effect: 'block' }] },
  ];
  const ctx = assembleContext(refined, API);
  const hook = ctx.hooks.find(h => h.id === 'typecheck-after-edit');
  assert.equal(hook.source, 'rules-strict');
  assert.equal(hook.event, 'before-commit');
  assert.equal(ctx.hooks.filter(h => h.id === 'typecheck-after-edit').length, 1);
});

test('invoked skill contributes only when invoked', () => {
  const off = assembleContext(SOURCES, API);
  assert.ok(!off.applied.includes('skill-pr-review'));
  assert.equal(off.skipped.find(s => s.source === 'skill-pr-review').reason, 'not-invoked');
  assert.equal(off.settings.diffStyle, undefined);

  const on = assembleContext(SOURCES, API, { invoke: ['pr-review'] });
  assert.ok(on.applied.includes('skill-pr-review'));
  assert.equal(on.settings.diffStyle.value, 'unified');
  assert.equal(on.permissions['bash git diff *'].state, 'allowed');
  assert.ok(on.hooks.some(h => h.id === 'no-secrets-in-findings'));
});

test('disabling a layer falls settings back to lower scopes', () => {
  const ctx = assembleContext(SOURCES, API, { disabled: ['project-shared'] });
  assert.equal(ctx.settings.indent.value, 2);               // back to global
  assert.equal(ctx.settings.testRunner.value, 'node:test'); // api rule still applies
  assert.equal(ctx.skipped.find(s => s.source === 'project-shared').reason, 'disabled');
});

test('bare model: no sources means everything is a guess', () => {
  const ctx = assembleContext([], API);
  const s = summarize(ctx);
  assert.equal(s.instructionBlocks, 0);
  assert.equal(s.settingsResolved, 0);
  assert.equal(s.hooks, 0);
});

test('assembly is deterministic', () => {
  assert.deepEqual(assembleContext(SOURCES, API), assembleContext(SOURCES, API));
});

test('validateSource flags malformed sources', () => {
  assert.ok(validateSource(null).length > 0);
  assert.ok(validateSource({}).length > 0);
  assert.ok(validateSource({ name: 'x', scope: 'weird' }).some(p => p.includes('scope')));
  assert.ok(validateSource({ name: 'x', scope: 'path' }).some(p => p.includes('appliesTo')));
  assert.ok(validateSource({ name: 'x', scope: 'invoked' }).some(p => p.includes('invoke')));
  assert.ok(validateSource({ name: 'x', scope: 'global', bogus: 1 }).some(p => p.includes('bogus')));
  assert.ok(validateSource({ name: 'x', scope: 'global', hooks: [{}] }).some(p => p.includes('hooks[0]')));
  for (const s of SOURCES) assert.deepEqual(validateSource(s), [], `${s.name} should validate`);
});
