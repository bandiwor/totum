import type { ComponentType } from 'preact';
import type { ISODate, Minutes } from './date';
import type { BusyBlock } from './timeline';
import type { IconName } from '@/ui/icons';
import type { PlainKey } from './i18n';

/**
 * Every section of the app is a "feature" that plugs into shared surfaces
 * instead of other features importing each other:
 *   tab bar · routes · quick menu · Today widgets · busy time · agenda.
 * Adding a section = a folder in src/features + one line in src/app/features.ts.
 */

export interface RouteProps {
  params: Record<string, string>;
}

export interface RouteDef {
  /** e.g. "health/workouts/:id". The first segment is the tab. */
  pattern: string;
  component: ComponentType<RouteProps>;
}

export interface TabDef {
  path: string;
  label: PlainKey;
  icon: IconName;
  order: number;
}

export interface QuickActionContext {
  close: () => void;
  /** Go back to the quick menu grid. */
  back: () => void;
}

/** A big tile in the "super button" menu. */
export interface QuickAction {
  id: string;
  label: PlainKey;
  icon: IconName;
  order: number;
  /** Optional dynamic hint under the label, e.g. "1450 / 2600 ккал". */
  hint?: () => string | null;
  /** 0..1 — how relevant the action is right now; the top ones get larger tiles. */
  relevance?: () => number;
  /** Inline screen shown inside the quick menu… */
  screen?: ComponentType<QuickActionContext>;
  /** …or an immediate action. */
  run?: (ctx: QuickActionContext) => void;
}

export interface TodayWidget {
  id: string;
  order: number;
  component: ComponentType<{ date: ISODate }>;
}

/** Produces time-occupying blocks (classes, workouts, shifts) for the free-time engine. */
export interface BusySource {
  /** Must equal the `source` of the blocks it produces. */
  id: string;
  blocksFor: (date: ISODate) => BusyBlock[];
  /** Planned items cancelled on this date — shown greyed out so they can be restored. */
  cancelledFor?: (date: ISODate) => BusyBlock[];
  /** Opens the details of a block (by its id). */
  open?: (date: ISODate, id: string) => void;
}

/** "Add to this day" entries: one-off class, extra shift, extra workout… */
export interface DayAction {
  id: string;
  label: PlainKey;
  icon: IconName;
  order: number;
  run: (date: ISODate) => void;
}

/** Things to do on a day that aren't blocks of time: tasks, homework, meals, intakes. */
export interface AgendaItem {
  id: string;
  source: string;
  title: string;
  /** Due/planned time, if any. */
  time: Minutes | null;
  done: boolean;
  href?: string;
}

export interface AgendaSource {
  id: string;
  itemsFor: (date: ISODate) => AgendaItem[];
}

export interface FeatureDef {
  id: string;
  tab?: TabDef;
  routes?: RouteDef[];
  quickActions?: QuickAction[];
  todayWidgets?: TodayWidget[];
  busySources?: BusySource[];
  agendaSources?: AgendaSource[];
  dayActions?: DayAction[];
  /** Runs once after data is loaded (seeding defaults, cleanup). */
  onReady?: () => void;
}

const features: FeatureDef[] = [];

export function registerFeatures(defs: readonly FeatureDef[]): void {
  for (const def of defs) {
    if (features.some((f) => f.id === def.id)) throw new Error(`Feature "${def.id}" registered twice`);
    features.push(def);
  }
}

export function runReadyHooks(): void {
  for (const f of features) f.onReady?.();
}

const sorted = <T extends { order: number }>(items: T[]): T[] => items.sort((a, b) => a.order - b.order);

export const registry = {
  tabs: (): TabDef[] => sorted(features.flatMap((f) => (f.tab ? [f.tab] : []))),
  routes: (): RouteDef[] => features.flatMap((f) => f.routes ?? []),
  quickActions: (): QuickAction[] => sorted(features.flatMap((f) => f.quickActions ?? [])),
  todayWidgets: (): TodayWidget[] => sorted(features.flatMap((f) => f.todayWidgets ?? [])),
  busyBlocks: (date: ISODate): BusyBlock[] =>
    features.flatMap((f) => f.busySources ?? []).flatMap((s) => s.blocksFor(date)),
  cancelledBlocks: (date: ISODate): BusyBlock[] =>
    features.flatMap((f) => f.busySources ?? []).flatMap((s) => s.cancelledFor?.(date) ?? []),
  openBlock: (date: ISODate, block: BusyBlock): void =>
    features.flatMap((f) => f.busySources ?? []).find((s) => s.id === block.source)?.open?.(date, block.id),
  dayActions: (): DayAction[] => sorted(features.flatMap((f) => f.dayActions ?? [])),
  agenda: (date: ISODate): AgendaItem[] =>
    features.flatMap((f) => f.agendaSources ?? []).flatMap((s) => s.itemsFor(date)),
};
