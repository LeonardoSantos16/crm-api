import { describe, expect, it } from "vitest";
import {
  STAGE_DEADLINE_DAYS,
  type OpenStage,
} from "../../src/domain/deadlines.ts";

describe("STAGE_DEADLINE_DAYS", () => {
  it.each<[OpenStage, number]>([
    ["FIRST_CONTACT", 1],
    ["BUDGET_PRESENTATION", 5],
    ["FOLLOW_UP", 6],
    ["FORECAST", 7],
  ])("%s has %i days", (stage, days) => {
    expect(STAGE_DEADLINE_DAYS[stage]).toBe(days);
  });
});
