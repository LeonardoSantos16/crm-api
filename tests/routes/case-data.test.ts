import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedCaseData } from "../../prisma/seed-case-data.ts";
import { createApp } from "../../src/app.ts";
import type { User } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";

const app = createApp({
  clock: () => new Date("2026-10-15T09:00:00-03:00"),
});

const userNamed = (name: string) =>
  prisma.user.findFirstOrThrow({ where: { name } });

const get = (path: string, user: User) =>
  request(app).get(path).set("X-User-Id", String(user.id));

describe("case data through the API", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedCaseData(prisma);
  });

  it("shows OPP-2007 as lost from Apresentação de Orçamento", async () => {
    const ana = await userNamed("Ana");

    const board = await get("/api/opportunities?includeLost=true", ana);
    const detail = await get("/api/opportunities/2007", ana);

    expect(board.body).toMatchObject({
      opportunities: [
        { code: "OPP-2001" },
        { code: "OPP-2003" },
        { code: "OPP-2007", lostFromStage: "BUDGET_PRESENTATION" },
      ],
    });
    expect(detail.body).toMatchObject({
      timeline: [
        {
          type: "LOST",
          fromStage: "BUDGET_PRESENTATION",
          reason: "OTHER",
          detail: "Motivo não informado nos dados do case",
        },
        { type: "CREATED", stage: "BUDGET_PRESENTATION" },
      ],
    });
  });

  it.each([
    [
      "Ana",
      2001,
      { description: "Caneca personalizada", quantity: 300, unitValue: 15 },
    ],
    [
      "Carla",
      2004,
      { description: "Camiseta estampada", quantity: 80, unitValue: 48.75 },
    ],
  ])(
    "derives the unit value of %s's OPP-%i from value and quantity",
    async (name, id, item) => {
      const owner = await userNamed(name);

      const detail = await get(`/api/opportunities/${id}`, owner);

      expect(detail.body).toMatchObject({ items: [item] });
    },
  );

  it("orders a morning move on the reference date after the case creation", async () => {
    const bruno = await userNamed("Bruno");

    const res = await request(app)
      .post("/api/opportunities/2005/move")
      .set("X-User-Id", String(bruno.id))
      .send({ toStage: "CLOSING" });

    expect(res.body).toMatchObject({
      stage: "CLOSING",
      timeline: [
        { type: "STAGE_CHANGE", fromStage: "FORECAST", toStage: "CLOSING" },
        { type: "CREATED", stage: "FORECAST" },
      ],
    });
  });
});
