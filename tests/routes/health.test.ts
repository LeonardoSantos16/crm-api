import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";

const app = createApp();

describe("GET /health", () => {
  it("responds 200 when the database is reachable", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: true });
  });
});
