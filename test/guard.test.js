const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { guard, flatten } = require('..');

const tempLock = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-guard-')), 'i18n.lock.json');
const catalog = (en, zh) => ({ app: { source: { k: en }, translations: { zh: { k: zh } } } });

test('finds missing, extra, empty and mismatched texts', () => {
  const problems = guard(tempLock(), {
    app: {
      source: { a: 'Hi {name}', b: 'Bye', c: { one: '{n} page', other: '{n} pages' } },
      translations: { zh: { a: '你好', b: ' ', c: '{n} 页', x: '多余' } },
    },
  });
  assert.deepEqual(problems, [
    'app zh: "a" has {}, English has {{name}}',
    'app zh: empty "b"',
    'app zh: "c" is a string, English is a plural',
    'app zh: "x" is not in English',
  ]);
});

test('accepts plural objects with different categories', () => {
  const lock = tempLock();
  const plurals = { app: { source: { c: { one: '{n} page', other: '{n} pages' } }, translations: { zh: { c: { other: '{n} 页' } } } } };
  assert.deepEqual(guard(lock, plurals, { update: true }), []);
  assert.deepEqual(guard(lock, plurals), []);
});

test('reports a language that kept its text after English changed', () => {
  const lock = tempLock();
  assert.deepEqual(guard(lock, catalog('A', '甲'), { update: true }), []);
  assert.deepEqual(guard(lock, catalog('A', '甲')), []);
  assert.deepEqual(guard(lock, catalog('B', '甲')), ['app zh: "k" is stale (English changed, this language did not)']);
});

test('fails until the lock is refreshed, so the next stale text is still found', () => {
  const lock = tempLock();
  guard(lock, catalog('A', '甲'), { update: true });
  assert.deepEqual(guard(lock, catalog('B', '乙')), ['app: i18n.lock.json is out of date for k. Run npm run i18n:lock']);
  assert.deepEqual(guard(lock, catalog('B', '乙'), { update: true }), []);
  assert.deepEqual(guard(lock, catalog('C', '乙')), ['app zh: "k" is stale (English changed, this language did not)']);
});

test('accepts a text that correctly stays the same', () => {
  const lock = tempLock();
  guard(lock, catalog('A', 'Brand'), { update: true });
  assert.deepEqual(guard(lock, catalog('B', 'Brand'), { update: true, accept: ['k:*'] }), []);
  assert.deepEqual(guard(lock, catalog('B', 'Brand')), []);
});

test('does not write the lock while there are problems', () => {
  const lock = tempLock();
  guard(lock, catalog('A', '甲'), { update: true });
  const before = fs.readFileSync(lock, 'utf8');
  assert.equal(guard(lock, catalog('B', '甲'), { update: true }).length, 1);
  assert.equal(fs.readFileSync(lock, 'utf8'), before);
});

test('flattens nested JSON', () => {
  assert.deepEqual(flatten({ ios: { A: 'a' }, android: { b: 'b' } }), { 'ios.A': 'a', 'android.b': 'b' });
});
