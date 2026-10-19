import { appVersion, applyUpdate, checkForUpdate, checkingUpdate, storagePersisted, updateReady } from '@/core/pwa';
import { settings, type ThemePref } from '@/core/settings';
import { Badge, Button, Card, List, ListRow, openSheet, Page, Section, SegmentedControl, Switch, toast } from '@/ui';
import { AccentPicker } from './AccentPicker';
import { BackupsSheet, ExportSheet, ImportSheet } from './DataSheets';
import { t } from '@/core/i18n';

const THEMES: readonly ThemePref[] = ['dark', 'light', 'system'];

export function SettingsScreen() {
  const s = settings.value.value;

  const check = async (): Promise<void> => {
    const found = await checkForUpdate();
    if (!found) toast(t('settings.upToDate'));
  };

  return (
    <Page title={t('settings.title')} back>
      <Section title={t('settings.data')}>
        <List>
          <ListRow icon="download" title={t('settings.export')} subtitle={t('settings.exportSub')} chevron onClick={() => openSheet(() => <ExportSheet />, { title: t('settings.export') })} />
          <ListRow icon="upload" title={t('settings.import')} subtitle={t('settings.importSub')} chevron onClick={() => openSheet((close) => <ImportSheet close={close} />, { title: t('settings.import') })} />
          <ListRow icon="history" title={t('settings.backups')} subtitle={t('settings.backupsSub')} chevron onClick={() => openSheet((close) => <BackupsSheet close={close} />, { title: t('settings.backups') })} />
        </List>
        {storagePersisted.value === false && (
          <p class="settings__note">{t('settings.evictionWarning')}</p>
        )}
      </Section>

      <Section title={t('settings.appearance')}>
        <SegmentedControl options={THEMES.map((value) => ({ value, label: t(`settings.themes.${value}`) }))} value={s.theme} onChange={(theme) => settings.set({ theme })} />
        <Card>
          <p class="accent-picker__title">{t('settings.accent')}</p>
          <AccentPicker />
        </Card>
        <List>
          <ListRow icon="zap" title={t('settings.haptics')} trailing={<Switch label={t('settings.haptics')} checked={s.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <ListRow icon="sparkles" title={t('settings.effects')} subtitle={t('settings.effectsSub')} trailing={<Switch label={t('settings.effects')} checked={s.effects} onChange={(effects) => settings.set({ effects })} />} />
        </List>
      </Section>

      <Section title={t('settings.appSection')}>
        <List>
          <ListRow
            icon="refresh"
            title={t('settings.version')}
            subtitle={appVersion}
            trailing={
              updateReady.value ? (
                <Button size="sm" variant="primary" onClick={applyUpdate}>
                  {t('app.update')}
                </Button>
              ) : (
                <Button size="sm" disabled={checkingUpdate.value} onClick={() => void check()}>
                  {checkingUpdate.value ? t('settings.checking') : t('common.check')}
                </Button>
              )
            }
          />
          <ListRow icon="info" title={t('settings.storage')} value={storagePersisted.value ? <Badge tone="positive">{t('settings.storagePersistent')}</Badge> : <Badge>{t('settings.storageNormal')}</Badge>} />
        </List>
      </Section>
    </Page>
  );
}
