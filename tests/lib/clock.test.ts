import { describe, expect, it } from "vitest";
import { toLocalDate } from "../../src/domain/dates.ts";
import { createClock } from "../../src/lib/clock.ts";

const timeOfDay = (instant: Date) => instant.toISOString().slice(11);

describe("createClock", () => {
  it("returns the real instant without a reference date", () => {
    const real = new Date("2026-10-24T15:20:00Z");

    expect(createClock({ realNow: () => real })()).toEqual(real);
  });

  it("moves to the reference date and keeps the real time of day", () => {
    const real = new Date("2026-10-24T15:20:00Z");
    const now = createClock({
      referenceDate: "2026-10-15",
      realNow: () => real,
    })();

    expect(toLocalDate(now)).toBe("2026-10-15");
    expect(timeOfDay(now)).toBe(timeOfDay(real));
  });

  it("keeps consecutive instants in order", () => {
    let real = new Date("2026-10-24T15:20:00Z");
    const clock = createClock({
      referenceDate: "2026-10-15",
      realNow: () => real,
    });

    const first = clock();
    real = new Date("2026-10-24T15:20:05Z");
    const second = clock();

    expect(second.getTime() - first.getTime()).toBe(5000);
  });

  it("uses the São Paulo day near midnight", () => {
    const real = new Date("2026-10-25T02:30:00Z");
    const now = createClock({
      referenceDate: "2026-10-15",
      realNow: () => real,
    })();

    expect(toLocalDate(now)).toBe("2026-10-15");
  });
});
