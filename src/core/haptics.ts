import { settings } from './settings';

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 18,
  success: [12, 70, 18],
  warning: [22, 90, 22],
  error: [30, 60, 30, 60, 30],
};

/** How many taps of the iOS switch approximate each kind. */
const IOS_TAPS: Record<HapticKind, number> = {
  selection: 1,
  light: 1,
  medium: 1,
  success: 2,
  warning: 2,
  error: 3,
};

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1));

let iosSwitch: HTMLLabelElement | null = null;

/**
 * iOS Safari has no Vibration API. Since iOS 18, toggling a native
 * `<input type="checkbox" switch>` plays the system haptic, and clicking its
 * label from a user-gesture handler triggers it too. A hidden switch does that.
 */
function iosTap(): void {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

/** Call from a user-gesture handler (tap/click). Silently does nothing where unsupported. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!settings.value.value.haptics) return;
  if (canVibrate) {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (!isIOS) return;
  iosTap();
  // Extra taps for "patterned" feedback. iOS may drop them outside the gesture window.
  for (let i = 1; i < IOS_TAPS[kind]; i++) setTimeout(iosTap, i * 90);
}
