import type { Prisma } from "../../generated/prisma/client.ts";
import type { CompanyRepository } from "../company.repository.ts";

export class PrismaCompanyRepository implements CompanyRepository {
  private readonly db: Prisma.TransactionClient;

  constructor(db: Prisma.TransactionClient) {
    this.db = db;
  }

  async findOrCreate(name: string) {
    return (
      (await this.db.company.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      })) ?? (await this.db.company.create({ data: { name } }))
    );
  }
}
