import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { Button, ColorPicker, colorVar, Field, Form, IconButton, List, ListRow, openSheet, Page, Section, SheetActions, TextField, type ColorKey } from '@/ui';
import { lessonTypes, sortedLessonTypes, timetables, type LessonType } from './model';

function TypeForm({ type, close }: { type: LessonType | null; close: () => void }) {
  const [name, setName] = useState(type?.name ?? '');
  const [short, setShort] = useState(type?.short ?? '');
  const [color, setColor] = useState<string>(type?.color ?? 'c6');
  const used = type ? timetables.all.value.some((t) => t.cycle.days.some((d) => d.some((l) => l.typeId === type.id))) : false;

  const save = (): void => {
    const data = { name: name.trim(), short: short.trim() || name.trim().slice(0, 3), color };
    if (!data.name) return;
    if (type) lessonTypes.update(type.id, data);
    else lessonTypes.add({ ...data, order: lessonTypes.all.value.length });
    haptic('success');
    close();
  };

  return (
    <Form>
      <TextField label="Название" value={name} onValue={setName} placeholder="Коллоквиум" autoFocus={!type} />
      <TextField label="Сокращение" value={short} onValue={setShort} placeholder="Кол" maxLength={5} />
      <Field label="Цвет">
        <ColorPicker value={color} onChange={(c: ColorKey) => setColor(c)} />
      </Field>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          Сохранить
        </Button>
        {type && !used && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={() => {
              lessonTypes.remove(type.id);
              close();
            }}
          >
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

const openForm = (type: LessonType | null) =>
  void openSheet((close) => <TypeForm type={type} close={close} />, { title: type ? type.name : 'Новый тип' });

function move(type: LessonType, dir: -1 | 1): void {
  const list = sortedLessonTypes.value;
  const i = list.findIndex((t) => t.id === type.id);
  const other = list[i + dir];
  if (!other) return;
  lessonTypes.update(type.id, { order: other.order });
  lessonTypes.update(other.id, { order: type.order });
}

export function TypesScreen() {
  const list = sortedLessonTypes.value;
  return (
    <Page title="Типы пар" back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openForm(null)}>Новый</Button>}>
      <Section>
        <List>
          {list.map((t, i) => (
            <ListRow
              key={t.id}
              leading={<span class="color-dot" style={{ background: colorVar(t.color) }} />}
              title={t.name}
              subtitle={t.short}
              trailing={
                <span class="reorder">
                  <IconButton icon="chevronDown" label="Ниже" disabled={i === list.length - 1} onClick={(e) => { e.stopPropagation(); move(t, 1); }} />
                </span>
              }
              onClick={() => openForm(t)}
            />
          ))}
        </List>
      </Section>
    </Page>
  );
}
