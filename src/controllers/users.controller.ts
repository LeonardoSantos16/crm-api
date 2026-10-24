import type { Request, Response } from "express";
import { listUsers } from "../services/users.service.ts";

export async function getUsers(_req: Request, res: Response) {
  res.json({ users: await listUsers() });
}
