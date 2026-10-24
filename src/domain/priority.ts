import type { Alert } from "./alert.ts";

export type Rankable = {
  alert: Alert | null;
  estimatedValue: number | null;
  stageEnteredAt: Date;
};

export function byValue(a: Rankable, b: Rankable): number {
  if (a.estimatedValue === b.estimatedValue) return 0;
  if (a.estimatedValue === null) return 1;
  if (b.estimatedValue === null) return -1;
  return b.estimatedValue - a.estimatedValue;
}

export function byPriority(a: Rankable, b: Rankable): number {
  const pctA = a.alert?.consumedPct ?? -Infinity;
  const pctB = b.alert?.consumedPct ?? -Infinity;
  if (pctA !== pctB) return pctB - pctA;
  return byValue(a, b);
}

export function byMostRecent(a: Rankable, b: Rankable): number {
  return b.stageEnteredAt.getTime() - a.stageEnteredAt.getTime();
}
