import type { Prisma } from "../../generated/prisma/client.ts";

export const summaryInclude = {
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" } },
} satisfies Prisma.OpportunityInclude;

export const opportunityCardInclude = {
  ...summaryInclude,
  stageChanges: {
    where: { toStage: "LOST" },
    select: { fromStage: true },
  },
} satisfies Prisma.OpportunityInclude;

export const opportunityDetailInclude = {
  ...summaryInclude,
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
