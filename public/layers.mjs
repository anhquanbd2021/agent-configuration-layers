// Context Assembly engine: merges layered config sources into the effective
// context an agent would see for one target file. Teaching model of how real
// harnesses stack config (global ~/.config files → project AGENTS.md /
// CLAUDE.md + settings.json → gitignored local overrides → path-scoped rules/
// → invoked skills/commands).
//
// Merge rules implemented here:
//   - instruction blocks: additive, ordered broad → specific (the model reads
//     global advice first and the path-scoped rule last — closest to the file)
//   - keyed settings: most specific scope wins; the full contender list is
//     kept so the override is visible, not silent
//   - permissions: deny > ask > allow across ALL layers — a deny written
//     globally can never be re-allowed by a narrower file
//   - hooks: additive and deduped by id — a hook can be refined by a more
//     specific layer but never removed ("instructions advise, hooks enforce")
//   - scope 'path' contributes only when appliesTo matches the target
//   - scope 'invoked' contributes only when named in `invoke`

import { matchesGlob } from './glob.mjs';

export const SCOPE_RANK = Object.freeze({
  global: 0,
  project: 1,
  local: 2,
  path: 3,
  invoked: 4,
});

const VALID_SCOPES = new Set(Object.keys(SCOPE_RANK));
const KNOWN_KEYS = new Set([
  'name', 'label', 'scope', 'appliesTo', 'invoke',
  'instructions', 'settings', 'permissions', 'hooks', 'note',
]);

// Fail loudly on malformed sources — a config file that silently drops a
// misspelled key is worse than no config file.
export function validateSource(source) {
  const problems = [];
  if (!source || typeof source !== 'object') return ['source must be an object'];
  if (typeof source.name !== 'string' || !source.name) problems.push('name is required');
  if (!VALID_SCOPES.has(source.scope)) {
    problems.push(`scope must be one of: ${[...VALID_SCOPES].join(', ')}`);
  }
  if (source.scope === 'path' && (typeof source.appliesTo !== 'string' || !source.appliesTo)) {
    problems.push('scope "path" requires an appliesTo glob');
  }
  if (source.scope === 'invoked' && (typeof source.invoke !== 'string' || !source.invoke)) {
    problems.push('scope "invoked" requires an invoke name');
  }
  if (source.instructions != null && !Array.isArray(source.instructions)) {
    problems.push('instructions must be an array');
  }
  if (source.settings != null && (typeof source.settings !== 'object' || Array.isArray(source.settings))) {
    problems.push('settings must be an object');
  }
  if (source.permissions != null) {
    const perms = source.permissions;
    for (const list of ['allow', 'ask', 'deny']) {
      if (perms[list] != null && !Array.isArray(perms[list])) {
        problems.push(`permissions.${list} must be an array`);
      }
    }
    for (const key of Object.keys(perms)) {
      if (!['allow', 'ask', 'deny'].includes(key)) problems.push(`unknown permissions list "${key}"`);
    }
  }
  if (source.hooks != null) {
    if (!Array.isArray(source.hooks)) problems.push('hooks must be an array');
    else {
      source.hooks.forEach((hook, i) => {
        if (!hook || typeof hook.id !== 'string' || !hook.id) problems.push(`hooks[${i}] requires an id`);
        else if (typeof hook.event !== 'string' || !hook.event) problems.push(`hooks[${i}] requires an event`);
      });
    }
  }
  for (const key of Object.keys(source)) {
    if (!KNOWN_KEYS.has(key)) problems.push(`unknown key "${key}"`);
  }
  return problems;
}

export function assembleContext(sources, targetPath, { invoke = [], disabled = [] } = {}) {
  const applied = [];
  const skipped = [];
  const candidates = [];

  sources.forEach((source, index) => {
    if (disabled.includes(source.name)) {
      skipped.push({ source: source.name, reason: 'disabled' });
      return;
    }
    if (source.scope === 'invoked' && !invoke.includes(source.invoke)) {
      skipped.push({ source: source.name, reason: 'not-invoked' });
      return;
    }
    if (source.appliesTo && source.appliesTo !== '**' && !matchesGlob(source.appliesTo, targetPath)) {
      skipped.push({ source: source.name, reason: 'path-mismatch' });
      return;
    }
    candidates.push({ source, index });
  });

  // Broad → specific; stable within a scope by fixture order.
  candidates.sort((a, b) =>
    (SCOPE_RANK[a.source.scope] - SCOPE_RANK[b.source.scope]) || (a.index - b.index));

  const blocks = [];
  const settingsContenders = new Map(); // key -> [{source, scope, value}] in rank order
  const permissionLists = new Map();    // rule -> {allow:[names], ask:[names], deny:[names]}
  const hooks = new Map();              // id -> hook (later/higher scope refines)

  for (const { source } of candidates) {
    applied.push(source.name);
    for (const text of source.instructions || []) {
      blocks.push({ source: source.name, scope: source.scope, text });
    }
    for (const [key, value] of Object.entries(source.settings || {})) {
      if (!settingsContenders.has(key)) settingsContenders.set(key, []);
      settingsContenders.get(key).push({ source: source.name, scope: source.scope, value });
    }
    const perms = source.permissions || {};
    for (const [list, rules] of Object.entries(perms)) {
      for (const rule of rules) {
        if (!permissionLists.has(rule)) permissionLists.set(rule, { allow: [], ask: [], deny: [] });
        permissionLists.get(rule)[list].push(source.name);
      }
    }
    for (const hook of source.hooks || []) {
      hooks.set(hook.id, { ...hook, source: source.name, scope: source.scope });
    }
  }

  const settings = {};
  for (const [key, contenders] of settingsContenders) {
    const winner = contenders[contenders.length - 1]; // most specific wins
    settings[key] = { value: winner.value, winner: winner.source, contenders };
  }

  const permissions = {};
  for (const [rule, lists] of permissionLists) {
    const state = lists.deny.length ? 'denied' : lists.ask.length ? 'ask' : 'allowed';
    const deciders = state === 'denied' ? lists.deny : state === 'ask' ? lists.ask : lists.allow;
    permissions[rule] = { state, decidedBy: deciders[deciders.length - 1], lists };
  }

  return {
    targetPath,
    blocks,
    settings,
    permissions,
    hooks: [...hooks.values()],
    applied,
    skipped,
  };
}

export function summarize(context) {
  const perms = Object.values(context.permissions);
  return {
    layersApplied: context.applied.length,
    instructionBlocks: context.blocks.length,
    settingsResolved: Object.keys(context.settings).length,
    allowed: perms.filter(p => p.state === 'allowed').length,
    ask: perms.filter(p => p.state === 'ask').length,
    denied: perms.filter(p => p.state === 'denied').length,
    hooks: context.hooks.length,
  };
}
