/** A text: a string, or a plural object such as { one: '{n} page', other: '{n} pages' }. */
export type Text = string | Readonly<Record<string, string>>;

export type Dictionary = Readonly<Record<string, Text>>;

/** English source texts, and the same keys in every other language. */
export interface Catalog {
  source: Dictionary;
  translations: Readonly<Record<string, Dictionary>>;
}

export interface GuardOptions {
  /** Write a new lock when there are no problems. */
  update?: boolean;
  /** "key:lang" or "key:*" pairs whose unchanged text is correct. */
  accept?: string[];
}

/** Checks every catalog against the lock file and returns the problems (empty when all is well). */
export function guard(lockPath: string, catalogs: Readonly<Record<string, Catalog>>, options?: GuardOptions): string[];

export function checkCatalog(
  name: string,
  catalog: Catalog,
  lockEntries?: Readonly<Record<string, Record<string, string>>>,
  accept?: string[],
): string[];

export function lockFor(catalog: Catalog): Record<string, Record<string, string>>;

/** Turns nested JSON into flat keys: { ios: { X: 'y' } } becomes { 'ios.X': 'y' }. */
export function flatten(object: object): Record<string, string>;

export function hash(value: Text): string;

/** The accept list from the I18N_ACCEPT environment variable. */
export function envAccept(): string[];
