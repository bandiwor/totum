import { useState } from 'preact/hooks';
import { EmptyState, Page, SegmentedControl, type IconName } from '@/ui';
import { t } from '@/core/i18n';

export interface PlaceholderTab {
  value: string;
  label: string;
  icon: IconName;
  stage: number;
  text: string;
}

/** Temporary tab content until the section's stage is implemented. */
export function Placeholder({ title, tabs }: { title: string; tabs: PlaceholderTab[] }) {
  const [active, setActive] = useState(tabs[0]?.value ?? '');
  const tab = tabs.find((t) => t.value === active) ?? tabs[0];
  return (
    <Page
      title={title}
      large
      toolbar={tabs.length > 1 ? <SegmentedControl options={tabs} value={active} onChange={setActive} /> : undefined}
    >
      {tab && <EmptyState icon={tab.icon} title={t('common.stage', { n: tab.stage })} text={tab.text} />}
    </Page>
  );
}
