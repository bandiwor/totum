/** A content pack as written by hand, by an AI or by a built-in definition (see docs/PACKS.md). */
export interface PackInput {
  totum?: 'pack';
  version?: number;
  name?: string;
  description?: string;
  /** Partial app settings. */
  settings?: Record<string, unknown>;
  /** Partial singleton documents by name: bells, trainingProgram, mealPlan, bodyProfile, money. */
  docs?: Record<string, Record<string, unknown>>;
  /** Items per collection: an array (merge) or { mode, items }. */
  collections?: Record<string, PackItem[] | { mode?: PackMode; items: PackItem[] }>;
}

export type PackMode = 'merge' | 'replace';

/** A collection item without the bookkeeping fields; `id` is optional. */
export type PackItem = Record<string, unknown> & { id?: string };

/** Text in each built-in language; the active language (or its fallback) picks one. */
export interface Localized {
  ru: string;
  en: string;
}
