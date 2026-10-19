import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { formatTime, isISODate, parseTime, type ISODate, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { Chip } from './inputs';
import { cx } from './primitives';

// ── Palette ────────────────────────────────────────────────────────────────

export const PALETTE = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const;
export type ColorKey = (typeof PALETTE)[number];

export function colorVar(key: string): string {
  return PALETTE.includes(key as ColorKey) ? `var(--c-${key.slice(1)})` : 'var(--c-8)';
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (key: ColorKey) => void }) {
  return (
    <div class="ui-colors" role="radiogroup">
      {PALETTE.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={`Цвет ${key}`}
          class={cx('ui-colors__item', value === key && 'is-selected')}
          style={{ background: colorVar(key) }}
          onClick={() => {
            haptic('selection');
            onChange(key);
          }}
        />
      ))}
    </div>
  );
}

// ── Labeled block for forms ────────────────────────────────────────────────

export function Field({ label, children, hint }: { label: string; children: ComponentChildren; hint?: string }) {
  return (
    <div class="ui-form-field">
      <span class="ui-field__label">{label}</span>
      {children}
      {hint && <span class="ui-field__hint">{hint}</span>}
    </div>
  );
}

export function Form({ children }: { children: ComponentChildren }) {
  return <div class="ui-form">{children}</div>;
}

// ── Chips as a single-choice select ────────────────────────────────────────

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  color?: string;
}

export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  allowNone = false,
}: {
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the selected chip clears the choice. */
  allowNone?: boolean;
}) {
  return (
    <div class="ui-chips">
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          selected={o.value === value}
          {...(o.color ? { color: o.color } : {})}
          onClick={() => onChange(o.value === value && allowNone ? null : o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

// ── Native time / date inputs (iOS wheels) ─────────────────────────────────

export function TimeField({ label, value, onChange }: { label?: string; value: Minutes; onChange: (m: Minutes) => void }) {
  const id = useId();
  return (
    <div class="ui-field">
      {label && (
        <label class="ui-field__label" for={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="time"
        class="ui-field__input ui-field__native"
        value={formatTime(value)}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          if (/^\d{2}:\d{2}/.test(raw)) onChange(parseTime(raw.slice(0, 5)));
        }}
      />
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: ISODate | null;
  onChange: (d: ISODate | null) => void;
}) {
  const id = useId();
  return (
    <div class="ui-field">
      {label && (
        <label class="ui-field__label" for={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="date"
        class="ui-field__input ui-field__native"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          onChange(isISODate(raw) ? raw : null);
        }}
      />
    </div>
  );
}

export function TimeRange({
  start,
  end,
  onChange,
}: {
  start: Minutes;
  end: Minutes;
  onChange: (start: Minutes, end: Minutes) => void;
}) {
  return (
    <div class="ui-row2">
      <TimeField
        label="Начало"
        value={start}
        // Moving the start keeps the duration.
        onChange={(s) => onChange(s, Math.min(1440, s + (end - start)))}
      />
      <TimeField label="Конец" value={end} onChange={(e) => onChange(start, Math.max(e, start + 5))} />
    </div>
  );
}
