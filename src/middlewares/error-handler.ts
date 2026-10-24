import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.ts";
import {
  InternalError,
  InvalidJsonError,
  ValidationError,
} from "../errors/http-errors.ts";

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new ValidationError("Invalid request data", err.issues);
  }

  if (err instanceof SyntaxError && "body" in err) {
    return new InvalidJsonError();
  }

  console.error(err);
  return new InternalError();
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);

  const { status, code, message, details } = toAppError(err);
  res.status(status).json({ error: { code, message, details } });
}
