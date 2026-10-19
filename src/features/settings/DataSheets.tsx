import { useEffect, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import {
  applyImport,
  exportJSON,
  listAutoBackups,
  parseBackup,
  type ImportPreview,
} from '@/core/store/backup';
import type { StoredBackup } from '@/core/store/idb';
import { Button, confirm, EmptyState, List, ListRow, SheetActions, TextArea, toast } from '@/ui';
import { t } from '@/core/i18n';
import { formatDateTime } from '@/core/date';

const formatBytes = (n: number): string =>
  n < 1024 ? t('units.bytes', { n }) : n < 1048576 ? t('units.kb', { n: (n / 1024).toFixed(1) }) : t('units.mb', { n: (n / 1048576).toFixed(1) });
const formatStamp = formatDateTime;

export function ExportSheet() {
  const [json] = useState(exportJSON);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(json);
      haptic('success');
      toast(t('settings.copied'), { tone: 'success' });
    } catch {
      toast(t('settings.copyFailed'), { tone: 'error' });
    }
  };
  return (
    <>
      <p class="sheet-note">
        {t('settings.exportText', { size: formatBytes(new Blob([json]).size) })}
      </p>
      <TextArea value={json} readOnly rows={8} class="mono" />
      <SheetActions>
        <Button variant="primary" size="lg" icon="copy" block feedback={false} onClick={copy}>
          {t('settings.copy')}
        </Button>
      </SheetActions>
    </>
  );
}

export function ImportSheet({ close }: { close: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const paste = async (): Promise<void> => {
    try {
      setText(await navigator.clipboard.readText());
      setPreview(null);
      setError(null);
    } catch {
      toast(t('settings.pasteFailed'), { tone: 'error' });
    }
  };

  const check = (): void => {
    try {
      setPreview(parseBackup(text));
      setError(null);
      haptic('success');
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
      haptic('error');
    }
  };

  const apply = async (): Promise<void> => {
    if (!preview) return;
    const ok = await confirm({
      title: t('settings.replaceTitle'),
      message: t('settings.replaceMessage'),
      confirmLabel: t('settings.replace'),
      danger: true,
    });
    if (!ok) return;
    await applyImport(preview);
    haptic('success');
    toast(t('settings.imported'), { tone: 'success' });
    close();
  };

  return (
    <>
      <TextArea
        value={text}
        onValue={(v) => {
          setText(v);
          setPreview(null);
          setError(null);
        }}
        placeholder={t('settings.pastePlaceholder')}
        rows={6}
        class="mono"
        autoCapitalize="off"
        autoCorrect="off"
        spellcheck={false}
      />
      {error && <p class="sheet-error">{error}</p>}
      {preview && (
        <div class="import-preview">
          <p class="sheet-note">{t('settings.exportedAt', { date: formatStamp(Date.parse(preview.exportedAt)) })}</p>
          {preview.counts.length === 0 ? (
            <p class="sheet-note">{t('settings.onlySettings')}</p>
          ) : (
            <List>
              {preview.counts.map((c) => (
                <ListRow key={c.name} title={c.label} value={c.count} />
              ))}
            </List>
          )}
          {preview.warnings.map((w) => (
            <p key={w} class="sheet-note">
              {w}
            </p>
          ))}
        </div>
      )}
      <SheetActions>
        {preview ? (
          <Button variant="danger" size="lg" icon="upload" block feedback={false} onClick={apply}>
            {t('settings.replaceData')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" icon="paste" block onClick={paste}>
              {t('settings.pasteFromClipboard')}
            </Button>
            <Button variant="primary" size="lg" block disabled={!text.trim()} feedback={false} onClick={check}>
              {t('common.check')}
            </Button>
          </>
        )}
      </SheetActions>
    </>
  );
}

export function BackupsSheet({ close }: { close: () => void }) {
  const [items, setItems] = useState<StoredBackup[] | null>(null);
  useEffect(() => {
    void listAutoBackups().then(setItems);
  }, []);

  const restore = async (b: StoredBackup): Promise<void> => {
    const ok = await confirm({
      title: t('settings.restoreTitle'),
      message: t('settings.restoreMessage', { date: formatStamp(b.createdAt) }),
      confirmLabel: t('settings.restore'),
      danger: true,
    });
    if (!ok) return;
    try {
      await applyImport(parseBackup(b.json), t('backup.beforeRestore'));
      toast(t('settings.restored'), { tone: 'success' });
      close();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('settings.restoreFailed'), { tone: 'error' });
    }
  };

  if (!items) return null;
  if (items.length === 0) {
    return <EmptyState icon="history" title={t('settings.noBackups')} text={t('settings.noBackupsText')} />;
  }
  return (
    <List>
      {items.map((b) => (
        <ListRow
          key={b.id}
          icon="history"
          title={formatStamp(b.createdAt)}
          subtitle={`${b.reason} · ${formatBytes(b.json.length)}`}
          chevron
          onClick={() => void restore(b)}
        />
      ))}
    </List>
  );
}
