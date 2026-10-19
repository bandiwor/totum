import type { ComponentChildren } from 'preact';
import { cycleDayIndex, cycleDayLabel, resizeCycle, type Cycle } from '@/core/cycle';
import { startOfWeek, today } from '@/core/date';
import { Switch, NumberStepper } from './inputs';
import { DateField, Field } from './forms';
import { List, ListRow, Section } from './primitives';

/**
 * One editor for every repeating template: timetable, work shifts, training
 * program, meal plan. The caller renders day summaries and opens day editors.
 */
export function CycleEditor<TDay>({
  cycle,
  onChange,
  makeDay,
  summary,
  onOpenDay,
  title = 'Дни цикла',
}: {
  cycle: Cycle<TDay>;
  onChange: (cycle: Cycle<TDay>) => void;
  makeDay: () => TDay;
  summary: (day: TDay, index: number) => ComponentChildren;
  onOpenDay: (index: number) => void;
  title?: string;
}) {
  const todayIndex = cycleDayIndex(cycle, today());
  const weeks = cycle.weekAligned ? Math.max(1, Math.round(cycle.days.length / 7)) : 0;

  return (
    <>
      <Section title="Повтор">
        <List>
          <ListRow
            title="По неделям"
            subtitle={cycle.weekAligned ? 'Дни подписаны Пн–Вс' : 'Цикл из любого числа дней'}
            trailing={
              <Switch
                label="По неделям"
                checked={cycle.weekAligned}
                onChange={(on) => {
                  const length = on ? Math.max(7, Math.round(cycle.days.length / 7) * 7) : cycle.days.length;
                  const resized = resizeCycle(cycle, length, makeDay);
                  onChange({ ...resized, weekAligned: on, anchor: on ? startOfWeek(cycle.anchor) : cycle.anchor });
                }}
              />
            }
          />
        </List>
        <div class="cycle-editor__controls">
          {cycle.weekAligned ? (
            <NumberStepper
              label="Недель в цикле"
              value={weeks}
              min={1}
              max={8}
              onChange={(w) => onChange(resizeCycle(cycle, w * 7, makeDay))}
            />
          ) : (
            <NumberStepper
              label="Дней в цикле"
              value={cycle.days.length}
              min={1}
              max={60}
              onChange={(n) => onChange(resizeCycle(cycle, n, makeDay))}
            />
          )}
          <Field label={cycle.weekAligned ? 'Неделя 1 начинается' : 'День 1 приходится на'}>
            <DateField
              value={cycle.anchor}
              onChange={(d) => d && onChange({ ...cycle, anchor: cycle.weekAligned ? startOfWeek(d) : d })}
            />
          </Field>
        </div>
      </Section>

      <Section title={title}>
        <List>
          {cycle.days.map((day, i) => (
            <ListRow
              key={i}
              title={
                <>
                  {cycleDayLabel(cycle, i)}
                  {i === todayIndex && <span class="cycle-editor__today"> · сегодня</span>}
                </>
              }
              subtitle={summary(day, i)}
              chevron
              onClick={() => onOpenDay(i)}
            />
          ))}
        </List>
      </Section>
    </>
  );
}
