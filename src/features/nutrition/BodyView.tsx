import { useState } from 'preact/hooks';
import { formatDayMonth, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import {
  Button,
  Card,
  ChoiceChips,
  DateField,
  EmptyState,
  Field,
  Form,
  LineChart,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  Section,
  SheetActions,
  Stat,
  Switch,
  toast,
} from '@/ui';
import { fmtG, fmtKcal, fmtKg, targets } from './actions';
import { bodyProfile, setWeight, weightLog, weightsByDate, type Activity, type BodyProfile, type GoalType, type Macros, type Sex } from './model';
import { weightTrend } from './targets';

const SEXES: readonly Sex[] = ['male', 'female'];
const ACTIVITIES: readonly Activity[] = ['sedentary', 'light', 'moderate', 'high', 'athlete'];
const GOALS: readonly GoalType[] = ['lose', 'maintain', 'gain'];

export function WeightForm({ close }: { close: () => void }) {
  const last = weightsByDate.value[weightsByDate.value.length - 1];
  const [kg, setKg] = useState(last?.kg ?? 70);
  const [date, setDate] = useState<ISODate>(today());
  return (
    <Form>
      <NumberStepper label={t('nutrition.weight')} value={kg} step={0.1} precision={1} min={20} max={300} unit={t('units.kg')} onChange={setKg} />
      <DateField value={date} onChange={(d) => d && setDate(d)} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback={false}
          onClick={() => {
            setWeight(date, kg);
            haptic('success');
            toast(t('nutrition.saved'), { tone: 'success' });
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

export const openWeightForm = (): void => void openSheet((close) => <WeightForm close={close} />, { title: t('nutrition.addWeight') });

function ProfileForm({ close }: { close: () => void }) {
  const [p, setP] = useState<BodyProfile>(bodyProfile.value.value);
  const patch = (x: Partial<BodyProfile>): void => setP((cur) => ({ ...cur, ...x }));
  return (
    <Form>
      <NumberStepper label={t('nutrition.height')} value={p.heightCm ?? 175} min={120} max={230} unit={t('nutrition.heightUnit')} onChange={(heightCm) => patch({ heightCm })} />
      <NumberStepper label={t('nutrition.birthYear')} value={p.birthYear ?? 2005} min={1930} max={Number(today().slice(0, 4)) - 10} onChange={(birthYear) => patch({ birthYear })} />
      <Field label={t('nutrition.sex')}>
        <ChoiceChips options={SEXES.map((s) => ({ value: s, label: t(`nutrition.sexes.${s}`) }))} value={p.sex} onChange={(sex) => sex && patch({ sex })} />
      </Field>
      <List>
        <ListRow
          title={t('nutrition.knowBodyFat')}
          subtitle={t('nutrition.bodyFatHint')}
          trailing={<Switch label={t('nutrition.knowBodyFat')} checked={p.bodyFatPct !== null} onChange={(on) => patch({ bodyFatPct: on ? 18 : null })} />}
        />
      </List>
      {p.bodyFatPct !== null && <NumberStepper label={t('nutrition.bodyFat')} value={p.bodyFatPct} min={3} max={60} unit="%" onChange={(bodyFatPct) => patch({ bodyFatPct })} />}
      <Field label={t('nutrition.activity')}>
        <ChoiceChips options={ACTIVITIES.map((a) => ({ value: a, label: t(`nutrition.activities.${a}`) }))} value={p.activity} onChange={(activity) => activity && patch({ activity })} />
      </Field>
      <Field label={t('nutrition.goal')}>
        <ChoiceChips options={GOALS.map((g) => ({ value: g, label: t(`nutrition.goals.${g}`) }))} value={p.goal} onChange={(goal) => goal && patch({ goal })} />
      </Field>
      {p.goal !== 'maintain' && <NumberStepper label={t('nutrition.rate')} value={p.ratePct} step={0.25} precision={2} min={0.25} max={1.5} unit="%" onChange={(ratePct) => patch({ ratePct })} />}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            bodyProfile.set({ ...p, heightCm: p.heightCm ?? 175, birthYear: p.birthYear ?? 2005 });
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function ManualForm({ initial, close }: { initial: Macros & { water: number }; close: () => void }) {
  const [m, setM] = useState(initial);
  return (
    <Form>
      <NumberStepper label={t('nutrition.kcal')} value={Math.round(m.kcal)} step={50} min={800} max={6000} onChange={(kcal) => setM({ ...m, kcal })} />
      <div class="ui-row2">
        <NumberStepper label={t('nutrition.protein')} value={Math.round(m.p)} step={5} min={0} max={400} onChange={(p) => setM({ ...m, p })} />
        <NumberStepper label={t('nutrition.fat')} value={Math.round(m.f)} step={5} min={0} max={300} onChange={(f) => setM({ ...m, f })} />
      </div>
      <NumberStepper label={t('nutrition.carbs')} value={Math.round(m.c)} step={5} min={0} max={800} onChange={(c) => setM({ ...m, c })} />
      <NumberStepper label={t('nutrition.waterTarget')} value={m.water} step={250} min={500} max={6000} onChange={(water) => setM({ ...m, water })} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            const { water, ...macros } = m;
            bodyProfile.set({ manual: macros, waterMl: water });
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function TargetsCard() {
  const r = targets.value;
  const profile = bodyProfile.value.value;
  if (!r.ok) {
    return (
      <Card onClick={() => void openSheet((close) => <ProfileForm close={close} />, { title: t('nutrition.profile') })}>
        <p class="today__setup-title">{t('nutrition.noTargets')}</p>
        <p class="today__setup-text">{t('nutrition.missingLine', { list: r.missing.map((m) => t(`nutrition.missing.${m}`)).join(', ') })}</p>
      </Card>
    );
  }
  const x = r.targets;
  return (
    <>
      <div class="stat-grid stat-grid--3">
        <Card>
          <Stat label={t('nutrition.kcal')} value={fmtKcal(x.kcal)} />
        </Card>
        <Card>
          <Stat label={t('nutrition.protein')} value={fmtG(x.p)} unit={t('units.g')} />
        </Card>
        <Card>
          <Stat label={t('nutrition.water')} value={x.water} unit={t('units.ml')} />
        </Card>
      </div>
      <div class="stat-grid">
        <Card>
          <Stat label={t('nutrition.fat')} value={fmtG(x.f)} unit={t('units.g')} />
        </Card>
        <Card>
          <Stat label={t('nutrition.carbs')} value={fmtG(x.c)} unit={t('units.g')} />
        </Card>
      </div>
      <Section title={t('nutrition.howCalculated')}>
        <Card>
          {x.manual ? (
            <p>{t('nutrition.manualOn')}</p>
          ) : (
            <ul class="explain num">
              <li>{t('nutrition.explain.bmr', { bmr: fmtKcal(x.bmr) })}</li>
              <li>
                {t('nutrition.explain.tdee', {
                  tdee: fmtKcal(x.tdee),
                  source: x.tdeeSource === 'adaptive' ? t('nutrition.explain.sourceAdaptive') : t('nutrition.explain.sourceFormula'),
                })}
              </li>
              {x.deficitPct > 0 && <li>{t('nutrition.explain.deficit', { pct: x.deficitPct.toFixed(0) })}</li>}
              <li>{t('nutrition.explain.protein', { perKg: x.proteinPerKg.toFixed(1) })}</li>
            </ul>
          )}
          <p class="macro__hint">{t('nutrition.explain.adaptiveHint')}</p>
          <p class="macro__hint">{t('nutrition.explain.method')}</p>
        </Card>
        {profile.manual ? (
          <Button block onClick={() => bodyProfile.set({ manual: null, waterMl: null })}>
            {t('nutrition.resetManual')}
          </Button>
        ) : (
          <Button
            block
            variant="ghost"
            onClick={() => void openSheet((close) => <ManualForm initial={{ kcal: x.kcal, p: x.p, f: x.f, c: x.c, water: x.water }} close={close} />, { title: t('nutrition.manual') })}
          >
            {t('nutrition.manual')}
          </Button>
        )}
      </Section>
    </>
  );
}

export function BodyView() {
  const trend = weightTrend(weightsByDate.value);
  const last = trend[trend.length - 1];
  const r = targets.value;
  const weekly = r.ok ? r.targets.weeklyChange : null;
  const profile = bodyProfile.value.value;

  return (
    <>
      <Section title={t('nutrition.weight')} action={<Button size="sm" variant="ghost" icon="plus" onClick={openWeightForm}>{t('nutrition.addWeight')}</Button>}>
        {!last ? (
          <EmptyState icon="scale" title={t('nutrition.noWeight')} text={t('nutrition.noWeightText')} action={<Button variant="primary" onClick={openWeightForm}>{t('nutrition.addWeight')}</Button>} />
        ) : (
          <>
            <div class="stat-grid">
              <Card>
                <Stat label={t('nutrition.current')} value={fmtKg(last.trend)} unit={t('units.kg')} />
              </Card>
              <Card>
                <Stat
                  label={t('nutrition.perWeek')}
                  value={weekly === null ? '—' : `${weekly > 0 ? '+' : ''}${weekly.toFixed(2)}`}
                  {...(weekly === null ? {} : { unit: t('units.kg') })}
                />
              </Card>
            </div>
            <Card>
              <LineChart
                points={trend.map((p) => ({ date: p.date, value: p.trend }))}
                dots={trend.map((p) => ({ date: p.date, value: p.raw }))}
                format={(v) => fmtKg(v)}
              />
            </Card>
            <p class="settings__note">{t('nutrition.trendHint')}</p>
          </>
        )}
      </Section>

      <Section title={t('nutrition.targets')}>
        <TargetsCard />
      </Section>

      <Section title={t('nutrition.profile')} action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => void openSheet((close) => <ProfileForm close={close} />, { title: t('nutrition.profile') })}>{t('common.edit')}</Button>}>
        <List>
          <ListRow title={t('nutrition.height')} value={profile.heightCm ? `${profile.heightCm} ${t('nutrition.heightUnit')}` : '—'} />
          <ListRow title={t('nutrition.birthYear')} value={profile.birthYear ?? '—'} />
          <ListRow title={t('nutrition.activity')} value={t(`nutrition.activities.${profile.activity}`)} />
          <ListRow title={t('nutrition.goal')} value={t(`nutrition.goals.${profile.goal}`)} />
        </List>
      </Section>

      {weightLog.all.value.length > 0 && (
        <Section title={t('nutrition.history')}>
          <List>
            {[...weightsByDate.value].reverse().slice(0, 10).map((w) => (
              <ListRow
                key={w.id}
                title={formatDayMonth(w.date)}
                value={t('nutrition.kgValue', { n: fmtKg(w.kg) })}
                onClick={() => {
                  void openSheet(
                    (close) => (
                      <SheetActions>
                        <Button variant="danger" block icon="trash" onClick={() => { weightLog.remove(w.id); close(); }}>
                          {t('common.delete')}
                        </Button>
                      </SheetActions>
                    ),
                    { title: t('nutrition.kgValue', { n: fmtKg(w.kg) }) },
                  );
                }}
              />
            ))}
          </List>
        </Section>
      )}
    </>
  );
}
