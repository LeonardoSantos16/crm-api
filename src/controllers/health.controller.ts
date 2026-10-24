import type { Request, Response } from "express";
import { isDatabaseUp } from "../services/health.service.ts";

export async function getHealth(_req: Request, res: Response) {
  const database = await isDatabaseUp();
  res
    .status(database ? 200 : 503)
    .json({ status: database ? "ok" : "unavailable", database });
}
