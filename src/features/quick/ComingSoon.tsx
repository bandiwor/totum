import type { QuickActionContext } from '@/core/registry';
import { Button, EmptyState } from '@/ui';

export function comingSoon(stage: number) {
  return function ComingSoon({ back }: QuickActionContext) {
    return (
      <EmptyState
        icon="sparkles"
        title={`Появится на этапе ${stage}`}
        text="Кнопка уже на своём месте, логика подключится вместе с разделом."
        action={<Button onClick={back}>Назад</Button>}
      />
    );
  };
}
