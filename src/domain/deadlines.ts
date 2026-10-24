import type { FinalStage, Stage } from "./stages.ts";

export type OpenStage = Exclude<Stage, FinalStage>;

export const STAGE_DEADLINE_DAYS: Record<OpenStage, number> = {
  FIRST_CONTACT: 1,
  BUDGET_PRESENTATION: 5,
  FOLLOW_UP: 6,
  FORECAST: 7,
};
