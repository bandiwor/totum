import { h } from 'preact';
import { t } from '@/core/i18n';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const NotesScreen = () =>
  h(Placeholder, {
    title: t('stubs.notes.title'),
    tabs: [{ value: 'all', label: t('stubs.notes.all'), icon: 'notes', stage: 6, text: t('stubs.notes.allText') }],
  });

export const notesFeature: FeatureDef = {
  id: 'notes',
  tab: { path: 'notes', label: 'app.tabs.notes', icon: 'notes', order: 40 },
  routes: [{ pattern: 'notes', component: NotesScreen }],
  quickActions: [{ id: 'note', label: 'stubs.notes.note', icon: 'pencil', order: 50, screen: comingSoon(6) }],
};
