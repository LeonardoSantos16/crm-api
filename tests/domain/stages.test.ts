import { describe, expect, it } from "vitest";
import { isFinalStage, type Stage } from "../../src/domain/stages.ts";

describe("isFinalStage", () => {
  it.each<Stage>(["CLOSING", "LOST"])("%s is final", (stage) => {
    expect(isFinalStage(stage)).toBe(true);
  });

  it.each<Stage>([
    "FIRST_CONTACT",
    "BUDGET_PRESENTATION",
    "FOLLOW_UP",
    "FORECAST",
  ])("%s is not final", (stage) => {
    expect(isFinalStage(stage)).toBe(false);
  });
});
