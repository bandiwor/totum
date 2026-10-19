import { signal } from '@preact/signals';
import { navigate } from '@/core/router';

export type HealthTab = 'training' | 'food' | 'body' | 'sleep';

/** Selected segment of the Health tab; shared so widgets can deep-link into it. */
export const healthTab = signal<HealthTab>('training');

export function openHealthTab(tab: HealthTab): void {
  healthTab.value = tab;
  navigate('health');
}
