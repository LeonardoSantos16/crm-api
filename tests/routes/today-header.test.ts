import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";

const app = createApp({
  clock: () => new Date("2026-10-15T23:30:00-03:00"),
});

describe("X-Today header", () => {
  it.each([
    ["the health check", "/health"],
    ["a public route", "/api/users"],
    ["an error response", "/api/opportunities"],
    ["an unknown route", "/api/nothing"],
  ])("tells the São Paulo date on %s", async (_case, path) => {
    const res = await request(app).get(path);

    expect(res.headers["x-today"]).toBe("2026-10-15");
  });

  it("tells the São Paulo date on a malformed JSON error", async () => {
    const res = await request(app)
      .post("/api/opportunities")
      .set("Content-Type", "application/json")
      .send("{ invalid");

    expect(res.status).toBe(400);
    expect(res.headers["x-today"]).toBe("2026-10-15");
  });

  it("exposes the header to cross-origin requests", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-expose-headers"]).toBe("X-Today");
  });
});
