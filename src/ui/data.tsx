import type { ComponentChildren } from 'preact';
import { cx, Icon } from './primitives';

export function ProgressRing({
  value,
  max,
  size = 64,
  stroke = 7,
  color = 'var(--accent-2)',
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ComponentChildren;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <div class="ui-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" stroke-width={stroke} />
        <circle
          class="ui-ring__bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--warning)' : color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <div class="ui-ring__center">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color = 'var(--accent-2)' }: { value: number; max: number; color?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div class="ui-bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span class="ui-bar__fill" style={{ transform: `scaleX(${ratio})`, background: value > max ? 'var(--warning)' : color }} />
    </div>
  );
}

/** A number with a label and an optional trend: "82.4 кг ↓0.3/нед". */
export function Stat({
  label,
  value,
  unit,
  delta,
  deltaGood = 'up',
}: {
  label: string;
  value: ComponentChildren;
  unit?: string;
  delta?: { text: string; direction: 'up' | 'down' | 'flat' };
  /** Which direction is good, for coloring. */
  deltaGood?: 'up' | 'down';
}) {
  const tone =
    !delta || delta.direction === 'flat' ? 'flat' : delta.direction === deltaGood ? 'good' : 'bad';
  return (
    <div class="ui-stat">
      <span class="ui-stat__label">{label}</span>
      <span class="ui-stat__value num">
        {value}
        {unit && <span class="ui-stat__unit">{unit}</span>}
      </span>
      {delta && (
        <span class={cx('ui-stat__delta', `is-${tone}`)}>
          {delta.direction !== 'flat' && <Icon name={delta.direction === 'up' ? 'trendUp' : 'trendDown'} size={12} />}
          {delta.text}
        </span>
      )}
    </div>
  );
}
