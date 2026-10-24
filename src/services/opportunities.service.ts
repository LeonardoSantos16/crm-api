import {
  diffDays,
  toDbDate,
  toLocalDate,
  type CalendarDate,
} from "../domain/dates.ts";
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
import { needsAttention, type AlertState } from "../domain/alert.ts";
import {
  byMostRecent,
  byPriority,
  byValue,
  type Rankable,
} from "../domain/priority.ts";
import {
  opportunityCardInclude,
  opportunityDetailInclude,
  toOpportunityCard,
  toOpportunityDetail,
} from "./opportunity-detail.ts";
import type { CurrentUser } from "./users.service.ts";
import {
  assertTeamMember,
  findVisibleOpportunity,
  visibleOpportunitiesWhere,
} from "./visibility.ts";

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

type OpportunityAction = (
  tx: Prisma.TransactionClient,
  current: Opportunity,
) => Promise<void>;

async function actOnOpportunity(
  user: CurrentUser,
  id: number,
  now: Date,
  action: OpportunityAction,
) {
  const opportunity = await prisma.$transaction(async (tx) => {
    const current = await findVisibleOpportunity(user, id, tx);
    await action(tx, current);
    return loadDetail(tx, id);
  });

  return toOpportunityDetail(opportunity, now);
}

function actOnOpenOpportunity(
  user: CurrentUser,
  id: number,
  now: Date,
  action: OpportunityAction,
) {
  return actOnOpportunity(user, id, now, async (tx, current) => {
    if (isFinalStage(current.stage)) throw finalStageError();
    await action(tx, current);
  });
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

export function commentOpportunity(
  user: CurrentUser,
  id: number,
  body: string,
  now: Date,
) {
  return actOnOpportunity(user, id, now, async (tx) => {
    await tx.comment.create({
      data: { opportunityId: id, userId: user.id, body, createdAt: now },
    });
  });
}

export type ListQuery = {
  q?: string | undefined;
  situation?: AlertState[] | undefined;
  ownerId?: number | undefined;
  sort?: "priority" | "value" | undefined;
  allClosed?: boolean | undefined;
  includeLost?: boolean | undefined;
};

const RECENT_FINAL_DAYS = 30;

type BoardCard = Rankable & { stage: Stage };

const boardGroup = (card: BoardCard) =>
  card.stage === "CLOSING" ? 1 : card.stage === "LOST" ? 2 : 0;

function byBoardPriority(a: BoardCard, b: BoardCard) {
  const group = boardGroup(a) - boardGroup(b);
  if (group !== 0) return group;
  return boardGroup(a) === 0 ? byPriority(a, b) : byMostRecent(a, b);
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export async function listOpportunities(
  user: CurrentUser,
  {
    q,
    situation,
    ownerId,
    sort = "priority",
    allClosed = false,
    includeLost = false,
  }: ListQuery,
  now: Date,
) {
  if (ownerId !== undefined) await assertTeamMember(user, ownerId);

  const rows = await prisma.opportunity.findMany({
    where: {
      ...visibleOpportunitiesWhere(user),
      ...(ownerId === undefined ? {} : { ownerId }),
      ...(includeLost ? {} : { stage: { not: "LOST" as const } }),
    },
    include: opportunityCardInclude,
  });
  const cards = rows.map((row) => toOpportunityCard(row, now));

  const today = toLocalDate(now);
  const isRecent = (enteredAt: Date) =>
    diffDays(toLocalDate(enteredAt), today) <= RECENT_FINAL_DAYS;
  const search = q ? normalizeText(q) : undefined;
  const isListed = (card: (typeof cards)[number]) => {
    if (card.stage === "CLOSING") {
      return allClosed || isRecent(card.stageEnteredAt);
    }
    if (card.stage === "LOST") return isRecent(card.stageEnteredAt);
    return true;
  };
  const matchesSearch = (card: (typeof cards)[number]) =>
    !search ||
    normalizeText(card.code).includes(search) ||
    normalizeText(card.company.name).includes(search);
  const matchesSituation = (card: (typeof cards)[number]) =>
    !situation || (card.alert !== null && situation.includes(card.alert.state));

  const matching = cards.filter(
    (card) => isListed(card) && matchesSearch(card) && matchesSituation(card),
  );

  return {
    opportunities: matching.sort(sort === "value" ? byValue : byBoardPriority),
    needsAttention: cards.filter((card) => needsAttention(card.alert)).length,
  };
}
