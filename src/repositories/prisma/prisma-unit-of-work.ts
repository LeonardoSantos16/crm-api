import type { Prisma, PrismaClient } from "../../generated/prisma/client.ts";
import type { Repositories, UnitOfWork } from "../unit-of-work.ts";
import { PrismaCompanyRepository } from "./prisma-company.repository.ts";
import { PrismaOpportunityRepository } from "./prisma-opportunity.repository.ts";
import { PrismaUserRepository } from "./prisma-user.repository.ts";

export function createPrismaRepositories(
  db: Prisma.TransactionClient,
): Repositories {
  return {
    opportunities: new PrismaOpportunityRepository(db),
    companies: new PrismaCompanyRepository(db),
    users: new PrismaUserRepository(db),
  };
}

export class PrismaUnitOfWork implements UnitOfWork {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  run<T>(work: (repositories: Repositories) => Promise<T>) {
    return this.prisma.$transaction((tx) => work(createPrismaRepositories(tx)));
  }
}
