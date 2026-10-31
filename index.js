/**
 * i18n-guard: keeps every language in step with the English source.
 *
 * Project-neutral on purpose: a project's own test loads its dictionaries and passes them in, so the
 * same file works for any app. A catalog is { source: {key: text}, translations: {lang: {key: text}} };
 * a text is a string or a plural object ({one, other, ...}).
 *
 * Checks, per language: same keys as the source, nothing empty, same {placeholders}, and no stale
 * text. Stale means the English text changed since the lock was written but this language's text
 * did not. The lock (i18n.lock.json) holds a short hash of every text, per key and language.
 */
const crypto = require('crypto');
const fs = require('fs');

const SOURCE = 'en';

const hash = (value) =>
  crypto.createHash('sha1').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 10);

const texts = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}));

const kind = (value) => (typeof value === 'string' ? 'string' : 'plural');

const placeholders = (value) =>
  [...new Set(texts(value).join(' ').match(/\{\w+\}/g) ?? [])].sort().join(',');

/** `accept` lists "key:lang" or "key:*" pairs whose unchanged text is correct (e.g. a brand name). */
function checkCatalog(name, { source, translations }, lockEntries = {}, accept = []) {
  const problems = [];
  const accepted = (key, lang) => accept.includes(`${key}:${lang}`) || accept.includes(`${key}:*`);
  const keys = Object.keys(source);

  for (const [lang, dict] of Object.entries(translations)) {
    const where = `${name} ${lang}`;
    for (const key of keys) {
      const value = dict[key];
      if (value === undefined) {
        problems.push(`${where}: missing "${key}"`);
        continue;
      }
      if (typeof value !== typeof source[key]) problems.push(`${where}: "${key}" is a ${kind(value)}, English is a ${kind(source[key])}`);
      if (texts(value).some((t) => typeof t !== 'string' || !t.trim())) problems.push(`${where}: empty "${key}"`);
      if (placeholders(value) !== placeholders(source[key])) {
        problems.push(`${where}: "${key}" has {${placeholders(value)}}, English has {${placeholders(source[key])}}`);
      }
      const locked = lockEntries[key];
      if (locked && locked[SOURCE] !== hash(source[key]) && locked[lang] === hash(value) && !accepted(key, lang)) {
        problems.push(`${where}: "${key}" is stale (English changed, this language did not)`);
      }
    }
    for (const key of Object.keys(dict)) {
      if (!(key in source)) problems.push(`${where}: "${key}" is not in English`);
    }
  }
  return problems;
}

function lockFor({ source, translations }) {
  const entries = {};
  for (const key of Object.keys(source).sort()) {
    entries[key] = { [SOURCE]: hash(source[key]) };
    for (const lang of Object.keys(translations).sort()) {
      if (translations[lang][key] !== undefined) entries[key][lang] = hash(translations[lang][key]);
    }
  }
  return entries;
}

/** One line per key, so a diff of the lock shows which keys changed. */
function serialize(lock) {
  const catalogs = Object.entries(lock.catalogs).map(([name, entries]) => {
    const lines = Object.entries(entries).map(([key, hashes]) => `   ${JSON.stringify(key)}: ${JSON.stringify(hashes)}`);
    return `  ${JSON.stringify(name)}: {\n${lines.join(',\n')}\n  }`;
  });
  return `{\n "version": ${lock.version},\n "catalogs": {\n${catalogs.join(',\n')}\n }\n}\n`;
}

/**
 * Checks every catalog against the lock file. With update, writes a new lock when there are no
 * problems (accepted stale texts are not problems). Returns the problems.
 */
function guard(lockPath, catalogs, { update = false, accept = [] } = {}) {
  const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : { catalogs: {} };
  const problems = Object.entries(catalogs).flatMap(([name, catalog]) =>
    checkCatalog(name, catalog, lock.catalogs?.[name], accept),
  );
  if (problems.length > 0) return problems;
  const next = { version: 1, catalogs: {} };
  for (const name of Object.keys(catalogs).sort()) next.catalogs[name] = lockFor(catalogs[name]);
  if (update) {
    fs.writeFileSync(lockPath, serialize(next));
    return [];
  }
  // A lock that lags behind the texts would hide the next stale text, so it must be refreshed too.
  for (const [name, entries] of Object.entries(next.catalogs)) {
    const old = lock.catalogs?.[name] ?? {};
    const changed = [...new Set([...Object.keys(entries), ...Object.keys(old)])].filter(
      (key) => JSON.stringify(entries[key]) !== JSON.stringify(old[key]),
    );
    if (changed.length) problems.push(`${name}: i18n.lock.json is out of date for ${changed.join(', ')}. Run npm run i18n:lock`);
  }
  return problems;
}

/** Splits "a.b" style nested JSON into flat keys, e.g. {ios: {X: 'y'}} becomes {'ios.X': 'y'}. */
function flatten(object, prefix = '') {
  return Object.entries(object).reduce((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? { ...flat, ...flatten(value, path) } : { ...flat, [path]: value };
  }, {});
}

const envAccept = () => (process.env.I18N_ACCEPT ?? '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = { guard, checkCatalog, lockFor, flatten, hash, envAccept };
