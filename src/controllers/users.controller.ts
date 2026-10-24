import type { Request, Response } from "express";
import type { UserListDto } from "../dtos/user-response.dto.ts";
import { listUsers } from "../services/users.service.ts";

export async function getUsers(_req: Request, res: Response<UserListDto>) {
  res.json({ users: await listUsers() });
}
