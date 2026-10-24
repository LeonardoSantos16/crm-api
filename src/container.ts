import { HealthController } from "./controllers/health.controller.ts";
import { OpportunitiesController } from "./controllers/opportunities.controller.ts";
import { UsersController } from "./controllers/users.controller.ts";
import type { PrismaClient } from "./generated/prisma/client.ts";
import { requireUser } from "./middlewares/identity.ts";
import { PrismaHealthRepository } from "./repositories/prisma/prisma-health.repository.ts";
import {
  createPrismaRepositories,
  PrismaUnitOfWork,
} from "./repositories/prisma/prisma-unit-of-work.ts";
import type { RouteHandlers } from "./routes/index.ts";
import { CheckHealthUseCase } from "./use-cases/health/check-health.use-case.ts";
import { CommentOpportunityUseCase } from "./use-cases/opportunities/comment-opportunity.use-case.ts";
import { CreateOpportunityUseCase } from "./use-cases/opportunities/create-opportunity.use-case.ts";
import { FollowUpOpportunityUseCase } from "./use-cases/opportunities/follow-up-opportunity.use-case.ts";
import { GetOpportunityDetailUseCase } from "./use-cases/opportunities/get-opportunity-detail.use-case.ts";
import { ListOpportunitiesUseCase } from "./use-cases/opportunities/list-opportunities.use-case.ts";
import { LoseOpportunityUseCase } from "./use-cases/opportunities/lose-opportunity.use-case.ts";
import { MoveOpportunityUseCase } from "./use-cases/opportunities/move-opportunity.use-case.ts";
import { OpportunityActionRunner } from "./use-cases/opportunities/opportunity-action-runner.ts";
import { SnoozeOpportunityUseCase } from "./use-cases/opportunities/snooze-opportunity.use-case.ts";
import { UpdateOpportunityUseCase } from "./use-cases/opportunities/update-opportunity.use-case.ts";
import { IdentifyUserUseCase } from "./use-cases/users/identify-user.use-case.ts";
import { ListUsersUseCase } from "./use-cases/users/list-users.use-case.ts";

export function createContainer(prisma: PrismaClient): RouteHandlers {
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const { opportunities, users } = createPrismaRepositories(prisma);
  const runner = new OpportunityActionRunner(unitOfWork);

  return {
    health: new HealthController(
      new CheckHealthUseCase(new PrismaHealthRepository(prisma)),
    ),
    users: new UsersController(new ListUsersUseCase(users)),
    opportunities: new OpportunitiesController({
      list: new ListOpportunitiesUseCase(opportunities, users),
      getDetail: new GetOpportunityDetailUseCase(opportunities),
      create: new CreateOpportunityUseCase(unitOfWork),
      update: new UpdateOpportunityUseCase(runner),
      move: new MoveOpportunityUseCase(runner),
      lose: new LoseOpportunityUseCase(runner),
      followUp: new FollowUpOpportunityUseCase(runner),
      snooze: new SnoozeOpportunityUseCase(runner),
      comment: new CommentOpportunityUseCase(runner),
    }),
    requireUser: requireUser(new IdentifyUserUseCase(users)),
  };
}
