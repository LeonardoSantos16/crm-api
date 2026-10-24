import { addDays, diffDays, toLocalDate, type CalendarDate } from "./dates.ts";
import { STAGE_DEADLINE_DAYS } from "./deadlines.ts";
import { isFinalStage, type Stage } from "./stages.ts";

export const ALERT_STATES = [
  "ON_TIME",
  "ATTENTION",
  "SNOOZED",
  "ESCALATED",
] as const;

export type AlertState = (typeof ALERT_STATES)[number];

export type AlertSubject = {
  stage: Stage;
  stageEnteredAt: Date;
  lastContactAt: Date | null;
  nextFollowUpAt: CalendarDate | null;
  snoozedUntil: CalendarDate | null;
  snoozeCount: number;
};

export type Alert = {
  state: AlertState;
  dueDate: CalendarDate;
  idleDays: number;
  deadlineDays: number;
  consumedPct: number;
};

function latestActivity(subject: AlertSubject): CalendarDate {
  const stageEntry = toLocalDate(subject.stageEnteredAt);
  if (!subject.lastContactAt) return stageEntry;

  const lastContact = toLocalDate(subject.lastContactAt);
  return lastContact > stageEntry ? lastContact : stageEntry;
}

function alertState(
  subject: AlertSubject,
  today: CalendarDate,
  dueDate: CalendarDate,
  deadlineDays: number,
): AlertState {
  if (subject.snoozeCount >= 2 || today > addDays(dueDate, deadlineDays)) {
    return "ESCALATED";
  }
  if (subject.snoozedUntil && today < subject.snoozedUntil) return "SNOOZED";
  if (today > dueDate) return "ATTENTION";
  return "ON_TIME";
}

export function computeAlert(subject: AlertSubject, now: Date): Alert | null {
  const { stage } = subject;
  if (isFinalStage(stage)) return null;

  const today = toLocalDate(now);
  const deadlineDays = STAGE_DEADLINE_DAYS[stage];
  const lastActivity = latestActivity(subject);
  const dueDate =
    subject.snoozedUntil ??
    subject.nextFollowUpAt ??
    addDays(lastActivity, deadlineDays);
  const deadlineStart = addDays(dueDate, -deadlineDays);

  return {
    state: alertState(subject, today, dueDate, deadlineDays),
    dueDate,
    idleDays: diffDays(lastActivity, today),
    deadlineDays,
    consumedPct: (diffDays(deadlineStart, today) * 100) / deadlineDays,
  };
}

export function needsAttention(alert: Alert | null): boolean {
  return alert?.state === "ATTENTION" || alert?.state === "ESCALATED";
}
