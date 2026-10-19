import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t, type PlainKey } from '@/core/i18n';
import { pickText } from '@/core/i18n/languages';
import { AI_GUIDE } from '@/core/packs/aiGuide';
import { applyPack, planPack, type PackPlan, type PackSection } from '@/core/packs/pack';
import { registeredCollections } from '@/core/store/store';
import { BUILTIN_PACKS } from '@/features/packs/builtin';
import { Button, cx, EmptyState, Icon, List, ListRow, openSheet, Page, Section, SheetActions, Switch, toast } from '@/ui';
import { copyText, JsonField, readClipboard } from './clipboard';

const DOC_LABELS: Record<string, PlainKey> = {
  settings: 'packs.docs.settings',
  bells: 'packs.docs.bells',
  trainingProgram: 'packs.docs.trainingProgram',
  mealPlan: 'packs.docs.mealPlan',
  bodyProfile: 'packs.docs.bodyProfile',
  money: 'packs.docs.money',
};

const FIELD_LABELS: Record<string, PlainKey> = {
  theme: 'packs.fields.theme',
  accentHue: 'packs.fields.accentHue',
  haptics: 'packs.fields.haptics',
  effects: 'packs.fields.effects',
  dayStart: 'packs.fields.dayStart',
  dayEnd: 'packs.fields.dayEnd',
  minHomeStay: 'packs.fields.minHomeStay',
  disabledModules: 'packs.fields.disabledModules',
  tabOrder: 'packs.fields.tabOrder',
  language: 'packs.fields.language',
};

function sectionLabel(s: PackSection): string {
  if (s.kind === 'doc') {
    const key = DOC_LABELS[s.name];
    return key ? t(key) : s.name;
  }
  const def = registeredCollections().find((c) => c.name === s.name);
  return def ? t(def.label) : s.name;
}

const fieldLabel = (f: string): string => {
  const key = FIELD_LABELS[f];
  return key ? t(key) : f;
};

/** "What will change": sections with +/~/− counts, expandable item lists and an include switch each. */
function PackPreview({ plan, close }: { plan: PackPlan; close: () => void }) {
  const [include, setInclude] = useState(() => new Set(plan.sections.map((s) => s.key)));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (key: string, on: boolean): void => {
    const next = new Set(include);
    if (on) next.add(key);
    else next.delete(key);
    setInclude(next);
  };

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      await applyPack(plan, include);
      haptic('success');
      toast(t('packs.applied', { name: plan.name }), { tone: 'success' });
      close();
    } catch (e) {
      setBusy(false);
      toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
    }
  };

  if (plan.sections.length === 0) {
    return <EmptyState icon="check" title={t('packs.nothing')} text={t('packs.nothingText')} />;
  }

  return (
    <>
      {plan.description && <p class="sheet-note">{plan.description}</p>}
      <div class="pack-diff">
        {plan.sections.map((s) => {
          const on = include.has(s.key);
          const expanded = open === s.key;
          return (
            <div key={s.key} class={cx('pack-sec', !on && 'is-off', expanded && 'is-open')}>
              <div class="pack-sec__head">
                <button type="button" class="pack-sec__toggle" onClick={() => { haptic('selection'); setOpen(expanded ? null : s.key); }}>
                  <span class="pack-sec__title">{sectionLabel(s)}</span>
                  <span class="pack-sec__counts num">
                    {s.added.length > 0 && <span class="diff diff--add">+{s.added.length}</span>}
                    {s.changed.length > 0 && <span class="diff diff--mod">~{s.changed.length}</span>}
                    {s.removed.length > 0 && <span class="diff diff--del">−{s.removed.length}</span>}
                  </span>
                  <Icon name="chevronDown" size={18} class="pack-sec__chevron" />
                </button>
                <Switch label={sectionLabel(s)} checked={on} onChange={(v) => toggle(s.key, v)} />
              </div>
              {expanded && (
                <ul class="pack-sec__items">
                  {s.added.map((c) => (
                    <li key={`a${c.id}`} class="pack-item pack-item--add">
                      <span class="pack-item__mark">+</span>
                      <span>{c.title}</span>
                    </li>
                  ))}
                  {s.changed.map((c) => (
                    <li key={`c${c.id}`} class="pack-item pack-item--mod">
                      <span class="pack-item__mark">~</span>
                      <span>
                        {s.kind === 'doc' ? fieldLabel(c.title) : c.title}
                        {s.kind === 'collection' && <span class="pack-item__fields"> · {c.fields.map(fieldLabel).join(', ')}</span>}
                      </span>
                    </li>
                  ))}
                  {s.removed.map((c) => (
                    <li key={`r${c.id}`} class="pack-item pack-item--del">
                      <span class="pack-item__mark">−</span>
                      <span>{c.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p class="sheet-note">{t('packs.backupNote')}</p>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={include.size === 0 || busy} feedback={false} onClick={() => void apply()}>
          {t('packs.apply')}
        </Button>
      </SheetActions>
    </>
  );
}

function openPreview(plan: PackPlan): void {
  void openSheet((close) => <PackPreview plan={plan} close={close} />, { title: plan.name });
}

/** Paste JSON → check → the same sheet turns into the preview. */
function PasteSheet({ close }: { close: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PackPlan | null>(null);

  if (plan) return <PackPreview plan={plan} close={close} />;

  const check = (value: string): void => {
    try {
      setPlan(planPack(value));
      haptic('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      haptic('error');
    }
  };

  return (
    <>
      <JsonField value={text} onValue={(v) => { setText(v); setError(null); }} placeholder={t('packs.pastePlaceholder')} />
      {error && <p class="sheet-error">{error}</p>}
      <SheetActions>
        <Button
          variant="secondary"
          size="lg"
          icon="paste"
          block
          onClick={async () => {
            const pasted = await readClipboard();
            if (pasted === null) return;
            setText(pasted);
            check(pasted);
          }}
        >
          {t('settings.pasteFromClipboard')}
        </Button>
        <Button variant="primary" size="lg" block disabled={!text.trim()} feedback={false} onClick={() => check(text)}>
          {t('common.check')}
        </Button>
      </SheetActions>
    </>
  );
}

export function PacksScreen() {
  return (
    <Page title={t('packs.title')} back>
      <p class="settings__lead">{t('packs.lead')}</p>
      <Section title={t('packs.builtin')}>
        <List>
          {BUILTIN_PACKS.map((p) => (
            <ListRow
              key={p.id}
              icon={p.icon}
              title={pickText(p.name)}
              subtitle={pickText(p.description)}
              chevron
              onClick={() => {
                try {
                  openPreview(planPack(p.build(pickText)));
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
                }
              }}
            />
          ))}
        </List>
      </Section>
      <Section title={t('packs.own')}>
        <List>
          <ListRow icon="paste" title={t('packs.paste')} subtitle={t('packs.pasteSub')} chevron onClick={() => void openSheet((close) => <PasteSheet close={close} />, { title: t('packs.paste') })} />
          <ListRow icon="sparkles" title={t('packs.aiGuide')} subtitle={t('packs.aiGuideSub')} onClick={() => void copyText(AI_GUIDE)} />
        </List>
        <p class="settings__note">{t('packs.aiHowTo')}</p>
      </Section>
    </Page>
  );
}
