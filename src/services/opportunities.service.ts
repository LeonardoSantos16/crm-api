import { buildBoard, type BoardFilter } from "../domain/board.ts";
import { toDbDate, type CalendarDate } from "../domain/dates.ts";
import { isFinalStage, type Stage } from "../domain/stages.ts";
import { checkTransition, missingValueOrItems } from "../domain/transitions.ts";
import { ForbiddenError, ValidationError } from "../errors/http-errors.ts";
import {
  FinalStageError,
  InvalidTransitionError,
  MissingValueOrItemsError,
  StageConflictError,
} from "../errors/opportunity-errors.ts";
import type {
  FollowUpChannel,
  LossReason,
  Opportunity,
  Prisma,
} from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
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

const loadDetail = (tx: Prisma.TransactionClient, id: number) =>
  tx.opportunity.findUniqueOrThrow({
    where: { id },
    include: opportunityDetailInclude,
  });

const toOptionalDbDate = (date: CalendarDate | null | undefined) =>
  date ? toDbDate(date) : date;

async function findOrCreateCompany(tx: Prisma.TransactionClient, name: string) {
  return (
    (await tx.company.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    })) ?? (await tx.company.create({ data: { name } }))
  );
}

async function replaceItems(
  tx: Prisma.TransactionClient,
  opportunityId: number,
  items: ItemInput[],
) {
  await tx.opportunityItem.deleteMany({ where: { opportunityId } });
  await tx.opportunityItem.createMany({
    data: items.map((item) => ({ ...item, opportunityId })),
  });
}

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
    throw new StageConflictError();
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
    if (isFinalStage(current.stage)) throw new FinalStageError();
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
    if (!result.allowed) throw new InvalidTransitionError(result.reason);
    if (result.missing) throw new MissingValueOrItemsError(result.missing);

    if (complete?.items) await replaceItems(tx, id, complete.items);

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

export type ListQuery = BoardFilter & {
  ownerId?: number | undefined;
  includeLost?: boolean | undefined;
};

export async function listOpportunities(
  user: CurrentUser,
  { ownerId, includeLost = false, ...filter }: ListQuery,
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

  return buildBoard(cards, filter, now);
}

export type CreateInput = {
  companyName: string;
  contactName: string;
  contactPhone?: string | undefined;
  contactEmail?: string | undefined;
  ownerId?: number | undefined;
  item?: ItemInput | undefined;
  estimatedValue?: number | undefined;
};

async function resolveOwner(user: CurrentUser, ownerId: number | undefined) {
  if (user.role === "MANAGER") {
    if (ownerId === undefined) {
      throw new ValidationError(
        "Managers must choose an owner from their team",
        [{ path: ["ownerId"], message: "Required for managers" }],
      );
    }
    await assertTeamMember(user, ownerId);
    return ownerId;
  }
  if (ownerId === undefined || ownerId === user.id) return user.id;
  throw new ForbiddenError(
    "Sellers can only create opportunities for themselves",
  );
}

export async function createOpportunity(
  user: CurrentUser,
  { companyName, ownerId, item, ...data }: CreateInput,
  now: Date,
) {
  const owner = await resolveOwner(user, ownerId);
  const opportunity = await prisma.$transaction(async (tx) => {
    const company = await findOrCreateCompany(tx, companyName);
    const { id } = await tx.opportunity.create({
      data: {
        ...data,
        companyId: company.id,
        ownerId: owner,
        stage: "FIRST_CONTACT",
        stageEnteredAt: now,
        items: item ? { create: [item] } : {},
        stageChanges: {
          create: {
            fromStage: null,
            toStage: "FIRST_CONTACT",
            changedAt: now,
            changedById: user.id,
          },
        },
      },
    });
    return loadDetail(tx, id);
  });

  return toOpportunityDetail(opportunity, now);
}

export type UpdateInput = {
  companyName?: string | undefined;
  contactName?: string | undefined;
  contactPhone?: string | null | undefined;
  contactEmail?: string | null | undefined;
  proposalValidUntil?: CalendarDate | null | undefined;
  eventDate?: CalendarDate | null | undefined;
  items?: ItemInput[] | undefined;
  estimatedValue?: number | null | undefined;
};

export function updateOpportunity(
  user: CurrentUser,
  id: number,
  { companyName, items, proposalValidUntil, eventDate, ...data }: UpdateInput,
  now: Date,
) {
  return actOnOpenOpportunity(user, id, now, async (tx, current) => {
    if (current.stage !== "FIRST_CONTACT") {
      const missing = missingValueOrItems({
        hasEstimatedValue:
          data.estimatedValue === undefined
            ? current.estimatedValue !== null
            : data.estimatedValue !== null,
        itemCount:
          items?.length ??
          (await tx.opportunityItem.count({ where: { opportunityId: id } })),
      });
      if (missing.length > 0) throw new MissingValueOrItemsError(missing);
    }

    const company = companyName
      ? await findOrCreateCompany(tx, companyName)
      : undefined;
    await tx.opportunity.update({
      where: { id },
      data: {
        ...data,
        ...(company ? { companyId: company.id } : {}),
        proposalValidUntil: toOptionalDbDate(proposalValidUntil),
        eventDate: toOptionalDbDate(eventDate),
      },
    });
    if (items) await replaceItems(tx, id, items);
  });
}
