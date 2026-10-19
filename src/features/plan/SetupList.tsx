import { useState } from 'preact/hooks';
import { formatDuration, formatTime } from '@/core/date';
import { t } from '@/core/i18n';
import { navigate } from '@/core/router';
import { settings } from '@/core/settings';
import { places } from '@/features/places/model';
import { bells, subjects, timetables, sortedLessonTypes } from '@/features/schedule/model';
import { jobs } from '@/features/work/model';
import { Button, Form, List, ListRow, NumberStepper, openSheet, Section, SheetActions, TimeField } from '@/ui';

function DayWindowForm({ close }: { close: () => void }) {
  const s = settings.value.value;
  const [dayStart, setStart] = useState(s.dayStart);
  const [dayEnd, setEnd] = useState(s.dayEnd);
  const [minHomeStay, setStay] = useState(s.minHomeStay);
  return (
    <Form>
      <div class="ui-row2">
        <TimeField label={t('plan.wake')} value={dayStart} onChange={setStart} />
        <TimeField label={t('plan.sleep')} value={dayEnd} onChange={setEnd} />
      </div>
      <NumberStepper label={t('plan.minHomeStay')} value={minHomeStay} step={5} min={0} max={240} unit={t('units.min')} onChange={setStay} />
      <p class="sheet-note">{t('plan.minHomeStayHint')}</p>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={dayEnd <= dayStart}
          onClick={() => {
            settings.set({ dayStart, dayEnd, minHomeStay });
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

/** Hub for everything that shapes the plan. */
export function SetupList() {
  const s = settings.value.value;
  const bellCount = bells.value.value.slots.length;
  const ttCount = timetables.all.value.length;
  return (
    <>
      <Section title={t('plan.study')}>
        <List>
          <ListRow icon="calendar" title={t('plan.timetables')} subtitle={ttCount ? t('plan.semesters', { count: ttCount }) : t('plan.notCreated')} chevron onClick={() => navigate('plan/timetables')} />
          <ListRow icon="notes" title={t('plan.subjects')} subtitle={t('plan.subjectsCount', { count: subjects.all.value.filter((x) => !x.archived).length })} chevron onClick={() => navigate('plan/subjects')} />
          <ListRow icon="tasks" title={t('plan.lessonTypes')} subtitle={sortedLessonTypes.value.map((x) => x.short).join(', ')} chevron onClick={() => navigate('plan/types')} />
          <ListRow icon="clock" title={t('plan.bells')} subtitle={bellCount ? t('plan.bellsCount', { count: bellCount }) : t('plan.notSet')} chevron onClick={() => navigate('plan/bells')} />
        </List>
      </Section>
      <Section title={t('plan.life')}>
        <List>
          <ListRow icon="briefcase" title={t('plan.work')} subtitle={jobs.all.value.length ? jobs.all.value.map((j) => j.name).join(', ') : t('plan.notAdded')} chevron onClick={() => navigate('plan/work')} />
          <ListRow icon="pin" title={t('plan.places')} subtitle={places.all.value.length ? places.all.value.map((p) => p.name).join(', ') : t('plan.placesHint')} chevron onClick={() => navigate('plan/places')} />
          <ListRow
            icon="moon"
            title={t('plan.dayWindow')}
            subtitle={t('plan.dayWindowSub', { from: formatTime(s.dayStart), to: formatTime(s.dayEnd), duration: formatDuration(s.minHomeStay) })}
            chevron
            onClick={() => openSheet((close) => <DayWindowForm close={close} />, { title: t('plan.dayWindow') })}
          />
        </List>
      </Section>
    </>
  );
}
