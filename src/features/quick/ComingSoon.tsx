import type { QuickActionContext } from '@/core/registry';
import { Button, EmptyState } from '@/ui';
import { t } from '@/core/i18n';

export function comingSoon(stage: number) {
  return function ComingSoon({ back }: QuickActionContext) {
    return (
      <EmptyState
        icon="sparkles"
        title={t('common.comingSoon', { n: stage })}
        text={t('common.comingSoonText')}
        action={<Button onClick={back}>{t('common.back')}</Button>}
      />
    );
  };
}
