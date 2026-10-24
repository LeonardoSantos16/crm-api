import { describe, expect, it } from "vitest";
import {
  computeAlert,
  needsAttention,
  type Alert,
  type AlertState,
  type AlertSubject,
} from "../../src/domain/alert.ts";
import type { Stage } from "../../src/domain/stages.ts";

const at = (date: string) => new Date(`${date}T12:00:00-03:00`);

const budget = (overrides: Partial<AlertSubject> = {}): AlertSubject => ({
  stage: "BUDGET_PRESENTATION",
  stageEnteredAt: at("2026-10-10"),
  lastContactAt: null,
  nextFollowUpAt: null,
  snoozedUntil: null,
  snoozeCount: 0,
  ...overrides,
});

const stateOn = (subject: AlertSubject, today: string) =>
  computeAlert(subject, at(today))?.state;

describe("computeAlert", () => {
  describe("final stages", () => {
    it.each<Stage>(["CLOSING", "LOST"])("%s has no alert", (stage) => {
      expect(computeAlert(budget({ stage }), at("2026-10-15"))).toBeNull();
    });
  });

  describe("dueDate", () => {
    it("is the stage entry date plus the stage deadline", () => {
      expect(computeAlert(budget(), at("2026-10-12"))?.dueDate).toBe(
        "2026-10-15",
      );
    });

    it("counts from the last follow-up when it is more recent", () => {
      const subject = budget({ lastContactAt: at("2026-10-12") });

      expect(computeAlert(subject, at("2026-10-12"))?.dueDate).toBe(
        "2026-10-17",
      );
    });

    it("counts from the stage entry when the last follow-up is older", () => {
      const subject = budget({ lastContactAt: at("2026-10-05") });

      expect(computeAlert(subject, at("2026-10-12"))?.dueDate).toBe(
        "2026-10-15",
      );
    });

    it("is the next follow-up date when one was chosen", () => {
      const subject = budget({ nextFollowUpAt: "2026-10-25" });

      expect(computeAlert(subject, at("2026-10-12"))?.dueDate).toBe(
        "2026-10-25",
      );
    });

    it("is the snooze date, even with a next follow-up date", () => {
      const subject = budget({
        nextFollowUpAt: "2026-10-25",
        snoozedUntil: "2026-10-20",
        snoozeCount: 1,
      });

      expect(computeAlert(subject, at("2026-10-12"))?.dueDate).toBe(
        "2026-10-20",
      );
    });

    it("uses the São Paulo calendar day of the stage entry", () => {
      const subject = budget({
        stageEnteredAt: new Date("2026-10-10T23:30:00-03:00"),
      });

      expect(computeAlert(subject, at("2026-10-12"))?.dueDate).toBe(
        "2026-10-15",
      );
    });
  });

  describe("state boundaries", () => {
    it.each<[string, AlertState]>([
      ["2026-10-14", "ON_TIME"],
      ["2026-10-15", "ON_TIME"],
      ["2026-10-16", "ATTENTION"],
      ["2026-10-20", "ATTENTION"],
      ["2026-10-21", "ESCALATED"],
    ])("on %s is %s", (today, state) => {
      expect(stateOn(budget(), today)).toBe(state);
    });

    it.each<[string, AlertState]>([
      ["2026-10-19", "SNOOZED"],
      ["2026-10-20", "ON_TIME"],
      ["2026-10-21", "ATTENTION"],
    ])("snoozed until 2026-10-20, on %s is %s", (today, state) => {
      const subject = budget({ snoozedUntil: "2026-10-20", snoozeCount: 1 });

      expect(stateOn(subject, today)).toBe(state);
    });

    it("is SNOOZED after the first snooze", () => {
      const subject = budget({ snoozedUntil: "2026-10-20", snoozeCount: 1 });

      expect(stateOn(subject, "2026-10-16")).toBe("SNOOZED");
    });

    it("escalates on the second snooze in a row, even while snoozed", () => {
      const subject = budget({ snoozedUntil: "2026-10-20", snoozeCount: 2 });

      expect(stateOn(subject, "2026-10-16")).toBe("ESCALATED");
    });

    it("goes back to the deadline after a follow-up resets the snooze count", () => {
      const subject = budget({
        lastContactAt: at("2026-10-16"),
        snoozeCount: 0,
      });

      expect(stateOn(subject, "2026-10-18")).toBe("ON_TIME");
    });
  });

  describe("metrics", () => {
    it("reports idle days since the latest event and the stage deadline", () => {
      expect(computeAlert(budget(), at("2026-10-16"))).toMatchObject({
        idleDays: 6,
        deadlineDays: 5,
      });
      expect(
        computeAlert(
          budget({ lastContactAt: at("2026-10-13") }),
          at("2026-10-16"),
        ),
      ).toMatchObject({ idleDays: 3 });
    });

    it("reports the percentage of the deadline consumed", () => {
      expect(computeAlert(budget(), at("2026-10-16"))?.consumedPct).toBe(120);
    });

    it("reports a negative percentage when the next date is beyond the deadline", () => {
      const subject: AlertSubject = {
        ...budget(),
        stage: "FOLLOW_UP",
        stageEnteredAt: at("2026-10-15"),
        nextFollowUpAt: "2026-11-14",
      };

      expect(computeAlert(subject, at("2026-10-15"))?.consumedPct).toBe(-400);
    });
  });

  describe("case data on 2026-10-15", () => {
    const caseOpportunity = (stage: Stage, lastContact: string) =>
      budget({
        stage,
        stageEnteredAt: at(lastContact),
        lastContactAt: at(lastContact),
      });

    it.each<[string, Stage, string, Partial<Alert> | null]>([
      [
        "OPP-2001",
        "FIRST_CONTACT",
        "2026-10-14",
        { state: "ON_TIME", dueDate: "2026-10-15" },
      ],
      [
        "OPP-2002",
        "BUDGET_PRESENTATION",
        "2026-10-06",
        { state: "ATTENTION", dueDate: "2026-10-11", idleDays: 9 },
      ],
      [
        "OPP-2003",
        "FOLLOW_UP",
        "2026-10-13",
        { state: "ON_TIME", dueDate: "2026-10-19" },
      ],
      [
        "OPP-2004",
        "FOLLOW_UP",
        "2026-10-02",
        { state: "ESCALATED", dueDate: "2026-10-08" },
      ],
      [
        "OPP-2005",
        "FORECAST",
        "2026-10-15",
        { state: "ON_TIME", dueDate: "2026-10-22" },
      ],
      ["OPP-2006", "CLOSING", "2026-10-09", null],
      ["OPP-2007", "LOST", "2026-10-01", null],
    ])("%s (%s, last contact %s)", (_code, stage, lastContact, expected) => {
      const alert = computeAlert(
        caseOpportunity(stage, lastContact),
        at("2026-10-15"),
      );

      if (expected === null) expect(alert).toBeNull();
      else expect(alert).toMatchObject(expected);
    });
  });
});

describe("needsAttention", () => {
  const alertIn = (state: AlertState): Alert => ({
    state,
    dueDate: "2026-10-15",
    idleDays: 0,
    deadlineDays: 5,
    consumedPct: 0,
  });

  it.each<AlertState>(["ATTENTION", "ESCALATED"])("is true for %s", (state) => {
    expect(needsAttention(alertIn(state))).toBe(true);
  });

  it.each<AlertState>(["SNOOZED", "ON_TIME"])("is false for %s", (state) => {
    expect(needsAttention(alertIn(state))).toBe(false);
  });

  it("is false without an alert", () => {
    expect(needsAttention(null)).toBe(false);
  });
});
