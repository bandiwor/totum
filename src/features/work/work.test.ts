import { describe, expect, it } from 'vitest';
import type { ISODate } from '@/core/date';
import { jobs } from './model';

const d = (s: string): ISODate => s as ISODate;

describe('night shifts', () => {
  it('split across midnight into an evening and a morning block', async () => {
    // The feature module pulls in the router, which reads location.hash.
    Object.assign(globalThis, { location: { hash: '' }, addEventListener: () => {}, window: globalThis, matchMedia: () => ({ matches: false, addEventListener: () => {} }) });
    const { workFeature } = await import('./index');
    jobs.add({ name: 'Кафе', color: 'c7', placeId: 'cafe', payType: 'hour', rate: 250, archived: false, cycle: { anchor: d('2026-10-19'), weekAligned: true, days: [[{ id: 'sh1', jobId: '', start: 1320, end: 1800 }], [], [], [], [], [], []] } });
    const job = jobs.all.value[0]!;
    jobs.update(job.id, { cycle: { ...job.cycle!, days: [[{ id: 'sh1', jobId: job.id, start: 1320, end: 1800 }], [], [], [], [], [], []] } });
    const src = workFeature.busySources![0]!;
    expect(src.blocksFor(d('2026-10-19'))).toMatchObject([{ start: 1320, end: 1440, continues: true }]);
    expect(src.blocksFor(d('2026-10-20'))).toMatchObject([{ start: 0, end: 360, continued: true }]);
  });
});
