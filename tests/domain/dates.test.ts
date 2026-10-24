import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  fromDbDate,
  isCalendarDate,
  toLocalDate,
} from "../../src/domain/dates.ts";

describe("toLocalDate", () => {
  it.each([
    ["2026-10-15T12:00:00-03:00", "2026-10-15"],
    ["2026-10-15T23:30:00-03:00", "2026-10-15"],
    ["2026-10-16T01:00:00Z", "2026-10-15"],
    ["2026-10-16T03:00:00Z", "2026-10-16"],
    ["2027-01-01T02:00:00Z", "2026-12-31"],
  ])("converts %s to %s in São Paulo", (instant, expected) => {
    expect(toLocalDate(new Date(instant))).toBe(expected);
  });
});

describe("fromDbDate", () => {
  it("keeps the calendar day of a date column stored at UTC midnight", () => {
    expect(fromDbDate(new Date("2026-10-15T00:00:00Z"))).toBe("2026-10-15");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-15", 1, "2026-10-16"],
    ["2026-10-15", -1, "2026-10-14"],
    ["2026-10-15", 0, "2026-10-15"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2026-10-15", 30, "2026-11-14"],
  ])("%s %i days is %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe("diffDays", () => {
  it.each([
    ["2026-10-15", "2026-10-15", 0],
    ["2026-10-06", "2026-10-15", 9],
    ["2026-10-15", "2026-10-06", -9],
    ["2026-10-25", "2026-11-05", 11],
  ])("from %s to %s is %i days", (from, to, expected) => {
    expect(diffDays(from, to)).toBe(expected);
  });
});

describe("isCalendarDate", () => {
  it.each(["2026-10-15", "2028-02-29"])("accepts %s", (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "15/10/2026",
    "2026-10-15T00:00:00Z",
    "",
  ])("rejects %j", (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});
