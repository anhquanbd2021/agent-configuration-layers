// Embedded copies of examples/*.json so the browser lab, CLI, and tests all
// assemble the same layers. test/examples.test.mjs asserts these stay in sync
// with the files on disk — edit the JSON, then mirror it here.

export const SOURCE_FILES = {
  'user-global': 'global.json',
  'project-shared': 'project.json',
  'dev-local': 'local.json',
  'rules-api': 'rules-api.json',
  'rules-ui': 'rules-ui.json',
  'skill-pr-review': 'skill-pr-review.json',
};

export const SOURCES = [
  {
    name: 'user-global',
    label: '~/.agent/config — applies to every repo you touch',
    scope: 'global',
    appliesTo: '**',
    instructions: [
      'Prefer small, reviewable diffs over rewrites.',
      'Explain non-obvious decisions in one sentence, not paragraphs.',
    ],
    settings: { indent: 2, quoteStyle: 'single', commitStyle: 'conventional' },
    permissions: {
      allow: ['read **', 'bash npm test*'],
      ask: ['bash git push *'],
      deny: ['read .env*', 'bash curl * | sh'],
    },
    hooks: [
      { id: 'block-secret-output', event: 'before-output', effect: 'block', note: 'redact tokens and keys before they reach the transcript' },
    ],
  },
  {
    name: 'project-shared',
    label: 'AGENTS.md + .agent/settings.json — committed with the repo',
    scope: 'project',
    appliesTo: '**',
    instructions: [
      'Stack: Node 20, ES modules, zero runtime dependencies.',
      'Tests run with Vitest — npm test.',
      'HTTP handlers live in src/api, UI components in src/ui.',
    ],
    settings: { indent: 4, testRunner: 'vitest', maxFunctionLines: 50 },
    permissions: {
      allow: ['bash npm run *'],
      ask: ['bash git commit *'],
      deny: ['bash git push --force*', 'write infra/prod/**'],
    },
    hooks: [
      { id: 'typecheck-after-edit', event: 'after-write', effect: 'validate', note: 'npm run typecheck must pass after every edit' },
    ],
  },
  {
    name: 'dev-local',
    label: '.agent/settings.local.json — gitignored, just you',
    scope: 'local',
    appliesTo: '**',
    instructions: [
      'Show the shell command before running anything destructive.',
    ],
    settings: { quoteStyle: 'double' },
    permissions: { allow: ['bash git fetch *'] },
    hooks: [],
  },
  {
    name: 'rules-api',
    label: 'rules/api.json — applies only under src/api/**',
    scope: 'path',
    appliesTo: 'src/api/**',
    instructions: [
      'Handlers are pure functions — no middleware signatures.',
      'Every handler needs a node:test file beside it.',
    ],
    settings: { testRunner: 'node:test', maxFunctionLines: 40 },
    permissions: { allow: ['read .env*'] },
    hooks: [
      { id: 'validate-api-schema', event: 'before-commit', effect: 'block', note: 'openapi spec must stay in sync with handlers' },
    ],
    note: 'The allow on read .env* tries to carve out config access for handlers — the global deny still wins. That is the point of the lab.',
  },
  {
    name: 'rules-ui',
    label: 'rules/ui.json — applies only under src/ui/**',
    scope: 'path',
    appliesTo: 'src/ui/**',
    instructions: [
      'CSS modules only — no global stylesheets.',
      'State lives in props — no module-level stores.',
    ],
    settings: { maxFunctionLines: 30, quoteStyle: 'single' },
    permissions: { ask: ['bash npm run build*'] },
    hooks: [
      { id: 'a11y-smoke', event: 'before-commit', effect: 'warn', note: 'run the axe smoke check on changed components' },
    ],
  },
  {
    name: 'skill-pr-review',
    label: 'skills/pr-review — loaded only when invoked',
    scope: 'invoked',
    invoke: 'pr-review',
    appliesTo: '**',
    instructions: [
      'Review like a senior: correctness first, then security, then style.',
      'Cite file:line for every finding.',
    ],
    settings: { diffStyle: 'unified' },
    permissions: { allow: ['bash git diff *', 'bash git log *'] },
    hooks: [
      { id: 'no-secrets-in-findings', event: 'before-output', effect: 'block', note: 'never echo a token value in a review comment' },
    ],
  },
];

// Target files the lab assembles context for. Only rules-api matches the first
// and only rules-ui matches the second — the third has no path rule at all.
export const TARGETS = [
  { path: 'src/api/users.ts', note: 'HTTP handler — the api rule applies' },
  { path: 'src/ui/Button.tsx', note: 'component — the ui rule applies' },
  { path: 'scripts/seed.ts', note: 'no path rule — falls back to project + global' },
];

export const SCOPE_INFO = {
  global: { label: 'global', tone: 'info' },
  project: { label: 'project', tone: 'info' },
  local: { label: 'local', tone: 'warn' },
  path: { label: 'path-scoped', tone: 'pass' },
  invoked: { label: 'invoked', tone: 'hot' },
};

export const PERMISSION_INFO = {
  allowed: { label: 'allowed', tone: 'pass' },
  ask: { label: 'ask first', tone: 'warn' },
  denied: { label: 'denied', tone: 'fail' },
};
