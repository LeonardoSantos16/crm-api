import type { CurrentUser } from "../types/user.types.ts";

export interface UserRepository {
  findById(id: number): Promise<CurrentUser | null>;
  list(): Promise<CurrentUser[]>;
  isTeamMember(managerId: number, userId: number): Promise<boolean>;
}
