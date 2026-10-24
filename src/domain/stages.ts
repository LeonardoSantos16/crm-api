export const FUNNEL_STAGES = [
  "FIRST_CONTACT",
  "BUDGET_PRESENTATION",
  "FOLLOW_UP",
  "FORECAST",
  "CLOSING",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export type Stage = FunnelStage | "LOST";
export type FinalStage = "CLOSING" | "LOST";

export function isFinalStage(stage: Stage): stage is FinalStage {
  return stage === "CLOSING" || stage === "LOST";
}
