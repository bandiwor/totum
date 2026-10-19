import { computed, effect } from '@preact/signals';
import * as v from 'valibot';
import { settings } from '../settings';
import { defineCollection, type Entity } from '../store/store';
import { entityFields } from '../store/schema';
import { allMessageKeys, coverage, setActiveLocale, t } from './i18n';
import { en } from './en';
import { ru } from './ru';

/**
 * Languages: built-in ones are complete and typed; custom ones are pasted JSON
 * (a message tree with any subset of keys). Missing keys of a custom language
 * come from its fallback — a language translated at 100%.
 */
export interface Language {
  id: string;
  name: string;
  /** BCP 47 tag for dates, numbers and plural rules. */
  tag: string;
  messages: unknown;
  builtin: boolean;
}

export interface CustomLanguage extends Entity {
  name: string;
  tag: string;
  fallback: string;
  messages: Record<string, unknown>;
}

export const customLanguages = defineCollection<CustomLanguage>('languages', {
  label: 'collections.languages',
  schema: v.object({
    ...entityFields,
    name: v.pipe(v.string(), v.minLength(1)),
    tag: v.string(),
    fallback: v.string(),
    messages: v.record(v.string(), v.unknown()),
  }),
});

const BUILTIN: readonly Language[] = [
  { id: 'ru', name: 'Русский', tag: 'ru-RU', messages: ru, builtin: true },
  { id: 'en', name: 'English', tag: 'en-GB', messages: en, builtin: true },
];

export const languages = computed((): Language[] => [
  ...BUILTIN,
  ...customLanguages.all.value.map((l) => ({ id: l.id, name: l.name, tag: l.tag, messages: l.messages, builtin: false })),
]);

const coverageCache = new WeakMap<object, number>();
export function languageCoverage(lang: Language): number {
  if (lang.builtin) return 1;
  const tree = lang.messages as object;
  let c = coverageCache.get(tree);
  if (c === undefined) coverageCache.set(tree, (c = coverage(tree)));
  return c;
}

/** Languages a partial one can borrow missing keys from. */
export function fallbackCandidates(exceptId?: string): Language[] {
  return languages.value.filter((l) => l.id !== exceptId && languageCoverage(l) === 1);
}

export function languageById(id: string): Language | undefined {
  return languages.value.find((l) => l.id === id);
}

export function validTag(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

/** Keeps the active locale in sync with settings. Call once after data is loaded. */
export function installLanguage(): void {
  effect(() => {
    const id = settings.value.value.language;
    const lang = languageById(id) ?? BUILTIN[0]!;
    const custom = lang.builtin ? undefined : customLanguages.get(lang.id);
    const fallback = custom ? languageById(custom.fallback) : undefined;
    setActiveLocale(lang.tag, fallback ? [lang.messages, fallback.messages] : [lang.messages]);
    document.documentElement.lang = lang.tag;
  });
}

// ── Import of a pasted language ─────────────────────────────────────────────

export interface ParsedLanguage {
  name: string;
  tag: string;
  fallback: string | null;
  messages: Record<string, unknown>;
  coverage: number;
}

/**
 * Accepts either `{ name, tag, fallback?, messages }` or a bare message tree.
 * Values must be strings or plural objects; unknown keys are ignored.
 */
export function parseLanguage(text: string): ParsedLanguage {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error(t('backup.notJson'));
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(t('languages.badFormat'));
  const obj = raw as Record<string, unknown>;
  const wrapped = typeof obj.messages === 'object' && obj.messages !== null;
  const messages = (wrapped ? obj.messages : obj) as Record<string, unknown>;
  const cov = coverage(messages);
  if (cov === 0) throw new Error(t('languages.noKeys'));
  return {
    name: wrapped && typeof obj.name === 'string' ? obj.name : '',
    tag: wrapped && typeof obj.tag === 'string' ? obj.tag : '',
    fallback: wrapped && typeof obj.fallback === 'string' ? obj.fallback : null,
    messages,
    coverage: cov,
  };
}

/** A ready-to-translate file: every key with the text of `source`. */
export function languageTemplate(source: Language): string {
  const messages: Record<string, unknown> = {};
  for (const key of allMessageKeys()) {
    const parts = key.split('.');
    let src: unknown = source.messages;
    for (const p of parts) src = (src as Record<string, unknown> | undefined)?.[p];
    let node = messages;
    parts.slice(0, -1).forEach((p) => (node = (node[p] ??= {}) as Record<string, unknown>));
    node[parts[parts.length - 1]!] = src;
  }
  return JSON.stringify({ name: '', tag: '', fallback: source.id, messages }, null, 2);
}

/** Picks the built-in text for the active language (custom languages use their fallback's). */
export function pickText(text: { ru: string; en: string }): string {
  let id = settings.value.value.language;
  const custom = customLanguages.get(id);
  if (custom) id = custom.fallback;
  return id === 'en' ? text.en : text.ru;
}
