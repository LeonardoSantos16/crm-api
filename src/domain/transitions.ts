import {
  FUNNEL_STAGES,
  isFinalStage,
  type FunnelStage,
  type Stage,
} from "./stages.ts";

export type MoveBlockReason =
  | "FINAL_STAGE"
  | "SAME_STAGE"
  | "USE_LOSE_ACTION"
  | "NO_RETURN_TO_FIRST_CONTACT"
  | "ONLY_FROM_FORECAST"
  | "RETURN_NOT_ALLOWED"
  | "ONE_STEP_AT_A_TIME";

export type MissingField = "estimatedValue" | "items";

export type TransitionResult =
  | { allowed: true; missing?: MissingField[] }
  | { allowed: false; reason: MoveBlockReason };

export type Move = { stage: FunnelStage } & TransitionResult;

export type TransitionSubject = {
  stage: Stage;
  hasEstimatedValue: boolean;
  itemCount: number;
};

const ALLOWED_RETURNS: readonly [FunnelStage, FunnelStage][] = [
  ["FOLLOW_UP", "BUDGET_PRESENTATION"],
  ["FORECAST", "FOLLOW_UP"],
];

const blocked = (reason: MoveBlockReason): TransitionResult => ({
  allowed: false,
  reason,
});

export function missingValueOrItems(
  subject: Pick<TransitionSubject, "hasEstimatedValue" | "itemCount">,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!subject.hasEstimatedValue) missing.push("estimatedValue");
  if (subject.itemCount === 0) missing.push("items");
  return missing;
}

export function checkTransition(
  subject: TransitionSubject,
  toStage: Stage,
): TransitionResult {
  const from = subject.stage;

  if (isFinalStage(from)) return blocked("FINAL_STAGE");
  if (toStage === from) return blocked("SAME_STAGE");
  if (toStage === "LOST") return blocked("USE_LOSE_ACTION");
  if (toStage === "FIRST_CONTACT") return blocked("NO_RETURN_TO_FIRST_CONTACT");
  if (toStage === "CLOSING" && from !== "FORECAST") {
    return blocked("ONLY_FROM_FORECAST");
  }

  const step = FUNNEL_STAGES.indexOf(toStage) - FUNNEL_STAGES.indexOf(from);
  const isAllowedReturn = ALLOWED_RETURNS.some(
    ([returnFrom, returnTo]) => returnFrom === from && returnTo === toStage,
  );
  if (step < 0 && !isAllowedReturn) return blocked("RETURN_NOT_ALLOWED");
  if (step > 1) return blocked("ONE_STEP_AT_A_TIME");

  if (toStage === "BUDGET_PRESENTATION") {
    const missing = missingValueOrItems(subject);
    if (missing.length > 0) return { allowed: true, missing };
  }

  return { allowed: true };
}

export function getMoves(subject: TransitionSubject): Move[] {
  return FUNNEL_STAGES.filter((stage) => stage !== subject.stage).map(
    (stage) => ({ stage, ...checkTransition(subject, stage) }),
  );
}
