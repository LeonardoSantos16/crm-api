import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.ts";
import {
  findCurrentUser,
  type CurrentUser,
} from "../services/users.service.ts";

declare module "express-serve-static-core" {
  interface Locals {
    user: CurrentUser;
  }
}

const POSITIVE_INTEGER = /^[1-9]\d*$/;

const unauthenticated = () =>
  new AppError(
    401,
    "UNAUTHENTICATED",
    "X-User-Id header must identify an existing user",
  );

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.get("X-User-Id");
  if (!header || !POSITIVE_INTEGER.test(header)) throw unauthenticated();

  const user = await findCurrentUser(Number(header));
  if (!user) throw unauthenticated();

  res.locals.user = user;
  next();
}
