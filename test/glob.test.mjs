import test from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesGlob } from '../public/glob.mjs';

test('** matches everything', () => {
  assert.ok(matchesGlob('**', 'src/api/users.ts'));
  assert.ok(matchesGlob('**', 'a'));
  assert.ok(matchesGlob('**', 'deep/nested/dir/file.js'));
});

test('src/api/** matches shallow and deep, not siblings', () => {
  assert.ok(matchesGlob('src/api/**', 'src/api/users.ts'));
  assert.ok(matchesGlob('src/api/**', 'src/api/v2/users.ts'));
  assert.ok(!matchesGlob('src/api/**', 'src/ui/Button.tsx'));
  assert.ok(!matchesGlob('src/api/**', 'src/apiary/x.ts'));
});

test('* stays inside one segment', () => {
  assert.ok(matchesGlob('*.test.ts', 'a.test.ts'));
  assert.ok(!matchesGlob('*.test.ts', 'a.ts'));
  assert.ok(!matchesGlob('*.test.ts', 'dir/a.test.ts'));
  assert.ok(matchesGlob('.env*', '.env'));
  assert.ok(matchesGlob('.env*', '.env.local'));
  assert.ok(matchesGlob('.env*', '.envx')); // * matches the trailing x — correct glob semantics
  assert.ok(!matchesGlob('.env*', 'config.env'));
});

test('? matches exactly one char', () => {
  assert.ok(matchesGlob('file?.ts', 'file1.ts'));
  assert.ok(!matchesGlob('file?.ts', 'file10.ts'));
});

test('dots are literal, not regex', () => {
  assert.ok(!matchesGlob('a.ts', 'axts'));
  assert.ok(matchesGlob('a.ts', 'a.ts'));
});

test('globToRegExp rejects empty patterns', () => {
  assert.throws(() => globToRegExp(''), TypeError);
  assert.throws(() => globToRegExp(null), TypeError);
});
