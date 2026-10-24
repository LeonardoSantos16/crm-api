import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedCaseData } from "../../prisma/seed-case-data.ts";
import { createApp } from "../../src/app.ts";
import type { Prisma, User } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
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
    companyName: "Tech Alpha Ltda",
    stage: "BUDGET_PRESENTATION",
    stageEnteredAt: new Date("2026-10-13T12:00:00-03:00"),
    estimatedValue: 4500,
    eventDate: new Date("2026-11-30T00:00:00Z"),
    items: { create: [{ description: "Caneca", quantity: 300 }] },
    ...data,
  });

const getDetail = (id: number | string, user: User = ana) =>
  request(app)
    .get(`/api/opportunities/${id}`)
    .set("X-User-Id", String(user.id));

describe("GET /api/opportunities/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("returns the seller's own opportunity with alert and moves", async () => {
    const { id } = await opportunityOf(ana);

    const res = await getDetail(id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      code: `OPP-${id}`,
      company: { name: "Tech Alpha Ltda" },
      owner: { id: ana.id, name: "Ana" },
      estimatedValue: 4500,
      items: [{ description: "Caneca", quantity: 300, unitValue: null }],
      eventDate: "2026-11-30",
      proposalValidUntil: null,
      stage: "BUDGET_PRESENTATION",
      alert: { state: "ON_TIME", dueDate: "2026-10-18", idleDays: 2 },
      moves: [
        { stage: "FIRST_CONTACT", allowed: false },
        { stage: "FOLLOW_UP", allowed: true },
        { stage: "FORECAST", allowed: false },
        { stage: "CLOSING", allowed: false },
      ],
    });
  });

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app).get(`/api/opportunities/${id}`);

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });
      const { id } = await opportunityOf(bruno);

      const res = await getDetail(id);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it.each(["999999", "abc"])("responds 404 for the id %j", async (id) => {
      const res = await getDetail(id);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it("lets the manager see a team opportunity", async () => {
      const { id } = await opportunityOf(ana);

      const res = await getDetail(id, manager);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, owner: { id: ana.id } });
    });
  });

  it("shows OPP-2002 from the case data as needing attention on 2026-10-15", async () => {
    await resetDatabase();
    await seedCaseData(prisma);
    const bruno = await prisma.user.findFirstOrThrow({
      where: { name: "Bruno" },
    });

    const res = await getDetail(2002, bruno);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: "OPP-2002",
      company: { name: "Construtora Horizonte" },
      proposalValidUntil: "2026-10-13",
      alert: {
        state: "ATTENTION",
        dueDate: "2026-10-11",
        idleDays: 9,
        deadlineDays: 5,
      },
    });
  });

  describe("timeline", () => {
    const createdAt = new Date("2026-10-13T12:00:00-03:00");
    const createdOpportunity = () =>
      opportunityOf(ana, {
        stage: "FIRST_CONTACT",
        stageEnteredAt: createdAt,
        stageChanges: {
          create: {
            fromStage: null,
            toStage: "FIRST_CONTACT",
            changedAt: createdAt,
            changedById: ana.id,
          },
        },
      });

    const act = (id: number, action: string, body: object, user: User) =>
      request(app)
        .post(`/api/opportunities/${id}/${action}`)
        .set("X-User-Id", String(user.id))
        .send(body);

    it("starts with the creation entry", async () => {
      const { id } = await createdOpportunity();

      const res = await getDetail(id);

      expect(res.body).toMatchObject({
        timeline: [
          {
            type: "CREATED",
            at: "2026-10-13T15:00:00.000Z",
            author: { id: ana.id, name: "Ana" },
            stage: "FIRST_CONTACT",
          },
        ],
      });
    });

    it("shows a stage change made through the API before the creation", async () => {
      const { id } = await createdOpportunity();
      await act(id, "move", { toStage: "BUDGET_PRESENTATION" }, manager);

      const res = await getDetail(id);

      expect(res.body).toMatchObject({
        timeline: [
          {
            type: "STAGE_CHANGE",
            at: now.toISOString(),
            author: { id: manager.id, name: "Marcos" },
            fromStage: "FIRST_CONTACT",
            toStage: "BUDGET_PRESENTATION",
          },
          { type: "CREATED", stage: "FIRST_CONTACT" },
        ],
      });
    });

    it("shows a loss made through the API with its reason", async () => {
      const { id } = await createdOpportunity();
      await act(
        id,
        "lose",
        { reason: "COMPETITOR", detail: "Fechou com a Brindex" },
        ana,
      );

      const res = await getDetail(id);

      expect(res.body).toMatchObject({
        timeline: [
          {
            type: "LOST",
            at: now.toISOString(),
            author: { id: ana.id, name: "Ana" },
            fromStage: "FIRST_CONTACT",
            reason: "COMPETITOR",
            detail: "Fechou com a Brindex",
          },
          { type: "CREATED" },
        ],
      });
    });

    it.each<[string, object]>([
      ["move", { toStage: "BUDGET_PRESENTATION" }],
      ["lose", { reason: "PRICE" }],
    ])("returns the updated timeline from %s", async (action, body) => {
      const { id } = await createdOpportunity();

      const res = await act(id, action, body, ana);

      expect(res.body).toMatchObject({
        timeline: [{ at: now.toISOString() }, { type: "CREATED" }],
      });
    });
  });
});
