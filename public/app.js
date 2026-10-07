// Context Assembly Lab UI: picks a target file, toggles config layers on/off,
// and renders the merged context — instruction stack, resolved settings,
// permissions, and hooks — exactly as assembleContext computed it.
import { assembleContext, summarize } from './layers.mjs';
import { SOURCES, TARGETS, SCOPE_INFO, PERMISSION_INFO } from './sources.mjs';

const $ = id => document.getElementById(id);
const targetSelect = $('target');
const togglesBox = $('toggles');

for (const t of TARGETS) {
  const opt = document.createElement('option');
  opt.value = t.path;
  opt.textContent = t.path;
  targetSelect.append(opt);
}
targetSelect.value = TARGETS[0].path;

function badge(text, tone) {
  const b = document.createElement('span');
  b.className = `badge ${tone}`;
  b.textContent = text;
  return b;
}

// One checkbox per source. For scope 'invoked' the checkbox means "invoke it";
// for every other scope it means "this layer exists".
const toggleInputs = new Map();
for (const source of SOURCES) {
  const label = document.createElement('label');
  label.className = 'layer-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = source.scope !== 'invoked'; // skill starts un-invoked
  input.addEventListener('change', render);
  toggleInputs.set(source.name, input);
  label.append(input, ` ${source.label}`);
  togglesBox.append(label);
}

function currentOptions() {
  const disabled = [];
  const invoke = [];
  for (const source of SOURCES) {
    const on = toggleInputs.get(source.name).checked;
    if (source.scope === 'invoked') {
      if (on) invoke.push(source.invoke);
    } else if (!on) {
      disabled.push(source.name);
    }
  }
  return { invoke, disabled };
}

function renderLayerTable(context) {
  const body = $('layer-body');
  body.textContent = '';
  const skipped = new Map(context.skipped.map(s => [s.source, s.reason]));
  for (const source of SOURCES) {
    const tr = document.createElement('tr');
    const reason = skipped.get(source.name);
    const status = reason
      ? { 'not-invoked': 'not invoked', 'path-mismatch': 'no path match', disabled: 'off' }[reason]
      : 'applied';
    tr.innerHTML = `<td><code>${source.name}</code></td><td>${SCOPE_INFO[source.scope].label}</td>`;
    const td = document.createElement('td');
    td.append(badge(status, reason ? 'info' : 'pass'));
    tr.append(td);
    body.append(tr);
  }
}

function renderBlocks(context) {
  const list = $('blocks');
  list.textContent = '';
  if (!context.blocks.length) {
    const li = document.createElement('li');
    li.className = 'action';
    li.innerHTML = '<p class="muted">No instructions assembled — the model guesses everything: stack, test runner, commit style, all of it.</p>';
    list.append(li);
    return;
  }
  for (const block of context.blocks) {
    const li = document.createElement('li');
    li.className = `action scope-${block.scope}`;
    const head = document.createElement('div');
    head.className = 'action-head';
    head.append(
      badge(SCOPE_INFO[block.scope].label, SCOPE_INFO[block.scope].tone),
      Object.assign(document.createElement('code'), { textContent: block.source }),
    );
    const p = document.createElement('p');
    p.textContent = block.text;
    li.append(head, p);
    list.append(li);
  }
}

function renderSettings(context) {
  const body = $('settings-body');
  body.textContent = '';
  const entries = Object.entries(context.settings);
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="4" class="muted">no settings resolved — every convention is a guess</td></tr>';
    return;
  }
  for (const [key, resolved] of entries) {
    const tr = document.createElement('tr');
    const overridden = resolved.contenders.slice(0, -1)
      .map(c => `${c.value} (${c.source})`)
      .join(', ');
    tr.innerHTML = `<td><code>${key}</code></td><td><strong>${resolved.value}</strong></td><td>${resolved.winner}</td>`;
    const td = document.createElement('td');
    td.className = 'muted';
    td.textContent = overridden || '—';
    tr.append(td);
    body.append(tr);
  }
}

function renderPermissions(context) {
  const body = $('perms-body');
  body.textContent = '';
  const entries = Object.entries(context.permissions)
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="3" class="muted">no permission rules — everything is implicit</td></tr>';
  }
  for (const [rule, resolved] of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>${rule}</code></td>`;
    const vtd = document.createElement('td');
    const info = PERMISSION_INFO[resolved.state];
    vtd.append(badge(info.label, info.tone));
    tr.append(vtd);
    const shadowed = resolved.state !== 'allowed' && resolved.lists.allow.length
      ? ` (allow from ${resolved.lists.allow.join(', ')} overridden)`
      : '';
    tr.insertAdjacentHTML('beforeend', `<td>${resolved.decidedBy}<span class="muted">${shadowed}</span></td>`);
    body.append(tr);
  }

  const hooks = $('hooks');
  hooks.textContent = '';
  if (!context.hooks.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No hooks — every convention above is a suggestion, not an enforcement.';
    hooks.append(li);
  }
  for (const hook of context.hooks) {
    const li = document.createElement('li');
    li.innerHTML = `<code>${hook.id}</code> <span class="muted">on ${hook.event} → ${hook.effect} (${hook.source}) — ${hook.note || ''}</span>`;
    hooks.append(li);
  }
}

function render() {
  const target = targetSelect.value;
  const note = TARGETS.find(t => t.path === target)?.note || '';
  $('target-note').textContent = note;
  const context = assembleContext(SOURCES, target, currentOptions());
  renderLayerTable(context);
  renderBlocks(context);
  renderSettings(context);
  renderPermissions(context);
  const s = summarize(context);
  $('status').className = `badge ${s.layersApplied ? 'pass' : 'warn'}`;
  $('status').textContent = `${s.layersApplied} layers · ${s.instructionBlocks} blocks · ${s.settingsResolved} settings · ${s.denied} denied · ${s.hooks} hooks`;
}

targetSelect.addEventListener('change', render);
render();
