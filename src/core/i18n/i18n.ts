import { signal } from '@preact/signals';
import { ru } from './ru';

/**
 * Typed translations.
 *  - Keys are dot paths checked at compile time: t('plan.week.title').
 *  - `{name}` placeholders become required, typed params: t('tasks.left', { count: 3 }).
 *  - Plural entries ({ one, few, many, other }) pick a form via Intl.PluralRules using `count`.
 * `ru` is the source of truth; built-in locales must match `LocaleMessages`.
 */
export type Dict = typeof ru;

export interface PluralForms {
  readonly one: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

type Join<A extends string, B extends string> = A extends '' ? B : `${A}.${B}`;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : T[K] extends PluralForms ? Join<P, K> : Leaves<T[K], Join<P, K>>;
}[keyof T & string];

export type MessageKey = Leaves<Dict>;

type At<T, K extends string> = K extends `${infer H}.${infer R}` ? (H extends keyof T ? At<T[H], R> : never) : K extends keyof T ? T[K] : never;

type Vars<S> = S extends `${string}{${infer P}}${infer R}` ? P | Vars<R> : never;

type MessageVars<M> = M extends string ? Vars<M> : M extends PluralForms ? Vars<M[keyof M] & string> | 'count' : never;

export type MessageParams<K extends MessageKey> = Record<MessageVars<At<Dict, K>>, string | number>;

type Args<K extends MessageKey> = [MessageVars<At<Dict, K>>] extends [never] ? [] : [MessageParams<K>];

/** Keys whose message has no placeholders — safe to store in data (tab labels, collection names). */
export type PlainKey = { [K in MessageKey]: [MessageVars<At<Dict, K>>] extends [never] ? K : never }[MessageKey];

/** Shape other locales must implement (same keys, any wording). */
export type LocaleMessages = DeepWiden<Dict>;
type DeepWiden<T> = T extends string ? string : T extends PluralForms ? PluralForms : { readonly [K in keyof T]: DeepWiden<T[K]> };

/**
 * The active language is a chain of message trees: the chosen language first,
 * then its fallback (a complete language), then `ru`. Custom languages (see
 * languages.ts) may be partial — missing keys come from the fallback.
 */
interface ActiveLocale {
  /** BCP 47 tag for Intl (dates, numbers, plural rules). */
  tag: string;
  chain: readonly unknown[];
}

const active = signal<ActiveLocale>({ tag: 'ru-RU', chain: [ru] });

export function setActiveLocale(tag: string, chain: readonly unknown[]): void {
  active.value = { tag, chain: [...chain, ru] };
}

export const intlLocale = (): string => active.value.tag;

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(n: number): Intl.LDMLPluralRule {
  const tag = intlLocale();
  let rules = pluralRules.get(tag);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(tag);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    pluralRules.set(tag, rules);
  }
  return rules.select(n);
}

function lookupIn(tree: unknown, key: string): unknown {
  let node = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const isMessage = (x: unknown): boolean => typeof x === 'string' || (typeof x === 'object' && x !== null && typeof (x as PluralForms).other === 'string');

function lookup(key: string): unknown {
  for (const tree of active.value.chain) {
    const hit = lookupIn(tree, key);
    if (isMessage(hit)) return hit;
  }
  return undefined;
}

/** Every message key (dot path) of the source dictionary. */
export function allMessageKeys(tree: unknown = ru, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(tree as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isMessage(v)) out.push(key);
    else if (typeof v === 'object' && v !== null) out.push(...allMessageKeys(v, key));
  }
  return out;
}

/** Share of source keys a message tree translates, 0..1. */
export function coverage(tree: unknown): number {
  const keys = allMessageKeys();
  return keys.filter((k) => isMessage(lookupIn(tree, k))).length / keys.length;
}

function interpolate(template: string, params: Record<string, string | number> | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function t(key: PlainKey): string;
export function t<K extends MessageKey>(key: K, ...args: Args<K>): string;
export function t(key: string, params?: Record<string, string | number>): string {
  const entry = lookup(key);
  if (typeof entry === 'string') return interpolate(entry, params);
  if (typeof entry === 'object' && entry !== null && 'other' in entry) {
    const forms = entry as PluralForms;
    const count = Number(params?.count ?? 0);
    const form = forms[pluralCategory(count) as keyof PluralForms] ?? forms.other;
    return interpolate(form, params);
  }
  if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
  return key;
}
