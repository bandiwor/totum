import { useState } from 'preact/hooks';
import { formatDayMonth } from '@/core/date';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import {
  Badge,
  Button,
  Card,
  ColorPicker,
  colorVar,
  EmptyState,
  Form,
  LineChart,
  List,
  ListRow,
  openSheet,
  Page,
  Section,
  SegmentedControl,
  SheetActions,
  Stat,
  TextField,
  type ColorKey,
} from '@/ui';
import { exerciseSeries, progressStatus, statusLabel, trend, type ProgressStatus } from './analytics';
import { openExerciseForm } from './ExerciseForm';
import { categories, exercises, formatKg, formatSet, measureLabel, sessions, sortedCategories, type ExerciseCategory } from './model';
import { inPeriod, period, periodOptions } from './period';
import { t } from '@/core/i18n';

export const STATUS_TONE: Record<ProgressStatus, 'positive' | 'neutral' | 'warning'> = {
  growth: 'positive',
  stable: 'neutral',
  plateau: 'warning',
  new: 'neutral',
};

export function formatPct(p: number): string {
  return t('training.pctWeek', { pct: `${p > 0 ? '+' : ''}${p.toFixed(1)}` });
}

/** "+2.7%" — for stat tiles, with "в нед" as the unit. */
export function formatPctShort(p: number): string {
  return t('training.pct', { pct: `${p > 0 ? '+' : ''}${p.toFixed(1)}` });
}

function CategoryForm({ category, close }: { category: ExerciseCategory | null; close: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState<string>(category?.color ?? 'c8');
  const used = category ? exercises.all.value.some((e) => e.categoryId === category.id) : false;
  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} autoFocus={!category} />
      <ColorPicker value={color} onChange={(c: ColorKey) => setColor(c)} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            if (category) categories.update(category.id, { name: name.trim(), color });
            else categories.add({ name: name.trim(), color, order: categories.all.value.length });
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {category && !used && (
          <Button variant="danger" block icon="trash" onClick={() => { categories.remove(category.id); close(); }}>
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

function openCategories(): void {
  const edit = (c: ExerciseCategory | null): void =>
    void openSheet((close) => <CategoryForm category={c} close={close} />, { title: c ? c.name : t('training.newCategory') });
  void openSheet(
    () => (
      <>
        <List>
          {sortedCategories.value.map((c) => (
            <ListRow key={c.id} leading={<span class="color-dot" style={{ background: colorVar(c.color) }} />} title={c.name} chevron onClick={() => edit(c)} />
          ))}
        </List>
        <SheetActions>
          <Button block icon="plus" onClick={() => edit(null)}>
            {t('training.newCategory')}
          </Button>
        </SheetActions>
      </>
    ),
    { title: t('training.categories') },
  );
}

export function ExercisesScreen() {
  const all = [...exercises.all.value].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru'));
  const groups = [
    ...sortedCategories.value.map((c) => ({ key: c.id, title: c.name, items: all.filter((e) => e.categoryId === c.id) })),
    { key: 'none', title: t('training.noCategory'), items: all.filter((e) => !e.categoryId || !categories.get(e.categoryId)) },
  ].filter((g) => g.items.length > 0);

  return (
    <Page
      title={t('training.exercises')}
      back
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={openCategories}>{t('training.categories')}</Button>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => openExerciseForm(null)} />
        </>
      }
    >
      {groups.length === 0 ? (
        <EmptyState icon="dumbbell" title={t('training.noExercises')} action={<Button variant="primary" icon="plus" onClick={() => openExerciseForm(null)}>{t('common.add')}</Button>} />
      ) : (
        groups.map((g) => (
          <Section key={g.key} title={g.title}>
            <List>
              {g.items.map((e) => (
                <ListRow
                  key={e.id}
                  title={e.archived ? t('common.archivedSuffix', { name: e.name }) : e.name}
                  subtitle={measureLabel(e.measure)}
                  chevron
                  onClick={() => navigate(`health/exercise/${e.id}`)}
                />
              ))}
            </List>
          </Section>
        ))
      )}
    </Page>
  );
}

export function ExerciseScreen({ params }: RouteProps) {
  const exercise = exercises.byId(params.id);
  if (!exercise) return <Page title={t('training.exercise')} back><EmptyState icon="dumbbell" title={t('common.notFound')} /></Page>;
  const all = exerciseSeries(exercise, sessions.all.value);
  const series = exerciseSeries(exercise, inPeriod(sessions.all.value, period.value));
  const tr = trend(series);
  const status = progressStatus(all, trend(all));
  const best = all.length ? Math.max(...all.map((p) => p.value)) : 0;
  const isWeight = exercise.measure === 'weight';
  const unit = isWeight ? t('units.kg') : exercise.measure === 'time' ? t('units.sec') : t('units.reps');
  const fmt = (v: number): string => (isWeight ? formatKg(Math.round(v * 2) / 2) : v.toFixed(0));
  const category = exercise.categoryId ? categories.get(exercise.categoryId) : undefined;

  return (
    <Page title={exercise.name} back actions={<Button size="sm" variant="ghost" icon="pencil" onClick={() => openExerciseForm(exercise)} />}>
      <div class="ex-meta">
        {category && <Badge>{category.name}</Badge>}
        <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
      </div>
      <SegmentedControl options={periodOptions()} value={period.value} onChange={(p) => (period.value = p)} />
      <Section>
        <div class="stat-grid">
          <Card>
            <Stat label={isWeight ? t('training.recordE1rm') : t('training.record')} value={fmt(best)} unit={unit} />
          </Card>
          <Card>
            <Stat
              label={t('training.trend')}
              value={tr ? formatPctShort(tr.weeklyPct) : '—'}
              {...(tr ? { unit: t('training.perWeek') } : {})}
              {...(tr ? { delta: { text: t('training.sessionsN', { n: tr.n }), direction: tr.weeklyPct > 0.1 ? 'up' : tr.weeklyPct < -0.1 ? 'down' : 'flat' } } : {})}
            />
          </Card>
        </div>
      </Section>
      <Section title={isWeight ? t('training.e1rmTitle') : t('training.bestSet')}>
        <Card>
          <LineChart points={series} trendAt={tr?.at} format={fmt} />
        </Card>
        {isWeight && <p class="settings__note">{t('training.e1rmHint')}</p>}
      </Section>
      <Section title={t('training.history')}>
        {all.length === 0 ? (
          <p class="widget-empty">{t('training.neverDone')}</p>
        ) : (
          <List>
            {[...all].reverse().slice(0, 15).map((p) => (
              <ListRow
                key={p.session.id}
                title={formatDayMonth(p.date)}
                subtitle={p.session.exercises
                  .filter((x) => x.exerciseId === exercise.id)
                  .flatMap((x) => x.sets.filter((s) => s.done))
                  .map((s) => formatSet(s, exercise.measure))
                  .join(' · ')}
                value={fmt(p.value)}
                onClick={() => navigate(`health/session/${p.session.id}`)}
              />
            ))}
          </List>
        )}
      </Section>
      {exercise.note && (
        <Section title={t('common.note')}>
          <Card>
            <p data-selectable>{exercise.note}</p>
          </Card>
        </Section>
      )}
    </Page>
  );
}
