import { signal } from '@preact/signals';
import { shortDate } from '@/ui/charts';
import { navigate } from '@/core/router';
import { BarChart, Card, ChoiceChips, colorVar, EmptyState, LineChart, List, ListRow, Page, Section, SegmentedControl, Stat, Badge } from '@/ui';
import { categoryIndex, exerciseSeries, progressStatus, STATUS_LABELS, trend, weeklyLoad } from './analytics';
import { formatPct, formatPctShort, STATUS_TONE } from './LibraryScreens';
import { exercises, sessions, sortedCategories, WELLBEING_LABELS } from './model';
import { inPeriod, period, PERIODS } from './period';

const selected = signal<string | null>(null);

export function ProgressScreen() {
  const list = inPeriod(sessions.all.value, period.value);
  const finished = list.filter((s) => s.finished);
  const cat = selected.value;
  const catExercises = exercises.all.value.filter((e) => (cat ? e.categoryId === cat : true));
  const ids = new Set(catExercises.map((e) => e.id));
  const index = categoryIndex(catExercises, list);
  const t = trend(index);
  const load = weeklyLoad(list, (id) => ids.has(id));
  const recentLoad = load.slice(-4);
  const avgSets = recentLoad.length ? recentLoad.reduce((s, w) => s + w.sets, 0) / recentLoad.length : 0;
  const wb = finished.filter((s) => s.wellbeing !== null);
  const avgWellbeing = wb.length ? wb.reduce((s, x) => s + (x.wellbeing ?? 0), 0) / wb.length : null;

  const rows = catExercises
    .map((e) => {
      const series = exerciseSeries(e, list);
      const all = exerciseSeries(e, sessions.all.value);
      return { e, series, t: trend(series), status: progressStatus(all, trend(all)) };
    })
    .filter((r) => r.series.length > 0)
    .sort((a, b) => (b.t?.weeklyPct ?? -999) - (a.t?.weeklyPct ?? -999));

  return (
    <Page title="Прогресс" back>
      <SegmentedControl options={PERIODS} value={period.value} onChange={(p) => (period.value = p)} />
      <div class="progress-cats">
        <ChoiceChips
          allowNone
          options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
          value={cat}
          onChange={(v) => (selected.value = v)}
        />
      </div>

      {finished.length === 0 ? (
        <EmptyState icon="scale" title="Пока нет данных" text="Графики появятся после первых завершённых тренировок." />
      ) : (
        <>
          <div class="stat-grid stat-grid--3">
            <Card>
              <Stat label="Сила" value={t ? formatPctShort(t.weeklyPct) : '—'} {...(t ? { unit: 'в нед' } : {})} />
            </Card>
            <Card>
              <Stat label="Подходы" value={avgSets.toFixed(0)} unit="в нед" />
            </Card>
            <Card>
              <Stat label="Самочувств." value={avgWellbeing ? avgWellbeing.toFixed(1) : '—'} {...(avgWellbeing ? { unit: 'из 5' } : {})} />
            </Card>
          </div>

          <Section title="Индекс силы (старт = 100)">
            <Card>
              <LineChart points={index} trendAt={t?.at} reference={100} format={(v) => v.toFixed(0)} />
            </Card>
            <p class="settings__note">
              Каждое упражнение сравнивается со своим началом, по неделе берётся медиана — так жим и разводки
              сопоставимы. Тренд — % изменения в неделю.
            </p>
          </Section>

          <Section title="Рабочие подходы по неделям">
            <Card>
              <BarChart bars={load.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.sets }))} />
            </Card>
          </Section>

          <Section title="Упражнения">
            <List>
              {rows.map((r) => (
                <ListRow
                  key={r.e.id}
                  title={r.e.name}
                  subtitle={r.t ? formatPct(r.t.weeklyPct) : `${r.series.length} трен.`}
                  trailing={<Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>}
                  chevron
                  onClick={() => navigate(`health/exercise/${r.e.id}`)}
                />
              ))}
            </List>
          </Section>
          {avgWellbeing !== null && (
            <p class="settings__note">Самочувствие: 1 — {WELLBEING_LABELS[0].toLowerCase()}, 5 — {WELLBEING_LABELS[4].toLowerCase()}.</p>
          )}
        </>
      )}
    </Page>
  );
}
