import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SOURCE_FILES, SOURCES, TARGETS } from '../public/sources.mjs';
import { validateSource } from '../public/layers.mjs';

const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url));
const exampleUrl = file => new URL(`../examples/${file}`, import.meta.url);

test('embedded sources match the example files on disk', async () => {
  const onDisk = (await readdir(examplesDir)).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(Object.values(SOURCE_FILES).sort(), onDisk);

  for (const source of SOURCES) {
    const file = SOURCE_FILES[source.name];
    assert.ok(file, `${source.name} missing from SOURCE_FILES`);
    const fromDisk = JSON.parse(await readFile(exampleUrl(file), 'utf8'));
    assert.deepEqual(source, fromDisk, `${source.name} drifted from examples/${file}`);
  }
});

test('every example file is a valid source', async () => {
  for (const file of Object.values(SOURCE_FILES)) {
    const source = JSON.parse(await readFile(exampleUrl(file), 'utf8'));
    assert.deepEqual(validateSource(source), [], `${file} should validate`);
  }
});

test('targets are real forward-slash paths', () => {
  for (const t of TARGETS) {
    assert.match(t.path, /^[^/]+\//, 'targets must be repo-relative paths');
    assert.ok(!t.path.includes('\\'));
  }
});
