import { useState } from 'preact/hooks';
import { isISODate } from '@/core/date';
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
  SheetActions,
  Switch,
  TextField,
  type ColorKey,
  type IconName,
} from '@/ui';
import { FIELD_TYPES, noteCollections, notes, type FieldDef, type FieldType, type FieldValue, type NoteCollection } from './model';

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
      return <DateField label={field.name} value={typeof value === 'string' && isISODate(value) ? value : null} onChange={onChange} />;
    case 'number':
      return (
        <TextField
          label={field.name}
          inputMode="decimal"
          value={value === null || value === undefined ? '' : String(value)}
          onValue={(v) => {
            const n = Number(v.replace(',', '.'));
            onChange(v.trim() === '' ? null : Number.isFinite(n) ? n : value);
          }}
        />
      );
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

/** Compact read-only value for lists. */
export function fieldDisplay(field: FieldDef, value: FieldValue | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (field.type === 'checkbox') return value ? field.name : null;
  if (field.type === 'rating') return null;
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
      return [f('chapter', 'text')];
    case 'rated':
      return [f('rating', 'rating'), f('brand', 'text'), f('season', 'choice', t('notes.seasons').split(','))];
    case 'blank':
      return [];
  }
}

const TEMPLATE_ICONS: Record<Template, IconName> = { diary: 'moon', book: 'notes', rated: 'star', blank: 'bookmark' };

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
  const [name, setName] = useState(collection?.name ?? t('notes.templates.diary'));
  const [icon, setIcon] = useState(collection?.icon ?? 'moon');
  const [color, setColor] = useState<string>(collection?.color ?? 'c1');
  const [fields, setFields] = useState<FieldDef[]>(collection?.fields ?? templateFields('diary'));

  const pickTemplate = (tpl: Template): void => {
    setTemplate(tpl);
    setName(t(`notes.templates.${tpl}`));
    setIcon(TEMPLATE_ICONS[tpl]);
    setFields(templateFields(tpl));
  };

  const editField = (index: number | null): void => {
    const field = index === null ? null : (fields[index] ?? null);
    void openSheet(
      (c) => (
        <FieldForm
          field={field}
          onSave={(f) => setFields((cur) => (index === null ? [...cur, f] : cur.map((x, i) => (i === index ? f : x))))}
          {...(index !== null ? { onDelete: () => setFields((cur) => cur.filter((_, i) => i !== index)) } : {})}
          close={c}
        />
      ),
      { title: field ? field.name : t('notes.addField') },
    );
  };

  const save = (): void => {
    const data = { name: name.trim(), icon, color, fields };
    if (!data.name) return;
    if (collection) noteCollections.update(collection.id, data);
    else {
      const created = noteCollections.add({ ...data, sort: 'updated', archived: false });
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
          <List>
            {fields.map((f, i) => (
              <ListRow key={f.id} title={f.name} subtitle={t(`notes.fieldTypes.${f.type}`)} chevron onClick={() => editField(i)} />
            ))}
          </List>
        )}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => editField(null)}>
          {t('notes.addField')}
        </Button>
      </Field>
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
                for (const n of notes.all.value) if (n.collectionId === collection.id) notes.remove(n.id);
                noteCollections.remove(collection.id);
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

