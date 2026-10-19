import { useEffect, useState } from 'preact/hooks';
import { t } from '@/core/i18n';
import { requestPersistentStorage, storagePersisted } from '@/core/pwa';
import { Badge, Button, SheetActions } from '@/ui';
import { formatBytes } from './DataSheets';

/** What "persistent" vs "normal" storage means, and what protects the data. */
export function StorageSheet() {
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsed(e.usage ?? null));
  }, []);
  const persisted = storagePersisted.value;

  return (
    <div class="storage-info">
      <div class="storage-info__status">
        {persisted ? <Badge tone="positive">{t('settings.storagePersistent')}</Badge> : <Badge>{t('settings.storageNormal')}</Badge>}
        {used !== null && <span class="num">{t('storage.used', { size: formatBytes(used) })}</span>}
      </div>
      <p>{t('storage.where')}</p>
      <h3>{t('settings.storagePersistent')}</h3>
      <p>{t('storage.persistent')}</p>
      <h3>{t('settings.storageNormal')}</h3>
      <p>{t('storage.normal')}</p>
      <h3>{t('storage.whyTitle')}</h3>
      <p>{t('storage.why')}</p>
      <h3>{t('storage.protectTitle')}</h3>
      <p>{t('storage.protect')}</p>
      {!persisted && (
        <SheetActions>
          <Button variant="primary" size="lg" block onClick={() => void requestPersistentStorage()}>
            {t('storage.request')}
          </Button>
        </SheetActions>
      )}
    </div>
  );
}
