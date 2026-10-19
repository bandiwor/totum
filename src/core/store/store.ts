import { batch, computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { GenericSchema } from 'valibot';
import { newId } from '../id';
import { db, type StoredRecord } from './idb';

/** Base fields of every stored entity. */
export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export type Draft<T extends Entity> = Omit<T, keyof Entity> & { id?: string };
export type Patch<T extends Entity> = Partial<Omit<T, keyof Entity>>;

const DOC_COLLECTION = '$doc';

// ── Write queue: in-memory state updates synchronously, IndexedDB follows. ──

let writeChain: Promise<void> = Promise.resolve();
export const pendingWrites = signal(0);
export const lastWriteError = signal<string | null>(null);

function persist(op: () => Promise<unknown>): void {
  pendingWrites.value++;
  writeChain = writeChain
    .then(op)
    .then(
      () => undefined,
      (e: unknown) => {
        lastWriteError.value = e instanceof Error ? e.message : String(e);
        console.error('IndexedDB write failed', e);
      },
    )
    .finally(() => pendingWrites.value--);
}

export function flushWrites(): Promise<void> {
  return writeChain;
}

// ── Collections ─────────────────────────────────────────────────────────────

interface AnyCollection {
  readonly name: string;
  readonly schema: GenericSchema | undefined;
  readonly label: string;
  hydrate(values: unknown[]): void;
  snapshot(): unknown[];
}

interface AnyDoc {
  readonly name: string;
  hydrate(value: unknown): void;
  snapshot(): unknown;
}

const collections = new Map<string, AnyCollection>();
const docs = new Map<string, AnyDoc>();
/** Records of collections no longer registered — kept so export never loses data. */
let orphans: Record<string, unknown[]> = {};

export class Collection<T extends Entity> implements AnyCollection {
  private readonly map = signal<ReadonlyMap<string, T>>(new Map());
  /** All items, in insertion order. */
  readonly all: ReadonlySignal<readonly T[]> = computed(() => [...this.map.value.values()]);

  constructor(
    readonly name: string,
    readonly label: string,
    readonly schema: GenericSchema | undefined,
  ) {}

  get(id: string): T | undefined {
    return this.map.value.get(id);
  }

  /** Reactive lookup for components. */
  byId(id: string | null | undefined): T | undefined {
    return id ? this.map.value.get(id) : undefined;
  }

  add(draft: Draft<T>): T {
    const now = Date.now();
    const item = { ...draft, id: draft.id ?? newId(), createdAt: now, updatedAt: now } as T;
    this.write(item);
    return item;
  }

  update(id: string, patch: Patch<T>): T | undefined {
    const cur = this.map.value.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch, id, updatedAt: Date.now() } as T;
    this.write(next);
    return next;
  }

  remove(id: string): void {
    if (!this.map.value.has(id)) return;
    const next = new Map(this.map.value);
    next.delete(id);
    this.map.value = next;
    persist(async () => (await db()).delete('records', [this.name, id]));
  }

  private write(item: T): void {
    const next = new Map(this.map.value);
    next.set(item.id, item);
    this.map.value = next;
    const record: StoredRecord = { c: this.name, id: item.id, v: item };
    persist(async () => (await db()).put('records', record));
  }

  hydrate(values: unknown[]): void {
    this.map.value = new Map((values as T[]).map((v) => [v.id, v]));
  }

  snapshot(): T[] {
    return [...this.map.value.values()];
  }
}

/** Defines a persistent collection. Call once at module level. */
export function defineCollection<T extends Entity>(
  name: string,
  opts: { label: string; schema?: GenericSchema },
): Collection<T> {
  if (collections.has(name)) throw new Error(`Collection "${name}" defined twice`);
  const c = new Collection<T>(name, opts.label, opts.schema);
  collections.set(name, c);
  return c;
}

// ── Documents (singletons: settings, profile, …) ───────────────────────────

export class Doc<T extends object> implements AnyDoc {
  private readonly state: Signal<T>;
  readonly value: ReadonlySignal<T>;

  constructor(
    readonly name: string,
    private readonly defaults: T,
  ) {
    this.state = signal<T>(defaults);
    this.value = this.state;
  }

  set(patch: Partial<T>): void {
    const next: T = { ...this.state.value, ...patch };
    this.state.value = next;
    const record: StoredRecord = { c: DOC_COLLECTION, id: this.name, v: next };
    persist(async () => (await db()).put('records', record));
  }

  hydrate(value: unknown): void {
    // Merge with defaults so newly added fields get sane values.
    this.state.value = { ...this.defaults, ...(value as Partial<T>) } as T;
  }

  snapshot(): T {
    return this.state.value;
  }
}

export function defineDoc<T extends object>(name: string, defaults: T): Doc<T> {
  if (docs.has(name)) throw new Error(`Doc "${name}" defined twice`);
  const d = new Doc(name, defaults);
  docs.set(name, d);
  return d;
}

// ── Whole-database operations (used by boot and backup) ────────────────────

export interface DataSnapshot {
  collections: Record<string, unknown[]>;
  docs: Record<string, unknown>;
}

function distribute(records: readonly StoredRecord[]): void {
  const byCollection = new Map<string, unknown[]>();
  const docValues = new Map<string, unknown>();
  for (const r of records) {
    if (r.c === DOC_COLLECTION) docValues.set(r.id, r.v);
    else {
      let list = byCollection.get(r.c);
      if (!list) byCollection.set(r.c, (list = []));
      list.push(r.v);
    }
  }
  orphans = {};
  batch(() => {
    for (const c of collections.values()) c.hydrate(byCollection.get(c.name) ?? []);
    for (const [name, values] of byCollection) if (!collections.has(name)) orphans[name] = values;
    for (const d of docs.values()) if (docValues.has(d.name)) d.hydrate(docValues.get(d.name));
  });
}

export async function loadAll(): Promise<void> {
  distribute(await (await db()).getAll('records'));
}

export function snapshotAll(): DataSnapshot {
  const out: DataSnapshot = { collections: { ...orphans }, docs: {} };
  for (const c of collections.values()) out.collections[c.name] = c.snapshot();
  for (const d of docs.values()) out.docs[d.name] = d.snapshot();
  return out;
}

/** Replaces the entire database atomically. */
export async function replaceAll(data: DataSnapshot): Promise<void> {
  await flushWrites();
  const records: StoredRecord[] = [];
  for (const [c, values] of Object.entries(data.collections)) {
    for (const v of values) records.push({ c, id: (v as Entity).id, v });
  }
  for (const [id, v] of Object.entries(data.docs)) records.push({ c: DOC_COLLECTION, id, v });

  const tx = (await db()).transaction('records', 'readwrite');
  await tx.store.clear();
  for (const r of records) void tx.store.put(r);
  await tx.done;
  distribute(records);
}

export function registeredCollections(): readonly AnyCollection[] {
  return [...collections.values()];
}
