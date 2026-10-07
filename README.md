# Context Assembly Lab — companion demo

Interactive lab for the article *The 7 Config Layers That Decide What Your
Coding Agent Knows*. A coding agent never reads your config files directly —
its harness merges every applicable layer into one effective context per
target file. This lab replays that merge so you can watch precedence,
deny-wins permissions, and additive hooks resolve.

Zero dependencies — Node 20+ only. The assembly engine is plain ES modules
shared by the browser UI, the CLI, and the test suite.

## What it proves

Six config sources — a global config, a committed `AGENTS.md`-style project
layer, a gitignored local override, two path-scoped rule files, and an
invoked review skill — assemble into the effective context for three target
files:

| Target | `testRunner` resolves to | Why |
|---|---|---|
| `src/api/users.ts` | `node:test` | `rules-api` (path-scoped) beats the project's `vitest` |
| `src/ui/Button.tsx` | `vitest` | the ui rule doesn't set it — project stands |
| `scripts/seed.ts` | `vitest` | no path rule at all — project + global only |

The same merge shows the harder guarantees: `read .env*` is **allowed** by the
api rule but **denied** by the global layer — denied wins, always. Hooks from
every applicable layer stay active; a narrower layer can refine a hook but
never remove it. And the `pr-review` skill contributes nothing until invoked.

## Run it

```text
npm start       # serve the lab on :3000
npm test        # glob + merge + permissions + hooks + examples sync + server
npm run scan    # CLI: effective context for all three targets, bare vs layered
npm run check   # both
```

## Layout

- `public/glob.mjs` — minimal `**`/`*`/`?` glob matcher for `appliesTo` paths.
- `public/layers.mjs` — `assembleContext(sources, targetPath, { invoke,
  disabled })`: scope filtering, precedence ordering (global → project →
  local → path → invoked), per-key winner + contender trace, permission
  resolution deny > ask > allow, additive hook dedupe. `validateSource` fails
  loudly on unknown keys.
- `public/sources.mjs` — embedded copies of `examples/*.json` (a test asserts
  they stay in sync) plus the three target files.
- `examples/` — the six config sources as JSON. Edit one and rerun
  `npm run scan`.
- `test/` — node:test suite covering merge order, per-key winners on all three
  targets, deny-beats-allow across scopes, additive hooks, invoked-only
  skills, disabled-layer fallback, determinism, fixture sync, glob edge cases,
  and the server allowlist.

## Honest limits

- The merge order is a **teaching model**. Claude Code, Cursor, and
  AGENTS.md-style harnesses each order and combine layers differently — some
  load nested instruction files additively rather than overriding values.
  Check your tool's docs before relying on a specific precedence.
- Permission rules are matched as literal strings; real harnesses match tool
  names plus path/command patterns.
- No model is queried and nothing executes — the lab shows what context
  *would* be assembled, not what a model does with it.
- Fixtures are invented for instruction, not copied from a real repo.

This is an educational demo, not production infrastructure.
