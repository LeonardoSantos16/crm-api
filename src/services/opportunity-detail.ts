import { computeAlert, type AlertSubject } from "../domain/alert.ts";
import { fromDbDate } from "../domain/dates.ts";
import { getMoves, type TransitionSubject } from "../domain/transitions.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export const opportunityDetailInclude = {
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" } },
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

export function toOpportunityDetail(
  opportunity: OpportunityWithRelations,
  now: Date,
) {
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
    alert: computeAlert(toAlertSubject(opportunity), now),
    moves: getMoves(toTransitionSubject(opportunity)),
  };
}
