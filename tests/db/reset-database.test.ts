import { describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity, createUser } from "../helpers/factories.ts";

describe("resetDatabase", () => {
  it("empties every table and restarts the ids", async () => {
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
    await prisma.followUp.create({ data: { opportunityId } });
    await prisma.snooze.create({
      data: { opportunityId, until: new Date("2026-10-20T00:00:00Z") },
    });
    await prisma.comment.create({ data: { opportunityId, body: "Oi" } });

    await resetDatabase();

    const counts = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.opportunity.count(),
      prisma.opportunityItem.count(),
      prisma.stageChange.count(),
      prisma.followUp.count(),
      prisma.snooze.count(),
      prisma.comment.count(),
    ]);
    expect(counts.every((count) => count === 0)).toBe(true);
    expect((await createUser()).id).toBe(1);
  });
});
