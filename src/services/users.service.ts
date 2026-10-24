import type { UserRole } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export type CurrentUser = {
  id: number;
  name: string;
  role: UserRole;
  managerId: number | null;
};

export function findCurrentUser(id: number): Promise<CurrentUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, managerId: true },
  });
}

export function listUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
}
