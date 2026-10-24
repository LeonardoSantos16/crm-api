import { buildBoard } from "../domain/board.ts";
import { isFinalStage } from "../domain/stages.ts";
import { checkTransition, missingValueOrItems } from "../domain/transitions.ts";
import type {
  CommentOpportunityDto,
  CreateOpportunityDto,
  FollowUpOpportunityDto,
  ListOpportunitiesDto,
  LoseOpportunityDto,
  MoveOpportunityDto,
  SnoozeOpportunityDto,
  UpdateOpportunityDto,
} from "../dtos/opportunity-request.dto.ts";
import type {
  OpportunityBoardDto,
  OpportunityDetailDto,
} from "../dtos/opportunity-response.dto.ts";
import { ForbiddenError, ValidationError } from "../errors/http-errors.ts";
import {
  FinalStageError,
  InvalidTransitionError,
  MissingValueOrItemsError,
  OpportunityNotFoundError,
} from "../errors/opportunity-errors.ts";
import type { Opportunity } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import {
  toOpportunityCard,
  toOpportunityDetail,
} from "../presenters/opportunity.presenter.ts";
import type { OpportunityReader } from "../repositories/opportunity.repository.ts";
import {
  createPrismaRepositories,
  PrismaUnitOfWork,
} from "../repositories/prisma/prisma-unit-of-work.ts";
import type { Repositories } from "../repositories/unit-of-work.ts";
import type { UserRepository } from "../repositories/user.repository.ts";
import type { CurrentUser } from "../types/user.types.ts";

const unitOfWork = new PrismaUnitOfWork(prisma);
const repositories = createPrismaRepositories(prisma);

async function findVisibleOpportunity(
  opportunities: OpportunityReader,
  user: CurrentUser,
  id: number,
) {
  const opportunity = await opportunities.findVisible(user, id);
  if (!opportunity) throw new OpportunityNotFoundError();
  return opportunity;
}

async function assertTeamMember(
  users: UserRepository,
  user: CurrentUser,
  ownerId: number,
) {
  const member =
    user.role === "MANAGER" && (await users.isTeamMember(user.id, ownerId));
  if (!member) {
    throw new ForbiddenError(
      "Only a manager can choose an owner from their team",
    );
  }
}

type OpportunityAction = (
  repositories: Repositories,
  current: Opportunity,
) => Promise<void>;

async function actOnOpportunity(
  user: CurrentUser,
  id: number,
  now: Date,
  action: OpportunityAction,
): Promise<OpportunityDetailDto> {
  const opportunity = await unitOfWork.run(async (repositories) => {
    const current = await findVisibleOpportunity(
      repositories.opportunities,
      user,
      id,
    );
    await action(repositories, current);
    return repositories.opportunities.findDetail(id);
  });

  return toOpportunityDetail(opportunity, now);
}

function actOnOpenOpportunity(
  user: CurrentUser,
  id: number,
  now: Date,
  action: OpportunityAction,
): Promise<OpportunityDetailDto> {
  return actOnOpportunity(user, id, now, async (repositories, current) => {
    if (isFinalStage(current.stage)) throw new FinalStageError();
    await action(repositories, current);
  });
}

export function moveOpportunity(
  user: CurrentUser,
  id: number,
  { toStage, complete }: MoveOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpenOpportunity(
    user,
    id,
    now,
    async ({ opportunities }, current) => {
      const result = checkTransition(
        {
          stage: current.stage,
          hasEstimatedValue:
            complete?.estimatedValue !== undefined ||
            current.estimatedValue !== null,
          itemCount:
            complete?.items?.length ?? (await opportunities.countItems(id)),
        },
        toStage,
      );
      if (!result.allowed) throw new InvalidTransitionError(result.reason);
      if (result.missing) throw new MissingValueOrItemsError(result.missing);

      if (complete?.items) await opportunities.replaceItems(id, complete.items);

      await opportunities.changeStage({
        opportunityId: id,
        fromStage: current.stage,
        toStage,
        userId: user.id,
        at: now,
        estimatedValue: complete?.estimatedValue,
      });
    },
  );
}

export function loseOpportunity(
  user: CurrentUser,
  id: number,
  { reason, detail }: LoseOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpenOpportunity(user, id, now, ({ opportunities }, current) =>
    opportunities.changeStage({
      opportunityId: id,
      fromStage: current.stage,
      toStage: "LOST",
      userId: user.id,
      at: now,
      lossReason: reason,
      lossDetail: detail ?? null,
    }),
  );
}

export function followUpOpportunity(
  user: CurrentUser,
  id: number,
  { channel, summary, nextDate }: FollowUpOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpenOpportunity(user, id, now, ({ opportunities }) =>
    opportunities.recordFollowUp({
      opportunityId: id,
      userId: user.id,
      channel: channel ?? null,
      summary: summary ?? null,
      nextDate: nextDate ?? null,
      at: now,
    }),
  );
}

export function snoozeOpportunity(
  user: CurrentUser,
  id: number,
  { until, reason }: SnoozeOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpenOpportunity(user, id, now, ({ opportunities }) =>
    opportunities.recordSnooze({
      opportunityId: id,
      userId: user.id,
      until,
      reason: reason ?? null,
      at: now,
    }),
  );
}

export async function getOpportunityDetail(
  user: CurrentUser,
  id: number,
  now: Date,
): Promise<OpportunityDetailDto> {
  const { opportunities } = repositories;
  await findVisibleOpportunity(opportunities, user, id);
  return toOpportunityDetail(await opportunities.findDetail(id), now);
}

export function commentOpportunity(
  user: CurrentUser,
  id: number,
  { body }: CommentOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpportunity(user, id, now, ({ opportunities }) =>
    opportunities.addComment({
      opportunityId: id,
      userId: user.id,
      body,
      at: now,
    }),
  );
}

export async function listOpportunities(
  user: CurrentUser,
  { ownerId, includeLost = false, ...filter }: ListOpportunitiesDto,
  now: Date,
): Promise<OpportunityBoardDto> {
  if (ownerId !== undefined) {
    await assertTeamMember(repositories.users, user, ownerId);
  }

  const rows = await repositories.opportunities.findVisibleCards(user, {
    ownerId,
    includeLost,
  });
  const cards = rows.map((row) => toOpportunityCard(row, now));

  return buildBoard(cards, filter, now);
}

async function resolveOwner(user: CurrentUser, ownerId: number | undefined) {
  if (user.role === "MANAGER") {
    if (ownerId === undefined) {
      throw new ValidationError(
        "Managers must choose an owner from their team",
        [{ path: ["ownerId"], message: "Required for managers" }],
      );
    }
    await assertTeamMember(repositories.users, user, ownerId);
    return ownerId;
  }
  if (ownerId === undefined || ownerId === user.id) return user.id;
  throw new ForbiddenError(
    "Sellers can only create opportunities for themselves",
  );
}

export async function createOpportunity(
  user: CurrentUser,
  { companyName, ownerId, ...data }: CreateOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  const owner = await resolveOwner(user, ownerId);
  const opportunity = await unitOfWork.run(
    async ({ companies, opportunities }) => {
      const company = await companies.findOrCreate(companyName);
      const id = await opportunities.create({
        ...data,
        companyId: company.id,
        ownerId: owner,
        createdById: user.id,
        createdAt: now,
      });
      return opportunities.findDetail(id);
    },
  );

  return toOpportunityDetail(opportunity, now);
}

export function updateOpportunity(
  user: CurrentUser,
  id: number,
  { companyName, items, ...changes }: UpdateOpportunityDto,
  now: Date,
): Promise<OpportunityDetailDto> {
  return actOnOpenOpportunity(
    user,
    id,
    now,
    async ({ companies, opportunities }, current) => {
      if (current.stage !== "FIRST_CONTACT") {
        const missing = missingValueOrItems({
          hasEstimatedValue:
            changes.estimatedValue === undefined
              ? current.estimatedValue !== null
              : changes.estimatedValue !== null,
          itemCount: items?.length ?? (await opportunities.countItems(id)),
        });
        if (missing.length > 0) throw new MissingValueOrItemsError(missing);
      }

      const company = companyName
        ? await companies.findOrCreate(companyName)
        : undefined;
      await opportunities.update(id, { ...changes, companyId: company?.id });
      if (items) await opportunities.replaceItems(id, items);
    },
  );
}
