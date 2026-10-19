import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import {
  customLanguages,
  fallbackCandidates,
  languageCoverage,
  languages,
  languageTemplate,
  parseLanguage,
  validTag,
  type CustomLanguage,
  type Language,
  type ParsedLanguage,
} from '@/core/i18n/languages';
import { settings } from '@/core/settings';
import { Badge, Button, ChoiceChips, confirm, Field, Form, Icon, List, ListRow, openSheet, Page, Section, SheetActions, TextField } from '@/ui';
import { copyText, JsonField, readClipboard } from './clipboard';

const percent = (x: number): string => `${Math.floor(x * 100)}%`;

/** Paste a translation; for an existing custom language it replaces its texts. */
function LanguageForm({ lang, close }: { lang: CustomLanguage | null; close: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedLanguage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(lang?.name ?? '');
  const [tag, setTag] = useState(lang?.tag ?? '');
  const candidates = fallbackCandidates(lang?.id);
  const [fallback, setFallback] = useState(lang?.fallback ?? candidates[0]?.id ?? 'ru');

  const check = (value: string): void => {
    setText(value);
    if (!value.trim()) return void (setParsed(null), setError(null));
    try {
      const p = parseLanguage(value);
      setParsed(p);
      setError(null);
      if (p.name && !name) setName(p.name);
      if (p.tag && !tag) setTag(p.tag);
      if (p.fallback && candidates.some((c) => c.id === p.fallback)) setFallback(p.fallback);
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const tagOk = validTag(tag.trim());
  const canSave = (parsed !== null || lang !== null) && name.trim() !== '' && tagOk;

  const save = (): void => {
    const data = { name: name.trim(), tag: tag.trim(), fallback, ...(parsed ? { messages: parsed.messages } : {}) };
    if (lang) customLanguages.update(lang.id, data);
    else if (parsed) settings.set({ language: customLanguages.add({ ...data, messages: parsed.messages }).id });
    haptic('success');
    close();
  };

  return (
    <Form>
      <JsonField value={text} onValue={check} placeholder={t('languages.pastePlaceholder')} />
      {error && <p class="sheet-error">{error}</p>}
      {parsed && <p class="sheet-note">{t('languages.coverage', { percent: percent(parsed.coverage) })}</p>}
      <TextField label={t('languages.name')} value={name} onValue={setName} placeholder="Українська" />
      <TextField label={t('languages.tag')} value={tag} onValue={setTag} placeholder="uk" autoCapitalize="off" />
      {tag.trim() !== '' && !tagOk && <p class="sheet-error">{t('languages.badTag')}</p>}
      <Field label={t('languages.fallback')} hint={t('languages.fallbackHint')}>
        <ChoiceChips options={candidates.map((c) => ({ value: c.id, label: c.name }))} value={fallback} onChange={(v) => v && setFallback(v)} />
      </Field>
      <SheetActions>
        <Button
          variant="secondary"
          size="lg"
          icon="paste"
          block
          onClick={async () => {
            const pasted = await readClipboard();
            if (pasted !== null) check(pasted);
          }}
        >
          {t('settings.pasteFromClipboard')}
        </Button>
        <Button variant="primary" size="lg" block disabled={!canSave} onClick={save}>
          {t('common.save')}
        </Button>
        {lang && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              const ok = await confirm({ title: t('languages.deleteTitle', { name: lang.name }), confirmLabel: t('common.delete'), danger: true });
              if (!ok) return;
              if (settings.value.value.language === lang.id) settings.set({ language: lang.fallback });
              customLanguages.remove(lang.id);
              close();
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

function TemplateSheet() {
  const sources = fallbackCandidates();
  return (
    <>
      <p class="sheet-note">{t('languages.templateText')}</p>
      <List>
        {sources.map((l) => (
          <ListRow key={l.id} icon="copy" title={l.name} onClick={() => void copyText(languageTemplate(l))} />
        ))}
      </List>
    </>
  );
}

function openForm(lang: CustomLanguage | null): void {
  void openSheet((close) => <LanguageForm lang={lang} close={close} />, { title: lang ? lang.name : t('languages.add') });
}

export function LanguageScreen() {
  const current = settings.value.value.language;
  const pick = (l: Language): void => {
    haptic('selection');
    settings.set({ language: l.id });
  };
  return (
    <Page title={t('languages.title')} back>
      <Section>
        <List>
          {languages.value.map((l) => {
            const cov = languageCoverage(l);
            const custom = l.builtin ? undefined : customLanguages.get(l.id);
            return (
              <ListRow
                key={l.id}
                title={l.name}
                subtitle={l.builtin ? t('languages.builtin') : t('languages.customSub', { percent: percent(cov), tag: l.tag })}
                trailing={
                  <>
                    {custom && (
                      <Button size="sm" variant="ghost" onClick={() => openForm(custom)}>
                        {t('common.edit')}
                      </Button>
                    )}
                    {current === l.id ? <Icon name="check" size={20} class="lang-check" /> : cov < 1 ? <Badge>{percent(cov)}</Badge> : null}
                  </>
                }
                onClick={() => pick(l)}
              />
            );
          })}
        </List>
      </Section>
      <Section>
        <List>
          <ListRow icon="plus" title={t('languages.add')} subtitle={t('languages.addSub')} chevron onClick={() => openForm(null)} />
          <ListRow icon="copy" title={t('languages.template')} subtitle={t('languages.templateSub')} chevron onClick={() => void openSheet(() => <TemplateSheet />, { title: t('languages.template') })} />
        </List>
      </Section>
    </Page>
  );
}
