import { useState } from 'preact/hooks';
import { addMonths, formatDayMonth, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { Badge, Button, Card, confirm, DateField, EmptyState, Form, List, ListRow, openSheet, ProgressBar, SheetActions, Switch, TextField } from '@/ui';
import { goalForecast } from './logic';
import { goals, goalSaved, type Goal } from './model';
import { AmountField } from './TransactionForm';
import { contribute, fmtMoney, monthlyPace } from './state';

function GoalForm({ goal, close }: { goal: Goal | null; close: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [deadline, setDeadline] = useState<ISODate | null>(goal?.deadline ?? addMonths(today(), 6));
  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} autoFocus={!goal} />
      <AmountField value={target} onChange={setTarget} />
      <List>
        <ListRow title={t('money.hasDeadline')} trailing={<Switch label={t('money.hasDeadline')} checked={deadline !== null} onChange={(on) => setDeadline(on ? addMonths(today(), 6) : null)} />} />
      </List>
      {deadline !== null && <DateField label={t('money.deadline')} value={deadline} onChange={setDeadline} />}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim() || target <= 0}
          onClick={() => {
            const data = { name: name.trim(), target, deadline };
            if (goal) goals.update(goal.id, data);
            else goals.add({ ...data, contributions: [], archived: false });
            haptic('success');
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {goal && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('money.deleteGoal'), confirmLabel: t('common.delete'), danger: true })) {
                goals.remove(goal.id);
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

function ContributionForm({ goal, sign, close }: { goal: Goal; sign: 1 | -1; close: () => void }) {
  const [amount, setAmount] = useState(0);
  return (
    <Form>
      <AmountField value={amount} onChange={setAmount} autoFocus />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={amount <= 0}
          feedback="success"
          onClick={() => {
            contribute(goal, sign * Math.min(amount, sign < 0 ? goalSaved(goal) : amount));
            close();
          }}
        >
          {sign > 0 ? t('money.contribute') : t('money.withdraw')}
        </Button>
      </SheetActions>
    </Form>
  );
}

const openGoalForm = (goal: Goal | null): void => void openSheet((close) => <GoalForm goal={goal} close={close} />, { title: goal ? goal.name : t('money.newGoal') });

function GoalCard({ goal }: { goal: Goal }) {
  const saved = goalSaved(goal);
  const f = goalForecast(goal, saved, monthlyPace.value, today());
  return (
    <Card>
      <div class="goal">
        <div class="goal__head">
          <button type="button" class="ex-card__title" onClick={() => openGoalForm(goal)}>
            {goal.name}
          </button>
          {f.left === 0 ? (
            <Badge tone="positive">{t('money.reached')}</Badge>
          ) : f.onTrack === null ? null : (
            <Badge tone={f.onTrack ? 'positive' : 'warning'}>{f.onTrack ? t('money.onTrack') : t('money.behind')}</Badge>
          )}
        </div>
        <ProgressBar value={saved} max={goal.target} />
        <p class="goal__line num">
          {t('money.progress', { saved: fmtMoney(saved), target: fmtMoney(goal.target) })}
          {goal.deadline ? ` · ${formatDayMonth(goal.deadline)}` : ''}
        </p>
        {f.left > 0 && f.perMonth !== null && <p class="goal__line num">{t('money.perMonth', { amount: fmtMoney(f.perMonth) })}</p>}
        {f.left > 0 && <p class="goal__line">{f.eta ? t('money.eta', { date: formatDayMonth(f.eta) }) : t('money.noPace')}</p>}
        <div class="goal__actions">
          <Button size="sm" variant="primary" icon="plus" onClick={() => void openSheet((close) => <ContributionForm goal={goal} sign={1} close={close} />, { title: t('money.contribute') })}>
            {t('money.contribute')}
          </Button>
          {saved > 0 && (
            <Button size="sm" onClick={() => void openSheet((close) => <ContributionForm goal={goal} sign={-1} close={close} />, { title: t('money.withdraw') })}>
              {t('money.withdraw')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GoalsView() {
  const list = goals.all.value.filter((g) => !g.archived);
  return (
    <>
      <Card>
        <p class="num">{t('money.pace', { amount: fmtMoney(monthlyPace.value) })}</p>
        <p class="macro__hint">{t('money.paceHint')}</p>
      </Card>
      {list.length === 0 ? (
        <EmptyState icon="sparkles" title={t('money.noGoals')} text={t('money.noGoalsText')} action={<Button variant="primary" icon="plus" onClick={() => openGoalForm(null)}>{t('money.newGoal')}</Button>} />
      ) : (
        <div class="goals" style={{ marginTop: 'var(--space-4)' }}>
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
          <Button block icon="plus" onClick={() => openGoalForm(null)}>
            {t('money.newGoal')}
          </Button>
        </div>
      )}
    </>
  );
}
