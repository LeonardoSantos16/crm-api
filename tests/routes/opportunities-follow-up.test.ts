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

const followUp = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .post(`/api/opportunities/${id}/follow-up`)
    .set("X-User-Id", String(user.id))
    .send(body);

const detailOf = async (id: number): Promise<unknown> =>
  (
    await request(app)
      .get(`/api/opportunities/${id}`)
      .set("X-User-Id", String(ana.id))
  ).body as unknown;

describe("POST /api/opportunities/:id/follow-up", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("restarts the clock from today and clears the snooze", async () => {
    const { id } = await opportunityOf(ana, {
      snoozedUntil: new Date("2026-10-20T00:00:00Z"),
      snoozeCount: 1,
    });

    const res = await followUp(id, {});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      lastContactAt: now.toISOString(),
      nextFollowUpAt: null,
      snoozedUntil: null,
      snoozeCount: 0,
      alert: { state: "ON_TIME", dueDate: "2026-10-21", idleDays: 0 },
    });
  });

  it("uses the chosen next date as the due date", async () => {
    const { id } = await opportunityOf(ana);

    const res = await followUp(id, { nextDate: "2026-10-30" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nextFollowUpAt: "2026-10-30",
      alert: { state: "ON_TIME", dueDate: "2026-10-30" },
    });
  });

  it("records the follow-up in the timeline", async () => {
    const { id } = await opportunityOf(ana);

    await followUp(id, {
      channel: "WHATSAPP",
      summary: "Cliente pediu nova amostra",
      nextDate: "2026-10-30",
    });

    expect(await detailOf(id)).toMatchObject({
      timeline: [
        {
          type: "FOLLOW_UP",
          at: now.toISOString(),
          author: { id: ana.id, name: "Ana" },
          channel: "WHATSAPP",
          summary: "Cliente pediu nova amostra",
          nextDate: "2026-10-30",
        },
      ],
    });
  });

  describe("validation", () => {
    it.each(["2026-10-16", "2026-11-14"])(
      "accepts the next date %s",
      async (nextDate) => {
        const { id } = await opportunityOf(ana);

        const res = await followUp(id, { nextDate });

        expect(res.status).toBe(200);
      },
    );

    it.each<[string, object]>([
      ["today as the next date", { nextDate: "2026-10-15" }],
      ["a next date after 30 days", { nextDate: "2026-11-15" }],
      ["a next date in another format", { nextDate: "15/10/2026" }],
      ["an unknown channel", { channel: "SMS" }],
      ["a summary over 500 characters", { summary: "a".repeat(501) }],
    ])("responds 400 for %s", async (_case, body) => {
      const { id } = await opportunityOf(ana);

      const res = await followUp(id, body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(await detailOf(id)).toMatchObject({ lastContactAt: null });
    });
  });

  it.each<Stage>(["CLOSING", "LOST"])(
    "responds 409 FINAL_STAGE from %s",
    async (stage) => {
      const { id } = await opportunityOf(ana, { stage });

      const res = await followUp(id, {});

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: "FINAL_STAGE" } });
      expect(await detailOf(id)).toMatchObject({
        lastContactAt: null,
        timeline: [],
      });
    },
  );

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app)
        .post(`/api/opportunities/${id}/follow-up`)
        .send({});

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });
      const { id } = await opportunityOf(bruno);

      const res = await followUp(id, {});

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });
  });
});
