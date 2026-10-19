import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t, type PlainKey } from '@/core/i18n';
import { languages, pickText } from '@/core/i18n/languages';
import { applyPack, planPack } from '@/core/packs/pack';
import { settings } from '@/core/settings';
import { registeredCollections } from '@/core/store/store';
import { BUILTIN_PACKS } from '@/features/packs/builtin';
import { Button, Icon, List, ListRow, SegmentedControl, Switch, toast, type IconName } from '@/ui';

const FEATURES: readonly { icon: IconName; color: string; title: PlainKey; text: PlainKey }[] = [
  { icon: 'today', color: 'var(--c-1)', title: 'onboarding.day', text: 'onboarding.dayText' },
  { icon: 'dumbbell', color: 'var(--c-2)', title: 'onboarding.health', text: 'onboarding.healthText' },
  { icon: 'wallet', color: 'var(--c-3)', title: 'onboarding.money', text: 'onboarding.moneyText' },
  { icon: 'notes', color: 'var(--c-5)', title: 'onboarding.notes', text: 'onboarding.notesText' },
  { icon: 'plus', color: 'var(--accent)', title: 'onboarding.quick', text: 'onboarding.quickText' },
];

/** Packs offered on the first run; university bells are opt-in. */
const DEFAULT_OFF = new Set(['study-bells']);

/** First run: what the app does, which starter packs to add, then "Start". */
export function Onboarding() {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(BUILTIN_PACKS.filter((p) => !DEFAULT_OFF.has(p.id)).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lang = settings.value.value.language;

  const toggle = (id: string, on: boolean): void => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const start = async (): Promise<void> => {
    setBusy(true);
    try {
      // Packs one by one: later ones see what earlier ones added (shared categories merge, not duplicate).
      for (const p of BUILTIN_PACKS) {
        if (!picked.has(p.id)) continue;
        const plan = planPack(p.build(pickText));
        await applyPack(plan, new Set(plan.sections.map((s) => s.key)));
      }
      haptic('success');
      setLeaving(true);
      setTimeout(() => settings.set({ onboarded: true }), 360);
    } catch (e) {
      setBusy(false);
      toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
    }
  };

  const builtinLangs = languages.value.filter((l) => l.builtin);

  return (
    <div class={leaving ? 'onboarding is-leaving' : 'onboarding'}>
      <div class="onboarding__scroll">
        <div class="onboarding__lang" style={{ '--i': 0 }}>
          <SegmentedControl options={builtinLangs.map((l) => ({ value: l.id, label: l.name }))} value={builtinLangs.some((l) => l.id === lang) ? lang : 'ru'} onChange={(language) => settings.set({ language })} />
        </div>

        <header class="onboarding__hero" style={{ '--i': 1 }}>
          <img src="./icons/icon.svg" alt="" width="72" height="72" class="onboarding__logo" />
          <h1>Totum</h1>
          <p>{t('onboarding.tagline')}</p>
        </header>

        <ul class="onboarding__features">
          {FEATURES.map((f, i) => (
            <li key={f.title} style={{ '--i': i + 2 }}>
              <span class="onboarding__icon" style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 16%, transparent)` }}>
                <Icon name={f.icon} size={22} />
              </span>
              <span>
                <strong>{t(f.title)}</strong>
                <span>{t(f.text)}</span>
              </span>
            </li>
          ))}
        </ul>

        <section class="onboarding__packs" style={{ '--i': FEATURES.length + 2 }}>
          <h2>{t('onboarding.startWith')}</h2>
          <List>
            {BUILTIN_PACKS.map((p) => (
              <ListRow
                key={p.id}
                icon={p.icon}
                title={pickText(p.name)}
                subtitle={pickText(p.description)}
                trailing={<Switch label={pickText(p.name)} checked={picked.has(p.id)} onChange={(on) => toggle(p.id, on)} />}
              />
            ))}
          </List>
          <p class="settings__note">{picked.size === 0 ? t('onboarding.blank') : t('onboarding.later')}</p>
        </section>
      </div>

      <div class="onboarding__footer">
        <Button variant="primary" size="lg" block disabled={busy} feedback={false} onClick={() => void start()}>
          {t('onboarding.start')}
        </Button>
      </div>
    </div>
  );
}

/** People who already use the app (data from before the welcome screen existed) skip it. */
export function skipOnboardingIfUsed(): void {
  if (settings.value.value.onboarded) return;
  if (registeredCollections().some((c) => c.snapshot().length > 0)) settings.set({ onboarded: true });
}
