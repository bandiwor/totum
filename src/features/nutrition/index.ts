import type { FeatureDef } from '@/core/registry';
import { DishEditor, FoodsScreen } from './FoodScreens';
import { IntakeScreen } from './IntakeScreens';
import { MealPlanDayScreen, MealPlanScreen } from './MealPlanScreens';
import {
  foodHint,
  foodRelevance,
  intakeAgenda,
  intakeHint,
  IntakeWidget,
  nutritionAgenda,
  NutritionWidget,
  QuickFood,
  QuickIntake,
  QuickWeight,
  weightHint,
} from './widgets';

export const nutritionFeature: FeatureDef = {
  id: 'nutrition',
  module: 'nutrition',
  routes: [
    { pattern: 'health/meals', component: MealPlanScreen },
    { pattern: 'health/meals/day/:index', component: MealPlanDayScreen },
    { pattern: 'health/foods', component: FoodsScreen },
    { pattern: 'health/food/:id', component: DishEditor },
    { pattern: 'health/intake', component: IntakeScreen },
  ],
  todayWidgets: [
    { id: 'nutrition', order: 20, component: NutritionWidget },
    { id: 'intake', order: 30, component: IntakeWidget, module: ['water', 'intake'] },
  ],
  agendaSources: [
    { id: 'nutrition', itemsFor: nutritionAgenda },
    { id: 'intake', itemsFor: intakeAgenda, module: 'intake' },
  ],
  quickActions: [
    { id: 'food', label: 'nutrition.quickFood', icon: 'utensils', order: 10, hint: foodHint, relevance: foodRelevance, screen: QuickFood },
    { id: 'intake', label: 'nutrition.intakeTitle', icon: 'droplet', order: 11, hint: intakeHint, screen: QuickIntake, module: ['water', 'intake'] },
    { id: 'weight', label: 'nutrition.quickWeight', icon: 'scale', order: 40, hint: weightHint, screen: QuickWeight, module: 'body' },
  ],
};
