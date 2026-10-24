import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedCaseData } from "../../prisma/seed-case-data.ts";
import { createApp } from "../../src/app.ts";
import type { Stage } from "../../src/domain/stages.ts";
import type { User } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity } from "../helpers/factories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");
const app = createApp({ clock: () => now });

let users: Record<"Marcos" | "Ana" | "Bruno" | "Carla", User>;

const list = (user: User, query = "") =>
  request(app)
    .get(`/api/opportunities${query}`)
    .set("X-User-Id", String(user.id));

const codesOf = (body: unknown) =>
  (body as { opportunities: { code: string }[] }).opportunities.map(
    (opportunity) => opportunity.code,
  );

describe("GET /api/opportunities", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedCaseData(prisma);
    const byName = async (name: string) =>
      prisma.user.findFirstOrThrow({ where: { name } });
    users = {
      Marcos: await byName("Marcos"),
      Ana: await byName("Ana"),
      Bruno: await byName("Bruno"),
      Carla: await byName("Carla"),
    };
  });

  it("lists the seller's open opportunities with alert and moves", async () => {
    const res = await list(users.Ana);

    expect(res.status).toBe(200);
    expect(codesOf(res.body)).toEqual(["OPP-2001", "OPP-2003"]);
    expect(res.body).toMatchObject({
      needsAttention: 0,
      opportunities: [
        {
          code: "OPP-2001",
          company: { name: "Tech Alpha Ltda" },
          alert: { state: "ON_TIME", dueDate: "2026-10-15" },
          lostFromStage: null,
        },
        { code: "OPP-2003", alert: { state: "ON_TIME" } },
      ],
    });
    expect(res.body).not.toHaveProperty("opportunities.0.timeline");
    expect(res.body).toHaveProperty("opportunities.0.moves");
  });

  it("responds 401 without the X-User-Id header", async () => {
    const res = await request(app).get("/api/opportunities");

    expect(res.status).toBe(401);
  });

  it("lists the team for the manager by priority, closed last", async () => {
    const res = await list(users.Marcos);

    expect(codesOf(res.body)).toEqual([
      "OPP-2004",
      "OPP-2002",
      "OPP-2001",
      "OPP-2003",
      "OPP-2005",
      "OPP-2006",
    ]);
    expect(res.body).toMatchObject({ needsAttention: 2 });
  });

  it.each([
    ["clinica", ["OPP-2003"]],
    ["OPP-2005", ["OPP-2005"]],
    ["2005", ["OPP-2005"]],
    ["HORIZONTE", ["OPP-2002"]],
    [
      "opp-200",
      ["OPP-2004", "OPP-2002", "OPP-2001", "OPP-2003", "OPP-2005", "OPP-2006"],
    ],
  ])("searches %j by code or company", async (q, codes) => {
    const res = await list(users.Marcos, `?q=${encodeURIComponent(q)}`);

    expect(res.status).toBe(200);
    expect(codesOf(res.body)).toEqual(codes);
  });

  it.each([
    ["?situation=ATTENTION&situation=ESCALATED", ["OPP-2004", "OPP-2002"]],
    ["?situation=ON_TIME", ["OPP-2001", "OPP-2003", "OPP-2005"]],
  ])("filters by situation with %s", async (query, codes) => {
    const res = await list(users.Marcos, query);

    expect(res.status).toBe(200);
    expect(codesOf(res.body)).toEqual(codes);
  });

  it("responds 400 for an unknown situation", async () => {
    const res = await list(users.Marcos, "?situation=LATE");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  describe("ownerId", () => {
    it("lets the manager filter by a team member", async () => {
      const res = await list(users.Marcos, `?ownerId=${users.Bruno.id}`);

      expect(res.status).toBe(200);
      expect(codesOf(res.body)).toEqual(["OPP-2002", "OPP-2005"]);
      expect(res.body).toMatchObject({ needsAttention: 1 });
    });

    it("responds 403 when a seller sends it", async () => {
      const res = await list(users.Ana, `?ownerId=${users.Ana.id}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    });

    it("responds 403 for someone outside the manager's team", async () => {
      const otherManager = await prisma.user.create({
        data: { name: "Paula", role: "MANAGER" },
      });
      const outsider = await prisma.user.create({
        data: { name: "Diego", managerId: otherManager.id },
      });

      const res = await list(users.Marcos, `?ownerId=${outsider.id}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    });

    it("responds 400 for an invalid id", async () => {
      const res = await list(users.Marcos, "?ownerId=abc");

      expect(res.status).toBe(400);
    });
  });

  it("sorts every opportunity by value", async () => {
    const res = await list(users.Marcos, "?sort=value");

    expect(codesOf(res.body)).toEqual([
      "OPP-2005",
      "OPP-2006",
      "OPP-2002",
      "OPP-2003",
      "OPP-2001",
      "OPP-2004",
    ]);
  });

  it("responds 400 for an unknown sort", async () => {
    const res = await list(users.Marcos, "?sort=date");

    expect(res.status).toBe(400);
  });

  describe("closed and lost cut-offs", () => {
    const createFor = (owner: User, stage: Stage, enteredOn: string) =>
      createOpportunity({
        ownerId: owner.id,
        stage,
        stageEnteredAt: new Date(`${enteredOn}T12:00:00-03:00`),
      });

    it("shows closings from the last 30 days unless all are requested", async () => {
      const recent = await createFor(users.Ana, "CLOSING", "2026-09-15");
      const old = await createFor(users.Ana, "CLOSING", "2026-09-14");

      const byDefault = await list(users.Ana);
      const all = await list(users.Ana, "?allClosed=true");

      expect(codesOf(byDefault.body)).toEqual([
        "OPP-2001",
        "OPP-2003",
        `OPP-${recent.id}`,
      ]);
      expect(codesOf(all.body)).toEqual([
        "OPP-2001",
        "OPP-2003",
        `OPP-${recent.id}`,
        `OPP-${old.id}`,
      ]);
    });

    it("responds 400 for a non-boolean flag", async () => {
      const res = await list(users.Ana, "?allClosed=yes");

      expect(res.status).toBe(400);
    });

    it("includes recent losses with their stage of origin when asked, after closings", async () => {
      const closing = await createFor(users.Ana, "CLOSING", "2026-10-10");
      const followUp = await createFor(users.Ana, "FOLLOW_UP", "2026-10-13");
      await createFor(users.Ana, "LOST", "2026-09-14");
      await request(app)
        .post(`/api/opportunities/${followUp.id}/lose`)
        .set("X-User-Id", String(users.Ana.id))
        .send({ reason: "PRICE" });

      const res = await list(users.Ana, "?includeLost=true");

      expect(codesOf(res.body)).toEqual([
        "OPP-2001",
        "OPP-2003",
        `OPP-${closing.id}`,
        `OPP-${followUp.id}`,
        "OPP-2007",
      ]);
      expect(res.body).toMatchObject({
        opportunities: [
          {},
          {},
          { lostFromStage: null },
          { stage: "LOST", lostFromStage: "FOLLOW_UP" },
          { stage: "LOST", lostFromStage: null },
        ],
      });
    });
  });

  it("keeps counting what needs attention while searching or filtering", async () => {
    const res = await list(users.Marcos, "?q=clinica&situation=ON_TIME");

    expect(codesOf(res.body)).toEqual(["OPP-2003"]);
    expect(res.body).toMatchObject({ needsAttention: 2 });
  });
});
