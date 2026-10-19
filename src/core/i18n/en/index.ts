import type { LocaleMessages } from '../i18n';
import { app, backup, collections, cycle } from './core';
import { common, time, units } from './common';
import { places, plan, schedule, tasks, work } from './plan';
import { quick, settings, today } from './screens';
import { training } from './training';
import { nutrition } from './nutrition';
import { money } from './money';
import { notes } from './notes';
import { languages, modules, onboarding, packs, reset, storage } from './system';
import { sleep } from './sleep';

export const en: LocaleMessages = { common, time, units, cycle, backup, collections, app, today, quick, settings, plan, schedule, tasks, work, places, training, nutrition, money, notes, sleep, modules, languages, packs, storage, onboarding, reset };
