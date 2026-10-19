import { signal } from '@preact/signals';
import { ru } from './ru';

/**
 * Typed translations.
 *  - Keys are dot paths checked at compile time: t('plan.week.title').
 *  - `{name}` placeholders become required, typed params: t('tasks.left', { count: 3 }).
 *  - Plural entries ({ one, few, many, other }) pick a form via Intl.PluralRules using `count`.
 * `ru` is the source of truth; other locales must match `LocaleMessages`.
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
type DeepWiden<T> = T extends string ? string : { readonly [K in keyof T]: DeepWiden<T[K]> };

export type Locale = 'ru';
const locales: Record<Locale, LocaleMessages> = { ru };
const intlTags: Record<Locale, string> = { ru: 'ru-RU' };

export const locale = signal<Locale>('ru');
export const intlLocale = (): string => intlTags[locale.value];

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(n: number): Intl.LDMLPluralRule {
  const tag = intlLocale();
  let rules = pluralRules.get(tag);
  if (!rules) pluralRules.set(tag, (rules = new Intl.PluralRules(tag)));
  return rules.select(n);
}

function lookup(key: string): unknown {
  let node: unknown = locales[locale.value];
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
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
