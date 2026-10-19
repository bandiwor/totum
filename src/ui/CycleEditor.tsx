import type { ComponentChildren } from 'preact';
import { cycleDayIndex, cycleDayLabel, resizeCycle, type Cycle } from '@/core/cycle';
import { startOfWeek, today } from '@/core/date';
import { Switch, NumberStepper } from './inputs';
import { DateField, Field } from './forms';
import { List, ListRow, Section } from './primitives';
import { t } from '@/core/i18n';

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
  title = t('cycle.daysTitle'),
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
      <Section title={t('cycle.repeat')}>
        <List>
          <ListRow
            title={t('cycle.byWeeks')}
            subtitle={cycle.weekAligned ? t('cycle.byWeeksOn') : t('cycle.byWeeksOff')}
            trailing={
              <Switch
                label={t('cycle.byWeeks')}
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
              label={t('cycle.weeks')}
              value={weeks}
              min={1}
              max={8}
              onChange={(w) => onChange(resizeCycle(cycle, w * 7, makeDay))}
            />
          ) : (
            <NumberStepper
              label={t('cycle.days')}
              value={cycle.days.length}
              min={1}
              max={60}
              onChange={(n) => onChange(resizeCycle(cycle, n, makeDay))}
            />
          )}
          <Field label={cycle.weekAligned ? t('cycle.weekOneStarts') : t('cycle.dayOneIs')}>
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
                  {i === todayIndex && <span class="cycle-editor__today">{t('cycle.todayMark')}</span>}
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
