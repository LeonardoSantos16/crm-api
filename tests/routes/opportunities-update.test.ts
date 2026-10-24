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
  data: Partial<Omit<Prisma.OpportunityUncheckedCreateInput, "ownerId">> & {
    companyName?: string;
  } = {},
) =>
  createOpportunity({
    ownerId: owner.id,
    companyName: "Banco Norte",
    contactName: "Rita",
    stage: "FOLLOW_UP",
    stageEnteredAt: new Date("2026-10-12T12:00:00-03:00"),
    estimatedValue: 38000,
    items: { create: [{ description: "Agenda executiva", quantity: 1000 }] },
    ...data,
  });

const update = (id: number | string, body: object, user: User = ana) =>
  request(app)
    .patch(`/api/opportunities/${id}`)
    .set("X-User-Id", String(user.id))
    .send(body);

const detailOf = async (id: number): Promise<unknown> =>
  (
    await request(app)
      .get(`/api/opportunities/${id}`)
      .set("X-User-Id", String(ana.id))
  ).body as unknown;

describe("PATCH /api/opportunities/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
    manager = await createUser({ name: "Marcos", role: "MANAGER" });
    ana = await createUser({ name: "Ana", managerId: manager.id });
  });

  it("updates the contact phone without touching the alert clock", async () => {
    const { id } = await opportunityOf(ana);
    const before = await detailOf(id);

    const res = await update(id, { contactPhone: "(11) 98888-7777" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ contactPhone: "(11) 98888-7777" });
    const { alert, stageEnteredAt, timeline } = before as Record<
      string,
      unknown
    >;
    expect(await detailOf(id)).toMatchObject({
      contactPhone: "(11) 98888-7777",
      alert,
      stageEnteredAt,
      timeline,
    });
  });

  it("replaces the gift items and the estimated value", async () => {
    const { id } = await opportunityOf(ana);

    const res = await update(id, {
      items: [
        { description: "Agenda executiva", quantity: 800, unitValue: 38 },
        { description: "Caneta metálica", quantity: 800, unitValue: 12.5 },
      ],
      estimatedValue: 40400,
    });

    expect(res.status).toBe(200);
    expect(await detailOf(id)).toMatchObject({
      estimatedValue: 40400,
      items: [
        { description: "Agenda executiva", quantity: 800, unitValue: 38 },
        { description: "Caneta metálica", quantity: 800, unitValue: 12.5 },
      ],
    });
  });

  it("changes the company, reusing it by name regardless of case", async () => {
    const existing = await opportunityOf(ana, { companyName: "Clínica Vida" });
    const { id } = await opportunityOf(ana);

    const reused = await update(id, { companyName: "clínica VIDA" });
    const created = await update(id, { companyName: "Escola Saber" });

    expect(reused.body).toMatchObject({
      company: { id: existing.companyId, name: "Clínica Vida" },
    });
    expect(created.body).toMatchObject({ company: { name: "Escola Saber" } });
    expect((created.body as { company: { id: number } }).company.id).not.toBe(
      existing.companyId,
    );
  });

  it("sets and clears contact details and dates", async () => {
    const { id } = await opportunityOf(ana, {
      contactPhone: "(11) 90000-0000",
      contactEmail: "rita@banconorte.com",
      eventDate: new Date("2026-12-12T00:00:00Z"),
    });

    const res = await update(id, {
      contactName: "Rita Souza",
      contactPhone: null,
      contactEmail: null,
      proposalValidUntil: "2026-10-01",
      eventDate: null,
    });

    expect(res.status).toBe(200);
    expect(await detailOf(id)).toMatchObject({
      contactName: "Rita Souza",
      contactPhone: null,
      contactEmail: null,
      proposalValidUntil: "2026-10-01",
      eventDate: null,
    });
  });

  describe("value and items from Orçamento on", () => {
    it.each<[string, object, string[]]>([
      ["the last item", { items: [] }, ["items"]],
      ["the value", { estimatedValue: null }, ["estimatedValue"]],
      [
        "both",
        { items: [], estimatedValue: null },
        ["estimatedValue", "items"],
      ],
    ])("responds 422 when removing %s", async (_case, body, missing) => {
      const { id } = await opportunityOf(ana);

      const res = await update(id, body);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        error: { code: "MISSING_VALUE_OR_ITEMS", details: { missing } },
      });
      expect(await detailOf(id)).toMatchObject({
        estimatedValue: 38000,
        items: [{ description: "Agenda executiva" }],
      });
    });

    it("lets Primeiro Contato clear value and items", async () => {
      const { id } = await opportunityOf(ana, { stage: "FIRST_CONTACT" });

      const res = await update(id, { items: [], estimatedValue: null });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ items: [], estimatedValue: null });
    });
  });

  it.each<Stage>(["CLOSING", "LOST"])(
    "responds 409 FINAL_STAGE on %s and changes nothing",
    async (stage) => {
      const { id } = await opportunityOf(ana, { stage });

      const res = await update(id, { contactPhone: "(11) 91111-1111" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: "FINAL_STAGE" } });
      expect(await detailOf(id)).toMatchObject({ contactPhone: null });
    },
  );

  it.each<[string, object]>([
    ["an empty body", {}],
    ["a blank company", { companyName: "  " }],
    ["a null company", { companyName: null }],
    ["a null contact", { contactName: null }],
    ["a blank contact", { contactName: " " }],
    ["an invalid email", { contactEmail: "rita@" }],
    ["a date in another format", { eventDate: "12/12/2026" }],
    ["a zero quantity", { items: [{ description: "Agenda", quantity: 0 }] }],
    ["a zero value", { estimatedValue: 0 }],
  ])("responds 400 for %s", async (_case, body) => {
    const { id } = await opportunityOf(ana);

    const res = await update(id, body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  describe("access", () => {
    it("responds 401 without the X-User-Id header", async () => {
      const { id } = await opportunityOf(ana);

      const res = await request(app)
        .patch(`/api/opportunities/${id}`)
        .send({ contactPhone: "1" });

      expect(res.status).toBe(401);
    });

    it("responds 404 for another seller's opportunity", async () => {
      const bruno = await createUser({ name: "Bruno", managerId: manager.id });
      const { id } = await opportunityOf(bruno);

      const res = await update(id, { contactPhone: "1" });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    });

    it("lets the manager edit a team opportunity", async () => {
      const { id } = await opportunityOf(ana);

      const res = await update(
        id,
        { contactPhone: "(11) 92222-2222" },
        manager,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ contactPhone: "(11) 92222-2222" });
    });
  });
});
