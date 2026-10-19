import { useEffect } from 'preact/hooks';
import { consumeFx, fxQueue } from '@/core/fx';

/**
 * Renders celebration effects queued by `fx()`. STUB: currently consumes
 * events without visuals. Implement per kind here (confetti, glow, counters…);
 * use transform/opacity only and respect `prefers-reduced-motion`.
 */
export function FxLayer() {
  const events = fxQueue.value;
  useEffect(() => {
    for (const e of events) consumeFx(e.id);
  }, [events]);
  return <div class="ui-fx-layer" aria-hidden="true" />;
}
