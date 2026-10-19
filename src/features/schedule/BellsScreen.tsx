import { useState } from 'preact/hooks';
import { formatTime, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { Button, EmptyState, Form, List, ListRow, NumberStepper, openSheet, Page, Section, SheetActions, TimeField, TimeRange } from '@/ui';
import { bells, timetables, type BellSlot } from './model';

function setSlots(slots: BellSlot[]): void {
  bells.set({ slots: slots.map((s, i) => ({ ...s, n: i + 1 })) });
  syncTimetables();
}

/** Lessons tied to a bell number follow the new times. */
function syncTimetables(): void {
  const byN = new Map(bells.value.value.slots.map((s) => [s.n, s]));
  for (const t of timetables.all.value) {
    let changed = false;
    const days = t.cycle.days.map((day) =>
      day.map((l) => {
        const slot = l.bell !== null ? byN.get(l.bell) : undefined;
        if (!slot || (slot.start === l.start && slot.end === l.end)) return l;
        changed = true;
        return { ...l, start: slot.start, end: slot.end };
      }),
    );
    if (changed) timetables.update(t.id, { cycle: { ...t.cycle, days } });
  }
}

function SlotForm({ index, close }: { index: number; close: () => void }) {
  const slots = bells.value.value.slots;
  const slot = slots[index];
  const [start, setStart] = useState(slot?.start ?? 9 * 60);
  const [end, setEnd] = useState(slot?.end ?? 10 * 60 + 30);
  return (
    <Form>
      <TimeRange start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setSlots(slots.map((s, i) => (i === index ? { ...s, start, end } : s)));
            close();
          }}
        >
          Сохранить
        </Button>
        <Button
          variant="danger"
          block
          icon="trash"
          onClick={() => {
            setSlots(slots.filter((_, i) => i !== index));
            close();
          }}
        >
          Удалить
        </Button>
      </SheetActions>
    </Form>
  );
}

function GeneratorForm({ close }: { close: () => void }) {
  const [first, setFirst] = useState<Minutes>(8 * 60 + 30);
  const [count, setCount] = useState(6);
  const [length, setLength] = useState(90);
  const [pause, setPause] = useState(10);
  const [bigAfter, setBigAfter] = useState(3);
  const [bigPause, setBigPause] = useState(30);

  const preview: BellSlot[] = [];
  let t = first;
  for (let n = 1; n <= count && t + length <= 1440; n++) {
    preview.push({ n, start: t, end: t + length });
    t += length + (n === bigAfter ? bigPause : pause);
  }

  return (
    <Form>
      <TimeField label="Начало первой пары" value={first} onChange={setFirst} />
      <div class="ui-row2">
        <NumberStepper label="Пар" value={count} min={1} max={10} onChange={setCount} />
        <NumberStepper label="Длительность" value={length} step={5} min={20} max={240} unit="мин" onChange={setLength} />
      </div>
      <div class="ui-row2">
        <NumberStepper label="Перемена" value={pause} step={5} min={0} max={60} unit="мин" onChange={setPause} />
        <NumberStepper label="Большая после" value={bigAfter} min={0} max={count} unit="пары" onChange={setBigAfter} />
      </div>
      {bigAfter > 0 && <NumberStepper label="Большая перемена" value={bigPause} step={5} min={0} max={120} unit="мин" onChange={setBigPause} />}
      <div class="bells-preview num">
        {preview.map((s) => (
          <span key={s.n}>
            {s.n}) {formatTime(s.start)}–{formatTime(s.end)}
          </span>
        ))}
      </div>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setSlots(preview);
            haptic('success');
            close();
          }}
        >
          Применить
        </Button>
      </SheetActions>
    </Form>
  );
}

export function BellsScreen() {
  const slots = bells.value.value.slots;
  const addSlot = (): void => {
    const last = slots[slots.length - 1];
    const len = last ? last.end - last.start : 90;
    const start = last ? last.end + 10 : 9 * 60;
    if (start + len > 1440) return;
    setSlots([...slots, { n: slots.length + 1, start, end: start + len }]);
    haptic('light');
  };
  const openGenerator = () => void openSheet((close) => <GeneratorForm close={close} />, { title: 'Заполнить сетку' });

  return (
    <Page title="Сетка звонков" back>
      {slots.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Сетка не задана"
          text="Задай время пар один раз — потом в расписании выбираешь только номер."
          action={<Button variant="primary" onClick={openGenerator}>Заполнить</Button>}
        />
      ) : (
        <Section
          title="Пары"
          action={<Button size="sm" variant="ghost" onClick={openGenerator}>Заполнить заново</Button>}
        >
          <List>
            {slots.map((s, i) => (
              <ListRow
                key={s.n}
                title={`${s.n} пара`}
                value={`${formatTime(s.start)}–${formatTime(s.end)}`}
                chevron
                onClick={() => openSheet((close) => <SlotForm index={i} close={close} />, { title: `${s.n} пара` })}
              />
            ))}
          </List>
          <Button block icon="plus" onClick={addSlot}>
            Добавить пару
          </Button>
          <p class="settings__note">Пары в расписании, выбранные по номеру, сдвигаются вместе с сеткой.</p>
        </Section>
      )}
    </Page>
  );
}
