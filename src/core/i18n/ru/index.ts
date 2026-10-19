import { app, backup, collections, cycle } from './core';
import { common, time, units } from './common';
import { places, plan, schedule, tasks, work } from './plan';
import { quick, settings, today } from './screens';
import { stubs, training } from './training';

export const ru = { common, time, units, cycle, backup, collections, app, today, quick, settings, plan, schedule, tasks, work, places, training, stubs } as const;
