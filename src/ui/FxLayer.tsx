import { useEffect, useRef } from 'preact/hooks';
import { consumeFx, fxQueue, type FxEvent, type FxKind } from '@/core/fx';

/**
 * Reward effects queued by `fx()`. Small, quick and non-linear; GPU-friendly
 * (transform/opacity only); skipped entirely with "reduce motion".
 */

type Point = { x: number; y: number };

const ENTER = 'cubic-bezier(0.05, 0.7, 0.1, 1)';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function spawn(layer: HTMLElement, cls: string, at: Point, color: string): HTMLElement {
  const el = document.createElement('span');
  el.className = cls;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  el.style.background = color;
  layer.append(el);
  return el;
}

/** A few dots flying out of the tapped control. */
function sparks(layer: HTMLElement, at: Point, color: string, count = 8, distance = 26): void {
  for (let i = 0; i < count; i++) {
    const el = spawn(layer, 'fx-dot', at, color);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = distance * (0.75 + Math.random() * 0.4);
    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * d}px), calc(-50% + ${Math.sin(angle) * d}px)) scale(0.3)`, opacity: 0 },
      ],
      { duration: 520, easing: ENTER, fill: 'forwards' },
    ).onfinish = () => el.remove();
  }
}

/** A soft expanding ring. */
function ring(layer: HTMLElement, at: Point, color: string): void {
  const el = spawn(layer, 'fx-ring', at, 'transparent');
  el.style.borderColor = color;
  el.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 },
    ],
    { duration: 700, easing: ENTER, fill: 'forwards' },
  ).onfinish = () => el.remove();
}

/** Confetti: a quick rise, then a slow tumble down. */
function confetti(layer: HTMLElement, at: Point, colors: string[], count = 28): void {
  for (let i = 0; i < count; i++) {
    const el = spawn(layer, 'fx-confetti', at, colors[i % colors.length] ?? '#fff');
    const spread = (Math.random() - 0.5) * 2;
    const dx = spread * 140;
    const rise = 120 + Math.random() * 120;
    const fall = 160 + Math.random() * 140;
    const spin = (Math.random() - 0.5) * 720;
    el.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1, offset: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% - ${rise}px)) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.35, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise - fall}px)) rotate(${spin}deg)`, opacity: 0, offset: 1 },
      ],
      { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
    ).onfinish = () => el.remove();
  }
}

const BIG: readonly FxKind[] = ['all-tasks-done', 'workout-done', 'personal-record', 'savings-goal', 'streak'];

function play(layer: HTMLElement, e: FxEvent): void {
  if (reducedMotion.matches) return;
  const at = e.origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.62 };
  const accent = cssVar('--accent');
  const success = cssVar('--accent-2');
  const palette = [accent, success, cssVar('--c-1'), cssVar('--c-3'), cssVar('--c-5'), cssVar('--c-6')];
  switch (e.kind) {
    case 'task-done':
    case 'set-done':
      sparks(layer, at, success);
      break;
    case 'nutrition-goal':
    case 'water-goal':
      ring(layer, at, success);
      sparks(layer, at, success, 10, 40);
      break;
    default:
      if (BIG.includes(e.kind)) {
        if (e.kind === 'personal-record') ring(layer, at, accent);
        confetti(layer, at, palette);
      }
  }
}

export function FxLayer() {
  const layer = useRef<HTMLDivElement>(null);
  const events = fxQueue.value;
  useEffect(() => {
    for (const e of events) {
      if (layer.current) play(layer.current, e);
      consumeFx(e.id);
    }
  }, [events]);
  return <div class="ui-fx-layer" ref={layer} aria-hidden="true" />;
}
