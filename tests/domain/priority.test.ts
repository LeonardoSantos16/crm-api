import { describe, expect, it } from "vitest";
import { computeAlert, type Alert } from "../../src/domain/alert.ts";
import {
  byMostRecent,
  byPriority,
  byValue,
  type Rankable,
} from "../../src/domain/priority.ts";
import type { Stage } from "../../src/domain/stages.ts";

const at = (date: string) => new Date(`${date}T12:00:00-03:00`);

type Ranked = Rankable & { code: string };

const withPct = (consumedPct: number): Alert => ({
  state: "ON_TIME",
  dueDate: "2026-10-15",
  idleDays: 0,
  deadlineDays: 5,
  consumedPct,
});

const ranked = (code: string, overrides: Partial<Rankable> = {}): Ranked => ({
  code,
  alert: withPct(50),
  estimatedValue: 1000,
  stageEnteredAt: at("2026-10-10"),
  ...overrides,
});

const codes = (items: Ranked[]) => items.map((item) => item.code);

describe("byPriority", () => {
  it("puts the highest consumed percentage first", () => {
    const items = [
      ranked("A", { alert: withPct(20) }),
      ranked("B", { alert: withPct(180) }),
      ranked("C", { alert: withPct(-400) }),
      ranked("D", { alert: withPct(100) }),
    ];

    expect(codes(items.sort(byPriority))).toEqual(["B", "D", "A", "C"]);
  });

  it("breaks ties by the highest value, with no value last", () => {
    const items = [
      ranked("A", { estimatedValue: 500 }),
      ranked("B", { estimatedValue: null }),
      ranked("C", { estimatedValue: 9000 }),
    ];

    expect(codes(items.sort(byPriority))).toEqual(["C", "A", "B"]);
  });

  it("ranks the case data on 2026-10-15", () => {
    const today = at("2026-10-15");
    const caseItem = (
      code: string,
      stage: Stage,
      lastContact: string,
      estimatedValue: number,
    ): Ranked => ({
      code,
      estimatedValue,
      stageEnteredAt: at(lastContact),
      alert: computeAlert(
        {
          stage,
          stageEnteredAt: at(lastContact),
          lastContactAt: at(lastContact),
          nextFollowUpAt: null,
          snoozedUntil: null,
          snoozeCount: 0,
        },
        today,
      ),
    });

    const items = [
      caseItem("OPP-2001", "FIRST_CONTACT", "2026-10-14", 4500),
      caseItem("OPP-2002", "BUDGET_PRESENTATION", "2026-10-06", 9800),
      caseItem("OPP-2003", "FOLLOW_UP", "2026-10-13", 7200),
      caseItem("OPP-2004", "FOLLOW_UP", "2026-10-02", 3900),
      caseItem("OPP-2005", "FORECAST", "2026-10-15", 38000),
    ];

    expect(codes(items.sort(byPriority))).toEqual([
      "OPP-2004",
      "OPP-2002",
      "OPP-2001",
      "OPP-2003",
      "OPP-2005",
    ]);
  });
});

describe("byValue", () => {
  it("puts the highest value first, with no value last", () => {
    const items = [
      ranked("A", { estimatedValue: 100 }),
      ranked("B", { estimatedValue: null }),
      ranked("C", { estimatedValue: 500 }),
    ];

    expect(codes(items.sort(byValue))).toEqual(["C", "A", "B"]);
  });
});

describe("byMostRecent", () => {
  it("puts the most recent stage entry first", () => {
    const items = [
      ranked("A", { stageEnteredAt: at("2026-10-01") }),
      ranked("B", { stageEnteredAt: at("2026-10-09") }),
      ranked("C", { stageEnteredAt: at("2026-10-05") }),
    ];

    expect(codes(items.sort(byMostRecent))).toEqual(["B", "C", "A"]);
  });
});
