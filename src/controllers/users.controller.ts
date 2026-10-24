import type { Request, Response } from "express";
import type { UserListDto } from "../dtos/user-response.dto.ts";
import type { ListUsersUseCase } from "../use-cases/users/list-users.use-case.ts";

export class UsersController {
  private readonly listUsers: ListUsersUseCase;

  constructor(listUsers: ListUsersUseCase) {
    this.listUsers = listUsers;
  }

  list = async (_req: Request, res: Response<UserListDto>) => {
    res.json({ users: await this.listUsers.execute() });
  };
}
