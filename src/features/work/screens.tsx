import { useState } from 'preact/hooks';
import { cycleDayLabel } from '@/core/cycle';
import { formatDuration, formatRelativeDay, formatTime, startOfWeek, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { newId } from '@/core/id';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import { PlacePicker } from '@/features/places/PlacePicker';
import {
  Badge,
  Button,
  ChoiceChips,
  ColorPicker,
  colorVar,
  confirm,
  CycleEditor,
  EmptyState,
  Field,
  Form,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  Page,
  Section,
  SheetActions,
  Switch,
  TextField,
  TimeRange,
  type ColorKey,
} from '@/ui';
import { activeJobs, jobs, PAY_LABELS, shiftOverrides, shiftsFor, type Job, type PayType, type ShiftData, type TemplateShift } from './model';

function createJob(): void {
  const job = jobs.add({ name: 'Работа', color: 'c7', placeId: null, payType: 'hour', rate: 0, archived: false, cycle: null });
  navigate(`plan/work/${job.id}`);
}

export function JobsScreen() {
  const list = jobs.all.value;
  return (
    <Page title="Работа" back actions={<Button size="sm" variant="ghost" icon="plus" onClick={createJob}>Новая</Button>}>
      {list.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title="Работы нет"
          text="Смены попадут в расписание дня, дорога и свободное время посчитаются автоматически."
          action={<Button variant="primary" icon="plus" onClick={createJob}>Добавить</Button>}
        />
      ) : (
        <Section>
          <List>
            {list.map((j) => (
              <ListRow
                key={j.id}
                leading={<span class="color-dot" style={{ background: colorVar(j.color) }} />}
                title={j.name}
                subtitle={j.rate > 0 ? `${j.rate} ${PAY_LABELS[j.payType]}` : 'Ставка не указана'}
                trailing={j.archived ? <Badge>Архив</Badge> : undefined}
                chevron
                onClick={() => navigate(`plan/work/${j.id}`)}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}

function shiftsSummary(day: TemplateShift[]): string {
  if (day.length === 0) return 'Выходной';
  return [...day].sort((a, b) => a.start - b.start).map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`).join(', ');
}

export function JobEditor({ params }: RouteProps) {
  const job = jobs.byId(params.id);
  if (!job) return <Page title="Работа" back><EmptyState icon="briefcase" title="Не найдено" /></Page>;
  const patch = (p: Partial<Job>): void => void jobs.update(job.id, p);

  const remove = async (): Promise<void> => {
    if (await confirm({ title: `Удалить «${job.name}»?`, message: 'Можно вместо этого отправить в архив.', confirmLabel: 'Удалить', danger: true })) {
      jobs.remove(job.id);
      navigate('plan/work', { replace: true });
    }
  };

  return (
    <Page title={job.name} back>
      <Section>
        <Form>
          <TextField label="Название" value={job.name} onValue={(name) => patch({ name })} />
          <Field label="Цвет">
            <ColorPicker value={job.color} onChange={(color: ColorKey) => patch({ color })} />
          </Field>
          <Field label="Место" hint="Для расчёта дороги">
            <PlacePicker value={job.placeId} onChange={(placeId) => patch({ placeId })} />
          </Field>
          <Field label="Оплата">
            <ChoiceChips
              options={(Object.keys(PAY_LABELS) as PayType[]).map((p) => ({ value: p, label: PAY_LABELS[p] }))}
              value={job.payType}
              onChange={(payType) => payType && patch({ payType })}
            />
          </Field>
          <NumberStepper label="Ставка" value={job.rate} step={job.payType === 'hour' ? 50 : 500} min={0} onChange={(rate) => patch({ rate })} />
        </Form>
      </Section>

      <Section title="Регулярные смены">
        <List>
          <ListRow
            title="По графику"
            subtitle={job.cycle ? 'Смены повторяются по циклу' : 'Только разовые смены'}
            trailing={
              <Switch
                label="По графику"
                checked={job.cycle !== null}
                onChange={(on) =>
                  patch({ cycle: on ? { anchor: startOfWeek(today()), days: Array.from({ length: 7 }, () => []), weekAligned: true } : null })
                }
              />
            }
          />
        </List>
      </Section>
      {job.cycle && (
        <CycleEditor
          cycle={job.cycle}
          onChange={(cycle) => patch({ cycle })}
          makeDay={() => []}
          summary={(day) => shiftsSummary(day)}
          onOpenDay={(i) => navigate(`plan/work/${job.id}/day/${i}`)}
          title="Смены по дням"
        />
      )}

      <Section>
        <List>
          <ListRow title="В архиве" subtitle="Смены не показываются" trailing={<Switch label="Архив" checked={job.archived} onChange={(archived) => patch({ archived })} />} />
        </List>
        <Button variant="danger" block icon="trash" onClick={() => void remove()}>
          Удалить
        </Button>
      </Section>
    </Page>
  );
}

function ShiftTimeForm({
  initial,
  onSave,
  onDelete,
  saveLabel = 'Сохранить',
  jobChoice = false,
  close,
}: {
  initial: ShiftData;
  onSave: (data: ShiftData) => void;
  onDelete?: () => void;
  saveLabel?: string;
  jobChoice?: boolean;
  close: () => void;
}) {
  const [d, setD] = useState(initial);
  return (
    <Form>
      {jobChoice && (
        <Field label="Работа">
          <ChoiceChips
            options={activeJobs.value.map((j) => ({ value: j.id, label: j.name, color: colorVar(j.color) }))}
            value={d.jobId}
            onChange={(jobId) => jobId && setD({ ...d, jobId })}
          />
        </Field>
      )}
      <TimeRange start={d.start} end={d.end} onChange={(start, end) => setD({ ...d, start, end })} />
      <p class="sheet-note">Длительность: {formatDuration(d.end - d.start)}</p>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!d.jobId || d.end <= d.start}
          feedback={false}
          onClick={() => {
            haptic('success');
            onSave(d);
            close();
          }}
        >
          {saveLabel}
        </Button>
        {onDelete && (
          <Button variant="danger" block icon="trash" onClick={() => { onDelete(); close(); }}>
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function JobDayEditor({ params }: RouteProps) {
  const job = jobs.byId(params.id);
  const index = Number(params.index);
  const day = job?.cycle?.days[index];
  if (!job?.cycle || !day) return <Page title="День" back><EmptyState icon="briefcase" title="Не найдено" /></Page>;
  const cycle = job.cycle;

  const setDay = (next: TemplateShift[]): void =>
    void jobs.update(job.id, { cycle: { ...cycle, days: cycle.days.map((d, i) => (i === index ? next : d)) } });

  const open = (shift: TemplateShift | null) =>
    void openSheet(
      (close) => (
        <ShiftTimeForm
          initial={shift ?? { jobId: job.id, start: 9 * 60, end: 18 * 60 }}
          onSave={(data) => (shift ? setDay(day.map((s) => (s.id === shift.id ? { ...data, id: s.id } : s))) : setDay([...day, { ...data, id: newId() }]))}
          {...(shift ? { onDelete: () => setDay(day.filter((s) => s.id !== shift.id)) } : {})}
          close={close}
        />
      ),
      { title: shift ? 'Смена' : 'Новая смена' },
    );

  return (
    <Page title={cycleDayLabel(cycle, index)} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => open(null)}>Смена</Button>}>
      {day.length === 0 ? (
        <EmptyState icon="sparkles" title="Выходной" action={<Button variant="primary" icon="plus" onClick={() => open(null)}>Добавить смену</Button>} />
      ) : (
        <Section>
          <List>
            {[...day].sort((a, b) => a.start - b.start).map((s) => (
              <ListRow key={s.id} icon="briefcase" title={`${formatTime(s.start)}–${formatTime(s.end)}`} value={formatDuration(s.end - s.start)} onClick={() => open(s)} />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}

// ── Dated shifts (from the day timeline) ───────────────────────────────────

export function openShiftSheet(date: ISODate, key: string): void {
  const shift = shiftsFor(date).find((s) => s.key === key);
  if (!shift) return;
  openSheet(
    (close) => (
      <>
        <p class="sheet-note">
          {formatRelativeDay(date)} · {formatTime(shift.data.start)}–{formatTime(shift.data.end)}
          {shift.modified ? ' · изменена' : ''}
        </p>
        <ShiftTimeForm
          initial={shift.data}
          saveLabel="Сохранить на этот день"
          onSave={(data) => shiftOverrides.modify(date, key, data)}
          onDelete={() => shiftOverrides.cancel(date, key)}
          close={close}
        />
        {shift.modified && (
          <Button block variant="ghost" icon="history" onClick={() => { shiftOverrides.reset(date, key); close(); }}>
            Вернуть как в графике
          </Button>
        )}
      </>
    ),
    { title: shift.job?.name ?? 'Смена' },
  );
}

export function openAddShift(date: ISODate): void {
  const job = activeJobs.value[0];
  if (!job) {
    navigate('plan/work');
    return;
  }
  openSheet(
    (close) => (
      <ShiftTimeForm
        initial={{ jobId: job.id, start: 9 * 60, end: 18 * 60 }}
        jobChoice={activeJobs.value.length > 1}
        saveLabel="Добавить смену"
        onSave={(data) => shiftOverrides.add(date, data)}
        close={close}
      />
    ),
    { title: 'Разовая смена' },
  );
}
