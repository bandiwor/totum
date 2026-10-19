import { useState } from 'preact/hooks';
import { formatTime, today, type ISODate, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import {
  Button,
  Checkbox,
  ChoiceChips,
  confirm,
  EmptyState,
  Field,
  Form,
  IconButton,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  Page,
  ProgressBar,
  Section,
  SheetActions,
  Switch,
  TextField,
  TimeField,
} from '@/ui';
import { addWater, toggleIntake, undoWater, waterTarget } from './actions';
import { DOSE_UNITS, intakeItems, intakeLog, intakeSlots, waterOn, type DoseUnit, type IntakeItem, type IntakeKind } from './model';

const KINDS: readonly IntakeKind[] = ['supplement', 'medication', 'other'];

export function doseLine(item: IntakeItem): string {
  return t('nutrition.doseLine', { dose: item.dose, unit: t(`nutrition.doseUnits.${item.unit}`) });
}

function scheduleLine(item: IntakeItem): string {
  return t('nutrition.scheduleLine', {
    times: item.times.map(formatTime).join(', '),
    every: item.everyDays === 1 ? t('nutrition.daily') : t('nutrition.everyN', { n: item.everyDays }),
  });
}

function IntakeForm({ item, close }: { item: IntakeItem | null; close: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<IntakeKind>(item?.kind ?? 'supplement');
  const [dose, setDose] = useState(item?.dose ?? 1);
  const [unit, setUnit] = useState<DoseUnit>(item?.unit ?? 'g');
  const [times, setTimes] = useState<Minutes[]>(item?.times ?? [9 * 60]);
  const [everyDays, setEveryDays] = useState(item?.everyDays ?? 1);
  const [archived, setArchived] = useState(item?.archived ?? false);

  const save = (): void => {
    const data = { name: name.trim(), kind, dose, unit, times: [...times].sort((a, b) => a - b), everyDays, archived };
    if (!data.name || data.times.length === 0) return;
    if (item) intakeItems.update(item.id, data);
    else intakeItems.add({ ...data, anchor: today() });
    haptic('success');
    close();
  };

  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} placeholder={t('nutrition.intakeNamePlaceholder')} autoFocus={!item} />
      <Field label={t('nutrition.kind')}>
        <ChoiceChips options={KINDS.map((k) => ({ value: k, label: t(`nutrition.kinds.${k}`) }))} value={kind} onChange={(k) => k && setKind(k)} />
      </Field>
      <NumberStepper label={t('nutrition.dose')} value={dose} step={unit === 'mg' || unit === 'mcg' || unit === 'iu' ? 50 : 1} precision={2} min={0} onChange={setDose} />
      <Field label={t('nutrition.doseUnit')}>
        <ChoiceChips options={DOSE_UNITS.map((u) => ({ value: u, label: t(`nutrition.doseUnits.${u}`) }))} value={unit} onChange={(u) => u && setUnit(u)} />
      </Field>
      <Field label={t('nutrition.times')}>
        <div class="intake-times">
          {times.map((time, i) => (
            <div key={i} class="intake-times__row">
              <TimeField value={time} onChange={(v) => setTimes(times.map((x, j) => (j === i ? v : x)))} />
              {times.length > 1 && <IconButton icon="x" label={t('common.delete')} onClick={() => setTimes(times.filter((_, j) => j !== i))} />}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setTimes([...times, Math.min(1439, (times[times.length - 1] ?? 9 * 60) + 4 * 60)])}>
            {t('nutrition.addTime')}
          </Button>
        </div>
      </Field>
      <NumberStepper label={t('nutrition.everyDays')} value={everyDays} min={1} max={30} onChange={setEveryDays} />
      <p class="sheet-note">{t('nutrition.everyDaysHint')}</p>
      {item && (
        <List>
          <ListRow title={t('common.archived')} trailing={<Switch label={t('common.archive')} checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {item && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('schedule.deleteNamed', { name: item.name }), confirmLabel: t('common.delete'), danger: true })) {
                for (const e of intakeLog.all.value) if (e.itemId === item.id) intakeLog.remove(e.id);
                intakeItems.remove(item.id);
                close();
              }
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openIntakeForm(item: IntakeItem | null): void {
  void openSheet((close) => <IntakeForm item={item} close={close} />, { title: item ? item.name : t('nutrition.newIntake') });
}

export function IntakeScreen() {
  const list = [...intakeItems.all.value].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru'));
  return (
    <Page title={t('nutrition.intakeItems')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openIntakeForm(null)} />}>
      {list.length === 0 ? (
        <EmptyState icon="pill" title={t('nutrition.noIntake')} text={t('nutrition.noIntakeText')} action={<Button variant="primary" icon="plus" onClick={() => openIntakeForm(null)}>{t('common.add')}</Button>} />
      ) : (
        <Section>
          <List>
            {list.map((i) => (
              <ListRow
                key={i.id}
                icon="pill"
                title={i.archived ? t('common.archivedSuffix', { name: i.name }) : `${i.name} · ${doseLine(i)}`}
                subtitle={`${t(`nutrition.kinds.${i.kind}`)} · ${scheduleLine(i)}`}
                chevron
                onClick={() => openIntakeForm(i)}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}

/** Water progress with quick buttons. Shared by the tab, the Today widget and the quick menu. */
export function WaterControl({ date }: { date: ISODate }) {
  const ml = waterOn(date);
  const goal = waterTarget();
  return (
    <div class="water">
      <div class="water__head">
        <span>{t('nutrition.water')}</span>
        <span class="num">{t('nutrition.waterOf', { ml, target: goal })}</span>
      </div>
      <ProgressBar value={ml} max={goal} color="var(--c-5)" />
      <div class="water__buttons">
        {[150, 250, 500].map((v) => (
          <Button key={v} size="sm" onClick={() => addWater(date, v)}>
            {t('nutrition.addWater', { ml: v })}
          </Button>
        ))}
        {ml > 0 && <IconButton icon="history" label={t('nutrition.removeLastWater')} onClick={() => undoWater(date)} />}
      </div>
    </div>
  );
}

/** Today's scheduled intakes as a checklist. */
export function IntakeChecklist({ date }: { date: ISODate }) {
  const slots = intakeSlots(date);
  if (slots.length === 0) return <p class="widget-empty">{t('nutrition.noIntakeToday')}</p>;
  return (
    <List>
      {slots.map((s) => (
        <ListRow
          key={`${s.item.id}-${s.slot}`}
          leading={<Checkbox checked={!!s.entry} label={s.item.name} onChange={() => toggleIntake(date, s)} />}
          title={s.item.name}
          subtitle={`${formatTime(s.time)} · ${doseLine(s.item)}`}
        />
      ))}
    </List>
  );
}
