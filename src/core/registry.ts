import type { ComponentType } from 'preact';
import type { ISODate, Minutes } from './date';
import type { BusyBlock } from './timeline';
import type { IconName } from '@/ui/icons';
import type { PlainKey } from './i18n';
import { moduleVisible, type ModuleSpec } from './modules';
import { settings } from './settings';

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

/** Contributions tagged with a module disappear while it is turned off. */
interface Gated {
  module?: ModuleSpec;
}

export interface TabDef extends Gated {
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
export interface QuickAction extends Gated {
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

export interface TodayWidget extends Gated {
  id: string;
  order: number;
  component: ComponentType<{ date: ISODate }>;
}

/** Produces time-occupying blocks (classes, workouts, shifts) for the free-time engine. */
export interface BusySource extends Gated {
  /** Must equal the `source` of the blocks it produces. */
  id: string;
  blocksFor: (date: ISODate) => BusyBlock[];
  /** Planned items cancelled on this date — shown greyed out so they can be restored. */
  cancelledFor?: (date: ISODate) => BusyBlock[];
  /** Opens the details of a block (by its id). */
  open?: (date: ISODate, id: string) => void;
}

/** "Add to this day" entries: one-off class, extra shift, extra workout… */
export interface DayAction extends Gated {
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

export interface AgendaSource extends Gated {
  id: string;
  itemsFor: (date: ISODate) => AgendaItem[];
}

export interface FeatureDef {
  id: string;
  /** Default module for everything this feature contributes (items may override). */
  module?: ModuleSpec;
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

/** Contributions of a kind, each tagged with its effective module, filtered by enabled modules. */
function collect<T extends Gated>(pick: (f: FeatureDef) => readonly T[] | undefined): T[] {
  return features.flatMap((f) => (pick(f) ?? []).filter((item) => moduleVisible(item.module ?? f.module)));
}

const busySources = (): BusySource[] => collect((f) => f.busySources);

/** All tabs in the user's order; tabs not in the saved order keep their default place at the end. */
function orderedTabs(): TabDef[] {
  const order = settings.value.value.tabOrder;
  const all = features.flatMap((f): TabDef[] => {
    if (!f.tab) return [];
    const module = f.tab.module ?? f.module;
    return [module ? { ...f.tab, module } : f.tab];
  });
  const rank = (tab: TabDef): number => {
    const i = order.indexOf(tab.path);
    return i === -1 ? order.length + tab.order / 1000 : i;
  };
  return all.sort((a, b) => rank(a) - rank(b));
}

export const registry = {
  /** Every tab (for the reorder screen), including ones of disabled modules. */
  allTabs: orderedTabs,
  tabs: (): TabDef[] => orderedTabs().filter((tab) => moduleVisible(tab.module)),
  routes: (): RouteDef[] => features.flatMap((f) => f.routes ?? []),
  quickActions: (): QuickAction[] => sorted(collect((f) => f.quickActions)),
  todayWidgets: (): TodayWidget[] => sorted(collect((f) => f.todayWidgets)),
  busyBlocks: (date: ISODate): BusyBlock[] => busySources().flatMap((s) => s.blocksFor(date)),
  cancelledBlocks: (date: ISODate): BusyBlock[] => busySources().flatMap((s) => s.cancelledFor?.(date) ?? []),
  openBlock: (date: ISODate, block: BusyBlock): void => busySources().find((s) => s.id === block.source)?.open?.(date, block.id),
  dayActions: (): DayAction[] => sorted(collect((f) => f.dayActions)),
  agenda: (date: ISODate): AgendaItem[] => collect((f) => f.agendaSources).flatMap((s) => s.itemsFor(date)),
};
