import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatDateLong, today } from '@/core/date';
import { t } from '@/core/i18n';
import type { QuickActionContext, RouteProps } from '@/core/registry';
import { goBack, navigate } from '@/core/router';
import { Button, Card, ChoiceChips, colorVar, confirm, DateField, EmptyState, Form, Icon, IconButton, List, ListRow, Page, Section, SheetActions, Switch, TextField, toast } from '@/ui';
import { asIcon, fieldDisplay, FieldInput, openCollectionForm, Stars } from './components';
import { allTags, isNoteEmpty, isSortableField, parseTags, preview, searchNotes, sortNotes } from './logic';
import {
  activeCollections,
  archivedCollections,
  noteCollections,
  notes,
  notesByCollection,
  revisitNotes,
  visibleNotes,
  type FieldValue,
  type Note,
  type NoteCollection,
  type SortMode,
} from './model';

function NoteRow({ note, collection, snippet }: { note: Note; collection?: NoteCollection | undefined; snippet?: string }) {
  const rating = collection?.fields.find((f) => f.type === 'rating');
  const ratingValue = rating ? note.values[rating.id] : undefined;
  const extras = (collection?.fields ?? []).map((f) => fieldDisplay(f, note.values[f.id])).filter(Boolean);
  const meta = [collection && !snippet ? null : collection?.name, formatDateLong(note.date), ...extras, ...note.tags.map((tg) => `#${tg}`)].filter(Boolean).join(' · ');
  return (
    <button type="button" class="note-row" onClick={() => navigate(`notes/n/${note.id}`)}>
      <span class="note-row__head">
        {note.pinned && <Icon name="pinned" size={14} />}
        <span class="note-row__title">{note.title || t('notes.untitled')}</span>
        {note.revisit && <Icon name="bookmark" size={16} class="note-row__revisit" />}
      </span>
      {(snippet ?? preview(note.body)) && <span class="note-row__body">{snippet ?? preview(note.body)}</span>}
      <span class="note-row__meta">
        {typeof ratingValue === 'number' && <Stars value={ratingValue} size={12} />}
        <span>{meta}</span>
      </span>
    </button>
  );
}

/** Notes created for the editor; only these vanish when left empty. */
const freshNotes = new Set<string>();

function createNote(collectionId: string): void {
  const n = notes.add({ collectionId, title: '', body: '', tags: [], date: today(), revisit: false, pinned: false, values: {} });
  freshNotes.add(n.id);
  navigate(`notes/n/${n.id}`);
}

const REVISIT_PREVIEW = 5;

const query = signal('');
const revisitExpanded = signal(false);
const archiveOpen = signal(false);

function CollectionRow({ c }: { c: NoteCollection }) {
  const count = notesByCollection.value.get(c.id)?.length ?? 0;
  return (
    <ListRow
      icon={asIcon(c.icon)}
      iconColor={colorVar(c.color)}
      title={c.name}
      subtitle={count ? t('notes.count', { count }) : t('notes.empty')}
      chevron
      onClick={() => navigate(`notes/c/${c.id}`)}
    />
  );
}

export function NotesHome() {
  const q = query.value.trim();
  const hits = q ? searchNotes(visibleNotes.value, q) : [];
  const revisit = revisitNotes.value;
  const cols = activeCollections.value;
  const archived = archivedCollections.value;
  return (
    <Page
      title={t('notes.title')}
      large
      actions={<IconButton icon="plus" label={t('notes.newCollection')} variant="accent" onClick={() => openCollectionForm(null)} />}
      toolbar={<TextField value={query.value} onValue={(v) => (query.value = v)} placeholder={t('notes.search')} type="search" />}
    >
      {q ? (
        hits.length === 0 ? (
          <EmptyState icon="search" title={t('notes.nothingFound')} />
        ) : (
          <Section title={t('notes.results', { count: hits.length })}>
            <div class="note-list">
              {hits.map((h) => (
                <NoteRow key={h.note.id} note={h.note} collection={noteCollections.get(h.note.collectionId)} snippet={h.snippet} />
              ))}
            </div>
          </Section>
        )
      ) : (
        <>
          {revisit.length > 0 && (
            <Section
              title={t('notes.revisit')}
              action={
                revisit.length > REVISIT_PREVIEW && (
                  <Button size="sm" variant="ghost" onClick={() => (revisitExpanded.value = !revisitExpanded.value)}>
                    {revisitExpanded.value ? t('notes.showLess') : t('notes.showAll', { count: revisit.length })}
                  </Button>
                )
              }
            >
              <div class="note-list">
                {(revisitExpanded.value ? revisit : revisit.slice(0, REVISIT_PREVIEW)).map((n) => (
                  <NoteRow key={n.id} note={n} collection={noteCollections.get(n.collectionId)} snippet={preview(n.body, 80)} />
                ))}
              </div>
            </Section>
          )}
          <Section title={t('notes.collections')}>
            {cols.length === 0 ? (
              <EmptyState
                icon="notes"
                title={t('notes.noCollections')}
                text={t('notes.noCollectionsText')}
                action={<Button variant="primary" icon="plus" onClick={() => openCollectionForm(null)}>{t('notes.newCollection')}</Button>}
              />
            ) : (
              <List>
                {cols.map((c) => (
                  <CollectionRow key={c.id} c={c} />
                ))}
              </List>
            )}
          </Section>
          {archived.length > 0 && (
            <Section>
              <List>
                <ListRow
                  icon="package"
                  title={t('common.archive')}
                  value={archived.length}
                  trailing={<Icon name={archiveOpen.value ? 'chevronDown' : 'chevronRight'} size={18} />}
                  onClick={() => (archiveOpen.value = !archiveOpen.value)}
                />
                {archiveOpen.value && archived.map((c) => <CollectionRow key={c.id} c={c} />)}
              </List>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

/** Tag filter per collection; outlives the screen so it's still there on return. */
const tagFilters = signal<Readonly<Record<string, string | null>>>({});

export function CollectionScreen({ params }: RouteProps) {
  const c = noteCollections.byId(params.id);
  if (!c) return <Page title={t('notes.collection')} back><EmptyState icon="notes" title={t('common.notFound')} /></Page>;

  const all = notesByCollection.value.get(c.id) ?? [];
  const tags = allTags(all);
  const saved = tagFilters.value[c.id] ?? null;
  const tag = saved && tags.includes(saved) ? saved : null;
  const list = sortNotes(tag ? all.filter((n) => n.tags.includes(tag)) : all, c.sort, c.fields);
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'updated', label: t('notes.sorts.updated') },
    { value: 'date', label: t('notes.sorts.date') },
    { value: 'title', label: t('notes.sorts.title') },
    ...c.fields.filter(isSortableField).map((f) => ({ value: `field:${f.id}` as SortMode, label: t('notes.sortBy', { name: f.name }) })),
  ];

  return (
    <Page
      title={c.name}
      back
      actions={
        <>
          <IconButton icon="settings" label={t('common.settings')} onClick={() => openCollectionForm(c)} />
          <IconButton icon="plus" label={t('notes.newNote')} variant="accent" onClick={() => createNote(c.id)} />
        </>
      }
    >
      <div class="tasks__filters">
        <ChoiceChips options={sortOptions} value={c.sort} onChange={(sort) => sort && noteCollections.update(c.id, { sort })} />
        {tags.length > 0 && <ChoiceChips allowNone options={tags.map((tg) => ({ value: tg, label: `#${tg}` }))} value={tag} onChange={(v) => (tagFilters.value = { ...tagFilters.value, [c.id]: v })} />}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={asIcon(c.icon)} title={t('notes.emptyCollection')} action={<Button variant="primary" icon="plus" onClick={() => createNote(c.id)}>{t('notes.newNote')}</Button>} />
      ) : (
        <div class="note-list">
          {list.map((n) => (
            <NoteRow key={n.id} note={n} collection={c} />
          ))}
        </div>
      )}
    </Page>
  );
}

/** Textarea that grows with its content. */
function AutoText({ value, onValue, placeholder }: { value: string; onValue: (v: string) => void; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapsing to "auto" shrinks the page for a moment and the browser clamps the scroll.
    const scroller = el.closest<HTMLElement>('.ui-page__content, .ui-sheet__body');
    const top = scroller?.scrollTop ?? 0;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    if (scroller) scroller.scrollTop = top;
  }, [value]);
  return <textarea ref={ref} class="note-body" value={value} placeholder={placeholder} onInput={(e) => onValue(e.currentTarget.value)} />;
}

export function NoteEditor({ params }: RouteProps) {
  const note = notes.byId(params.id);
  const [draft, setDraft] = useState(note);
  const [tagsText, setTagsText] = useState(note?.tags.join(', ') ?? '');
  // Created just to be edited here: dropped again if left empty.
  const [isNew] = useState(() => (note ? freshNotes.delete(note.id) : false));
  const latest = useRef(draft);
  latest.current = draft;
  const dirty = useRef(false);
  /** Deleted with the trash button: never write it back. */
  const deleted = useRef(false);
  /** Removed as empty while the app was hidden: re-created if typing resumes. */
  const autoRemoved = useRef(false);

  const save = (): void => {
    const d = latest.current;
    if (!d || !dirty.current || deleted.current) return;
    dirty.current = false;
    const { id, createdAt: _c, updatedAt: _u, ...data } = d;
    if (notes.get(id)) notes.update(id, data);
    else if (autoRemoved.current) {
      autoRemoved.current = false;
      notes.add({ ...data, id });
    }
  };
  /** On leaving (or the app going to the background, where iOS may kill it). */
  const flush = (): void => {
    const d = latest.current;
    if (d && isNew && !deleted.current && isNoteEmpty(d)) {
      dirty.current = false;
      if (notes.get(d.id)) {
        notes.remove(d.id);
        autoRemoved.current = true;
      }
    } else save();
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Autosave (debounced), only after an actual edit.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(save, 400);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const onHide = (): void => flushRef.current();
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      onHide();
    };
  }, []);

  // Render from the draft: the note itself may be gone for a moment (see `autoRemoved`).
  if (!draft) return <Page title={t('notes.title')} back><EmptyState icon="notes" title={t('common.notFound')} /></Page>;
  const c = noteCollections.get(draft.collectionId);
  const edit = (fn: (cur: Note) => Note): void => {
    dirty.current = true;
    setDraft((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      latest.current = next;
      return next;
    });
  };
  const patch = (p: Partial<Note>): void => edit((cur) => ({ ...cur, ...p }));
  const setValue = (fieldId: string, v: FieldValue): void => edit((cur) => ({ ...cur, values: { ...cur.values, [fieldId]: v } }));

  return (
    <Page
      title={c?.name ?? ''}
      back
      actions={
        <IconButton
          icon="trash"
          label={t('common.delete')}
          onClick={async () => {
            if (await confirm({ title: t('notes.deleteNote'), confirmLabel: t('common.delete'), danger: true })) {
              deleted.current = true;
              notes.remove(draft.id);
              goBack();
            }
          }}
        />
      }
    >
      <input class="note-title" value={draft.title} placeholder={t('notes.titlePlaceholder')} onInput={(e) => patch({ title: e.currentTarget.value })} />
      {c && c.fields.length > 0 && (
        <Card>
          <Form>
            {c.fields.map((f) => (
              <FieldInput key={f.id} field={f} value={draft.values[f.id] ?? null} onChange={(v) => setValue(f.id, v)} />
            ))}
          </Form>
        </Card>
      )}
      <AutoText value={draft.body} onValue={(body) => patch({ body })} placeholder={t('notes.bodyPlaceholder')} />
      <Section>
        <TextField label={t('notes.tags')} value={tagsText} placeholder={t('notes.tagsPlaceholder')} onValue={(v) => { setTagsText(v); patch({ tags: parseTags(v) }); }} autoCapitalize="off" />
        <DateField label={t('notes.date')} value={draft.date} onChange={(date) => date && patch({ date })} />
        <List>
          <ListRow icon="bookmark" title={t('notes.revisitSwitch')} trailing={<Switch label={t('notes.revisitSwitch')} checked={draft.revisit} onChange={(revisit) => patch({ revisit })} />} />
          <ListRow icon="pinned" title={t('notes.pinned')} trailing={<Switch label={t('notes.pinned')} checked={draft.pinned} onChange={(pinned) => patch({ pinned })} />} />
        </List>
      </Section>
    </Page>
  );
}

// ── Quick note ─────────────────────────────────────────────────────────────

const lastCollection = signal<string | null>(null);

export function QuickNote({ close }: QuickActionContext) {
  const cols = activeCollections.value;
  // The remembered collection may have been archived or deleted since.
  const [picked, setCollectionId] = useState<string | null>(() => (cols.some((c) => c.id === lastCollection.value) ? lastCollection.value : (cols[0]?.id ?? null)));
  const collectionId = picked && cols.some((c) => c.id === picked) ? picked : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  if (cols.length === 0) {
    return <EmptyState icon="notes" title={t('notes.noCollections')} action={<Button variant="primary" onClick={() => { close(); navigate('notes'); openCollectionForm(null); }}>{t('notes.newCollection')}</Button>} />;
  }
  return (
    <Form>
      <ChoiceChips options={cols.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))} value={collectionId} onChange={setCollectionId} />
      <TextField value={title} onValue={setTitle} placeholder={t('notes.titlePlaceholder')} autoFocus />
      <AutoText value={body} onValue={setBody} placeholder={t('notes.bodyPlaceholder')} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!collectionId || (!title.trim() && !body.trim())}
          feedback="success"
          onClick={() => {
            if (!collectionId) return;
            lastCollection.value = collectionId;
            notes.add({ collectionId, title: title.trim(), body, tags: [], date: today(), revisit: false, pinned: false, values: {} });
            toast(t('notes.saved'), { tone: 'success' });
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

