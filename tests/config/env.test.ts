import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.ts";

const base = { DATABASE_URL: "postgresql://localhost:5432/crm" };

describe("parseEnv REFERENCE_DATE", () => {
  it.each([undefined, ""])("is undefined when set to %j", (value) => {
    expect(
      parseEnv({ ...base, REFERENCE_DATE: value }).REFERENCE_DATE,
    ).toBeUndefined();
  });

  it("accepts a calendar date", () => {
    expect(
      parseEnv({ ...base, REFERENCE_DATE: "2026-10-15" }).REFERENCE_DATE,
    ).toBe("2026-10-15");
  });

  it.each(["2026-02-30", "15/10/2026", "2026-10-15T00:00:00Z"])(
    "rejects %s",
    (value) => {
      expect(() => parseEnv({ ...base, REFERENCE_DATE: value })).toThrow(
        /REFERENCE_DATE/,
      );
    },
  );
});
