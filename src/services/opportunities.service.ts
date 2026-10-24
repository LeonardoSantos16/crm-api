import { isFinalStage, type Stage } from "../domain/stages.ts";
import { checkTransition } from "../domain/transitions.ts";
import { AppError } from "../errors/app-error.ts";
import type { LossReason, Prisma } from "../generated/prisma/client.ts";
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

export async function moveOpportunity(
  user: CurrentUser,
  id: number,
  { toStage, complete }: MoveInput,
  now: Date,
) {
  const opportunity = await prisma.$transaction(async (tx) => {
    const current = await findVisibleOpportunity(user, id, tx);
    if (isFinalStage(current.stage)) throw finalStageError();

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

    return loadDetail(tx, id);
  });

  return toOpportunityDetail(opportunity, now);
}

export async function loseOpportunity(
  user: CurrentUser,
  id: number,
  { reason, detail }: LoseInput,
  now: Date,
) {
  const opportunity = await prisma.$transaction(async (tx) => {
    const current = await findVisibleOpportunity(user, id, tx);
    if (isFinalStage(current.stage)) throw finalStageError();

    await applyStageChange(tx, {
      id,
      fromStage: current.stage,
      toStage: "LOST",
      now,
      userId: user.id,
      data: { lossReason: reason, lossDetail: detail ?? null },
    });

    return loadDetail(tx, id);
  });

  return toOpportunityDetail(opportunity, now);
}
