import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity, createUser } from "../helpers/factories.ts";

describe("database schema", () => {
  beforeEach(resetDatabase);

  it("creates an opportunity with empty contact, snooze and follow-up fields", async () => {
    const owner = await createUser();
    const opportunity = await createOpportunity({ ownerId: owner.id });

    expect(opportunity).toMatchObject({
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      snoozedUntil: null,
      nextFollowUpAt: null,
      snoozeCount: 0,
      lossReason: null,
      lossDetail: null,
    });
  });

  it("deletes the history of an opportunity with it", async () => {
    const owner = await createUser();
    const { id: opportunityId } = await createOpportunity({
      ownerId: owner.id,
    });
    await prisma.opportunityItem.create({
      data: { opportunityId, description: "Caneca", quantity: 10 },
    });
    await prisma.stageChange.create({
      data: { opportunityId, toStage: "FIRST_CONTACT" },
    });
    await prisma.followUp.create({
      data: { opportunityId, userId: owner.id, channel: "CALL" },
    });
    await prisma.snooze.create({
      data: {
        opportunityId,
        userId: owner.id,
        until: new Date("2026-10-20T00:00:00Z"),
      },
    });
    await prisma.comment.create({
      data: { opportunityId, userId: owner.id, body: "Cliente pediu amostra" },
    });

    await prisma.opportunity.delete({ where: { id: opportunityId } });

    expect(await prisma.opportunityItem.count()).toBe(0);
    expect(await prisma.stageChange.count()).toBe(0);
    expect(await prisma.followUp.count()).toBe(0);
    expect(await prisma.snooze.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });
});
