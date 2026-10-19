import { app, backup, collections, cycle } from './core';
import { common, time, units } from './common';
import { places, plan, schedule, tasks, work } from './plan';
import { quick, settings, today } from './screens';
import { stubs, training } from './training';
import { nutrition } from './nutrition';
import { money } from './money';

export const ru = { common, time, units, cycle, backup, collections, app, today, quick, settings, plan, schedule, tasks, work, places, training, stubs, nutrition, money } as const;
