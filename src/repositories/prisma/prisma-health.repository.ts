import type { Prisma } from "../../generated/prisma/client.ts";
import type { HealthRepository } from "../health.repository.ts";

export class PrismaHealthRepository implements HealthRepository {
  private readonly db: Prisma.TransactionClient;

  constructor(db: Prisma.TransactionClient) {
    this.db = db;
  }

  async isDatabaseUp() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
