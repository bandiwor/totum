import { useRef } from 'preact/hooks';
import { hex } from '@/core/color';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { settings } from '@/core/settings';
import { ACCENT_PRESETS, accentColor } from '@/app/theme';
import { Badge, Button, cx } from '@/ui';

const mode = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/**
 * Hue-only picker: lightness and chroma are fixed per theme (OKLCH), so every
 * position on the strip is a clean, contrasting colour.
 */
export function AccentPicker() {
  const hue = settings.value.value.accentHue;
  const track = useRef<HTMLDivElement>(null);
  const lastStep = useRef(Math.round(hue / 10));
  const m = mode();
  const stops = Array.from({ length: 13 }, (_, i) => `${hex(accentColor(i * 30, m))} ${(i / 12) * 100}%`).join(', ');

  const setFromPointer = (clientX: number): void => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 359);
    const step = Math.round(h / 10);
    if (step !== lastStep.current) {
      lastStep.current = step;
      haptic('selection');
    }
    settings.set({ accentHue: h });
  };

  return (
    <div class="accent-picker">
      <div
        ref={track}
        class="accent-picker__track"
        role="slider"
        aria-label={t('settings.hue')}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={hue}
        style={{ background: `linear-gradient(90deg, ${stops})` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && setFromPointer(e.clientX)}
      >
        <span class="accent-picker__thumb" style={{ left: `${(hue / 359) * 100}%`, background: hex(accentColor(hue, m)) }} />
      </div>
      <div class="accent-picker__presets">
        {ACCENT_PRESETS.map((h) => (
          <button
            key={h}
            type="button"
            aria-label={`${t('settings.hue')} ${h}`}
            class={cx('ui-colors__item', Math.abs(h - hue) < 3 && 'is-selected')}
            style={{ background: hex(accentColor(h, m)) }}
            onClick={() => {
              haptic('selection');
              settings.set({ accentHue: h });
            }}
          />
        ))}
      </div>
      <div class="accent-picker__preview">
        <Button size="sm" variant="primary">
          {t('settings.accentPreview')}
        </Button>
        <Badge tone="accent">{t('settings.accentPreview')}</Badge>
        <span class="accent-picker__text">{t('settings.accentPreview')}</span>
      </div>
      <p class="settings__note">{t('settings.accentHint')}</p>
    </div>
  );
}
