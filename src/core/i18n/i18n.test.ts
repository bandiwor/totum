import { describe, expect, it } from 'vitest';
import { t } from './i18n';

describe('i18n', () => {
  it('interpolates typed params', () => {
    expect(t('time.hm', { h: 1, m: 40 })).toBe('1 ч 40 мин');
    expect(t('common.save')).toBe('Сохранить');
  });

  it('picks Russian plural forms', () => {
    expect(t('plan.bellsCount', { count: 1 })).toBe('1 пара');
    expect(t('plan.bellsCount', { count: 3 })).toBe('3 пары');
    expect(t('plan.bellsCount', { count: 5 })).toBe('5 пар');
    expect(t('plan.bellsCount', { count: 21 })).toBe('21 пара');
    expect(t('plan.bellsCount', { count: 12 })).toBe('12 пар');
  });

  it('is checked at compile time', () => {
    // @ts-expect-error — unknown key
    expect(t('nope.missing')).toBe('nope.missing');
    // @ts-expect-error — missing required params
    expect(t('time.hm')).toBe('{h} ч {m} мин');
    // @ts-expect-error — wrong param name
    expect(t('time.h', { x: 1 })).toBe('{h} ч');
  });
});
