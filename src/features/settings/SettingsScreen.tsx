import { appVersion, applyUpdate, checkForUpdate, checkingUpdate, storagePersisted, updateReady } from '@/core/pwa';
import { settings, type ThemePref } from '@/core/settings';
import { Badge, Button, List, ListRow, openSheet, Page, Section, SegmentedControl, Switch, toast } from '@/ui';
import { BackupsSheet, ExportSheet, ImportSheet } from './DataSheets';

const THEMES = [
  { value: 'dark', label: 'Тёмная' },
  { value: 'light', label: 'Светлая' },
  { value: 'system', label: 'Системная' },
] as const satisfies readonly { value: ThemePref; label: string }[];

export function SettingsScreen() {
  const s = settings.value.value;

  const check = async (): Promise<void> => {
    const found = await checkForUpdate();
    if (!found) toast('Установлена последняя версия');
  };

  return (
    <Page title="Настройки" back>
      <Section title="Данные">
        <List>
          <ListRow icon="download" iconColor="var(--accent)" title="Экспорт" subtitle="Скопировать все данные" chevron onClick={() => openSheet(() => <ExportSheet />, { title: 'Экспорт' })} />
          <ListRow icon="upload" iconColor="var(--accent)" title="Импорт" subtitle="Вставить ранее скопированные данные" chevron onClick={() => openSheet((close) => <ImportSheet close={close} />, { title: 'Импорт' })} />
          <ListRow icon="history" title="Автокопии" subtitle="Создаются перед импортом" chevron onClick={() => openSheet((close) => <BackupsSheet close={close} />, { title: 'Автокопии' })} />
        </List>
        {storagePersisted.value === false && (
          <p class="settings__note">Браузер может очистить данные при нехватке места. Регулярно делай экспорт.</p>
        )}
      </Section>

      <Section title="Оформление">
        <SegmentedControl options={THEMES} value={s.theme} onChange={(theme) => settings.set({ theme })} />
        <List>
          <ListRow icon="zap" title="Вибрация" trailing={<Switch label="Вибрация" checked={s.haptics} onChange={(haptics) => settings.set({ haptics })} />} />
          <ListRow icon="sparkles" title="Эффекты" subtitle="Анимации наград" trailing={<Switch label="Эффекты" checked={s.effects} onChange={(effects) => settings.set({ effects })} />} />
        </List>
      </Section>

      <Section title="Приложение">
        <List>
          <ListRow
            icon="refresh"
            title="Версия"
            subtitle={appVersion}
            trailing={
              updateReady.value ? (
                <Button size="sm" variant="primary" onClick={applyUpdate}>
                  Обновить
                </Button>
              ) : (
                <Button size="sm" disabled={checkingUpdate.value} onClick={() => void check()}>
                  {checkingUpdate.value ? 'Проверка…' : 'Проверить'}
                </Button>
              )
            }
          />
          <ListRow icon="info" title="Хранилище" value={storagePersisted.value ? <Badge tone="positive">Постоянное</Badge> : <Badge>Обычное</Badge>} />
        </List>
      </Section>
    </Page>
  );
}
