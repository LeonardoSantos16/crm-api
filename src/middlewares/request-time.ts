import type { NextFunction, Request, Response } from "express";
import type { Clock } from "../lib/clock.ts";

declare module "express-serve-static-core" {
  interface Locals {
    now: Date;
  }
}

export function requestTime(clock: Clock) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.now = clock();
    next();
  };
}
