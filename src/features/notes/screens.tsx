import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatDayMonth, today } from '@/core/date';
import { t } from '@/core/i18n';
import type { QuickActionContext, RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import { Button, Card, ChoiceChips, colorVar, confirm, DateField, EmptyState, Form, Icon, IconButton, List, ListRow, Page, Section, SheetActions, Switch, TextField, toast } from '@/ui';
import { asIcon, fieldDisplay, FieldInput, openCollectionForm, Stars } from './components';
import { allTags, parseTags, preview, searchNotes, sortNotes } from './logic';
import { activeCollections, noteCollections, notes, notesByCollection, revisitNotes, type Note, type NoteCollection, type SortMode } from './model';

function NoteRow({ note, collection, snippet }: { note: Note; collection?: NoteCollection | undefined; snippet?: string }) {
  const rating = collection?.fields.find((f) => f.type === 'rating');
  const ratingValue = rating ? note.values[rating.id] : undefined;
  const extras = (collection?.fields ?? []).map((f) => fieldDisplay(f, note.values[f.id])).filter(Boolean);
  const meta = [collection && !snippet ? null : collection?.name, formatDayMonth(note.date), ...extras, ...note.tags.map((tg) => `#${tg}`)].filter(Boolean).join(' · ');
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

function createNote(collectionId: string): void {
  const n = notes.add({ collectionId, title: '', body: '', tags: [], date: today(), revisit: false, pinned: false, values: {} });
  navigate(`notes/n/${n.id}`);
}

const query = signal('');

export function NotesHome() {
  const q = query.value.trim();
  const hits = q ? searchNotes(notes.all.value, q) : [];
  const revisit = revisitNotes.value;
  const cols = activeCollections.value;
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
            <Section title={t('notes.revisit')}>
              <div class="note-list">
                {revisit.slice(0, 5).map((n) => (
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
                {cols.map((c) => {
                  const count = notesByCollection.value.get(c.id)?.length ?? 0;
                  return (
                    <ListRow
                      key={c.id}
                      icon={asIcon(c.icon)}
                      iconColor={colorVar(c.color)}
                      title={c.name}
                      subtitle={count ? t('notes.count', { count }) : t('notes.empty')}
                      chevron
                      onClick={() => navigate(`notes/c/${c.id}`)}
                    />
                  );
                })}
              </List>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}

const tagFilter = signal<string | null>(null);

export function CollectionScreen({ params }: RouteProps) {
  const c = noteCollections.byId(params.id);
  useEffect(() => {
    tagFilter.value = null;
  }, [params.id]);
  if (!c) return <Page title={t('notes.collection')} back><EmptyState icon="notes" title={t('common.notFound')} /></Page>;

  const all = notesByCollection.value.get(c.id) ?? [];
  const tags = allTags(all);
  const tag = tagFilter.value;
  const list = sortNotes(tag ? all.filter((n) => n.tags.includes(tag)) : all, c.sort, c.fields);
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'updated', label: t('notes.sorts.updated') },
    { value: 'date', label: t('notes.sorts.date') },
    { value: 'title', label: t('notes.sorts.title') },
    ...c.fields.filter((f) => f.type === 'rating' || f.type === 'number').map((f) => ({ value: `field:${f.id}` as SortMode, label: t('notes.sortBy', { name: f.name }) })),
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
        {tags.length > 0 && <ChoiceChips allowNone options={tags.map((tg) => ({ value: tg, label: `#${tg}` }))} value={tag} onChange={(v) => (tagFilter.value = v)} />}
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
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} class="note-body" value={value} placeholder={placeholder} onInput={(e) => onValue(e.currentTarget.value)} />;
}

const isEmpty = (n: Pick<Note, 'title' | 'body' | 'values'>): boolean =>
  !n.title.trim() && !n.body.trim() && Object.values(n.values).every((v) => v === null || v === '' || v === false);

export function NoteEditor({ params }: RouteProps) {
  const note = notes.byId(params.id);
  const [draft, setDraft] = useState(note);
  const [tagsText, setTagsText] = useState(note?.tags.join(', ') ?? '');
  const latest = useRef(draft);
  latest.current = draft;

  // Autosave (debounced); an untouched empty note disappears when you leave.
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      const { id, createdAt: _c, updatedAt: _u, ...data } = draft;
      notes.update(id, data);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(
    () => () => {
      const d = latest.current;
      if (!d || !notes.get(d.id)) return;
      if (isEmpty(d)) notes.remove(d.id);
      else {
        const { id, createdAt: _c, updatedAt: _u, ...data } = d;
        notes.update(id, data);
      }
    },
    [],
  );

  if (!note || !draft) return <Page title={t('notes.title')} back><EmptyState icon="notes" title={t('common.notFound')} /></Page>;
  const c = noteCollections.get(note.collectionId);
  const patch = (p: Partial<Note>): void => setDraft((cur) => (cur ? { ...cur, ...p } : cur));

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
              notes.remove(note.id);
              history.back();
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
              <FieldInput key={f.id} field={f} value={draft.values[f.id] ?? null} onChange={(v) => patch({ values: { ...draft.values, [f.id]: v } })} />
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
  const [collectionId, setCollectionId] = useState<string | null>(lastCollection.value ?? cols[0]?.id ?? null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  if (cols.length === 0) {
    return <EmptyState icon="notes" title={t('notes.noCollections')} action={<Button variant="primary" onClick={() => { close(); navigate('notes'); }}>{t('notes.newCollection')}</Button>} />;
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

