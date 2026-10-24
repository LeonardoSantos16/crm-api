import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";

const app = createApp();

describe("app", () => {
  it("responds 404 with the standard error body for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route GET /api/does-not-exist not found",
      },
    });
  });

  it("responds 400 INVALID_JSON for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send("{ invalid");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "INVALID_JSON" } });
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
