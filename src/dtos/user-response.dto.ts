import type { UserRole } from "../types/user.types.ts";

export type UserDto = {
  id: number;
  name: string;
  role: UserRole;
  managerId: number | null;
};

export type UserListDto = { users: UserDto[] };
