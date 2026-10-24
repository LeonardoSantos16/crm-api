import type { Prisma } from "../generated/prisma/client.ts";
import type {
  opportunityCardInclude,
  opportunityDetailInclude,
  summaryInclude,
} from "../repositories/prisma/opportunity.includes.ts";

export type OpportunitySummaryRow = Prisma.OpportunityGetPayload<{
  include: typeof summaryInclude;
}>;

export type OpportunityCardRow = Prisma.OpportunityGetPayload<{
  include: typeof opportunityCardInclude;
}>;

export type OpportunityDetailRow = Prisma.OpportunityGetPayload<{
  include: typeof opportunityDetailInclude;
}>;
