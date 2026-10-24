import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { User } from "../../src/generated/prisma/client.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/factories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");
const app = createApp({ clock: () => now });

let manager: User;
let ana: User;

const create = (body: object, user: User = ana) =>
  request(app)
    .post("/api/opportunities")
    .set("X-User-Id", String(user.id))
    .send(body);

const validBody = {
  companyName: "Tech Alpha Ltda",
  contactName: "Joana Lima",
  contactPhone: "(11) 99999-0000",
  contactEmail: "joana@techalpha.com",
  item: { description: "Caneca personalizada", quantity: 300, unitValue: 15 },
  estimatedValue: 4500,
};

describe("POST /api/opportunities", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("creates the seller's opportunity in Primeiro Contato", async () => {
    const res = await create(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: expect.stringMatching(/^OPP-\d+$/) as string,
      stage: "FIRST_CONTACT",
      stageEnteredAt: now.toISOString(),
      owner: { id: ana.id, name: "Ana" },
      company: { name: "Tech Alpha Ltda" },
      contactName: "Joana Lima",
      contactPhone: "(11) 99999-0000",
      contactEmail: "joana@techalpha.com",
      estimatedValue: 4500,
      items: [
        { description: "Caneca personalizada", quantity: 300, unitValue: 15 },
      ],
      alert: { state: "ON_TIME", dueDate: "2026-10-16" },
      timeline: [
        {
          type: "CREATED",
          at: now.toISOString(),
          author: { id: ana.id, name: "Ana" },
          stage: "FIRST_CONTACT",
        },
      ],
    });
  });

  it("creates without item and value, asking for them to enter Orçamento", async () => {
    const res = await create({
      companyName: "Padaria Nova",
      contactName: "Seu Zé",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      items: [],
      estimatedValue: null,
      contactPhone: null,
      contactEmail: null,
      moves: [
        {
          stage: "BUDGET_PRESENTATION",
          allowed: true,
          missing: ["estimatedValue", "items"],
        },
        { stage: "FOLLOW_UP" },
        { stage: "FORECAST" },
        { stage: "CLOSING" },
      ],
    });
  });

  it("reuses the company by name, ignoring case", async () => {
    const first = await create(validBody);
    const same = await create({ ...validBody, companyName: "tech alpha LTDA" });
    const other = await create({ ...validBody, companyName: "Banco Norte" });

    const companyOf = (body: unknown) =>
      (body as { company: { id: number; name: string } }).company;
    expect(companyOf(same.body)).toEqual(companyOf(first.body));
    expect(companyOf(same.body).name).toBe("Tech Alpha Ltda");
    expect(companyOf(other.body).id).not.toBe(companyOf(first.body).id);
  });

  describe("owner", () => {
    it("responds 403 when a seller creates for someone else", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });

      const res = await create({ ...validBody, ownerId: bruno.id });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    });

    it("accepts the seller's own id", async () => {
      const res = await create({ ...validBody, ownerId: ana.id });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ owner: { id: ana.id } });
    });

    it("lets the manager create for a team member, as the author", async () => {
      const res = await create({ ...validBody, ownerId: ana.id }, manager);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        owner: { id: ana.id, name: "Ana" },
        timeline: [{ type: "CREATED", author: { id: manager.id } }],
      });
    });

    it("requires the manager to choose an owner", async () => {
      const res = await create(validBody, manager);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    });

    it("responds 403 when the manager chooses someone outside the team", async () => {
      const otherManager = await createUser({ name: "Paula", role: "MANAGER" });
      const outsider = await createUser({
        name: "Diego",
        managerId: otherManager.id,
      });

      const res = await create({ ...validBody, ownerId: outsider.id }, manager);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    });
  });

  it.each<[string, object]>([
    ["no company", { ...validBody, companyName: undefined }],
    ["a blank contact", { ...validBody, contactName: "   " }],
    ["an invalid email", { ...validBody, contactEmail: "joana@" }],
    [
      "a company over 200 characters",
      { ...validBody, companyName: "a".repeat(201) },
    ],
    [
      "a phone over 30 characters",
      { ...validBody, contactPhone: "1".repeat(31) },
    ],
    [
      "a zero quantity",
      { ...validBody, item: { description: "Caneca", quantity: 0 } },
    ],
    ["a blank item", { ...validBody, item: { description: " ", quantity: 1 } }],
    ["a zero value", { ...validBody, estimatedValue: 0 }],
  ])("responds 400 for %s", async (_case, body) => {
    const res = await create(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("responds 401 without the X-User-Id header", async () => {
    const res = await request(app).post("/api/opportunities").send(validBody);

    expect(res.status).toBe(401);
  });

  it("shows the new opportunity on the owner's board", async () => {
    const created = await create({ ...validBody, ownerId: ana.id }, manager);

    const board = await request(app)
      .get("/api/opportunities")
      .set("X-User-Id", String(ana.id));

    expect(board.body).toMatchObject({
      opportunities: [
        {
          code: (created.body as { code: string }).code,
          stage: "FIRST_CONTACT",
        },
      ],
    });
  });
});
