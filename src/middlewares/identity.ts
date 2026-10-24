import type { NextFunction, Request, Response } from "express";
import { parsePositiveInteger } from "../lib/positive-integer.ts";
import type { CurrentUser } from "../types/user.types.ts";
import type { IdentifyUserUseCase } from "../use-cases/users/identify-user.use-case.ts";

declare module "express-serve-static-core" {
  interface Locals {
    user: CurrentUser;
  }
}

export function requireUser(identifyUser: IdentifyUserUseCase) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = parsePositiveInteger(req.get("X-User-Id"));
    res.locals.user = await identifyUser.execute(id);
    next();
  };
}
