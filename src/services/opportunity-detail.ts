import {
  computeAlert,
  type Alert,
  type AlertSubject,
} from "../domain/alert.ts";
import {
  addDays,
  fromDbDate,
  startOfLocalDay,
  toLocalDate,
} from "../domain/dates.ts";
import { getMoves, type TransitionSubject } from "../domain/transitions.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export const opportunityDetailInclude = {
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" } },
  stageChanges: {
    include: { changedBy: { select: { id: true, name: true } } },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
  },
  followUps: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
  snoozes: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
  comments: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  },
} satisfies Prisma.OpportunityInclude;

export type OpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: typeof opportunityDetailInclude;
}>;

const toNumber = (value: Prisma.Decimal | null) => value?.toNumber() ?? null;
const toCalendarDate = (value: Date | null) => value && fromDbDate(value);

export function toAlertSubject(
  opportunity: OpportunityWithRelations,
): AlertSubject {
  return {
    stage: opportunity.stage,
    stageEnteredAt: opportunity.stageEnteredAt,
    lastContactAt: opportunity.lastContactAt,
    nextFollowUpAt: toCalendarDate(opportunity.nextFollowUpAt),
    snoozedUntil: toCalendarDate(opportunity.snoozedUntil),
    snoozeCount: opportunity.snoozeCount,
  };
}

export function toTransitionSubject(
  opportunity: OpportunityWithRelations,
): TransitionSubject {
  return {
    stage: opportunity.stage,
    hasEstimatedValue: opportunity.estimatedValue !== null,
    itemCount: opportunity.items.length,
  };
}

function stageChangeEntry(
  opportunity: OpportunityWithRelations,
  change: OpportunityWithRelations["stageChanges"][number],
) {
  const base = { at: change.changedAt, author: change.changedBy };
  if (change.fromStage === null) {
    return { ...base, type: "CREATED" as const, stage: change.toStage };
  }
  if (change.toStage === "LOST") {
    return {
      ...base,
      type: "LOST" as const,
      fromStage: change.fromStage,
      reason: opportunity.lossReason,
      detail: opportunity.lossDetail,
    };
  }
  return {
    ...base,
    type: "STAGE_CHANGE" as const,
    fromStage: change.fromStage,
    toStage: change.toStage,
  };
}

function followUpEntry(
  followUp: OpportunityWithRelations["followUps"][number],
) {
  return {
    type: "FOLLOW_UP" as const,
    at: followUp.createdAt,
    author: followUp.user,
    channel: followUp.channel,
    summary: followUp.summary,
    nextDate: toCalendarDate(followUp.nextDate),
  };
}

function snoozeEntry(snooze: OpportunityWithRelations["snoozes"][number]) {
  return {
    type: "SNOOZE" as const,
    at: snooze.createdAt,
    author: snooze.user,
    until: fromDbDate(snooze.until),
    reason: snooze.reason,
  };
}

function commentEntry(comment: OpportunityWithRelations["comments"][number]) {
  return {
    type: "COMMENT" as const,
    at: comment.createdAt,
    author: comment.user,
    body: comment.body,
  };
}

function secondSnoozeSinceLastFollowUp(opportunity: OpportunityWithRelations) {
  const lastFollowUpAt = opportunity.followUps[0]?.createdAt;
  const snoozesSince = opportunity.snoozes.filter(
    (snooze) => !lastFollowUpAt || snooze.createdAt > lastFollowUpAt,
  );
  return snoozesSince.at(-2);
}

function escalationEntries(
  opportunity: OpportunityWithRelations,
  alert: Alert | null,
) {
  if (alert?.state !== "ESCALATED") return [];

  const entry = { type: "ESCALATED" as const, author: null };
  if (opportunity.snoozeCount >= 2) {
    const secondSnooze = secondSnoozeSinceLastFollowUp(opportunity);
    if (!secondSnooze) return [];
    return [
      {
        ...entry,
        at: secondSnooze.createdAt,
        date: toLocalDate(secondSnooze.createdAt),
        cause: "SNOOZES" as const,
      },
    ];
  }

  const date = addDays(alert.dueDate, alert.deadlineDays + 1);
  return [
    {
      ...entry,
      at: startOfLocalDay(date),
      date,
      cause: "DEADLINE" as const,
    },
  ];
}

function toTimeline(
  opportunity: OpportunityWithRelations,
  alert: Alert | null,
) {
  return [
    ...escalationEntries(opportunity, alert),
    ...opportunity.comments.map(commentEntry),
    ...opportunity.snoozes.map(snoozeEntry),
    ...opportunity.followUps.map(followUpEntry),
    ...opportunity.stageChanges.map((change) =>
      stageChangeEntry(opportunity, change),
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function toOpportunityDetail(
  opportunity: OpportunityWithRelations,
  now: Date,
) {
  const alert = computeAlert(toAlertSubject(opportunity), now);

  return {
    id: opportunity.id,
    code: `OPP-${opportunity.id}`,
    company: opportunity.company,
    owner: opportunity.owner,
    contactName: opportunity.contactName,
    contactPhone: opportunity.contactPhone,
    contactEmail: opportunity.contactEmail,
    estimatedValue: toNumber(opportunity.estimatedValue),
    items: opportunity.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitValue: toNumber(item.unitValue),
    })),
    proposalValidUntil: toCalendarDate(opportunity.proposalValidUntil),
    eventDate: toCalendarDate(opportunity.eventDate),
    stage: opportunity.stage,
    stageEnteredAt: opportunity.stageEnteredAt,
    lastContactAt: opportunity.lastContactAt,
    nextFollowUpAt: toCalendarDate(opportunity.nextFollowUpAt),
    snoozedUntil: toCalendarDate(opportunity.snoozedUntil),
    snoozeCount: opportunity.snoozeCount,
    lossReason: opportunity.lossReason,
    lossDetail: opportunity.lossDetail,
    alert,
    moves: getMoves(toTransitionSubject(opportunity)),
    timeline: toTimeline(opportunity, alert),
  };
}
