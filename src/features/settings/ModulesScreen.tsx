import { t } from '@/core/i18n';
import { MODULE_IDS, MODULE_INFO, isModuleOn, moduleVisible, setModule, setTabOrder } from '@/core/modules';
import { registry } from '@/core/registry';
import { List, ListRow, Page, ReorderList, Section, Switch } from '@/ui';

/** Turn sections of the app on/off and order the tab bar. */
export function ModulesScreen() {
  const tabs = registry.allTabs();
  return (
    <Page title={t('modules.title')} back>
      <Section title={t('modules.tabOrder')}>
        <ReorderList
          items={tabs}
          keyOf={(tab) => tab.path}
          gripLabel={t('common.reorder')}
          onReorder={setTabOrder}
          render={(tab) => (
            <ListRow icon={tab.icon} title={t(tab.label)} {...(moduleVisible(tab.module) ? {} : { subtitle: t('modules.hidden') })} />
          )}
        />
        <p class="settings__note">{t('modules.tabOrderHint')}</p>
      </Section>

      <Section title={t('modules.sections')}>
        <List>
          {MODULE_IDS.map((id) => {
            const info = MODULE_INFO[id];
            return (
              <ListRow
                key={id}
                icon={info.icon}
                title={t(info.label)}
                subtitle={t(info.hint)}
                trailing={<Switch label={t(info.label)} checked={isModuleOn(id)} onChange={(on) => setModule(id, on)} />}
              />
            );
          })}
        </List>
        <p class="settings__note">{t('modules.dataKept')}</p>
      </Section>
    </Page>
  );
}
