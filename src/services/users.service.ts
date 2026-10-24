import { prisma } from "../lib/prisma.ts";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository.ts";

const users = new PrismaUserRepository(prisma);

export function findCurrentUser(id: number) {
  return users.findById(id);
}

export function listUsers() {
  return users.list();
}
