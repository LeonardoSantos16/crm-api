import { UnauthenticatedError } from "../../errors/http-errors.ts";
import type { UserRepository } from "../../repositories/user.repository.ts";
import type { CurrentUser } from "../../types/user.types.ts";

export class IdentifyUserUseCase {
  private readonly users: UserRepository;

  constructor(users: UserRepository) {
    this.users = users;
  }

  async execute(id: number | undefined): Promise<CurrentUser> {
    const user = id === undefined ? null : await this.users.findById(id);
    if (!user) throw new UnauthenticatedError();
    return user;
  }
}
