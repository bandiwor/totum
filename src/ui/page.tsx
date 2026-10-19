import type { ComponentChildren } from 'preact';
import { goBack } from '@/core/router';
import { IconButton } from './primitives';

/** Scrollable screen with a header. `large` = iOS-style big title for tab roots. */
export function Page({
  title,
  large = false,
  back = false,
  actions,
  toolbar,
  children,
}: {
  title: string;
  large?: boolean;
  back?: boolean;
  actions?: ComponentChildren;
  /** Sticky content under the title (segmented control, date strip…). */
  toolbar?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <div class="ui-page">
      <header class="ui-header">
        <div class="ui-header__bar">
          {back ? <IconButton icon="chevronLeft" label="Назад" onClick={goBack} /> : <span class="ui-header__spacer" />}
          {!large && <h1 class="ui-header__title">{title}</h1>}
          <div class="ui-header__actions">{actions}</div>
        </div>
        {large && <h1 class="ui-header__large">{title}</h1>}
        {toolbar && <div class="ui-header__toolbar">{toolbar}</div>}
      </header>
      <div class="ui-page__content">{children}</div>
    </div>
  );
}
