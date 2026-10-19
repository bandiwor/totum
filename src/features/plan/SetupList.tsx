import { useState } from 'preact/hooks';
import { formatDuration, formatTime } from '@/core/date';
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
        <TimeField label="Подъём" value={dayStart} onChange={setStart} />
        <TimeField label="Отбой" value={dayEnd} onChange={setEnd} />
      </div>
      <NumberStepper label="Ехать домой, если там пробуду не меньше" value={minHomeStay} step={5} min={0} max={240} unit="мин" onChange={setStay} />
      <p class="sheet-note">Иначе в перерыве остаёшься на месте или едешь сразу к следующему делу.</p>
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
          Сохранить
        </Button>
      </SheetActions>
    </Form>
  );
}

const count = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
};

/** Hub for everything that shapes the plan. */
export function SetupList() {
  const s = settings.value.value;
  const bellCount = bells.value.value.slots.length;
  return (
    <>
      <Section title="Учёба">
        <List>
          <ListRow icon="calendar" iconColor="var(--c-1)" title="Расписания" subtitle={timetables.all.value.length ? count(timetables.all.value.length, 'семестр', 'семестра', 'семестров') : 'Не созданы'} chevron onClick={() => navigate('plan/timetables')} />
          <ListRow icon="notes" iconColor="var(--c-2)" title="Предметы" subtitle={count(subjects.all.value.filter((x) => !x.archived).length, 'предмет', 'предмета', 'предметов')} chevron onClick={() => navigate('plan/subjects')} />
          <ListRow icon="tasks" iconColor="var(--c-5)" title="Типы пар" subtitle={sortedLessonTypes.value.map((t) => t.short).join(', ')} chevron onClick={() => navigate('plan/types')} />
          <ListRow icon="clock" iconColor="var(--c-3)" title="Сетка звонков" subtitle={bellCount ? count(bellCount, 'пара', 'пары', 'пар') : 'Не задана'} chevron onClick={() => navigate('plan/bells')} />
        </List>
      </Section>
      <Section title="Жизнь">
        <List>
          <ListRow icon="briefcase" iconColor="var(--c-7)" title="Работа" subtitle={jobs.all.value.length ? jobs.all.value.map((j) => j.name).join(', ') : 'Не добавлена'} chevron onClick={() => navigate('plan/work')} />
          <ListRow icon="pin" iconColor="var(--c-4)" title="Места и дорога" subtitle={places.all.value.length ? places.all.value.map((p) => p.name).join(', ') : 'Дом, корпуса, зал…'} chevron onClick={() => navigate('plan/places')} />
          <ListRow
            icon="moon"
            iconColor="var(--c-6)"
            title="Время дня"
            subtitle={`${formatTime(s.dayStart)}–${formatTime(s.dayEnd)} · домой от ${formatDuration(s.minHomeStay)}`}
            chevron
            onClick={() => openSheet((close) => <DayWindowForm close={close} />, { title: 'Время дня' })}
          />
        </List>
      </Section>
    </>
  );
}
