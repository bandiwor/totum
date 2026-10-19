import * as v from 'valibot';
import { isISODate, type ISODate } from '../date';
import { t } from '../i18n';

/** Shared valibot pieces for collection schemas (validated on import). */
export const entityFields = {
  id: v.pipe(v.string(), v.minLength(1)),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const isoDate = v.custom<ISODate>((x) => typeof x === 'string' && isISODate(x), () => t('backup.badDate'));
export const minutes = v.pipe(v.number(), v.minValue(0), v.maxValue(1440));
export const nullableString = v.nullable(v.string());

export function cycleSchema<TEntries extends v.GenericSchema>(day: TEntries) {
  return v.object({
    anchor: isoDate,
    days: v.pipe(v.array(day), v.minLength(1)),
    weekAligned: v.boolean(),
  });
}
