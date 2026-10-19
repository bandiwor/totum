import { signal } from '@preact/signals';
import { shortDate } from '@/ui/charts';
import { navigate } from '@/core/router';
import { BarChart, Card, ChoiceChips, colorVar, EmptyState, LineChart, List, ListRow, Page, Section, SegmentedControl, Stat, Badge } from '@/ui';
import { categoryIndex, exerciseSeries, progressStatus, statusLabel, trend, weeklyLoad } from './analytics';
import { formatPct, formatPctShort, STATUS_TONE } from './LibraryScreens';
import { exercises, sessions, sortedCategories, wellbeingLabel } from './model';
import { inPeriod, period, periodOptions } from './period';
import { t } from '@/core/i18n';

const selected = signal<string | null>(null);

export function ProgressScreen() {
  const list = inPeriod(sessions.all.value, period.value);
  const finished = list.filter((s) => s.finished);
  const cat = selected.value;
  const catExercises = exercises.all.value.filter((e) => (cat ? e.categoryId === cat : true));
  const ids = new Set(catExercises.map((e) => e.id));
  const index = categoryIndex(catExercises, list);
  const tr = trend(index);
  const load = weeklyLoad(list, (id) => ids.has(id));
  const recentLoad = load.slice(-4);
  const avgSets = recentLoad.length ? recentLoad.reduce((s, w) => s + w.sets, 0) / recentLoad.length : 0;
  const wb = finished.filter((s) => s.wellbeing !== null);
  const avgWellbeing = wb.length ? wb.reduce((s, x) => s + (x.wellbeing ?? 0), 0) / wb.length : null;

  const rows = catExercises
    .map((e) => {
      const series = exerciseSeries(e, list);
      const all = exerciseSeries(e, sessions.all.value);
      return { e, series, tr: trend(series), status: progressStatus(all, trend(all)) };
    })
    .filter((r) => r.series.length > 0)
    .sort((a, b) => (b.tr?.weeklyPct ?? -999) - (a.tr?.weeklyPct ?? -999));

  return (
    <Page title={t('training.progress')} back>
      <SegmentedControl options={periodOptions()} value={period.value} onChange={(p) => (period.value = p)} />
      <div class="progress-cats">
        <ChoiceChips
          allowNone
          options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
          value={cat}
          onChange={(v) => (selected.value = v)}
        />
      </div>

      {finished.length === 0 ? (
        <EmptyState icon="scale" title={t('training.noProgress')} text={t('training.noProgressText')} />
      ) : (
        <>
          <div class="stat-grid stat-grid--3">
            <Card>
              <Stat label={t('training.strength')} value={tr ? formatPctShort(tr.weeklyPct) : '—'} {...(tr ? { unit: t('training.perWeek') } : {})} />
            </Card>
            <Card>
              <Stat label={t('training.setsLabel')} value={avgSets.toFixed(0)} unit={t('training.perWeek')} />
            </Card>
            <Card>
              <Stat label={t('training.wellbeingShort')} value={avgWellbeing ? avgWellbeing.toFixed(1) : '—'} {...(avgWellbeing ? { unit: t('training.outOf5') } : {})} />
            </Card>
          </div>

          <Section title={t('training.indexTitle')}>
            <Card>
              <LineChart points={index} trendAt={tr?.at} reference={100} format={(v) => v.toFixed(0)} />
            </Card>
            <p class="settings__note">
              {t('training.indexHint')}
            </p>
          </Section>

          <Section title={t('training.weeklySets')}>
            <Card>
              <BarChart bars={load.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.sets }))} />
            </Card>
          </Section>

          <Section title={t('training.exercises')}>
            <List>
              {rows.map((r) => (
                <ListRow
                  key={r.e.id}
                  title={r.e.name}
                  subtitle={r.tr ? formatPct(r.tr.weeklyPct) : t('training.sessionsN', { n: r.series.length })}
                  trailing={<Badge tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Badge>}
                  chevron
                  onClick={() => navigate(`health/exercise/${r.e.id}`)}
                />
              ))}
            </List>
          </Section>
          {avgWellbeing !== null && (
            <p class="settings__note">{t('training.wellbeingScale', { low: wellbeingLabel(1).toLowerCase(), high: wellbeingLabel(5).toLowerCase() })}</p>
          )}
        </>
      )}
    </Page>
  );
}
