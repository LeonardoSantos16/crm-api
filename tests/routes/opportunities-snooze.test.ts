import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Stage } from "../../src/domain/stages.ts";
import type { Prisma, User } from "../../src/generated/prisma/client.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity, createUser } from "../helpers/factories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");
const app = createApp({ clock: () => now });

let manager: User;
let ana: User;

const opportunityOf = (
  owner: User,
  data: Partial<Omit<Prisma.OpportunityUncheckedCreateInput, "ownerId">> = {},
) =>
  createOpportunity({
    ownerId: owner.id,
    stage: "FOLLOW_UP",
    stageEnteredAt: new Date("2026-10-01T12:00:00-03:00"),
    estimatedValue: 1000,
    items: { create: [{ description: "Caneca", quantity: 10 }] },
    ...data,
  });

const snooze = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .post(`/api/opportunities/${id}/snooze`)
    .set("X-User-Id", String(user.id))
    .send(body);

describe("POST /api/opportunities/:id/snooze", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("pauses the alert until the chosen date", async () => {
    const { id } = await opportunityOf(ana, {
      nextFollowUpAt: new Date("2026-10-18T00:00:00Z"),
    });

    const res = await snooze(id, { until: "2026-10-20" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      snoozedUntil: "2026-10-20",
      nextFollowUpAt: null,
      snoozeCount: 1,
      alert: { state: "SNOOZED", dueDate: "2026-10-20" },
    });
  });

  it("escalates on the second snooze in a row", async () => {
    const { id } = await opportunityOf(ana);
    await snooze(id, { until: "2026-10-18" });

    const res = await snooze(id, { until: "2026-10-20" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      snoozedUntil: "2026-10-20",
      snoozeCount: 2,
      alert: { state: "ESCALATED" },
    });
  });

  it("goes back to the stage deadline after a follow-up", async () => {
    const { id } = await opportunityOf(ana);
    await snooze(id, { until: "2026-10-18" });
    await snooze(id, { until: "2026-10-20" });

    const res = await request(app)
      .post(`/api/opportunities/${id}/follow-up`)
      .set("X-User-Id", String(ana.id))
      .send({});

    expect(res.body).toMatchObject({
      snoozedUntil: null,
      snoozeCount: 0,
      alert: { state: "ON_TIME", dueDate: "2026-10-21" },
    });
  });

  it("records the snooze in the timeline", async () => {
    const { id } = await opportunityOf(ana);

    await snooze(id, {
      until: "2026-10-20",
      reason: "Cliente em viagem",
    });

    const detail = await request(app)
      .get(`/api/opportunities/${id}`)
      .set("X-User-Id", String(ana.id));
    expect(detail.body).toMatchObject({
      timeline: [
        {
          type: "SNOOZE",
          at: now.toISOString(),
          author: { id: ana.id, name: "Ana" },
          until: "2026-10-20",
          reason: "Cliente em viagem",
        },
      ],
    });
  });

  it.each<[string, object]>([
    ["no date", {}],
    ["today", { until: "2026-10-15" }],
    ["a date after 30 days", { until: "2026-11-15" }],
    ["a date in another format", { until: "20/10/2026" }],
    [
      "a reason over 500 characters",
      { until: "2026-10-20", reason: "a".repeat(501) },
    ],
  ])("responds 400 for %s", async (_case, body) => {
    const { id } = await opportunityOf(ana);

    const res = await snooze(id, body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("accepts a date 30 days ahead", async () => {
    const { id } = await opportunityOf(ana);

    const res = await snooze(id, { until: "2026-11-14" });

    expect(res.status).toBe(200);
  });

  it.each<Stage>(["CLOSING", "LOST"])(
    "responds 409 FINAL_STAGE from %s",
    async (stage) => {
      const { id } = await opportunityOf(ana, { stage });

      const res = await snooze(id, { until: "2026-10-20" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: "FINAL_STAGE" } });
      const detail = await request(app)
        .get(`/api/opportunities/${id}`)
        .set("X-User-Id", String(ana.id));
      expect(detail.body).toMatchObject({
        snoozedUntil: null,
        snoozeCount: 0,
        timeline: [],
      });
    },
  );

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app)
        .post(`/api/opportunities/${id}/snooze`)
        .send({ until: "2026-10-20" });

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });
      const { id } = await opportunityOf(bruno);

      const res = await snooze(id, { until: "2026-10-20" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });
  });

  it.each<[string, object]>([
    ["snooze", { until: "2026-10-20" }],
    ["follow-up", {}],
  ])("lets the manager %s a team opportunity", async (action, body) => {
    const { id } = await opportunityOf(ana);

    const res = await request(app)
      .post(`/api/opportunities/${id}/${action}`)
      .set("X-User-Id", String(manager.id))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      timeline: [{ author: { id: manager.id, name: "Marcos" } }],
    });
  });
});
