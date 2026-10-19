import type { IconName } from '@/ui/icons';
import type { Localized, PackInput, PackItem } from '@/core/packs/types';

/** A pack shipped with the app (Settings → Packs). See docs/PACKS.md. */
export interface BuiltinPack {
  id: string;
  icon: IconName;
  name: Localized;
  description: Localized;
  /** `L` picks the text for the active language. */
  build: (L: (text: Localized) => string) => PackInput;
}

type Lang = (text: Localized) => string;

const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const;

// ── Exercise categories ────────────────────────────────────────────────────

const EXERCISE_CATEGORIES: readonly [id: string, ru: string, en: string, color: string][] = [
  ['cat-chest', 'Грудь', 'Chest', 'c1'],
  ['cat-back', 'Спина', 'Back', 'c2'],
  ['cat-legs', 'Ноги', 'Legs', 'c3'],
  ['cat-shoulders', 'Плечи', 'Shoulders', 'c5'],
  ['cat-arms', 'Руки', 'Arms', 'c6'],
  ['cat-core', 'Пресс', 'Core', 'c7'],
  ['cat-cardio', 'Кардио', 'Cardio', 'c4'],
];

function exerciseCategories(L: Lang): PackItem[] {
  return EXERCISE_CATEGORIES.map(([id, ru, en, color], order) => ({ id, name: L({ ru, en }), color, order }));
}

// ── Lesson types ───────────────────────────────────────────────────────────

const LESSON_TYPES: readonly [id: string, name: Localized, short: Localized, color: string][] = [
  ['lt-lecture', { ru: 'Лекция', en: 'Lecture' }, { ru: 'Лек', en: 'Lec' }, 'c1'],
  ['lt-practice', { ru: 'Практика', en: 'Practice' }, { ru: 'Пр', en: 'Pr' }, 'c2'],
  ['lt-lab', { ru: 'Лабораторная', en: 'Lab' }, { ru: 'Лаб', en: 'Lab' }, 'c3'],
  ['lt-seminar', { ru: 'Семинар', en: 'Seminar' }, { ru: 'Сем', en: 'Sem' }, 'c5'],
];

// ── Money categories ───────────────────────────────────────────────────────

const EXPENSE: readonly [id: string, ru: string, en: string][] = [
  ['mc-food', 'Продукты', 'Groceries'],
  ['mc-cafe', 'Кафе', 'Cafes'],
  ['mc-transport', 'Транспорт', 'Transport'],
  ['mc-study', 'Учёба', 'Education'],
  ['mc-sport', 'Спорт', 'Sport'],
  ['mc-health', 'Здоровье', 'Health'],
  ['mc-subscriptions', 'Подписки', 'Subscriptions'],
  ['mc-shopping', 'Покупки', 'Shopping'],
  ['mc-fun', 'Развлечения', 'Entertainment'],
  ['mc-other', 'Другое', 'Other'],
];

const INCOME: readonly [id: string, ru: string, en: string][] = [
  ['mc-salary', 'Зарплата', 'Salary'],
  ['mc-side', 'Подработка', 'Side jobs'],
  ['mc-scholarship', 'Стипендия', 'Scholarship'],
  ['mc-gifts', 'Подарки', 'Gifts'],
  ['mc-other-income', 'Другие доходы', 'Other income'],
];

function moneyCategories(L: Lang): PackItem[] {
  return [
    ...EXPENSE.map(([id, ru, en], i) => ({ id, name: L({ ru, en }), type: 'expense', color: COLORS[i % 8], order: i })),
    ...INCOME.map(([id, ru, en], i) => ({ id, name: L({ ru, en }), type: 'income', color: COLORS[i % 8], order: 100 + i })),
  ];
}

// ── Exercises ──────────────────────────────────────────────────────────────

type Measure = 'weight' | 'reps' | 'time';

const EXERCISES: readonly [id: string, ru: string, en: string, categoryId: string, measure: Measure, step: number][] = [
  ['ex-bench', 'Жим штанги лёжа', 'Barbell bench press', 'cat-chest', 'weight', 2.5],
  ['ex-incline-db-press', 'Жим гантелей на наклонной скамье', 'Incline dumbbell press', 'cat-chest', 'weight', 2],
  ['ex-db-fly', 'Разводка гантелей лёжа', 'Dumbbell fly', 'cat-chest', 'weight', 2],
  ['ex-pushups', 'Отжимания', 'Push-ups', 'cat-chest', 'reps', 1],
  ['ex-dips', 'Отжимания на брусьях', 'Dips', 'cat-chest', 'reps', 1],
  ['ex-pullups', 'Подтягивания', 'Pull-ups', 'cat-back', 'reps', 1],
  ['ex-barbell-row', 'Тяга штанги в наклоне', 'Barbell row', 'cat-back', 'weight', 2.5],
  ['ex-db-row', 'Тяга гантели одной рукой', 'One-arm dumbbell row', 'cat-back', 'weight', 2],
  ['ex-lat-pulldown', 'Тяга верхнего блока', 'Lat pulldown', 'cat-back', 'weight', 5],
  ['ex-seated-row', 'Тяга горизонтального блока', 'Seated cable row', 'cat-back', 'weight', 5],
  ['ex-deadlift', 'Становая тяга', 'Deadlift', 'cat-back', 'weight', 2.5],
  ['ex-squat', 'Приседания со штангой', 'Barbell squat', 'cat-legs', 'weight', 2.5],
  ['ex-rdl', 'Румынская тяга', 'Romanian deadlift', 'cat-legs', 'weight', 2.5],
  ['ex-leg-press', 'Жим ногами', 'Leg press', 'cat-legs', 'weight', 5],
  ['ex-lunges', 'Выпады с гантелями', 'Dumbbell lunges', 'cat-legs', 'weight', 2],
  ['ex-leg-extension', 'Разгибание ног в тренажёре', 'Leg extension', 'cat-legs', 'weight', 5],
  ['ex-leg-curl', 'Сгибание ног в тренажёре', 'Leg curl', 'cat-legs', 'weight', 5],
  ['ex-calf-raise', 'Подъём на носки', 'Calf raise', 'cat-legs', 'weight', 5],
  ['ex-ohp', 'Жим штанги стоя', 'Overhead press', 'cat-shoulders', 'weight', 2.5],
  ['ex-db-shoulder-press', 'Жим гантелей сидя', 'Seated dumbbell press', 'cat-shoulders', 'weight', 2],
  ['ex-lateral-raise', 'Махи гантелями в стороны', 'Lateral raise', 'cat-shoulders', 'weight', 1],
  ['ex-face-pull', 'Тяга каната к лицу', 'Face pull', 'cat-shoulders', 'weight', 5],
  ['ex-biceps-curl', 'Подъём штанги на бицепс', 'Barbell curl', 'cat-arms', 'weight', 2.5],
  ['ex-hammer-curl', 'Молотки с гантелями', 'Hammer curl', 'cat-arms', 'weight', 2],
  ['ex-triceps-pushdown', 'Разгибание рук на блоке', 'Triceps pushdown', 'cat-arms', 'weight', 5],
  ['ex-french-press', 'Французский жим', 'Skull crushers', 'cat-arms', 'weight', 2.5],
  ['ex-plank', 'Планка', 'Plank', 'cat-core', 'time', 10],
  ['ex-hanging-leg-raise', 'Подъём ног в висе', 'Hanging leg raise', 'cat-core', 'reps', 1],
  ['ex-crunches', 'Скручивания', 'Crunches', 'cat-core', 'reps', 1],
  ['ex-running', 'Бег', 'Running', 'cat-cardio', 'time', 60],
  ['ex-cycling', 'Велотренажёр', 'Stationary bike', 'cat-cardio', 'time', 60],
  ['ex-jump-rope', 'Скакалка', 'Jump rope', 'cat-cardio', 'time', 30],
];

// ── Foods (per 100 g / ml) ─────────────────────────────────────────────────

type Portion = [id: string, name: Localized, grams: number];
type FoodRow = [id: string, ru: string, en: string, kcal: number, p: number, f: number, c: number, unit?: 'g' | 'ml', portions?: Portion[]];

const pc = (grams: number): Portion => ['pc', { ru: 'шт', en: 'pc' }, grams];
const tbsp = (grams: number): Portion => ['tbsp', { ru: 'ст. л.', en: 'tbsp' }, grams];
const tsp = (grams: number): Portion => ['tsp', { ru: 'ч. л.', en: 'tsp' }, grams];
const glass = (grams: number): Portion => ['glass', { ru: 'стакан', en: 'glass' }, grams];
const slice = (grams: number): Portion => ['slice', { ru: 'ломтик', en: 'slice' }, grams];
const pack = (grams: number): Portion => ['pack', { ru: 'упаковка', en: 'pack' }, grams];
const handful = (grams: number): Portion => ['handful', { ru: 'горсть', en: 'handful' }, grams];

const FOODS: readonly FoodRow[] = [
  // Grains (dry)
  ['f-oats', 'Овсяные хлопья', 'Rolled oats', 366, 12.3, 6.2, 61.8, 'g', [glass(90)]],
  ['f-buckwheat', 'Гречка (сухая)', 'Buckwheat (dry)', 313, 12.6, 3.3, 62.1],
  ['f-rice', 'Рис белый (сухой)', 'White rice (dry)', 344, 6.7, 0.7, 78.9],
  ['f-pasta', 'Макароны (сухие)', 'Pasta (dry)', 350, 11, 1.3, 71.5],
  ['f-bread-white', 'Хлеб пшеничный', 'White bread', 250, 8.1, 1, 48.8, 'g', [slice(30)]],
  ['f-bread-rye', 'Хлеб ржаной', 'Rye bread', 210, 6.7, 1.2, 42.4, 'g', [slice(30)]],
  ['f-lentils', 'Чечевица (сухая)', 'Lentils (dry)', 295, 24, 1.5, 46.3],
  ['f-chickpeas', 'Нут (сухой)', 'Chickpeas (dry)', 364, 19, 6, 61],
  // Protein
  ['f-eggs', 'Яйцо куриное', 'Egg', 157, 12.7, 11.5, 0.7, 'g', [pc(55)]],
  ['f-chicken-breast', 'Куриная грудка', 'Chicken breast', 113, 23.6, 1.9, 0.4],
  ['f-chicken-thigh', 'Куриное бедро без кожи', 'Chicken thigh (skinless)', 185, 19, 12, 0],
  ['f-turkey', 'Филе индейки', 'Turkey fillet', 114, 24, 2, 0],
  ['f-beef', 'Говядина', 'Beef', 187, 18.9, 12.4, 0],
  ['f-pork', 'Свинина нежирная', 'Lean pork', 142, 19.4, 7.1, 0],
  ['f-salmon', 'Лосось', 'Salmon', 208, 20, 13, 0],
  ['f-tuna', 'Тунец консервированный в собственном соку', 'Canned tuna in water', 96, 21, 1, 0, 'g', [['can', { ru: 'банка', en: 'can' }, 140]]],
  ['f-whey', 'Сывороточный протеин', 'Whey protein', 380, 75, 6, 8, 'g', [['scoop', { ru: 'мерная ложка', en: 'scoop' }, 30]]],
  // Dairy
  ['f-cottage-cheese', 'Творог 5%', 'Cottage cheese 5%', 121, 17.2, 5, 1.8, 'g', [pack(200)]],
  ['f-milk', 'Молоко 2,5%', 'Milk 2.5%', 52, 2.8, 2.5, 4.7, 'ml', [glass(250)]],
  ['f-kefir', 'Кефир 2,5%', 'Kefir 2.5%', 53, 2.9, 2.5, 4, 'ml', [glass(250)]],
  ['f-yogurt', 'Йогурт натуральный 2%', 'Plain yogurt 2%', 60, 4.3, 2, 6.2, 'g', [pack(125)]],
  ['f-cheese', 'Сыр твёрдый', 'Hard cheese', 356, 24, 28, 0, 'g', [slice(20)]],
  ['f-butter', 'Масло сливочное 82%', 'Butter', 748, 0.5, 82.5, 0.8, 'g', [tsp(5)]],
  // Fats, nuts, sweets
  ['f-olive-oil', 'Масло оливковое', 'Olive oil', 898, 0, 99.8, 0, 'g', [tbsp(13), tsp(5)]],
  ['f-nuts', 'Грецкие орехи', 'Walnuts', 654, 15.2, 65.2, 7, 'g', [handful(30)]],
  ['f-almonds', 'Миндаль', 'Almonds', 609, 18.6, 53.7, 13, 'g', [handful(30)]],
  ['f-peanut-butter', 'Арахисовая паста', 'Peanut butter', 588, 25, 50, 20, 'g', [tbsp(16)]],
  ['f-honey', 'Мёд', 'Honey', 329, 0.8, 0, 81.5, 'g', [tsp(8)]],
  ['f-sugar', 'Сахар', 'Sugar', 398, 0, 0, 99.7, 'g', [tsp(5)]],
  ['f-dark-chocolate', 'Шоколад горький 70%', 'Dark chocolate 70%', 580, 7.8, 42, 34, 'g', [['bar', { ru: 'плитка', en: 'bar' }, 100]]],
  // Fruit
  ['f-banana', 'Банан', 'Banana', 96, 1.5, 0.5, 21, 'g', [pc(120)]],
  ['f-apple', 'Яблоко', 'Apple', 47, 0.4, 0.4, 9.8, 'g', [pc(180)]],
  ['f-orange', 'Апельсин', 'Orange', 43, 0.9, 0.2, 8.1, 'g', [pc(150)]],
  ['f-avocado', 'Авокадо', 'Avocado', 160, 2, 14.7, 1.8, 'g', [pc(150)]],
  ['f-berries', 'Ягоды замороженные', 'Frozen berries', 45, 0.8, 0.4, 9, 'g', [handful(50)]],
  // Vegetables
  ['f-potatoes', 'Картофель', 'Potatoes', 77, 2, 0.4, 16.3, 'g', [pc(150)]],
  ['f-sweet-potato', 'Батат', 'Sweet potato', 86, 1.6, 0.1, 20.1, 'g', [pc(200)]],
  ['f-tomato', 'Помидор', 'Tomato', 20, 1.1, 0.2, 3.7, 'g', [pc(120)]],
  ['f-cucumber', 'Огурец', 'Cucumber', 15, 0.8, 0.1, 2.8, 'g', [pc(120)]],
  ['f-broccoli', 'Брокколи', 'Broccoli', 34, 2.8, 0.4, 5.2],
  ['f-carrots', 'Морковь', 'Carrots', 35, 1.3, 0.1, 6.9, 'g', [pc(80)]],
  ['f-cabbage', 'Капуста белокочанная', 'White cabbage', 27, 1.8, 0.1, 4.7],
  ['f-onion', 'Лук репчатый', 'Onion', 41, 1.4, 0, 8.2, 'g', [pc(80)]],
];

function food(L: Lang, [id, ru, en, kcal, p, f, c, unit = 'g', portions = []]: FoodRow): PackItem {
  return {
    id,
    name: L({ ru, en }),
    kind: 'product',
    unit,
    per100: { kcal, p, f, c },
    portions: portions.map(([pid, name, grams]) => ({ id: pid, name: L(name), grams })),
    ingredients: [],
    cookedWeight: null,
    archived: false,
  };
}

// ── Bells ──────────────────────────────────────────────────────────────────

const hm = (h: number, m: number): number => h * 60 + m;

const BELLS_90: readonly [start: number, end: number][] = [
  [hm(8, 30), hm(10, 0)],
  [hm(10, 10), hm(11, 40)],
  [hm(12, 20), hm(13, 50)],
  [hm(14, 0), hm(15, 30)],
  [hm(15, 40), hm(17, 10)],
  [hm(17, 20), hm(18, 50)],
];

// ── Packs ──────────────────────────────────────────────────────────────────

const base = (L: Lang, name: Localized, description: Localized): Pick<PackInput, 'totum' | 'version' | 'name' | 'description'> => ({
  totum: 'pack',
  version: 1,
  name: L(name),
  description: L(description),
});

function definePack(pack: Omit<BuiltinPack, 'build'> & { content: (L: Lang) => Omit<PackInput, 'totum' | 'version' | 'name' | 'description'> }): BuiltinPack {
  const { content, ...meta } = pack;
  return { ...meta, build: (L) => ({ ...base(L, meta.name, meta.description), ...content(L) }) };
}

export const BUILTIN_PACKS: readonly BuiltinPack[] = [
  definePack({
    id: 'base',
    icon: 'layers',
    name: { ru: 'Базовый набор', en: 'Basics' },
    description: {
      ru: 'Категории упражнений, типы пар и категории расходов и доходов.',
      en: 'Exercise categories, lesson types and money categories.',
    },
    content: (L) => ({
      collections: {
        exerciseCategories: exerciseCategories(L),
        lessonTypes: LESSON_TYPES.map(([id, name, short, color], order) => ({ id, name: L(name), short: L(short), color, order })),
        moneyCategories: moneyCategories(L),
      },
    }),
  }),
  definePack({
    id: 'exercises',
    icon: 'dumbbell',
    name: { ru: 'Базовые упражнения', en: 'Essential exercises' },
    description: {
      ru: 'Около тридцати популярных упражнений для зала и дома.',
      en: 'About thirty popular gym and home exercises.',
    },
    content: (L) => ({
      collections: {
        exerciseCategories: exerciseCategories(L),
        exercises: EXERCISES.map(([id, ru, en, categoryId, measure, step]) => ({
          id,
          name: L({ ru, en }),
          categoryId,
          measure,
          step,
          note: '',
          archived: false,
        })),
      },
    }),
  }),
  definePack({
    id: 'foods',
    icon: 'utensils',
    name: { ru: 'Базовые продукты', en: 'Common foods' },
    description: {
      ru: 'Повседневные продукты с КБЖУ на 100 г.',
      en: 'Everyday foods with macros per 100 g.',
    },
    content: (L) => ({ collections: { foods: FOODS.map((row) => food(L, row)) } }),
  }),
  definePack({
    id: 'study-bells',
    icon: 'calendar',
    name: { ru: 'Звонки: пары по 90 мин', en: 'Bells: 90-min classes' },
    description: {
      ru: 'Шесть пар с 8:30 до 18:50 и большим перерывом после третьей.',
      en: 'Six classes from 8:30 to 18:50 with a long break after the third.',
    },
    content: () => ({ docs: { bells: { slots: BELLS_90.map(([start, end], i) => ({ n: i + 1, start, end })) } } }),
  }),
];
