import type { Prisma } from "../../generated/prisma/client.ts";
import type { UserRepository } from "../user.repository.ts";

const currentUserSelect = {
  id: true,
  name: true,
  role: true,
  managerId: true,
} satisfies Prisma.UserSelect;

export class PrismaUserRepository implements UserRepository {
  private readonly db: Prisma.TransactionClient;

  constructor(db: Prisma.TransactionClient) {
    this.db = db;
  }

  findById(id: number) {
    return this.db.user.findUnique({
      where: { id },
      select: currentUserSelect,
    });
  }

  list() {
    return this.db.user.findMany({
      select: currentUserSelect,
      orderBy: [{ role: "desc" }, { name: "asc" }],
    });
  }

  async isTeamMember(managerId: number, userId: number) {
    const member = await this.db.user.findFirst({
      where: { id: userId, managerId },
      select: { id: true },
    });
    return member !== null;
  }
}
