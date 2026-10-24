import type { UserDto } from "../../dtos/user-response.dto.ts";
import type { UserRepository } from "../../repositories/user.repository.ts";

export class ListUsersUseCase {
  private readonly users: UserRepository;

  constructor(users: UserRepository) {
    this.users = users;
  }

  execute(): Promise<UserDto[]> {
    return this.users.list();
  }
}
