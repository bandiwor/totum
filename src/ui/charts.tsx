import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { diffDays, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';

/** Width of an element, kept in sync with resizes. */
function useWidth<T extends HTMLElement>(): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

const shortDate = (d: ISODate): string => `${Number(d.slice(8))}.${d.slice(5, 7)}`;

// Top padding leaves room for the tooltip inside the chart.
const PAD = { top: 44, right: 12, bottom: 24, left: 40 };

export interface LineChartProps {
  points: readonly { date: ISODate; value: number }[];
  /** Fitted trend (drawn dashed between the first and last date). */
  trendAt?: ((date: ISODate) => number) | undefined;
  format?: (value: number) => string;
  height?: number;
  /** Optional horizontal reference (e.g. 100 for an index). */
  reference?: number;
}

/** Single-series line with optional trend, recessive grid and a touch crosshair. */
export function LineChart({ points, trendAt, format = (v) => v.toFixed(0), height = 190, reference }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => setActive(null), [points]);

  if (points.length === 0) return <div class="ui-chart ui-chart--empty">Нет данных</div>;

  const first = points[0]!.date;
  const last = points[points.length - 1]!.date;
  const span = Math.max(1, diffDays(first, last));
  const trendValues = trendAt ? [trendAt(first), trendAt(last)] : [];
  const values = [...points.map((p) => p.value), ...trendValues, ...(reference !== undefined ? [reference] : [])];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
  lo -= pad;
  hi += pad;

  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (d: ISODate): number => PAD.left + (points.length === 1 ? w / 2 : (diffDays(first, d) / span) * w);
  const y = (v: number): number => PAD.top + h - ((v - lo) / (hi - lo)) * h;
  const ticks = niceTicks(lo, hi);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const pick = (clientX: number, target: Element): void => {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    let dist = Infinity;
    points.forEach((p, i) => {
      const dd = Math.abs(x(p.date) - px);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    if (best !== active) {
      haptic('selection');
      setActive(best);
    }
  };

  const sel = active !== null ? points[active] : undefined;

  return (
    <div class="ui-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerMove={(e) => e.buttons && pick(e.clientX, e.currentTarget)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line class="ui-chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text class="ui-chart__tick" x={PAD.left - 6} y={y(t)} text-anchor="end" dominant-baseline="middle">
                {format(t)}
              </text>
            </g>
          ))}
          {reference !== undefined && <line class="ui-chart__ref" x1={PAD.left} x2={width - PAD.right} y1={y(reference)} y2={y(reference)} />}
          <text class="ui-chart__tick" x={PAD.left} y={height - 6}>
            {shortDate(first)}
          </text>
          {points.length > 1 && (
            <text class="ui-chart__tick" x={width - PAD.right} y={height - 6} text-anchor="end">
              {shortDate(last)}
            </text>
          )}
          {trendAt && points.length > 1 && (
            <line class="ui-chart__trend" x1={x(first)} y1={y(trendAt(first))} x2={x(last)} y2={y(trendAt(last))} />
          )}
          <path class="ui-chart__line" d={path} />
          {sel && <line class="ui-chart__cross" x1={x(sel.date)} x2={x(sel.date)} y1={PAD.top} y2={PAD.top + h} />}
          {points.map((p, i) => (
            <circle key={i} class={i === active ? 'ui-chart__dot is-active' : 'ui-chart__dot'} cx={x(p.date)} cy={y(p.value)} r={i === active ? 6 : 4} />
          ))}
        </svg>
      )}
      {sel && (
        <div class="ui-chart__tip" style={{ left: Math.min(Math.max(x(sel.date), 60), width - 60) }}>
          <span class="num">{format(sel.value)}</span>
          <span>{shortDate(sel.date)}</span>
        </div>
      )}
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
}

/** Vertical bars with 4px rounded tops, 2px gaps and tap-to-read values. */
export function BarChart({ bars, format = (v) => v.toFixed(0), height = 150 }: { bars: readonly Bar[]; format?: (v: number) => string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (bars.length === 0) return <div class="ui-chart ui-chart--empty">Нет данных</div>;

  const max = Math.max(1, ...bars.map((b) => b.value));
  const left = 8;
  const right = 8;
  const top = 18;
  const bottom = 22;
  const w = Math.max(0, width - left - right);
  const h = height - top - bottom;
  const slot = w / bars.length;
  const bw = Math.max(4, Math.min(28, slot - 2));
  const labelEvery = Math.ceil(bars.length / 6);

  return (
    <div class="ui-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height}>
          <line class="ui-chart__grid" x1={left} x2={width - right} y1={top + h} y2={top + h} />
          {bars.map((b, i) => {
            const bh = (b.value / max) * h;
            const bx = left + i * slot + (slot - bw) / 2;
            const by = top + h - bh;
            const r = Math.min(4, bh / 2, bw / 2);
            return (
              <g
                key={b.key}
                onPointerDown={() => {
                  haptic('selection');
                  setActive(i === active ? null : i);
                }}
              >
                <rect x={left + i * slot} y={top} width={slot} height={h} fill="transparent" />
                {bh > 0 && (
                  <path
                    class={i === active ? 'ui-chart__bar is-active' : 'ui-chart__bar'}
                    d={`M${bx},${top + h}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${top + h}Z`}
                  />
                )}
                {i === active && (
                  <text class="ui-chart__value" x={bx + bw / 2} y={by - 5} text-anchor="middle">
                    {format(b.value)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text class="ui-chart__tick" x={bx + bw / 2} y={height - 6} text-anchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export { shortDate };
