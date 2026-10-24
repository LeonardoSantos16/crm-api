import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Prisma, User } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { applyStageChange } from "../../src/services/opportunities.service.ts";
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
    stage: "FIRST_CONTACT",
    stageEnteredAt: new Date("2026-10-14T12:00:00-03:00"),
    estimatedValue: 1000,
    items: { create: [{ description: "Caneca", quantity: 10 }] },
    ...data,
  });

const move = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .post(`/api/opportunities/${id}/move`)
    .set("X-User-Id", String(user.id))
    .send(body);

const stageChangesOf = (opportunityId: number) =>
  prisma.stageChange.findMany({ where: { opportunityId } });

describe("POST /api/opportunities/:id/move", () => {
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
        .post(`/api/opportunities/${id}/move`)
        .send({ toStage: "BUDGET_PRESENTATION" });

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const { id } = await opportunityOf(bruno);

      const res = await move(id, { toStage: "BUDGET_PRESENTATION" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it.each(["999999", "abc", "0"])(
      "responds 404 for the id %j",
      async (id) => {
        const res = await move(id, { toStage: "BUDGET_PRESENTATION" });

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
      },
    );
  });

  describe("validation", () => {
    it.each<[string, object]>([
      ["no toStage", {}],
      ["an unknown stage", { toStage: "FOO" }],
      [
        "empty items",
        { toStage: "BUDGET_PRESENTATION", complete: { items: [] } },
      ],
      [
        "a zero value",
        { toStage: "BUDGET_PRESENTATION", complete: { estimatedValue: 0 } },
      ],
      [
        "a zero quantity",
        {
          toStage: "BUDGET_PRESENTATION",
          complete: { items: [{ description: "Caneca", quantity: 0 }] },
        },
      ],
    ])("responds 400 for %s", async (_case, body) => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    });
  });

  describe("allowed move", () => {
    it("moves the opportunity, records the history and returns the detail", async () => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, { toStage: "BUDGET_PRESENTATION" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        code: `OPP-${id}`,
        stage: "BUDGET_PRESENTATION",
        stageEnteredAt: now.toISOString(),
        estimatedValue: 1000,
        items: [{ description: "Caneca", quantity: 10, unitValue: null }],
        owner: { id: ana.id, name: "Ana" },
        alert: { state: "ON_TIME", dueDate: "2026-10-20", deadlineDays: 5 },
      });
      expect(res.body).toHaveProperty("moves");
      expect(await stageChangesOf(id)).toEqual([
        expect.objectContaining({
          fromStage: "FIRST_CONTACT",
          toStage: "BUDGET_PRESENTATION",
          changedAt: now,
          changedById: ana.id,
        }),
      ]);
    });

    it("restarts the clock and keeps the snooze count", async () => {
      const { id } = await opportunityOf(ana, {
        stage: "BUDGET_PRESENTATION",
        snoozedUntil: new Date("2026-10-20T00:00:00Z"),
        nextFollowUpAt: new Date("2026-10-22T00:00:00Z"),
        snoozeCount: 1,
      });

      const res = await move(id, { toStage: "FOLLOW_UP" });

      expect(res.status).toBe(200);
      expect(
        await prisma.opportunity.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        stage: "FOLLOW_UP",
        stageEnteredAt: now,
        snoozedUntil: null,
        nextFollowUpAt: null,
        snoozeCount: 1,
      });
    });

    it("lets the manager move a team opportunity", async () => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, { toStage: "BUDGET_PRESENTATION" }, manager);

      expect(res.status).toBe(200);
      expect(await stageChangesOf(id)).toEqual([
        expect.objectContaining({ changedById: manager.id }),
      ]);
    });
  });

  describe("blocked move", () => {
    const expectUnchanged = async (id: number, stage: string) => {
      expect(
        (await prisma.opportunity.findUniqueOrThrow({ where: { id } })).stage,
      ).toBe(stage);
      expect(await stageChangesOf(id)).toEqual([]);
    };

    it("responds 409 INVALID_TRANSITION with the blocking reason", async () => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, { toStage: "FOLLOW_UP" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: {
          code: "INVALID_TRANSITION",
          details: { reason: "ONE_STEP_AT_A_TIME" },
        },
      });
      await expectUnchanged(id, "FIRST_CONTACT");
    });

    it("rejects LOST as a destination", async () => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, { toStage: "LOST" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: {
          code: "INVALID_TRANSITION",
          details: { reason: "USE_LOSE_ACTION" },
        },
      });
      await expectUnchanged(id, "FIRST_CONTACT");
    });

    it("responds 409 FINAL_STAGE from a final stage", async () => {
      const { id } = await opportunityOf(ana, { stage: "CLOSING" });

      const res = await move(id, { toStage: "FORECAST" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: "FINAL_STAGE" } });
      await expectUnchanged(id, "CLOSING");
    });

    it("responds 422 when value and items are missing", async () => {
      const { id } = await opportunityOf(ana, {
        estimatedValue: null,
        items: undefined,
      });

      const res = await move(id, { toStage: "BUDGET_PRESENTATION" });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: "MISSING_VALUE_OR_ITEMS",
          details: { missing: ["estimatedValue", "items"] },
        },
      });
      await expectUnchanged(id, "FIRST_CONTACT");
    });

    it("checks value and items on the return to Orçamento", async () => {
      const { id } = await opportunityOf(ana, {
        stage: "FOLLOW_UP",
        items: undefined,
      });

      const res = await move(id, { toStage: "BUDGET_PRESENTATION" });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: {
          code: "MISSING_VALUE_OR_ITEMS",
          details: { missing: ["items"] },
        },
      });
      await expectUnchanged(id, "FOLLOW_UP");
    });
  });

  describe("complete", () => {
    const itemsOf = (opportunityId: number) =>
      prisma.opportunityItem.findMany({ where: { opportunityId } });

    it("saves the missing data and moves", async () => {
      const { id } = await opportunityOf(ana, {
        estimatedValue: null,
        items: undefined,
      });

      const res = await move(id, {
        toStage: "BUDGET_PRESENTATION",
        complete: {
          estimatedValue: 4500,
          items: [{ description: "Caneca", quantity: 300, unitValue: 15 }],
        },
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        stage: "BUDGET_PRESENTATION",
        estimatedValue: 4500,
        items: [{ description: "Caneca", quantity: 300, unitValue: 15 }],
      });
    });

    it("saves nothing when the transition is blocked", async () => {
      const { id } = await opportunityOf(ana);

      const res = await move(id, {
        toStage: "FOLLOW_UP",
        complete: {
          estimatedValue: 9999,
          items: [{ description: "Kit", quantity: 1 }],
        },
      });

      expect(res.status).toBe(409);
      const opportunity = await prisma.opportunity.findUniqueOrThrow({
        where: { id },
      });
      expect(opportunity.estimatedValue?.toNumber()).toBe(1000);
      expect((await itemsOf(id)).map((item) => item.description)).toEqual([
        "Caneca",
      ]);
    });

    it("saves nothing when the data is still incomplete", async () => {
      const { id } = await opportunityOf(ana, {
        estimatedValue: null,
        items: undefined,
      });

      const res = await move(id, {
        toStage: "BUDGET_PRESENTATION",
        complete: { estimatedValue: 4500 },
      });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: { details: { missing: ["items"] } },
      });
      expect(
        (await prisma.opportunity.findUniqueOrThrow({ where: { id } }))
          .estimatedValue,
      ).toBeNull();
    });
  });
});

describe("applyStageChange", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("responds 409 STAGE_CONFLICT when the stage changed meanwhile", async () => {
    const { id } = await opportunityOf(ana, { stage: "FOLLOW_UP" });

    const result = prisma.$transaction((tx) =>
      applyStageChange(tx, {
        id,
        fromStage: "BUDGET_PRESENTATION",
        toStage: "FOLLOW_UP",
        now,
        userId: ana.id,
      }),
    );

    await expect(result).rejects.toMatchObject({
      status: 409,
      code: "STAGE_CONFLICT",
    });
    expect(
      (await prisma.opportunity.findUniqueOrThrow({ where: { id } })).stage,
    ).toBe("FOLLOW_UP");
    expect(await stageChangesOf(id)).toEqual([]);
  });
});
