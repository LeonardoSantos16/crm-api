import type { MissingField, MoveBlockReason } from "../domain/transitions.ts";
import { AppError } from "./app-error.ts";

export class OpportunityNotFoundError extends AppError {
  constructor() {
    super(404, "NOT_FOUND", "Opportunity not found");
  }
}

export class FinalStageError extends AppError {
  constructor() {
    super(409, "FINAL_STAGE", "Opportunity is in a final stage");
  }
}

export class StageConflictError extends AppError {
  constructor() {
    super(
      409,
      "STAGE_CONFLICT",
      "Opportunity stage changed during the request",
    );
  }
}

export class InvalidTransitionError extends AppError {
  constructor(reason: MoveBlockReason) {
    super(409, "INVALID_TRANSITION", "Stage transition not allowed", {
      reason,
    });
  }
}

export class MissingValueOrItemsError extends AppError {
  constructor(missing: MissingField[]) {
    super(
      422,
      "MISSING_VALUE_OR_ITEMS",
      "Estimated value and at least one item are required",
      { missing },
    );
  }
}
