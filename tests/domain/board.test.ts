import { describe, expect, it } from "vitest";
import type { Alert, AlertState } from "../../src/domain/alert.ts";
import {
  buildBoard,
  RECENT_FINAL_DAYS,
  type BoardCard,
} from "../../src/domain/board.ts";
import { addDays } from "../../src/domain/dates.ts";

const now = new Date("2026-10-15T12:00:00-03:00");
const at = (date: string) => new Date(`${date}T12:00:00-03:00`);
const daysAgo = (days: number) => at(addDays("2026-10-15", -days));

const alertOf = (state: AlertState, consumedPct = 50): Alert => ({
  state,
  dueDate: "2026-10-15",
  idleDays: 0,
  deadlineDays: 5,
  consumedPct,
});

const card = (code: string, overrides: Partial<BoardCard> = {}): BoardCard => ({
  code,
  company: { name: "Acme" },
  stage: "FIRST_CONTACT",
  stageEnteredAt: daysAgo(1),
  estimatedValue: 1000,
  alert: alertOf("ON_TIME"),
  ...overrides,
});

const codesOf = (cards: BoardCard[], filter = {}) =>
  buildBoard(cards, filter, now).opportunities.map((item) => item.code);

describe("buildBoard", () => {
  describe("final stages", () => {
    it("lists open stages regardless of how long ago they were entered", () => {
      expect(codesOf([card("A", { stageEnteredAt: daysAgo(400) })])).toEqual([
        "A",
      ]);
    });

    it(`lists CLOSING and LOST up to ${RECENT_FINAL_DAYS} days after entering the stage`, () => {
      const cards = [
        card("C1", { stage: "CLOSING", stageEnteredAt: daysAgo(30) }),
        card("C2", { stage: "CLOSING", stageEnteredAt: daysAgo(31) }),
        card("L1", { stage: "LOST", stageEnteredAt: daysAgo(30) }),
        card("L2", { stage: "LOST", stageEnteredAt: daysAgo(31) }),
      ];

      expect(codesOf(cards)).toEqual(["C1", "L1"]);
    });

    it("lists every CLOSING when allClosed is set, but not old LOST", () => {
      const cards = [
        card("C1", { stage: "CLOSING", stageEnteredAt: daysAgo(90) }),
        card("L1", { stage: "LOST", stageEnteredAt: daysAgo(90) }),
      ];

      expect(codesOf(cards, { allClosed: true })).toEqual(["C1"]);
    });
  });

  describe("search", () => {
    const cards = [
      card("OPP-1", { company: { name: "Padaria São João" } }),
      card("OPP-22", { company: { name: "Mercado Central" } }),
    ];

    it("matches the company name ignoring case and accents", () => {
      expect(codesOf(cards, { q: "sao JOAO" })).toEqual(["OPP-1"]);
    });

    it("matches the code", () => {
      expect(codesOf(cards, { q: "opp-22" })).toEqual(["OPP-22"]);
    });
  });

  describe("situation", () => {
    it("keeps only cards whose alert is in the given states", () => {
      const cards = [
        card("A", { alert: alertOf("ATTENTION") }),
        card("B", { alert: alertOf("ON_TIME") }),
        card("C", { alert: alertOf("ESCALATED") }),
        card("D", { stage: "CLOSING", alert: null }),
      ];

      expect(codesOf(cards, { situation: ["ATTENTION", "ESCALATED"] })).toEqual(
        ["A", "C"],
      );
    });
  });

  describe("sorting", () => {
    it("puts open stages by priority, then CLOSING and LOST by most recent", () => {
      const cards = [
        card("L-old", { stage: "LOST", stageEnteredAt: daysAgo(10) }),
        card("C-old", { stage: "CLOSING", stageEnteredAt: daysAgo(10) }),
        card("O-low", { alert: alertOf("ON_TIME", 20) }),
        card("L-new", { stage: "LOST", stageEnteredAt: daysAgo(2) }),
        card("C-new", { stage: "CLOSING", stageEnteredAt: daysAgo(2) }),
        card("O-high", { alert: alertOf("ATTENTION", 120) }),
      ];

      expect(codesOf(cards)).toEqual([
        "O-high",
        "O-low",
        "C-new",
        "C-old",
        "L-new",
        "L-old",
      ]);
    });

    it("sorts by value across all stages when sort is value", () => {
      const cards = [
        card("A", { estimatedValue: 500 }),
        card("B", { stage: "CLOSING", estimatedValue: 9000 }),
        card("C", { estimatedValue: null }),
      ];

      expect(codesOf(cards, { sort: "value" })).toEqual(["B", "A", "C"]);
    });
  });

  describe("needsAttention", () => {
    it("counts ATTENTION and ESCALATED cards, ignoring the filters", () => {
      const cards = [
        card("A", { alert: alertOf("ATTENTION") }),
        card("B", { alert: alertOf("ESCALATED") }),
        card("C", { alert: alertOf("SNOOZED") }),
        card("D", { alert: alertOf("ON_TIME") }),
      ];

      expect(buildBoard(cards, { q: "nothing" }, now)).toEqual({
        opportunities: [],
        needsAttention: 2,
      });
    });
  });
});
