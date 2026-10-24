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
let bruno: User;

const opportunityOf = (
  owner: User,
  data: Partial<Omit<Prisma.OpportunityUncheckedCreateInput, "ownerId">> = {},
) =>
  createOpportunity({
    ownerId: owner.id,
    stage: "FOLLOW_UP",
    stageEnteredAt: new Date("2026-10-10T12:00:00-03:00"),
    estimatedValue: 1000,
    items: { create: [{ description: "Caneca", quantity: 10 }] },
    ...data,
  });

const lose = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .post(`/api/opportunities/${id}/lose`)
    .set("X-User-Id", String(user.id))
    .send(body);

const detailOf = async (id: number): Promise<unknown> =>
  (
    await request(app)
      .get(`/api/opportunities/${id}`)
      .set("X-User-Id", String(ana.id))
  ).body as unknown;

describe("POST /api/opportunities/:id/lose", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
    bruno = await createUser({ name: "Bruno", managerId: manager.id });
  });

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app)
        .post(`/api/opportunities/${id}/lose`)
        .send({ reason: "PRICE" });

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const { id } = await opportunityOf(bruno);

      const res = await lose(id, { reason: "PRICE" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it("responds 404 for an invalid id", async () => {
      const res = await lose("abc", { reason: "PRICE" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });
  });

  describe("validation", () => {
    it.each<[string, object]>([
      ["no reason", {}],
      ["an unknown reason", { reason: "FOO" }],
      ["OTHER without detail", { reason: "OTHER" }],
      ["OTHER with a blank detail", { reason: "OTHER", detail: "   " }],
      [
        "a detail over 500 characters",
        { reason: "PRICE", detail: "a".repeat(501) },
      ],
    ])("responds 400 for %s", async (_case, body) => {
      const { id } = await opportunityOf(ana);

      const res = await lose(id, body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(await detailOf(id)).toMatchObject({ stage: "FOLLOW_UP" });
    });
  });

  describe("allowed", () => {
    it("marks the opportunity as lost, records the history and returns the detail", async () => {
      const { id } = await opportunityOf(ana);

      const res = await lose(id, { reason: "PRICE" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        stage: "LOST",
        lossReason: "PRICE",
        lossDetail: null,
        stageEnteredAt: now.toISOString(),
        alert: null,
      });
      expect(res.body).toMatchObject({
        moves: [
          { allowed: false, reason: "FINAL_STAGE" },
          { allowed: false, reason: "FINAL_STAGE" },
          { allowed: false, reason: "FINAL_STAGE" },
          { allowed: false, reason: "FINAL_STAGE" },
          { allowed: false, reason: "FINAL_STAGE" },
        ],
      });
      expect(await detailOf(id)).toMatchObject({
        timeline: [
          {
            type: "LOST",
            fromStage: "FOLLOW_UP",
            at: now.toISOString(),
            author: { id: ana.id },
            reason: "PRICE",
          },
        ],
      });
    });

    it("saves the trimmed detail for OTHER", async () => {
      const { id } = await opportunityOf(ana);

      const res = await lose(id, {
        reason: "OTHER",
        detail: "  Cliente fechou a empresa  ",
      });

      expect(res.status).toBe(200);
      expect(await detailOf(id)).toMatchObject({
        lossReason: "OTHER",
        lossDetail: "Cliente fechou a empresa",
      });
    });

    it("saves the detail for other reasons too", async () => {
      const { id } = await opportunityOf(ana);

      await lose(id, { reason: "COMPETITOR", detail: "Fechou com a Brindex" });

      expect(await detailOf(id)).toMatchObject({
        lossReason: "COMPETITOR",
        lossDetail: "Fechou com a Brindex",
      });
    });

    it("clears the snooze and the next follow-up date and keeps the snooze count", async () => {
      const { id } = await opportunityOf(ana, {
        snoozedUntil: new Date("2026-10-20T00:00:00Z"),
        nextFollowUpAt: new Date("2026-10-22T00:00:00Z"),
        snoozeCount: 1,
      });

      await lose(id, { reason: "NO_RESPONSE" });

      expect(await detailOf(id)).toMatchObject({
        snoozedUntil: null,
        nextFollowUpAt: null,
        snoozeCount: 1,
      });
    });

    it.each<Stage>([
      "FIRST_CONTACT",
      "BUDGET_PRESENTATION",
      "FOLLOW_UP",
      "FORECAST",
    ])("can be lost from %s", async (stage) => {
      const { id } = await opportunityOf(ana, { stage });

      const res = await lose(id, { reason: "NO_BUDGET" });

      expect(res.status).toBe(200);
      expect(await detailOf(id)).toMatchObject({ stage: "LOST" });
    });

    it("lets the manager mark a team opportunity as lost", async () => {
      const { id } = await opportunityOf(ana);

      const res = await lose(id, { reason: "PRICE" }, manager);

      expect(res.status).toBe(200);
      expect(await detailOf(id)).toMatchObject({
        timeline: [{ author: { id: manager.id, name: "Marcos" } }],
      });
    });
  });

  describe("blocked", () => {
    it.each<Stage>(["CLOSING", "LOST"])(
      "responds 409 FINAL_STAGE from %s",
      async (stage) => {
        const { id } = await opportunityOf(ana, { stage });

        const res = await lose(id, { reason: "PRICE" });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: { code: "FINAL_STAGE" } });
        expect(await detailOf(id)).toMatchObject({
          stage,
          lossReason: null,
          timeline: [],
        });
      },
    );
  });
});
