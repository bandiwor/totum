import type { FeatureDef } from '@/core/registry';
import { PlacesScreen } from './PlacesScreen';
import './model';

export const placesFeature: FeatureDef = {
  id: 'places',
  routes: [{ pattern: 'plan/places', component: PlacesScreen }],
};
