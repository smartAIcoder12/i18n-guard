# i18n-guard

Keeps every language of an app in step with the English source. Shared by all apps.

The check fails when a language:

- is missing a key, or has a key English does not have
- has an empty text, or a plural where English has a string (or the reverse)
- has different `{placeholders}` from English
- is **stale**: the English text changed, but this language's text did not

It also fails when `i18n.lock.json` is out of date. The lock holds a short hash of every text, per
key and language. An old lock would hide the next stale text.

A text is a string or a plural object (`{ one, other, ... }`).

## Add it to an app

1. Install it. `package-lock.json` pins the exact commit:

   ```bash
   npm install --save-dev git+https://github.com/smartAIcoder12/i18n-guard.git#main
   ```

2. Add a Jest test that loads the app's dictionaries and calls `guard()`:

   ```ts
   import path from 'path';
   import { guard, envAccept } from 'i18n-guard';
   import { DICTIONARIES } from '@/i18n';

   it('keeps every language complete and up to date with English', () => {
     const { en, ...translations } = DICTIONARIES;
     const problems = guard(path.resolve(__dirname, '../../../i18n.lock.json'), {
       app: { source: en, translations },
     }, { update: process.env.I18N_LOCK === 'update', accept: envAccept() });
     expect(problems).toEqual([]);
   });
   ```

   One catalog per group of texts (app strings, iOS/Android strings, ...). `flatten()` turns nested
   JSON such as `locales/*.json` into flat keys.

3. Add scripts to `package.json`:

   ```json
   "i18n:check": "jest path/to/sync.test.ts",
   "i18n:lock": "I18N_LOCK=update jest path/to/sync.test.ts",
   "prepare": "git config core.hooksPath .githooks || true"
   ```

4. Add `.githooks/pre-commit`, with the app's own language paths:

   ```sh
   #!/bin/sh
   if git diff --cached --name-only | grep -qE '^(src/i18n/|i18n\.lock\.json$)'; then
     npm run --silent i18n:check || {
       echo "Language check failed. Update every language, then run: npm run i18n:lock" >&2
       exit 1
     }
   fi
   ```

5. Run `npm install` (turns on the hook) and `npm run i18n:lock`, then commit `i18n.lock.json`.

## Changing a text

1. Change the English text.
2. Change the same key in every other language.
3. Run `npm run i18n:lock`. It writes the lock only when the check passes.
4. Commit the text changes together with `i18n.lock.json`.

A text that correctly stays the same (a brand name) is accepted by key, for one language or all.
The keys have no catalog name. This applies to that run only:

```bash
I18N_ACCEPT='android.app_name:*,settings.title:zh' npm run i18n:lock
```

Reverting an English change after a lock update also shows as stale. Accept the key the same way.

## Changing this library

Run `npm test`, commit, and push `main`. Then in each app, move the lock to the new commit:

```bash
npm install --save-dev git+https://github.com/smartAIcoder12/i18n-guard.git#main
```
