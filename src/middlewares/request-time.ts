import type { NextFunction, Request, Response } from "express";
import { toLocalDate } from "../domain/dates.ts";
import type { Clock } from "../lib/clock.ts";

declare module "express-serve-static-core" {
  interface Locals {
    now: Date;
  }
}

export function requestTime(clock: Clock) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.now = clock();
    res.set("X-Today", toLocalDate(res.locals.now));
    next();
  };
}
