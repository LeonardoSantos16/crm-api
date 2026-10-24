import type { UserDto } from "../dtos/user-response.dto.ts";
import { prisma } from "../lib/prisma.ts";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository.ts";
import type { CurrentUser } from "../types/user.types.ts";

const users = new PrismaUserRepository(prisma);

export function findCurrentUser(id: number): Promise<CurrentUser | null> {
  return users.findById(id);
}

export function listUsers(): Promise<UserDto[]> {
  return users.list();
}
