import { AppError } from "./app-error.ts";

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class InvalidJsonError extends AppError {
  constructor() {
    super(400, "INVALID_JSON", "Malformed JSON body");
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super(
      401,
      "UNAUTHENTICATED",
      "X-User-Id header must identify an existing user",
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, "FORBIDDEN", message);
  }
}

export class RouteNotFoundError extends AppError {
  constructor(method: string, path: string) {
    super(404, "NOT_FOUND", `Route ${method} ${path} not found`);
  }
}

export class InternalError extends AppError {
  constructor() {
    super(500, "INTERNAL_ERROR", "Internal server error");
  }
}
