import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.ts";

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid request data",
      err.issues,
    );
  }

  if (err instanceof SyntaxError && "body" in err) {
    return new AppError(400, "INVALID_JSON", "Malformed JSON body");
  }

  console.error(err);
  return new AppError(500, "INTERNAL_ERROR", "Internal server error");
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
