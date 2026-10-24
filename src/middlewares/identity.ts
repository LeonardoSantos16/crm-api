import type { NextFunction, Request, Response } from "express";
import type { CurrentUser } from "../types/user.types.ts";
import { UnauthenticatedError } from "../errors/http-errors.ts";
import { parsePositiveInteger } from "../lib/positive-integer.ts";
import { findCurrentUser } from "../services/users.service.ts";

declare module "express-serve-static-core" {
  interface Locals {
    user: CurrentUser;
  }
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = parsePositiveInteger(req.get("X-User-Id"));
  if (id === undefined) throw new UnauthenticatedError();

  const user = await findCurrentUser(id);
  if (!user) throw new UnauthenticatedError();

  res.locals.user = user;
  next();
}
