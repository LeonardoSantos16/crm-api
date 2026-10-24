import { describe, expect, it } from "vitest";
import { FUNNEL_STAGES, type Stage } from "../../src/domain/stages.ts";
import {
  checkTransition,
  getMoves,
  type MoveBlockReason,
  type TransitionSubject,
} from "../../src/domain/transitions.ts";

const complete = (stage: Stage): TransitionSubject => ({
  stage,
  hasEstimatedValue: true,
  itemCount: 1,
});

describe("checkTransition", () => {
  describe("allowed moves (matriz 2.3)", () => {
    it.each<[Stage, Stage]>([
      ["FIRST_CONTACT", "BUDGET_PRESENTATION"],
      ["BUDGET_PRESENTATION", "FOLLOW_UP"],
      ["FOLLOW_UP", "BUDGET_PRESENTATION"],
      ["FOLLOW_UP", "FORECAST"],
      ["FORECAST", "FOLLOW_UP"],
      ["FORECAST", "CLOSING"],
    ])("%s → %s is allowed", (from, to) => {
      expect(checkTransition(complete(from), to)).toEqual({ allowed: true });
    });
  });

  describe("blocked moves (matriz 2.3)", () => {
    it.each<[Stage, Stage, MoveBlockReason]>([
      ["FIRST_CONTACT", "FOLLOW_UP", "ONE_STEP_AT_A_TIME"],
      ["FIRST_CONTACT", "FORECAST", "ONE_STEP_AT_A_TIME"],
      ["BUDGET_PRESENTATION", "FORECAST", "ONE_STEP_AT_A_TIME"],
      ["FIRST_CONTACT", "CLOSING", "ONLY_FROM_FORECAST"],
      ["BUDGET_PRESENTATION", "CLOSING", "ONLY_FROM_FORECAST"],
      ["FOLLOW_UP", "CLOSING", "ONLY_FROM_FORECAST"],
      ["BUDGET_PRESENTATION", "FIRST_CONTACT", "NO_RETURN_TO_FIRST_CONTACT"],
      ["FOLLOW_UP", "FIRST_CONTACT", "NO_RETURN_TO_FIRST_CONTACT"],
      ["FORECAST", "FIRST_CONTACT", "NO_RETURN_TO_FIRST_CONTACT"],
      ["FORECAST", "BUDGET_PRESENTATION", "RETURN_NOT_ALLOWED"],
    ])("%s → %s is blocked with %s", (from, to, reason) => {
      expect(checkTransition(complete(from), to)).toEqual({
        allowed: false,
        reason,
      });
    });

    const allStages: Stage[] = [...FUNNEL_STAGES, "LOST"];

    it.each(
      (["CLOSING", "LOST"] as const).flatMap((from) =>
        allStages.map((to): [Stage, Stage] => [from, to]),
      ),
    )("%s → %s is blocked with FINAL_STAGE", (from, to) => {
      expect(checkTransition(complete(from), to)).toEqual({
        allowed: false,
        reason: "FINAL_STAGE",
      });
    });

    it.each<Stage>([
      "FIRST_CONTACT",
      "BUDGET_PRESENTATION",
      "FOLLOW_UP",
      "FORECAST",
    ])("%s → LOST is blocked with USE_LOSE_ACTION", (from) => {
      expect(checkTransition(complete(from), "LOST")).toEqual({
        allowed: false,
        reason: "USE_LOSE_ACTION",
      });
    });

    it.each<Stage>([
      "FIRST_CONTACT",
      "BUDGET_PRESENTATION",
      "FOLLOW_UP",
      "FORECAST",
    ])("%s → %s is blocked with SAME_STAGE", (stage) => {
      expect(checkTransition(complete(stage), stage)).toEqual({
        allowed: false,
        reason: "SAME_STAGE",
      });
    });
  });

  describe("reason precedence", () => {
    it("prefers FINAL_STAGE over NO_RETURN_TO_FIRST_CONTACT", () => {
      expect(checkTransition(complete("CLOSING"), "FIRST_CONTACT")).toEqual({
        allowed: false,
        reason: "FINAL_STAGE",
      });
    });

    it("prefers ONLY_FROM_FORECAST over ONE_STEP_AT_A_TIME", () => {
      expect(checkTransition(complete("FIRST_CONTACT"), "CLOSING")).toEqual({
        allowed: false,
        reason: "ONLY_FROM_FORECAST",
      });
    });
  });

  describe("value and items to enter Orçamento (R2)", () => {
    it.each<Stage>(["FIRST_CONTACT", "FOLLOW_UP"])(
      "%s → BUDGET_PRESENTATION lists what is missing",
      (from) => {
        const to = "BUDGET_PRESENTATION";

        expect(
          checkTransition(
            { stage: from, hasEstimatedValue: false, itemCount: 1 },
            to,
          ),
        ).toEqual({ allowed: true, missing: ["estimatedValue"] });
        expect(
          checkTransition(
            { stage: from, hasEstimatedValue: true, itemCount: 0 },
            to,
          ),
        ).toEqual({ allowed: true, missing: ["items"] });
        expect(
          checkTransition(
            { stage: from, hasEstimatedValue: false, itemCount: 0 },
            to,
          ),
        ).toEqual({ allowed: true, missing: ["estimatedValue", "items"] });
      },
    );

    it("does not check value and items for other destinations", () => {
      expect(
        checkTransition(
          {
            stage: "BUDGET_PRESENTATION",
            hasEstimatedValue: false,
            itemCount: 0,
          },
          "FOLLOW_UP",
        ),
      ).toEqual({ allowed: true });
    });

    it("does not list what is missing for a blocked destination", () => {
      expect(
        checkTransition(
          { stage: "FIRST_CONTACT", hasEstimatedValue: false, itemCount: 0 },
          "FOLLOW_UP",
        ),
      ).toEqual({ allowed: false, reason: "ONE_STEP_AT_A_TIME" });
    });
  });
});

describe("getMoves", () => {
  it("lists the other funnel stages in order, without the current one and LOST", () => {
    const moves = getMoves(complete("FOLLOW_UP"));

    expect(moves.map((move) => move.stage)).toEqual([
      "FIRST_CONTACT",
      "BUDGET_PRESENTATION",
      "FORECAST",
      "CLOSING",
    ]);
  });

  it("blocks every destination from CLOSING", () => {
    const moves = getMoves(complete("CLOSING"));

    expect(moves).toHaveLength(4);
    expect(
      moves.every((move) => !move.allowed && move.reason === "FINAL_STAGE"),
    ).toBe(true);
  });

  it("blocks every funnel stage from LOST", () => {
    const moves = getMoves(complete("LOST"));

    expect(moves.map((move) => move.stage)).toEqual([...FUNNEL_STAGES]);
    expect(
      moves.every((move) => !move.allowed && move.reason === "FINAL_STAGE"),
    ).toBe(true);
  });

  it.each<TransitionSubject>([
    complete("FIRST_CONTACT"),
    { stage: "FIRST_CONTACT", hasEstimatedValue: false, itemCount: 0 },
    complete("BUDGET_PRESENTATION"),
    { stage: "FOLLOW_UP", hasEstimatedValue: true, itemCount: 0 },
    complete("FORECAST"),
  ])("matches checkTransition for each destination (%o)", (subject) => {
    for (const move of getMoves(subject)) {
      const { stage, ...result } = move;
      expect(result).toEqual(checkTransition(subject, stage));
    }
  });
});
