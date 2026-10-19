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

const formatBytes = (n: number): string => (n < 1024 ? `${n} Б` : n < 1048576 ? `${(n / 1024).toFixed(1)} КБ` : `${(n / 1048576).toFixed(1)} МБ`);
const formatStamp = (ms: number): string =>
  new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ExportSheet() {
  const [json] = useState(exportJSON);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(json);
      haptic('success');
      toast('Скопировано в буфер обмена', { tone: 'success' });
    } catch {
      toast('Не удалось скопировать — выдели текст вручную', { tone: 'error' });
    }
  };
  return (
    <>
      <p class="sheet-note">
        Все данные одним текстом ({formatBytes(new Blob([json]).size)}). Сохрани его в Заметках или отправь себе — это твоя резервная копия.
      </p>
      <TextArea value={json} readOnly rows={8} class="mono" />
      <SheetActions>
        <Button variant="primary" size="lg" icon="copy" block feedback={false} onClick={copy}>
          Скопировать
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
      toast('Нет доступа к буферу — вставь вручную', { tone: 'error' });
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
      title: 'Заменить все данные?',
      message: 'Текущие данные будут заменены. Перед этим автоматически сохранится копия — её можно восстановить.',
      confirmLabel: 'Заменить',
      danger: true,
    });
    if (!ok) return;
    await applyImport(preview);
    haptic('success');
    toast('Данные импортированы', { tone: 'success' });
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
        placeholder="Вставь сюда экспорт…"
        rows={6}
        class="mono"
        autoCapitalize="off"
        autoCorrect="off"
        spellcheck={false}
      />
      {error && <p class="sheet-error">{error}</p>}
      {preview && (
        <div class="import-preview">
          <p class="sheet-note">Экспорт от {formatStamp(Date.parse(preview.exportedAt))}:</p>
          {preview.counts.length === 0 ? (
            <p class="sheet-note">Записей нет (только настройки).</p>
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
            Заменить данные
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" icon="paste" block onClick={paste}>
              Вставить из буфера
            </Button>
            <Button variant="primary" size="lg" block disabled={!text.trim()} feedback={false} onClick={check}>
              Проверить
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
      title: 'Восстановить копию?',
      message: `Копия от ${formatStamp(b.createdAt)}. Текущие данные тоже сохранятся копией.`,
      confirmLabel: 'Восстановить',
      danger: true,
    });
    if (!ok) return;
    try {
      await applyImport(parseBackup(b.json), 'Перед восстановлением');
      toast('Копия восстановлена', { tone: 'success' });
      close();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка восстановления', { tone: 'error' });
    }
  };

  if (!items) return null;
  if (items.length === 0) {
    return <EmptyState icon="history" title="Копий пока нет" text="Копия создаётся автоматически перед каждым импортом." />;
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
