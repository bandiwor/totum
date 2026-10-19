import { batch } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { formatDateLong, isISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { newId } from '@/core/id';
import { navigate } from '@/core/router';
import {
  Button,
  ChoiceChips,
  ColorPicker,
  confirm,
  DateField,
  Field,
  Form,
  Icon,
  List,
  ListRow,
  openSheet,
  ReorderList,
  SheetActions,
  Switch,
  TextField,
  type ColorKey,
  type IconName,
} from '@/ui';
import { dropValues, staleFieldIds, validSort } from './logic';
import { FIELD_TYPES, noteCollections, notes, type FieldDef, type FieldType, type FieldValue, type NoteCollection, type SortMode } from './model';

export const COLLECTION_ICONS: readonly IconName[] = ['notes', 'star', 'bookmark', 'sparkles', 'health', 'moon', 'tag', 'utensils', 'dumbbell', 'coins'];

export const asIcon = (name: string): IconName => (COLLECTION_ICONS as readonly string[]).includes(name) ? (name as IconName) : 'notes';

// ── Rating ─────────────────────────────────────────────────────────────────

export function Stars({ value, onChange, size = 26 }: { value: number; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <span class={onChange ? 'stars stars--input' : 'stars'} aria-label={t('notes.ratingN', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            class={n <= value ? 'is-on' : undefined}
            onClick={() => {
              haptic('selection');
              onChange(n === value ? null : n);
            }}
          >
            <Icon name="star" size={size} />
          </button>
        ) : (
          <span key={n} class={n <= value ? 'is-on' : undefined}>
            <Icon name="star" size={size} />
          </span>
        ),
      )}
    </span>
  );
}

// ── One custom field as an input ───────────────────────────────────────────

export function FieldInput({ field, value, onChange }: { field: FieldDef; value: FieldValue; onChange: (v: FieldValue) => void }) {
  switch (field.type) {
    case 'rating':
      return (
        <Field label={field.name}>
          <Stars value={typeof value === 'number' ? value : 0} onChange={onChange} />
        </Field>
      );
    case 'choice':
      return (
        <Field label={field.name}>
          <ChoiceChips allowNone options={field.options.map((o) => ({ value: o, label: o }))} value={typeof value === 'string' ? value : null} onChange={onChange} />
        </Field>
      );
    case 'checkbox':
      return (
        <List>
          <ListRow title={field.name} trailing={<Switch label={field.name} checked={value === true} onChange={onChange} />} />
        </List>
      );
    case 'date':
      return <DateField clearable label={field.name} value={typeof value === 'string' && isISODate(value) ? value : null} onChange={onChange} />;
    case 'number':
      return <NumberInput label={field.name} value={typeof value === 'number' ? value : null} onChange={onChange} />;
    case 'link':
      return (
        <div class="note-link">
          <TextField label={field.name} type="url" inputMode="url" value={typeof value === 'string' ? value : ''} onValue={(v) => onChange(v.trim() ? v : null)} />
          {typeof value === 'string' && /^https?:\/\//.test(value) && (
            <a class="ui-btn ui-btn--ghost ui-btn--sm" href={value} target="_blank" rel="noreferrer">
              <Icon name="link" size={18} />
              <span>{t('notes.openLink')}</span>
            </a>
          )}
        </div>
      );
    case 'text':
      return <TextField label={field.name} value={typeof value === 'string' ? value : ''} onValue={(v) => onChange(v.trim() ? v : null)} />;
  }
}

/** "4,5" → 4.5, "" → null, "-" / "4.5.1" → undefined (not a number yet). */
const parseNumber = (raw: string): number | null | undefined => {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** Keeps the raw text so half-typed numbers ("4,", "-") survive re-renders. */
function NumberInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [raw, setRaw] = useState(value === null ? '' : String(value));
  // Follow outside changes, but not our own echo of what's typed.
  useEffect(() => {
    if (parseNumber(raw) !== value) setRaw(value === null ? '' : String(value));
  }, [value]);
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={raw}
      onValue={(v) => {
        setRaw(v);
        const n = parseNumber(v);
        if (n !== undefined && n !== value) onChange(n);
      }}
    />
  );
}

/** Compact read-only value for lists. */
export function fieldDisplay(field: FieldDef, value: FieldValue | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (field.type === 'checkbox') return value ? field.name : null;
  if (field.type === 'rating') return null;
  if (field.type === 'date' && typeof value === 'string' && isISODate(value)) return formatDateLong(value);
  return String(value);
}

// ── Collection form ────────────────────────────────────────────────────────

type Template = 'blank' | 'diary' | 'book' | 'rated';
const TEMPLATES: readonly Template[] = ['diary', 'book', 'rated', 'blank'];

function templateFields(tpl: Template): FieldDef[] {
  const f = (key: 'mood' | 'chapter' | 'author' | 'rating' | 'brand' | 'season', type: FieldType, options: string[] = []): FieldDef => ({
    id: newId(),
    name: t(`notes.templateFields.${key}`),
    type,
    options,
  });
  switch (tpl) {
    case 'diary':
      return [f('mood', 'rating')];
    case 'book':
      return [f('author', 'text'), f('chapter', 'text'), f('rating', 'rating')];
    case 'rated':
      return [f('rating', 'rating'), f('brand', 'text'), f('season', 'choice', t('notes.seasons').split(','))];
    case 'blank':
      return [];
  }
}

const TEMPLATE_ICONS: Record<Template, IconName> = { diary: 'moon', book: 'notes', rated: 'star', blank: 'bookmark' };

/** The name a template suggests; a blank collection starts unnamed. */
const templateName = (tpl: Template): string => (tpl === 'blank' ? '' : t(`notes.templates.${tpl}`));

function FieldForm({ field, onSave, onDelete, close }: { field: FieldDef | null; onSave: (f: FieldDef) => void; onDelete?: () => void; close: () => void }) {
  const [name, setName] = useState(field?.name ?? '');
  const [type, setType] = useState<FieldType>(field?.type ?? 'text');
  const [options, setOptions] = useState((field?.options ?? []).join(', '));
  return (
    <Form>
      <TextField label={t('notes.fieldName')} value={name} onValue={setName} autoFocus={!field} />
      <Field label={t('notes.fieldType')}>
        <ChoiceChips options={FIELD_TYPES.map((ft) => ({ value: ft, label: t(`notes.fieldTypes.${ft}`) }))} value={type} onChange={(v) => v && setType(v)} />
      </Field>
      {type === 'choice' && <TextField label={t('notes.options')} value={options} onValue={setOptions} placeholder={t('notes.optionsPlaceholder')} />}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim() || (type === 'choice' && !options.trim())}
          onClick={() => {
            onSave({
              id: field?.id ?? newId(),
              name: name.trim(),
              type,
              options: type === 'choice' ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
            });
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {onDelete && (
          <Button variant="danger" block icon="trash" onClick={() => { onDelete(); close(); }}>
            {t('notes.deleteField')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

function CollectionForm({ collection, close }: { collection: NoteCollection | null; close: () => void }) {
  const [template, setTemplate] = useState<Template>('diary');
  const [name, setName] = useState(collection?.name ?? templateName('diary'));
  const [icon, setIcon] = useState(collection?.icon ?? 'moon');
  const [color, setColor] = useState<string>(collection?.color ?? 'c1');
  const [fields, setFields] = useState<FieldDef[]>(collection?.fields ?? templateFields('diary'));
  const [archived, setArchived] = useState(collection?.archived ?? false);

  const pickTemplate = (tpl: Template): void => {
    setTemplate(tpl);
    // Keep a name the user typed; replace only the previous template's suggestion.
    setName((cur) => (!cur.trim() || cur === templateName(template) ? templateName(tpl) : cur));
    setIcon(TEMPLATE_ICONS[tpl]);
    setFields(templateFields(tpl));
  };

  const editField = (field: FieldDef | null): void => {
    void openSheet(
      (c) => (
        <FieldForm
          field={field}
          onSave={(f) => setFields((cur) => (field ? cur.map((x) => (x.id === f.id ? f : x)) : [...cur, f]))}
          {...(field ? { onDelete: () => setFields((cur) => cur.filter((x) => x.id !== field.id)) } : {})}
          close={c}
        />
      ),
      { title: field ? field.name : t('notes.addField') },
    );
  };

  const save = (): void => {
    const data = { name: name.trim(), icon, color, fields, archived };
    if (!data.name) return;
    if (collection) {
      // Values of removed or retyped fields would linger unseen (and break sorting).
      const stale = staleFieldIds(collection.fields, fields);
      const sort = validSort(collection.sort, fields);
      batch(() => {
        noteCollections.update(collection.id, sort === collection.sort ? data : { ...data, sort });
        if (stale.length === 0) return;
        for (const n of notes.all.value) {
          if (n.collectionId !== collection.id) continue;
          const values = dropValues(n.values, stale);
          if (values) notes.update(n.id, { values });
        }
      });
    } else {
      const sort: SortMode = template === 'diary' ? 'date' : 'updated';
      const created = noteCollections.add({ ...data, sort });
      close();
      navigate(`notes/c/${created.id}`);
      return;
    }
    haptic('success');
    close();
  };

  return (
    <Form>
      {!collection && (
        <Field label={t('notes.template')}>
          <ChoiceChips options={TEMPLATES.map((tpl) => ({ value: tpl, label: t(`notes.templates.${tpl}`) }))} value={template} onChange={(v) => v && pickTemplate(v)} />
        </Field>
      )}
      <TextField label={t('common.name')} value={name} onValue={setName} />
      <Field label={t('notes.icon')}>
        <div class="icon-picker">
          {COLLECTION_ICONS.map((ic) => (
            <button key={ic} type="button" class={ic === icon ? 'is-selected' : undefined} aria-label={ic} onClick={() => { haptic('selection'); setIcon(ic); }}>
              <Icon name={ic} size={22} />
            </button>
          ))}
        </div>
      </Field>
      <ColorPicker value={color} onChange={(c: ColorKey) => setColor(c)} />
      <Field label={t('notes.fields')} hint={t('notes.fieldsHint')}>
        {fields.length > 0 && (
          <ReorderList
            items={fields}
            keyOf={(f) => f.id}
            gripLabel={t('common.reorder')}
            onReorder={(ids) => setFields((cur) => ids.map((id) => cur.find((f) => f.id === id)).filter((f): f is FieldDef => !!f))}
            render={(f) => <ListRow title={f.name} subtitle={t(`notes.fieldTypes.${f.type}`)} onClick={() => editField(f)} />}
          />
        )}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => editField(null)}>
          {t('notes.addField')}
        </Button>
      </Field>
      {collection && (
        <List>
          <ListRow title={t('common.archived')} subtitle={t('notes.archivedHint')} trailing={<Switch label={t('common.archive')} checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {collection && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('notes.deleteCollection'), message: t('notes.deleteCollectionText'), confirmLabel: t('common.delete'), danger: true })) {
                batch(() => {
                  for (const n of notes.all.value) if (n.collectionId === collection.id) notes.remove(n.id);
                  noteCollections.remove(collection.id);
                });
                close();
                navigate('notes', { replace: true });
              }
            }}
          >
            {t('notes.deleteCollection')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openCollectionForm(collection: NoteCollection | null): void {
  void openSheet((close) => <CollectionForm collection={collection} close={close} />, { title: collection ? collection.name : t('notes.newCollection') });
}

