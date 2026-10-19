import type { ComponentChildren, JSX } from 'preact';
import { haptic, type HapticKind } from '@/core/haptics';
import { iconMarkup, type IconName } from './icons';

const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');
export { cx };

// ── Icon ────────────────────────────────────────────────────────────────────

export function Icon({ name, size = 22, class: className }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={cx('ui-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={2}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconMarkup(name) }}
    />
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonAttrs = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'icon' | 'size'>;

export interface ButtonProps extends ButtonAttrs {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  block?: boolean;
  /** Haptic on tap; `false` to disable. */
  feedback?: HapticKind | false;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  feedback = 'light',
  class: className,
  onClick,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      class={cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className as string)}
      onClick={(e) => {
        if (feedback) haptic(feedback);
        onClick?.(e);
      }}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 20} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export interface IconButtonProps extends ButtonAttrs {
  icon: IconName;
  label: string;
  variant?: 'plain' | 'filled' | 'accent';
  feedback?: HapticKind | false;
}

export function IconButton({ icon, label, variant = 'plain', feedback = 'light', class: className, onClick, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-label={label}
      class={cx('ui-iconbtn', `ui-iconbtn--${variant}`, className as string)}
      onClick={(e) => {
        if (feedback) haptic(feedback);
        onClick?.(e);
      }}
    >
      <Icon name={icon} />
    </button>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

export function Card({
  children,
  onClick,
  padded = true,
  class: className,
}: {
  children: ComponentChildren;
  onClick?: () => void;
  padded?: boolean;
  class?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        class={cx('ui-card', 'ui-card--interactive', padded && 'ui-card--padded', className)}
        onClick={() => {
          haptic('selection');
          onClick();
        }}
      >
        {children}
      </button>
    );
  }
  return <div class={cx('ui-card', padded && 'ui-card--padded', className)}>{children}</div>;
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <section class="ui-section">
      {(title || action) && (
        <div class="ui-section__head">
          {title && <h2 class="ui-section__title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function List({ children }: { children: ComponentChildren }) {
  return <div class="ui-list">{children}</div>;
}

export interface ListRowProps {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  value?: ComponentChildren;
  icon?: IconName;
  /** CSS color for the icon tile, e.g. "var(--c-2)". */
  iconColor?: string;
  leading?: ComponentChildren;
  trailing?: ComponentChildren;
  chevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export function ListRow({ title, subtitle, value, icon, iconColor, leading, trailing, chevron, danger, onClick }: ListRowProps) {
  const content = (
    <>
      {leading}
      {icon && (
        <span class="ui-row__icon" style={iconColor ? { color: iconColor, background: `color-mix(in srgb, ${iconColor} 16%, transparent)` } : undefined}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span class="ui-row__text">
        <span class={cx('ui-row__title', danger && 'is-danger')}>{title}</span>
        {subtitle && <span class="ui-row__subtitle">{subtitle}</span>}
      </span>
      {value !== undefined && <span class="ui-row__value num">{value}</span>}
      {trailing}
      {chevron && <Icon name="chevronRight" size={18} class="ui-row__chevron" />}
    </>
  );
  if (!onClick) return <div class="ui-row">{content}</div>;
  return (
    <button
      type="button"
      class="ui-row ui-row--interactive"
      onClick={() => {
        haptic('selection');
        onClick();
      }}
    >
      {content}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ComponentChildren;
}) {
  return (
    <div class="ui-empty">
      <span class="ui-empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <p class="ui-empty__title">{title}</p>
      {text && <p class="ui-empty__text">{text}</p>}
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ComponentChildren; tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger' }) {
  return <span class={cx('ui-badge', `ui-badge--${tone}`)}>{children}</span>;
}
