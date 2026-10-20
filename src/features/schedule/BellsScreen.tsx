import { useState } from 'preact/hooks';
import { formatDuration, formatTime, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { Button, EmptyState, Field, Form, List, ListRow, NumberStepper, openSheet, Page, Section, SheetActions, TimeField, TimeRange } from '@/ui';
import { bells, buildBells, type BellSlot } from './model';

function setSlots(slots: BellSlot[]): void {
  const sorted = [...slots].sort((a, b) => a.start - b.start);
  bells.set({ slots: sorted.map((s, i) => ({ ...s, n: i + 1 })) });
}

function SlotForm({ index, close }: { index: number; close: () => void }) {
  const slots = bells.value.value.slots;
  const slot = slots[index];
  const [start, setStart] = useState(slot?.start ?? 9 * 60);
  const [end, setEnd] = useState(slot?.end ?? 10 * 60 + 30);
  return (
    <Form>
      <TimeRange
        start={start}
        end={end}
        onChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
      />
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
          {t('common.save')}
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
          {t('common.delete')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function GeneratorForm({ close }: { close: () => void }) {
  const current = bells.value.value.slots;
  const [first, setFirst] = useState<Minutes>(current[0]?.start ?? 8 * 60 + 30);
  const [count, setCount] = useState(current.length || 6);
  const [length, setLength] = useState(current[0] ? current[0].end - current[0].start : 90);
  // Breaks of the existing grid are the starting point; new gaps default to 10 minutes.
  const [breaks, setBreaks] = useState<Minutes[]>(() =>
    Array.from({ length: 9 }, (_, i) => {
      const a = current[i];
      const b = current[i + 1];
      return a && b ? b.start - a.end : 10;
    }),
  );
  const preview = buildBells(first, count, length, breaks);

  return (
    <Form>
      <TimeField label={t('schedule.firstStart')} value={first} onChange={setFirst} />
      <div class="ui-row2">
        <NumberStepper label={t('schedule.pairsCount')} value={count} min={1} max={10} onChange={setCount} />
        <NumberStepper label={t('schedule.duration')} value={length} step={5} min={20} max={240} unit={t('units.min')} onChange={setLength} />
      </div>
      {count > 1 && (
        <Field label={t('schedule.breaks')}>
          <div class="bells-breaks">
            {Array.from({ length: count - 1 }, (_, i) => (
              <NumberStepper
                key={i}
                label={t('schedule.breakAfter', { n: i + 1 })}
                value={breaks[i] ?? 10}
                step={5}
                min={0}
                max={180}
                unit={t('units.min')}
                onChange={(v) => setBreaks((b) => b.map((x, j) => (j === i ? v : x)))}
              />
            ))}
          </div>
        </Field>
      )}
      <div class="bells-preview num">
        {preview.map((s) => (
          <span key={s.n}>
            {s.n}) {t('time.range', { from: formatTime(s.start), to: formatTime(s.end) })}
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
          {t('schedule.apply')}
        </Button>
      </SheetActions>
    </Form>
  );
}

export function BellsScreen() {
  const slots = bells.value.value.slots;
  const addSlot = (): void => {
    const last = slots[slots.length - 1];
    const prev = slots[slots.length - 2];
    const len = last ? last.end - last.start : 90;
    const gap = last && prev ? last.start - prev.end : 10;
    const start = last ? last.end + gap : 9 * 60;
    if (start + len > 1440) return;
    setSlots([...slots, { n: slots.length + 1, start, end: start + len }]);
    haptic('light');
  };
  const openGenerator = (): void => void openSheet((close) => <GeneratorForm close={close} />, { title: t('schedule.fillTitle') });

  return (
    <Page title={t('schedule.bells')} back>
      {slots.length === 0 ? (
        <EmptyState
          icon="clock"
          title={t('schedule.bellsEmpty')}
          text={t('schedule.bellsEmptyText')}
          action={<Button variant="primary" onClick={openGenerator}>{t('schedule.fill')}</Button>}
        />
      ) : (
        <Section title={t('schedule.pairs')} action={<Button size="sm" variant="ghost" onClick={openGenerator}>{t('schedule.refill')}</Button>}>
          <List>
            {slots.map((s, i) => {
              const prev = slots[i - 1];
              return (
                <ListRow
                  key={s.n}
                  title={t('schedule.lessonN', { n: s.n })}
                  {...(prev ? { subtitle: t('schedule.breakBefore', { duration: formatDuration(s.start - prev.end) }) } : {})}
                  value={t('time.range', { from: formatTime(s.start), to: formatTime(s.end) })}
                  chevron
                  onClick={() => openSheet((close) => <SlotForm index={i} close={close} />, { title: t('schedule.lessonN', { n: s.n }) })}
                />
              );
            })}
          </List>
          <Button block icon="plus" onClick={addSlot}>
            {t('schedule.addLesson')}
          </Button>
          <p class="settings__note">{t('schedule.bellsHint')}</p>
        </Section>
      )}
    </Page>
  );
}
