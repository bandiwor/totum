/**
 * The prompt behind "Format for AI" (Settings → Packs). The user pastes it into
 * any AI chat; the AI interviews them and answers with one pack JSON
 * (see docs/PACKS.md). Keep in sync with the valibot schemas in
 * src/features/*\/model.ts, src/core/settings.ts and src/core/i18n/languages.ts.
 */
export const AI_GUIDE = `You are helping me set up Totum, a personal organizer app (today timeline, university timetable, tasks, work shifts, places & travel time, training with programs and auto-progression, nutrition with meal plans, food database, supplements, water and body weight, money, notes). Totum imports "packs": one JSON object that adds or changes data. Your job:

1. Interview me IN MY LANGUAGE (the language I answer in). First ask which areas I want to set up, offering this list: university timetable; places & travel times; work / shifts; training (exercises, workouts, weekly program); nutrition (foods with macros, meal plan, supplements/medications, body profile & targets); money (categories, opening balance, currency, recurring payments, savings goals); notes (collections with custom fields); tasks; app appearance & settings (theme, accent colour, language, hidden modules, tab order, day start/end).
2. Ask ONLY about the areas I chose. Ask in small batches (3-6 questions at a time), suggest sensible defaults, and accept "don't know / you decide". If I give rough data (e.g. a photo-transcribed timetable, a list of meals), fill in the structure yourself and ask only about real ambiguities. Estimate food macros per 100 g from your knowledge when I don't know them, and tell me they are estimates.
3. Before the final answer, briefly summarise what the pack will contain and let me correct it.
4. Then output EXACTLY ONE JSON object in a single \`\`\`json code block, following the format below precisely. No comments inside JSON, no trailing commas, no "..." placeholders. Text values (names, meals, notes) in my language. After the block, tell me: copy it, open Totum → Settings → Packs → Paste JSON, review the preview (it shows what will be added / changed / deleted per section; sections can be unticked) and apply. A backup is made automatically before applying.

=====================================================================
PACK FORMAT
=====================================================================

{
  "totum": "pack",
  "version": 1,
  "name": "short pack name",
  "description": "optional one-line description",
  "settings": { ...partial app settings... },
  "docs": { "<docName>": { ...partial document... } },
  "collections": { "<collectionName>": [ ...items... ] }
}

Every top-level key except "totum" and "version" is optional; include only the sections you actually fill.

- "settings": partial app settings; only the listed fields are changed.
- "docs": singleton documents by name (bells, trainingProgram, mealPlan, bodyProfile, money). The given fields are merged over the current document (a field you give replaces that field entirely, e.g. a whole "cycle" or "slots" array).
- "collections": per collection name EITHER an array of items (mode "merge") OR { "mode": "merge" | "replace", "items": [...] }.
  - merge (default, use it almost always): items are added or update existing ones; nothing is deleted.
  - replace: items of that collection that are NOT in the pack are DELETED. Use "replace" only if I explicitly say I want to wipe that section and start over.

How items are matched against existing data:
1. Same "id" as an existing item → that item is updated (pack fields over current ones).
2. Otherwise the same "name" (or "title" for tasks/notes), case-insensitive → the existing item is updated, and the pack's id is re-pointed to the existing item in all references inside the pack.
3. Otherwise the item is added. An item without "id" gets a random one.

General rules:
- Give every item an "id": short, unique across the whole pack, readable, kebab-case with a prefix, e.g. "pl-home", "sub-math", "lt-lec", "ex-bench", "wt-push", "fd-oats", "mc-food". Use these ids for every reference (fields ending in "Id": placeId, subjectId, typeId, categoryId, exerciseId, templateId, foodId, jobId, collectionId…). Never reference an id that is neither in the pack nor known to exist.
- Ids of nested entries (lessons in timetable days, shifts, planned exercises, workout slots, meals, meal items, food portions, note fields) must be unique within their parent; making them unique across the whole pack is simplest (e.g. "l-mon-1", "pe-push-1", "m-d1-bf", "mi-d1-bf-1").
- NEVER include "createdAt" or "updatedAt".
- For NEW items include every field listed for the collection (use null / false / "" / [] where the field allows it). For updates of existing items you may give only "id" (or "name") plus the changed fields.
- Time of day = integer minutes from midnight, 0..1440 (9:30 → 570, 13:05 → 785, 18:00 → 1080). Durations are minutes too.
- Dates = "YYYY-MM-DD" strings.
- Colours = one of "c1".."c8": c1 violet, c2 green, c3 yellow-olive, c4 red, c5 blue, c6 magenta, c7 orange, c8 grey. Vary colours between related items (subjects, categories).
- Numbers are plain JSON numbers (no units, no strings). Money amounts are in the currency of the "money" doc.
- "order" fields: 0, 1, 2… define display order.

=====================================================================
CYCLE — the repeating template used by timetables, jobs, trainingProgram, mealPlan
=====================================================================

Cycle<Day> = {
  "anchor": "YYYY-MM-DD",   // the date that is day #0 of the cycle
  "days": [ Day, Day, ... ], // template days, at least 1; cycle length = days.length
  "weekAligned": boolean     // true = label days as weekdays
}

The day for any date is days[(date − anchor) mod days.length] (works before the anchor too). Each Day is an ARRAY of entries (lessons / shifts / workout slots / meals); an empty array [] = nothing that day.
- Weekly schedule: 7 days, anchor = a MONDAY, weekAligned true → days[0] = Monday … days[6] = Sunday.
- Alternating weeks (numerator/denominator, odd/even weeks): 14 days, anchor = the Monday of a "week 1", weekAligned true → days[0..6] = week 1 Mon..Sun, days[7..13] = week 2 Mon..Sun. Ask me which calendar week is week 1 and pick its Monday as anchor.
- Non-weekly rhythm (e.g. shifts 2-on/2-off → 4 days; training 3-on/1-off; a 3-day rotating meal plan): days.length = rhythm length, weekAligned false, anchor = the date the rhythm starts (day 1).

=====================================================================
SETTINGS ("settings")
=====================================================================

- theme: "dark" | "light" | "system"
- accentHue: number 0..359 — OKLCH hue of the accent colour (lightness/chroma are fixed). Presets: 25 coral red, 50 orange, 80 amber, 150 green, 190 teal, 245 blue, 285 violet, 330 pink.
- haptics: boolean — vibration feedback.
- effects: boolean — decorative effects (celebrations, particles).
- dayStart: minutes — planned wake-up time; start of the awake window (used for free-time calculation and as the sleep plan). Default 450 (7:30).
- dayEnd: minutes — planned bedtime ("lights out"); end of the awake window and the sleep plan. Default 1410 (23:30).
- minHomeStay: minutes — go home between commitments only if I can stay home at least this long. Default 40.
- arriveEarly: minutes — arrive this many minutes early wherever travel is needed (departure times include it). Default 5.
- disabledModules: string[] — modules to HIDE (their data is kept). Module ids: "schedule" (university timetable), "work", "training", "nutrition", "water", "intake" (supplements/medications), "body" (weight & body profile), "sleep", "money", "notes". This list replaces the current one, so list every module that should be off; [] = all on.
- tabOrder: string[] — bottom tab order by path: "today", "plan", "health", "money", "notes". [] = default order. Give all paths when setting it.
- language: "ru" | "en" | the id of a custom language from the "languages" collection.

=====================================================================
PLACES & TRAVEL
=====================================================================

collection "places" — where things happen (home, university buildings, gym, work…). The timeline inserts travel between consecutive commitments at different places.
- id
- name: string
- isHome: boolean — exactly one place should be home.

collection "routes" — travel time between two places.
- id
- fromId: place id
- toId: place id
- minutes: number ≥ 0 — travel time
- bothWays: boolean — the same time also applies in the opposite direction (usually true). If the way back takes a different time, use two routes with bothWays false (one per direction).

=====================================================================
UNIVERSITY TIMETABLE (module "schedule")
=====================================================================

collection "lessonTypes" — kinds of classes (lecture, practice, lab, seminar…). The app may already have default ones; reuse names to update them.
- id
- name: string — "Lecture"
- short: string — short label for compact views, 2-4 chars: "Lec", "Pr", "Lab"
- color: "c1".."c8"
- order: number

collection "teachers"
- id
- name: string — full name
- position: string — position / title ("Associate professor", "Senior lecturer"…; "" if unknown)

collection "subjects"
- id
- name: string
- color: "c1".."c8"
- teacherId: teacher id | null — the default teacher (null if unknown)
- room: string — default room ("" if unknown)
- placeId: place id | null — default building/campus (for travel); null = no travel
- archived: boolean — false

doc "bells" — the bell schedule (numbered class periods).
{ "slots": [ { "n": 1, "start": 510, "end": 600 }, { "n": 2, "start": 610, "end": 700 }, ... ] }
- n: number — period number (1, 2, 3…); start/end: minutes. Giving "slots" replaces all slots.

collection "timetables" — one per semester/term; on a date the latest timetable whose range contains it applies.
- id
- name: string — "Autumn 2026"
- startDate: "YYYY-MM-DD"
- endDate: "YYYY-MM-DD" | null — inclusive; null = open-ended
- cycle: Cycle<Lesson[]> (required, at least 1 day), where Lesson =
  - id: string — unique within the timetable
  - subjectId: subject id
  - typeId: lesson type id | null
  - start: minutes; end: minutes — ALWAYS give real times, even when bell is set
  - bell: number | null — bell period number the time came from (n in bells); null = custom time
  - room: string | null — overrides the subject's room for this lesson; null = inherit
  - placeId: place id | null — overrides the subject's place; null = inherit
  - teacherId: teacher id | null — overrides the subject's teacher (e.g. labs taught by someone else); null = inherit
  - online: boolean — true = online class, no travel
  A class outside the bell grid (e.g. a whole-day military training block 7:40–15:55) is a lesson with bell null and its own start/end.
(collection "lessonOverrides" holds one-off per-date changes — do not generate it.)

=====================================================================
TASKS
=====================================================================

collection "tasks" — to-dos and homework (homework = task with subjectId).
- id
- title: string
- note: string ("" if none)
- date: "YYYY-MM-DD" | null — due date; null = no date
- time: minutes | null
- duration: minutes | null — with a time, makes it an EVENT that takes time on the timeline (doctor 60, meet-up 180); null = a plain to-do
- openEnded: boolean — true for an event of unknown length (shown with an unknown end, counted as ~1 h); false otherwise
- placeId: place id | null — where the event happens (travel is planned to it); null = wherever I am
- done: boolean — false
- doneAt: null (epoch ms when done; keep null)
- subjectId: subject id | null
- lesson: null (link to a specific lesson occurrence { "date", "key" }; keep null)

=====================================================================
WORK / SHIFTS (module "work")
=====================================================================

collection "jobs"
- id
- name: string
- color: "c1".."c8"
- placeId: place id | null
- payType: "hour" | "shift" | "month" — how the rate is counted
- rate: number — pay per hour / per shift / per month (money currency); 0 if unknown
- archived: boolean — false
- cycle: Cycle<Shift[]> | null — regular shifts; null = only one-off shifts. Shift =
  - id: string — unique within the job
  - jobId: the id of THIS job
  - start: minutes; end: minutes — for a night shift that ends the next day, end = next-day time + 1440 (22:00–06:00 → start 1320, end 1800); max 2880
(collection "shiftOverrides" holds per-date changes — do not generate it.)

=====================================================================
TRAINING (module "training")
=====================================================================

collection "exerciseCategories" — muscle groups / kinds (the app may have defaults: chest, back, legs, shoulders, arms, core, cardio — reuse names to update).
- id
- name: string
- color: "c1".."c8"
- order: number

collection "exercises"
- id
- name: string
- categoryId: category id | null
- measure: "weight" | "reps" | "time" — weight × reps; reps only (bodyweight); time (seconds, stored in the "reps" fields)
- step: number — progression increment: kg for weight exercises (e.g. 2.5 barbell, 1-2 dumbbell), seconds for timed ones (e.g. 5); for "reps" use 1
- note: string — technique cues ("" if none)
- archived: boolean — false

collection "workoutTemplates" — a workout (e.g. "Push", "Full body A").
- id
- name: string
- color: "c1".."c8"
- duration: number — typical minutes, used when scheduled without explicit times
- exercises: PlannedExercise[] in order, where PlannedExercise =
  - id: string — unique within the template
  - exerciseId: exercise id
  - sets: number — working sets
  - repMin: number; repMax: number — rep range (seconds for timed exercises); equal values for a fixed target
  - repGoal: number — current rep goal inside the range (start at repMin)
  - weight: number — current working weight in kg (0 for bodyweight / timed)
  - rpe: number | null — target RPE (e.g. 8); sets above it don't count as success; null = not used
  - rule: "double" | "linear" | "reps" | "none" — auto-progression after each workout (never goes down):
      double — reps climb by 1 to repMax, then weight += step and repGoal back to repMin (typical for hypertrophy ranges like 8-12);
      linear — repGoal hit on all sets → weight += step (strength, fixed reps like 5×5);
      reps   — repGoal hit → repGoal + 1 (bodyweight or fixed weight);
      none   — no automatic change.
    For measure "reps"/"time" exercises the goal grows by 1 rep / by step seconds when hit, regardless of rule (except none).
  - step: number — increment for this entry (normally the exercise's step)

doc "trainingProgram" — when workouts happen.
{ "cycle": Cycle<Slot[]> | null } where Slot =
- id: string — unique within the program
- templateId: workout template id
- start: minutes; end: minutes
- placeId: place id | null — e.g. the gym (for travel)
Typical: 7 days, weekAligned true, anchor = a Monday; rest days are [].
(collections "workoutSessions" (the training log) and "workoutOverrides" exist — do not generate them.)

=====================================================================
NUTRITION (modules "nutrition", "water", "intake", "body")
=====================================================================

Macros = { "kcal": number, "p": number, "f": number, "c": number } — kilocalories, protein, fat, carbs (grams).

collection "foods" — products and dishes in one base.
- id
- name: string
- kind: "product" | "dish"
- unit: "g" | "ml" — how amounts are measured (ml for liquids; amounts are still entered in the "grams" fields)
- per100: Macros — per 100 g/ml. Required for products. For dishes it is computed from ingredients; give { "kcal": 0, "p": 0, "f": 0, "c": 0 }.
- portions: [{ "id": string, "name": string, "grams": number }] — handy servings ("1 egg" 55, "1 slice" 30, "glass" 250); [] if none
- ingredients: [{ "foodId": product id, "grams": number }] — dishes only: products (kind "product") with RAW weight; [] for products
- cookedWeight: number | null — dishes only: total weight after cooking; null = sum of ingredients. Always null for products.
- archived: boolean — false

doc "mealPlan" — what I plan to eat.
{ "cycle": Cycle<Meal[]> | null } where Meal =
- id: string — unique within the whole plan
- name: string — "Breakfast", "Snack"…
- time: minutes | null
- items: [{ "id": string (unique within the plan), "foodId": food id, "grams": number }]
A plan that's the same every day = 1 day, weekAligned false. Rotating plans: N days. Weekly: 7 days aligned to a Monday.

collection "intakeItems" — supplements, medications, anything taken on schedule without macros.
- id
- name: string — "Vitamin D3", "Creatine"
- kind: "supplement" | "medication" | "other"
- dose: number
- unit: "g" | "mg" | "mcg" | "iu" | "caps" | "tab" | "ml" | "pcs"
- times: minutes[] — times of day, each is a separate check-off (e.g. [540, 1260])
- everyDays: integer ≥ 1 — 1 = daily, 2 = every other day…, counted from anchor
- anchor: "YYYY-MM-DD" — first day (usually today or the start date)
- archived: boolean — false

doc "bodyProfile" — used to compute calorie/macro/water targets.
- heightCm: number | null
- birthYear: number | null
- sex: "male" | "female"
- bodyFatPct: number | null — % if known
- activity: "sedentary" | "light" | "moderate" | "high" | "athlete"
- goal: "lose" | "maintain" | "gain"
- ratePct: number — desired weight change per week in % of body weight (positive; e.g. 0.5)
- manual: Macros | null — fixed daily targets that override the computed ones; null = computed
- waterMl: number | null — daily water target in ml; null = computed
(Current weight is a log entry in "weightLog"; normally don't generate it. If I explicitly give my current weight, you may add one item { "id", "date": today, "kg": number }.)

Log collections "foodLog", "intakeLog", "waterLog", "weightLog" hold history — do not generate them. The same goes for "sleepLog" (sleep sessions at any time of day: went to bed, fell asleep, woke up — epoch ms); the sleep plan itself is settings.dayEnd / settings.dayStart.

=====================================================================
MONEY (module "money")
=====================================================================

doc "money"
- openingBalance: number — balance before any recorded transaction (my current balance when starting)
- currency: string — symbol shown, e.g. "₽", "$", "€", "₸"

collection "moneyCategories"
- id
- name: string
- type: "expense" | "income"
- color: "c1".."c8"
- order: number
Typical expense categories: groceries, eating out, transport, housing, utilities & phone, subscriptions, health, clothes, education, fun, gifts, other; income: salary, scholarship, side jobs, gifts.

collection "recurring" — regular payments/income (rent, subscriptions, salary, scholarship). Occurrences appear as planned transactions.
- id
- name: string
- type: "expense" | "income"
- amount: number ≥ 0
- categoryId: money category id | null
- period: "month" | "week" | "days"
- every: integer ≥ 1 — every N months / weeks / days
- anchor: "YYYY-MM-DD" — the first (or any past) occurrence date; occurrences = anchor + k·every·period (monthly keeps the day of month)
- endDate: "YYYY-MM-DD" | null — last possible date; null = no end
- active: boolean — true

collection "goals" — savings goals.
- id
- name: string
- target: number — amount to save
- deadline: "YYYY-MM-DD" | null
- contributions: [{ "date": "YYYY-MM-DD", "amount": number }] — money already put aside ([] if none)
- archived: boolean — false

Collection "transactions" is the money log — do not generate it (set openingBalance instead).

=====================================================================
NOTES (module "notes")
=====================================================================

collection "noteCollections" — a notebook with its own custom fields (diary, books, films, perfumes, recipes, ideas…).
- id
- name: string
- icon: "notes" | "star" | "bookmark" | "sparkles" | "health" | "moon" | "tag" | "utensils" | "dumbbell" | "coins"
- color: "c1".."c8"
- fields: FieldDef[] where FieldDef =
  - id: string — unique within the collection, short (e.g. "rating", "author")
  - name: string — shown label
  - type: "rating" | "text" | "number" | "choice" | "date" | "checkbox" | "link"
  - options: string[] — the choices for "choice"; [] for other types
- sort: "updated" | "date" | "title" | "field:<fieldId>" — default list order; "field:<id>" only for a rating or number field
- archived: boolean — false

collection "notes" — only generate if I want starter notes.
- id
- collectionId: note collection id
- title: string
- body: string — plain text, may contain \\n line breaks
- tags: string[]
- date: "YYYY-MM-DD"
- revisit: boolean — "come back to this" flag
- pinned: boolean
- values: object keyed by the collection's field ids → value or null:
  rating → integer 1..5; text → string; number → number; choice → one of options; date → "YYYY-MM-DD"; checkbox → true/false; link → "https://…" URL

=====================================================================
LANGUAGES
=====================================================================

collection "languages" — custom UI translations (rarely needed; built-in "ru" and "en" always exist).
- id
- name: string — non-empty, e.g. "Українська"
- tag: string — BCP 47 tag, e.g. "uk-UA"
- fallback: "ru" | "en" — language that fills missing keys
- messages: object — a tree of UI message keys → strings (only if I give you the translation template; otherwise don't generate this collection)
To switch the app to it, set settings.language to its id.

=====================================================================
EXAMPLE (compact; realistic cross-references)
=====================================================================

\`\`\`json
{
  "totum": "pack",
  "version": 1,
  "name": "Student setup",
  "description": "Places, autumn timetable, push/pull training, simple meal plan, money basics",
  "settings": { "theme": "dark", "accentHue": 245, "disabledModules": ["work"] },
  "docs": {
    "bells": { "slots": [
      { "n": 1, "start": 510, "end": 600 },
      { "n": 2, "start": 610, "end": 700 },
      { "n": 3, "start": 730, "end": 820 }
    ] },
    "trainingProgram": { "cycle": {
      "anchor": "2026-09-07", "weekAligned": true,
      "days": [
        [{ "id": "ts-mon", "templateId": "wt-push", "start": 1080, "end": 1155, "placeId": "pl-gym" }],
        [],
        [],
        [{ "id": "ts-thu", "templateId": "wt-pull", "start": 1080, "end": 1155, "placeId": "pl-gym" }],
        [], [], []
      ]
    } },
    "mealPlan": { "cycle": {
      "anchor": "2026-10-19", "weekAligned": false,
      "days": [[
        { "id": "m-bf", "name": "Breakfast", "time": 450, "items": [
          { "id": "mi-bf-1", "foodId": "fd-oats", "grams": 80 },
          { "id": "mi-bf-2", "foodId": "fd-milk", "grams": 200 }
        ] },
        { "id": "m-dn", "name": "Dinner", "time": 1170, "items": [
          { "id": "mi-dn-1", "foodId": "fd-chicken", "grams": 200 },
          { "id": "mi-dn-2", "foodId": "fd-rice", "grams": 90 }
        ] }
      ]]
    } },
    "bodyProfile": { "heightCm": 180, "birthYear": 2005, "sex": "male", "activity": "moderate", "goal": "gain", "ratePct": 0.25 },
    "money": { "openingBalance": 25000, "currency": "₽" }
  },
  "collections": {
    "places": [
      { "id": "pl-home", "name": "Home", "isHome": true },
      { "id": "pl-main", "name": "Main building", "isHome": false },
      { "id": "pl-gym", "name": "Gym", "isHome": false }
    ],
    "routes": [
      { "id": "rt-home-main", "fromId": "pl-home", "toId": "pl-main", "minutes": 35, "bothWays": true },
      { "id": "rt-main-gym", "fromId": "pl-main", "toId": "pl-gym", "minutes": 15, "bothWays": true },
      { "id": "rt-home-gym", "fromId": "pl-home", "toId": "pl-gym", "minutes": 10, "bothWays": true }
    ],
    "lessonTypes": [
      { "id": "lt-lec", "name": "Lecture", "short": "Lec", "color": "c1", "order": 0 },
      { "id": "lt-pr", "name": "Practice", "short": "Pr", "color": "c2", "order": 1 }
    ],
    "teachers": [
      { "id": "tch-ivanova", "name": "Ivanova A. P.", "position": "Associate professor" },
      { "id": "tch-smirnov", "name": "Smirnov D. V.", "position": "Senior lecturer" }
    ],
    "subjects": [
      { "id": "sub-calc", "name": "Calculus", "color": "c5", "teacherId": "tch-ivanova", "room": "301", "placeId": "pl-main", "archived": false },
      { "id": "sub-prog", "name": "Programming", "color": "c7", "teacherId": "tch-smirnov", "room": "Lab 2", "placeId": "pl-main", "archived": false }
    ],
    "timetables": [
      { "id": "tt-autumn", "name": "Autumn 2026", "startDate": "2026-09-01", "endDate": "2026-12-28", "cycle": {
        "anchor": "2026-08-31", "weekAligned": true,
        "days": [
          [
            { "id": "l-w1-mon-1", "subjectId": "sub-calc", "typeId": "lt-lec", "start": 510, "end": 600, "bell": 1, "room": "Aud. 1", "placeId": null, "teacherId": null, "online": false },
            { "id": "l-w1-mon-2", "subjectId": "sub-prog", "typeId": "lt-pr", "start": 610, "end": 700, "bell": 2, "room": null, "placeId": null, "teacherId": null, "online": false }
          ],
          [], [], [], [], [], [],
          [
            { "id": "l-w2-mon-1", "subjectId": "sub-calc", "typeId": "lt-pr", "start": 610, "end": 700, "bell": 2, "room": null, "placeId": null, "teacherId": null, "online": false }
          ],
          [],
          [
            { "id": "l-w2-wed-1", "subjectId": "sub-prog", "typeId": "lt-lec", "start": 1020, "end": 1110, "bell": null, "room": null, "placeId": null, "teacherId": null, "online": true }
          ],
          [], [], [], []
        ]
      } }
    ],
    "exerciseCategories": [
      { "id": "cat-chest", "name": "Chest", "color": "c1", "order": 0 },
      { "id": "cat-back", "name": "Back", "color": "c2", "order": 1 }
    ],
    "exercises": [
      { "id": "ex-bench", "name": "Bench press", "categoryId": "cat-chest", "measure": "weight", "step": 2.5, "note": "", "archived": false },
      { "id": "ex-pushup", "name": "Push-ups", "categoryId": "cat-chest", "measure": "reps", "step": 1, "note": "", "archived": false },
      { "id": "ex-row", "name": "Barbell row", "categoryId": "cat-back", "measure": "weight", "step": 2.5, "note": "Flat back", "archived": false },
      { "id": "ex-pullup", "name": "Pull-ups", "categoryId": "cat-back", "measure": "reps", "step": 1, "note": "", "archived": false }
    ],
    "workoutTemplates": [
      { "id": "wt-push", "name": "Push", "color": "c1", "duration": 75, "exercises": [
        { "id": "pe-push-1", "exerciseId": "ex-bench", "sets": 3, "repMin": 6, "repMax": 10, "repGoal": 6, "weight": 60, "rpe": 8, "rule": "double", "step": 2.5 },
        { "id": "pe-push-2", "exerciseId": "ex-pushup", "sets": 3, "repMin": 15, "repMax": 15, "repGoal": 15, "weight": 0, "rpe": null, "rule": "reps", "step": 1 }
      ] },
      { "id": "wt-pull", "name": "Pull", "color": "c2", "duration": 75, "exercises": [
        { "id": "pe-pull-1", "exerciseId": "ex-row", "sets": 4, "repMin": 8, "repMax": 8, "repGoal": 8, "weight": 50, "rpe": null, "rule": "linear", "step": 2.5 },
        { "id": "pe-pull-2", "exerciseId": "ex-pullup", "sets": 3, "repMin": 5, "repMax": 10, "repGoal": 5, "weight": 0, "rpe": null, "rule": "reps", "step": 1 }
      ] }
    ],
    "foods": [
      { "id": "fd-oats", "name": "Rolled oats", "kind": "product", "unit": "g", "per100": { "kcal": 366, "p": 12.3, "f": 6.1, "c": 59.5 }, "portions": [], "ingredients": [], "cookedWeight": null, "archived": false },
      { "id": "fd-milk", "name": "Milk 2.5%", "kind": "product", "unit": "ml", "per100": { "kcal": 53, "p": 2.9, "f": 2.5, "c": 4.7 }, "portions": [{ "id": "po-milk-glass", "name": "Glass", "grams": 250 }], "ingredients": [], "cookedWeight": null, "archived": false },
      { "id": "fd-chicken", "name": "Chicken breast", "kind": "product", "unit": "g", "per100": { "kcal": 113, "p": 23.6, "f": 1.9, "c": 0.4 }, "portions": [], "ingredients": [], "cookedWeight": null, "archived": false },
      { "id": "fd-rice", "name": "White rice (dry)", "kind": "product", "unit": "g", "per100": { "kcal": 344, "p": 6.7, "f": 0.7, "c": 78.9 }, "portions": [], "ingredients": [], "cookedWeight": null, "archived": false },
      { "id": "fd-porridge", "name": "Oat porridge", "kind": "dish", "unit": "g", "per100": { "kcal": 0, "p": 0, "f": 0, "c": 0 }, "portions": [{ "id": "po-porr-bowl", "name": "Bowl", "grams": 300 }], "ingredients": [{ "foodId": "fd-oats", "grams": 80 }, { "foodId": "fd-milk", "grams": 250 }], "cookedWeight": 320, "archived": false }
    ],
    "intakeItems": [
      { "id": "in-d3", "name": "Vitamin D3", "kind": "supplement", "dose": 2000, "unit": "iu", "times": [540], "everyDays": 1, "anchor": "2026-10-19", "archived": false }
    ],
    "moneyCategories": [
      { "id": "mc-food", "name": "Groceries", "type": "expense", "color": "c2", "order": 0 },
      { "id": "mc-subs", "name": "Subscriptions", "type": "expense", "color": "c6", "order": 1 },
      { "id": "mc-stipend", "name": "Scholarship", "type": "income", "color": "c5", "order": 2 }
    ],
    "recurring": [
      { "id": "rc-music", "name": "Music subscription", "type": "expense", "amount": 199, "categoryId": "mc-subs", "period": "month", "every": 1, "anchor": "2026-10-05", "endDate": null, "active": true },
      { "id": "rc-stipend", "name": "Scholarship", "type": "income", "amount": 3500, "categoryId": "mc-stipend", "period": "month", "every": 1, "anchor": "2026-10-25", "endDate": "2027-06-30", "active": true }
    ],
    "goals": [
      { "id": "gl-laptop", "name": "New laptop", "target": 90000, "deadline": "2027-05-01", "contributions": [], "archived": false }
    ],
    "noteCollections": [
      { "id": "nc-books", "name": "Books", "icon": "bookmark", "color": "c3", "fields": [
        { "id": "author", "name": "Author", "type": "text", "options": [] },
        { "id": "rating", "name": "Rating", "type": "rating", "options": [] },
        { "id": "status", "name": "Status", "type": "choice", "options": ["Want", "Reading", "Done"] }
      ], "sort": "field:rating", "archived": false }
    ],
    "notes": [
      { "id": "nt-dune", "collectionId": "nc-books", "title": "Dune", "body": "", "tags": ["sci-fi"], "date": "2026-10-19", "revisit": false, "pinned": false, "values": { "author": "Frank Herbert", "rating": null, "status": "Reading" } }
    ],
    "tasks": [
      { "id": "tk-calc-hw", "title": "Calculus: problems 1-10", "note": "", "date": "2026-10-26", "time": null, "done": false, "doneAt": null, "subjectId": "sub-calc", "lesson": null }
    ]
  }
}
\`\`\`

In this example the timetable uses alternating weeks (14 days anchored to Monday 2026-08-31 = week 1); the training program is weekly (anchored to a Monday); the meal plan is the same every day (1 day). Adapt structure to my answers; do not copy example data I didn't ask for.

Start now: greet me briefly and ask which areas I want to set up.`;
