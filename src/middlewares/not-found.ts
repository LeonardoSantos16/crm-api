import type { Request } from "express";
import { RouteNotFoundError } from "../errors/http-errors.ts";

export function notFound(req: Request) {
  throw new RouteNotFoundError(req.method, req.path);
}
