import type { FeatureDef } from '@/core/registry';
import { CollectionScreen, NoteEditor, NotesHome, QuickNote } from './screens';

export const notesFeature: FeatureDef = {
  id: 'notes',
  tab: { path: 'notes', label: 'app.tabs.notes', icon: 'notes', order: 40 },
  routes: [
    { pattern: 'notes', component: NotesHome },
    { pattern: 'notes/c/:id', component: CollectionScreen },
    { pattern: 'notes/n/:id', component: NoteEditor },
  ],
  quickActions: [{ id: 'note', label: 'notes.newNote', icon: 'pencil', order: 50, screen: QuickNote }],
};
