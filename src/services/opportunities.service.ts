import { toDbDate, type CalendarDate } from "../domain/dates.ts";
import { isFinalStage, type Stage } from "../domain/stages.ts";
import { checkTransition } from "../domain/transitions.ts";
import { AppError } from "../errors/app-error.ts";
import type {
  FollowUpChannel,
  LossReason,
  Opportunity,
  Prisma,
} from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import {
  opportunityDetailInclude,
  toOpportunityDetail,
} from "./opportunity-detail.ts";
import type { CurrentUser } from "./users.service.ts";
import { findVisibleOpportunity } from "./visibility.ts";

export type ItemInput = {
  description: string;
  quantity: number;
  unitValue?: number | undefined;
};

export type MoveInput = {
  toStage: Stage;
  complete?:
    | {
        estimatedValue?: number | undefined;
        items?: ItemInput[] | undefined;
      }
    | undefined;
};

export type LoseInput = {
  reason: LossReason;
  detail?: string | undefined;
};

export type FollowUpInput = {
  channel?: FollowUpChannel | undefined;
  summary?: string | undefined;
  nextDate?: CalendarDate | undefined;
};

export type SnoozeInput = {
  until: CalendarDate;
  reason?: string | undefined;
};

export const finalStageError = () =>
  new AppError(409, "FINAL_STAGE", "Opportunity is in a final stage");

const loadDetail = (tx: Prisma.TransactionClient, id: number) =>
  tx.opportunity.findUniqueOrThrow({
    where: { id },
    include: opportunityDetailInclude,
  });

export async function applyStageChange(
  tx: Prisma.TransactionClient,
  {
    id,
    fromStage,
    toStage,
    now,
    userId,
    data = {},
  }: {
    id: number;
    fromStage: Stage;
    toStage: Stage;
    now: Date;
    userId: number;
    data?: Prisma.OpportunityUpdateManyMutationInput;
  },
) {
  const { count } = await tx.opportunity.updateMany({
    where: { id, stage: fromStage },
    data: {
      ...data,
      stage: toStage,
      stageEnteredAt: now,
      snoozedUntil: null,
      nextFollowUpAt: null,
    },
  });
  if (count === 0) {
    throw new AppError(
      409,
      "STAGE_CONFLICT",
      "Opportunity stage changed during the request",
    );
  }

  await tx.stageChange.create({
    data: {
      opportunityId: id,
      fromStage,
      toStage,
      changedAt: now,
      changedById: userId,
    },
  });
}

async function actOnOpenOpportunity(
  user: CurrentUser,
  id: number,
  now: Date,
  action: (tx: Prisma.TransactionClient, current: Opportunity) => Promise<void>,
) {
  const opportunity = await prisma.$transaction(async (tx) => {
    const current = await findVisibleOpportunity(user, id, tx);
    if (isFinalStage(current.stage)) throw finalStageError();

    await action(tx, current);
    return loadDetail(tx, id);
  });

  return toOpportunityDetail(opportunity, now);
}

export function moveOpportunity(
  user: CurrentUser,
  id: number,
  { toStage, complete }: MoveInput,
  now: Date,
) {
  return actOnOpenOpportunity(user, id, now, async (tx, current) => {
    const itemCount =
      complete?.items?.length ??
      (await tx.opportunityItem.count({ where: { opportunityId: id } }));
    const result = checkTransition(
      {
        stage: current.stage,
        hasEstimatedValue:
          complete?.estimatedValue !== undefined ||
          current.estimatedValue !== null,
        itemCount,
      },
      toStage,
    );
    if (!result.allowed) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Stage transition not allowed",
        { reason: result.reason },
      );
    }
    if (result.missing) {
      throw new AppError(
        422,
        "MISSING_VALUE_OR_ITEMS",
        "Estimated value and at least one item are required",
        { missing: result.missing },
      );
    }

    if (complete?.items) {
      await tx.opportunityItem.deleteMany({ where: { opportunityId: id } });
      await tx.opportunityItem.createMany({
        data: complete.items.map((item) => ({ ...item, opportunityId: id })),
      });
    }

    await applyStageChange(tx, {
      id,
      fromStage: current.stage,
      toStage,
      now,
      userId: user.id,
      data:
        complete?.estimatedValue === undefined
          ? {}
          : { estimatedValue: complete.estimatedValue },
    });
  });
}

export function loseOpportunity(
  user: CurrentUser,
  id: number,
  { reason, detail }: LoseInput,
  now: Date,
) {
  return actOnOpenOpportunity(user, id, now, (tx, current) =>
    applyStageChange(tx, {
      id,
      fromStage: current.stage,
      toStage: "LOST",
      now,
      userId: user.id,
      data: { lossReason: reason, lossDetail: detail ?? null },
    }),
  );
}

export function followUpOpportunity(
  user: CurrentUser,
  id: number,
  { channel, summary, nextDate }: FollowUpInput,
  now: Date,
) {
  return actOnOpenOpportunity(user, id, now, async (tx) => {
    const nextFollowUpAt = nextDate ? toDbDate(nextDate) : null;
    await tx.opportunity.update({
      where: { id },
      data: {
        lastContactAt: now,
        nextFollowUpAt,
        snoozedUntil: null,
        snoozeCount: 0,
      },
    });
    await tx.followUp.create({
      data: {
        opportunityId: id,
        userId: user.id,
        channel: channel ?? null,
        summary: summary ?? null,
        nextDate: nextFollowUpAt,
        createdAt: now,
      },
    });
  });
}

export function snoozeOpportunity(
  user: CurrentUser,
  id: number,
  { until, reason }: SnoozeInput,
  now: Date,
) {
  return actOnOpenOpportunity(user, id, now, async (tx) => {
    const snoozedUntil = toDbDate(until);
    await tx.opportunity.update({
      where: { id },
      data: {
        snoozedUntil,
        nextFollowUpAt: null,
        snoozeCount: { increment: 1 },
      },
    });
    await tx.snooze.create({
      data: {
        opportunityId: id,
        userId: user.id,
        until: snoozedUntil,
        reason: reason ?? null,
        createdAt: now,
      },
    });
  });
}

export async function getOpportunityDetail(
  user: CurrentUser,
  id: number,
  now: Date,
) {
  await findVisibleOpportunity(user, id);
  return toOpportunityDetail(await loadDetail(prisma, id), now);
}
