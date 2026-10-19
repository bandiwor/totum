import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { fx, type FxKind } from '@/core/fx';
import { cx, Icon } from './primitives';

// ── Segmented control ───────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div class="ui-seg" role="tablist" style={{ '--seg-count': options.length, '--seg-index': index }}>
      <span class="ui-seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          class={cx('ui-seg__item', o.value === value && 'is-active')}
          onClick={() => {
            if (o.value === value) return;
            haptic('selection');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Chips ───────────────────────────────────────────────────────────────────

export function Chip({
  children,
  selected = false,
  color,
  onClick,
}: {
  children: preact.ComponentChildren;
  selected?: boolean;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      class={cx('ui-chip', selected && 'is-selected')}
      style={color ? { '--chip-color': color } : undefined}
      onClick={() => {
        haptic('selection');
        onClick?.();
      }}
    >
      {color && <span class="ui-chip__dot" />}
      {children}
    </button>
  );
}

// ── Switch: native iOS switch (gives system haptics for free) ───────────────

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      // @ts-expect-error — `switch` is a Safari 17.4+ attribute not yet in the DOM typings.
      switch
      class="ui-switch"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}

// ── Checkbox (round, for tasks / sets / intakes) ────────────────────────────

export function Checkbox({
  checked,
  onChange,
  label,
  color,
  celebrate,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  color?: string;
  /** Effect to fire when checked (see core/fx). */
  celebrate?: FxKind;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      class={cx('ui-check', checked && 'is-checked')}
      style={color ? { '--check-color': color } : undefined}
      onClick={(e) => {
        const next = !checked;
        haptic(next ? 'success' : 'light');
        if (next && celebrate) fx(celebrate, e.currentTarget);
        onChange(next);
      }}
    >
      <Icon name="check" size={16} />
    </button>
  );
}

// ── Text fields ─────────────────────────────────────────────────────────────

type InputAttrs = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'value'>;

export function TextField({
  label,
  value,
  onValue,
  hint,
  error,
  class: className,
  ...rest
}: InputAttrs & { label?: string; value: string; onValue: (v: string) => void; hint?: string; error?: string | null }) {
  const id = useId();
  return (
    <div class={cx('ui-field', error && 'has-error', className as string)}>
      {label && (
        <label class="ui-field__label" for={id}>
          {label}
        </label>
      )}
      <input {...rest} id={id} class="ui-field__input" value={value} onInput={(e) => onValue(e.currentTarget.value)} />
      {(error || hint) && <span class="ui-field__hint">{error ?? hint}</span>}
    </div>
  );
}

type TextAreaAttrs = Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onInput' | 'value'>;

export function TextArea({
  label,
  value,
  onValue,
  class: className,
  ...rest
}: TextAreaAttrs & { label?: string; value: string; onValue?: (v: string) => void }) {
  const id = useId();
  return (
    <div class={cx('ui-field', className as string)}>
      {label && (
        <label class="ui-field__label" for={id}>
          {label}
        </label>
      )}
      <textarea {...rest} id={id} class="ui-field__input ui-field__textarea" value={value} onInput={(e) => onValue?.(e.currentTarget.value)} />
    </div>
  );
}

// ── Number stepper (big ± targets for weights, reps, grams, money) ──────────

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  unit,
  label,
  precision = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  precision?: number;
}) {
  const clamp = (n: number): number => Math.min(max, Math.max(min, Number(n.toFixed(precision))));
  const bump = (dir: 1 | -1): void => {
    const next = clamp(value + dir * step);
    if (next === value) {
      haptic('warning');
      return;
    }
    haptic('selection');
    onChange(next);
  };
  return (
    <div class="ui-stepper">
      {label && <span class="ui-stepper__label">{label}</span>}
      <div class="ui-stepper__row">
        <button type="button" class="ui-stepper__btn" aria-label="Меньше" onClick={() => bump(-1)}>
          <Icon name="minus" />
        </button>
        <label class="ui-stepper__value">
          <input
            class="num"
            // Width follows the value so the unit sits right next to it.
            style={{ width: `${Math.max(2, String(value).length) + 0.6}ch` }}
            type="text"
            inputMode={precision > 0 ? 'decimal' : 'numeric'}
            value={String(value)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const parsed = Number(e.currentTarget.value.replace(',', '.'));
              if (Number.isFinite(parsed)) onChange(clamp(parsed));
              else e.currentTarget.value = String(value);
            }}
          />
          {unit && <span class="ui-stepper__unit">{unit}</span>}
        </label>
        <button type="button" class="ui-stepper__btn" aria-label="Больше" onClick={() => bump(1)}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
