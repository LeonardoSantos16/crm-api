import { beforeEach, describe, expect, it } from "vitest";
import { seedCaseData } from "../../prisma/seed-case-data.ts";
import { computeAlert } from "../../src/domain/alert.ts";
import { fromDbDate, toLocalDate } from "../../src/domain/dates.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity } from "../helpers/factories.ts";

const loadOpportunities = () =>
  prisma.opportunity.findMany({
    orderBy: { id: "asc" },
    include: { company: true, owner: true, items: true, stageChanges: true },
  });

describe("seedCaseData", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedCaseData(prisma);
  });

  it("creates Marcos as the manager of Ana, Bruno and Carla", async () => {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    const marcos = users.find((user) => user.name === "Marcos");

    expect(marcos?.role).toBe("MANAGER");
    expect(
      users
        .filter((user) => user !== marcos)
        .map(({ name, role, managerId }) => ({ name, role, managerId })),
    ).toEqual(
      ["Ana", "Bruno", "Carla"].map((name) => ({
        name,
        role: "SELLER",
        managerId: marcos?.id,
      })),
    );
  });

  it("creates the case opportunities", async () => {
    const opportunities = await loadOpportunities();

    expect(
      opportunities.map((opp) => ({
        id: opp.id,
        company: opp.company.name,
        items: opp.items.map(({ description, quantity }) => ({
          description,
          quantity,
        })),
        estimatedValue: opp.estimatedValue?.toNumber(),
        owner: opp.owner.name,
        lastContact: opp.lastContactAt && toLocalDate(opp.lastContactAt),
        proposalValidUntil:
          opp.proposalValidUntil && fromDbDate(opp.proposalValidUntil),
        eventDate: opp.eventDate && fromDbDate(opp.eventDate),
        stage: opp.stage,
      })),
    ).toEqual([
      {
        id: 2001,
        company: "Tech Alpha Ltda",
        items: [{ description: "Caneca personalizada", quantity: 300 }],
        estimatedValue: 4500,
        owner: "Ana",
        lastContact: "2026-10-14",
        proposalValidUntil: null,
        eventDate: "2026-11-30",
        stage: "FIRST_CONTACT",
      },
      {
        id: 2002,
        company: "Construtora Horizonte",
        items: [{ description: "Kit escritório", quantity: 120 }],
        estimatedValue: 9800,
        owner: "Bruno",
        lastContact: "2026-10-06",
        proposalValidUntil: "2026-10-13",
        eventDate: "2026-10-25",
        stage: "BUDGET_PRESENTATION",
      },
      {
        id: 2003,
        company: "Clínica Vida",
        items: [{ description: "Squeeze personalizado", quantity: 500 }],
        estimatedValue: 7200,
        owner: "Ana",
        lastContact: "2026-10-13",
        proposalValidUntil: "2026-10-20",
        eventDate: "2026-10-18",
        stage: "FOLLOW_UP",
      },
      {
        id: 2004,
        company: "Agência Pulso",
        items: [{ description: "Camiseta estampada", quantity: 80 }],
        estimatedValue: 3900,
        owner: "Carla",
        lastContact: "2026-10-02",
        proposalValidUntil: "2026-10-10",
        eventDate: "2026-11-05",
        stage: "FOLLOW_UP",
      },
      {
        id: 2005,
        company: "Banco Norte",
        items: [{ description: "Agenda executiva", quantity: 1000 }],
        estimatedValue: 38000,
        owner: "Bruno",
        lastContact: "2026-10-15",
        proposalValidUntil: "2026-10-22",
        eventDate: "2026-12-12",
        stage: "FORECAST",
      },
      {
        id: 2006,
        company: "Escola Saber",
        items: [{ description: "Mochila infantil", quantity: 250 }],
        estimatedValue: 11500,
        owner: "Carla",
        lastContact: "2026-10-09",
        proposalValidUntil: "2026-10-16",
        eventDate: "2026-10-17",
        stage: "CLOSING",
      },
      {
        id: 2007,
        company: "Padaria do Bairro",
        items: [{ description: "Caneta promocional", quantity: 50 }],
        estimatedValue: 350,
        owner: "Ana",
        lastContact: "2026-10-01",
        proposalValidUntil: "2026-10-08",
        eventDate: "2026-10-20",
        stage: "LOST",
      },
    ]);
  });

  it("leaves contacts empty", async () => {
    const opportunities = await loadOpportunities();

    expect(
      opportunities.every(
        (opp) =>
          opp.contactName === null &&
          opp.contactPhone === null &&
          opp.contactEmail === null,
      ),
    ).toBe(true);
  });

  it("marks OPP-2007 as lost for another reason", async () => {
    const lost = await prisma.opportunity.findUniqueOrThrow({
      where: { id: 2007 },
    });

    expect(lost).toMatchObject({
      lossReason: "OTHER",
      lossDetail: "Motivo não informado nos dados do case",
    });
  });

  it("records the initial stage change at the stage entry", async () => {
    const opportunities = await loadOpportunities();

    for (const opp of opportunities.filter(({ id }) => id !== 2007)) {
      expect(opp.stageChanges).toEqual([
        expect.objectContaining({
          fromStage: null,
          toStage: opp.stage,
          changedAt: opp.stageEnteredAt,
        }),
      ]);
    }
  });

  it("continues the ids after the case opportunities", async () => {
    const owner = await prisma.user.findFirstOrThrow({
      where: { name: "Ana" },
    });

    expect((await createOpportunity({ ownerId: owner.id })).id).toBe(2008);
  });

  it("reproduces the case alerts on 2026-10-15", async () => {
    const now = new Date("2026-10-15T12:00:00-03:00");
    const opportunities = await loadOpportunities();

    expect(
      opportunities.map(
        (opp) =>
          computeAlert(
            {
              stage: opp.stage,
              stageEnteredAt: opp.stageEnteredAt,
              lastContactAt: opp.lastContactAt,
              nextFollowUpAt:
                opp.nextFollowUpAt && fromDbDate(opp.nextFollowUpAt),
              snoozedUntil: opp.snoozedUntil && fromDbDate(opp.snoozedUntil),
              snoozeCount: opp.snoozeCount,
            },
            now,
          )?.state ?? null,
      ),
    ).toEqual([
      "ON_TIME",
      "ATTENTION",
      "ON_TIME",
      "ESCALATED",
      "ON_TIME",
      null,
      null,
    ]);
  });

  it("does not duplicate data when run twice", async () => {
    await seedCaseData(prisma);

    expect(await prisma.user.count()).toBe(4);
    expect(await prisma.company.count()).toBe(7);
    expect(await prisma.opportunity.count()).toBe(7);
    expect(await prisma.opportunityItem.count()).toBe(7);
    expect(await prisma.stageChange.count()).toBe(8);
  });
});
