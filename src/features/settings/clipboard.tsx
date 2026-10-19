import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { TextArea, toast } from '@/ui';

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    haptic('success');
    toast(t('settings.copied'), { tone: 'success' });
  } catch {
    toast(t('settings.copyFailed'), { tone: 'error' });
  }
}

/** Clipboard text, or null (with a toast) when access is denied. */
export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast(t('settings.pasteFailed'), { tone: 'error' });
    return null;
  }
}

/** Monospace field for pasted JSON (export, packs, languages). */
export function JsonField({ value, onValue, placeholder, readOnly }: { value: string; onValue?: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
  return (
    <TextArea
      value={value}
      {...(onValue ? { onValue } : {})}
      {...(placeholder ? { placeholder } : {})}
      readOnly={readOnly ?? false}
      rows={readOnly ? 8 : 6}
      class="mono"
      autoCapitalize="off"
      autoCorrect="off"
      spellcheck={false}
    />
  );
}
