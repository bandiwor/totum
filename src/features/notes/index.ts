import { h } from 'preact';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const NotesScreen = () =>
  h(Placeholder, {
    title: 'Записи',
    tabs: [{ value: 'all', label: 'Все', icon: 'notes', stage: 6, text: 'Коллекции (дневник, книги, духи…) со своими полями, поиск и «вернуться к этому».' }],
  });

export const notesFeature: FeatureDef = {
  id: 'notes',
  tab: { path: 'notes', label: 'Записи', icon: 'notes', order: 40 },
  routes: [{ pattern: 'notes', component: NotesScreen }],
  quickActions: [{ id: 'note', label: 'Заметка', icon: 'pencil', order: 50, screen: comingSoon(6) }],
};
