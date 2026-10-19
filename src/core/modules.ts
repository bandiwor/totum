import { computed } from '@preact/signals';
import type { IconName } from '@/ui/icons';
import type { PlainKey } from './i18n';
import { settings } from './settings';

/**
 * Optional parts of the app. A disabled module disappears everywhere at once:
 * tab bar, quick menu, Today widgets, busy time, agenda, Health segments.
 * Its data is kept — turning it back on restores everything.
 */
export const MODULE_IDS = ['schedule', 'work', 'training', 'nutrition', 'water', 'intake', 'body', 'sleep', 'money', 'notes'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** One module, or several — the contribution is shown while any of them is on. */
export type ModuleSpec = ModuleId | readonly ModuleId[];

export const MODULE_INFO: Record<ModuleId, { label: PlainKey; hint: PlainKey; icon: IconName }> = {
  schedule: { label: 'modules.schedule', hint: 'modules.scheduleHint', icon: 'calendar' },
  work: { label: 'modules.work', hint: 'modules.workHint', icon: 'briefcase' },
  training: { label: 'modules.training', hint: 'modules.trainingHint', icon: 'dumbbell' },
  nutrition: { label: 'modules.nutrition', hint: 'modules.nutritionHint', icon: 'utensils' },
  water: { label: 'modules.water', hint: 'modules.waterHint', icon: 'droplet' },
  intake: { label: 'modules.intake', hint: 'modules.intakeHint', icon: 'pill' },
  body: { label: 'modules.body', hint: 'modules.bodyHint', icon: 'scale' },
  sleep: { label: 'modules.sleep', hint: 'modules.sleepHint', icon: 'moon' },
  money: { label: 'modules.money', hint: 'modules.moneyHint', icon: 'wallet' },
  notes: { label: 'modules.notes', hint: 'modules.notesHint', icon: 'notes' },
};

const disabled = computed(() => new Set<string>(settings.value.value.disabledModules));

export function isModuleOn(id: ModuleId): boolean {
  return !disabled.value.has(id);
}

/** True for contributions without a module, or when any listed module is on. */
export function moduleVisible(spec: ModuleSpec | undefined): boolean {
  if (spec === undefined) return true;
  if (typeof spec === 'string') return isModuleOn(spec);
  return spec.some(isModuleOn);
}

export function setModule(id: ModuleId, on: boolean): void {
  const cur = settings.value.value.disabledModules.filter((m) => m !== id);
  settings.set({ disabledModules: on ? cur : [...cur, id] });
}

export function setTabOrder(paths: readonly string[]): void {
  settings.set({ tabOrder: [...paths] });
}
