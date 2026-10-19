import type { ComponentType } from 'preact';
import type { ISODate, Minutes } from './date';
import type { BusyBlock } from './timeline';
import type { IconName } from '@/ui/icons';

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
  label: string;
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
  label: string;
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
  id: string;
  blocksFor: (date: ISODate) => BusyBlock[];
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
}

const features: FeatureDef[] = [];

export function registerFeatures(defs: readonly FeatureDef[]): void {
  for (const def of defs) {
    if (features.some((f) => f.id === def.id)) throw new Error(`Feature "${def.id}" registered twice`);
    features.push(def);
  }
}

const sorted = <T extends { order: number }>(items: T[]): T[] => items.sort((a, b) => a.order - b.order);

export const registry = {
  tabs: (): TabDef[] => sorted(features.flatMap((f) => (f.tab ? [f.tab] : []))),
  routes: (): RouteDef[] => features.flatMap((f) => f.routes ?? []),
  quickActions: (): QuickAction[] => sorted(features.flatMap((f) => f.quickActions ?? [])),
  todayWidgets: (): TodayWidget[] => sorted(features.flatMap((f) => f.todayWidgets ?? [])),
  busyBlocks: (date: ISODate): BusyBlock[] =>
    features.flatMap((f) => f.busySources ?? []).flatMap((s) => s.blocksFor(date)),
  agenda: (date: ISODate): AgendaItem[] =>
    features.flatMap((f) => f.agendaSources ?? []).flatMap((s) => s.itemsFor(date)),
};
