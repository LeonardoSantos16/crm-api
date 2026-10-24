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
    stageEnteredAt: new Date("2026-10-13T12:00:00-03:00"),
    estimatedValue: 1000,
    items: { create: [{ description: "Caneca", quantity: 10 }] },
    ...data,
  });

const comment = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .post(`/api/opportunities/${id}/comments`)
    .set("X-User-Id", String(user.id))
    .send(body);

describe("POST /api/opportunities/:id/comments", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("adds the trimmed comment to the timeline", async () => {
    const { id } = await opportunityOf(ana);

    const res = await comment(id, { body: "  Cliente pediu amostra  " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      timeline: [
        {
          type: "COMMENT",
          at: now.toISOString(),
          author: { id: ana.id, name: "Ana" },
          body: "Cliente pediu amostra",
        },
      ],
    });
  });

  it("leaves the alert clock untouched", async () => {
    const { id } = await opportunityOf(ana);

    const res = await comment(id, { body: "Ligar amanhã" });

    expect(res.body).toMatchObject({
      lastContactAt: null,
      alert: { state: "ON_TIME", dueDate: "2026-10-19", idleDays: 2 },
    });
  });

  it.each<Stage>(["CLOSING", "LOST"])(
    "accepts comments on %s",
    async (stage) => {
      const { id } = await opportunityOf(ana, { stage });

      const res = await comment(id, { body: "Cliente elogiou a entrega" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        stage,
        timeline: [{ type: "COMMENT", body: "Cliente elogiou a entrega" }],
      });
    },
  );

  it.each<[string, object]>([
    ["no body", {}],
    ["a blank body", { body: "   " }],
    ["a body over 2000 characters", { body: "a".repeat(2001) }],
  ])("responds 400 for %s", async (_case, body) => {
    const { id } = await opportunityOf(ana);

    const res = await comment(id, body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    const detail = await request(app)
      .get(`/api/opportunities/${id}`)
      .set("X-User-Id", String(ana.id));
    expect(detail.body).toMatchObject({ timeline: [] });
  });

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app)
        .post(`/api/opportunities/${id}/comments`)
        .send({ body: "Oi" });

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });
      const { id } = await opportunityOf(bruno);

      const res = await comment(id, { body: "Oi" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it("lets the manager comment on a team opportunity", async () => {
      const { id } = await opportunityOf(ana);

      const res = await comment(id, { body: "Priorizar" }, manager);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        timeline: [{ author: { id: manager.id, name: "Marcos" } }],
      });
    });
  });
});
