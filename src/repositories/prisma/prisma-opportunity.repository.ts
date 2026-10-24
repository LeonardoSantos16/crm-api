import { toDbDate, type CalendarDate } from "../../domain/dates.ts";
import { StageConflictError } from "../../errors/opportunity-errors.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import type {
  CardFilter,
  CommentRecord,
  FollowUpRecord,
  ItemData,
  NewOpportunity,
  OpportunityChanges,
  SnoozeRecord,
  StageChange,
} from "../../types/opportunity.types.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityRepository } from "../opportunity.repository.ts";
import {
  opportunityCardInclude,
  opportunityDetailInclude,
} from "./opportunity.includes.ts";

const toOptionalDbDate = (date: CalendarDate | null | undefined) =>
  date ? toDbDate(date) : date;

function visibleTo(user: CurrentUser): Prisma.OpportunityWhereInput {
  return user.role === "MANAGER"
    ? { owner: { managerId: user.id } }
    : { ownerId: user.id };
}

export class PrismaOpportunityRepository implements OpportunityRepository {
  private readonly db: Prisma.TransactionClient;

  constructor(db: Prisma.TransactionClient) {
    this.db = db;
  }

  findVisible(user: CurrentUser, id: number) {
    return this.db.opportunity.findFirst({
      where: { id, ...visibleTo(user) },
    });
  }

  findVisibleCards(user: CurrentUser, { ownerId, includeLost }: CardFilter) {
    return this.db.opportunity.findMany({
      where: {
        ...visibleTo(user),
        ...(ownerId === undefined ? {} : { ownerId }),
        ...(includeLost ? {} : { stage: { not: "LOST" as const } }),
      },
      include: opportunityCardInclude,
    });
  }

  findDetail(id: number) {
    return this.db.opportunity.findUniqueOrThrow({
      where: { id },
      include: opportunityDetailInclude,
    });
  }

  countItems(id: number) {
    return this.db.opportunityItem.count({ where: { opportunityId: id } });
  }

  async create({ item, createdById, createdAt, ...data }: NewOpportunity) {
    const { id } = await this.db.opportunity.create({
      data: {
        ...data,
        stage: "FIRST_CONTACT",
        stageEnteredAt: createdAt,
        items: item ? { create: [item] } : {},
        stageChanges: {
          create: {
            fromStage: null,
            toStage: "FIRST_CONTACT",
            changedAt: createdAt,
            changedById: createdById,
          },
        },
      },
    });
    return id;
  }

  async update(
    id: number,
    { proposalValidUntil, eventDate, ...data }: OpportunityChanges,
  ) {
    await this.db.opportunity.update({
      where: { id },
      data: {
        ...data,
        proposalValidUntil: toOptionalDbDate(proposalValidUntil),
        eventDate: toOptionalDbDate(eventDate),
      },
    });
  }

  async replaceItems(id: number, items: ItemData[]) {
    await this.db.opportunityItem.deleteMany({ where: { opportunityId: id } });
    await this.db.opportunityItem.createMany({
      data: items.map((item) => ({ ...item, opportunityId: id })),
    });
  }

  async changeStage({
    opportunityId,
    fromStage,
    toStage,
    userId,
    at,
    ...data
  }: StageChange) {
    const { count } = await this.db.opportunity.updateMany({
      where: { id: opportunityId, stage: fromStage },
      data: {
        ...data,
        stage: toStage,
        stageEnteredAt: at,
        snoozedUntil: null,
        nextFollowUpAt: null,
      },
    });
    if (count === 0) throw new StageConflictError();

    await this.db.stageChange.create({
      data: {
        opportunityId,
        fromStage,
        toStage,
        changedAt: at,
        changedById: userId,
      },
    });
  }

  async recordFollowUp({ nextDate, at, ...followUp }: FollowUpRecord) {
    const nextFollowUpAt = nextDate ? toDbDate(nextDate) : null;
    await this.db.opportunity.update({
      where: { id: followUp.opportunityId },
      data: {
        lastContactAt: at,
        nextFollowUpAt,
        snoozedUntil: null,
        snoozeCount: 0,
      },
    });
    await this.db.followUp.create({
      data: { ...followUp, nextDate: nextFollowUpAt, createdAt: at },
    });
  }

  async recordSnooze({ until, at, ...snooze }: SnoozeRecord) {
    const snoozedUntil = toDbDate(until);
    await this.db.opportunity.update({
      where: { id: snooze.opportunityId },
      data: {
        snoozedUntil,
        nextFollowUpAt: null,
        snoozeCount: { increment: 1 },
      },
    });
    await this.db.snooze.create({
      data: { ...snooze, until: snoozedUntil, createdAt: at },
    });
  }

  async addComment({ at, ...comment }: CommentRecord) {
    await this.db.comment.create({ data: { ...comment, createdAt: at } });
  }
}
