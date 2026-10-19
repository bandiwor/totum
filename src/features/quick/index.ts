import type { FeatureDef } from '@/core/registry';
import { BriefScreen } from './BriefScreen';

export const quickFeature: FeatureDef = {
  id: 'quick',
  quickActions: [{ id: 'brief', label: 'quick.brief', icon: 'clock', order: 0, relevance: () => 1, screen: BriefScreen }],
};
