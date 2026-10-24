import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.ts";
import {
  findVisibleOpportunity,
  visibleOpportunitiesWhere,
} from "../../src/services/visibility.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity, createUser } from "../helpers/factories.ts";

async function createTeams() {
  const marcos = await createUser({ name: "Marcos", role: "MANAGER" });
  const otherManager = await createUser({ name: "Paula", role: "MANAGER" });
  const ana = await createUser({ name: "Ana", managerId: marcos.id });
  const bruno = await createUser({ name: "Bruno", managerId: marcos.id });
  const carla = await createUser({ name: "Carla", managerId: otherManager.id });

  return {
    marcos,
    ana,
    anaOpportunity: await createOpportunity({ ownerId: ana.id }),
    brunoOpportunity: await createOpportunity({ ownerId: bruno.id }),
    carlaOpportunity: await createOpportunity({ ownerId: carla.id }),
  };
}

const visibleIds = async (
  where: ReturnType<typeof visibleOpportunitiesWhere>,
) =>
  (await prisma.opportunity.findMany({ where, orderBy: { id: "asc" } })).map(
    (opportunity) => opportunity.id,
  );

describe("findVisibleOpportunity", () => {
  beforeEach(resetDatabase);

  it("finds the seller's own opportunity", async () => {
    const { ana, anaOpportunity } = await createTeams();

    expect((await findVisibleOpportunity(ana, anaOpportunity.id)).id).toBe(
      anaOpportunity.id,
    );
  });

  it("hides another seller's opportunity as if it did not exist", async () => {
    const { ana, brunoOpportunity } = await createTeams();

    const hidden = await findVisibleOpportunity(ana, brunoOpportunity.id).catch(
      (error: unknown) => error,
    );
    const missing = await findVisibleOpportunity(ana, 999_999).catch(
      (error: unknown) => error,
    );

    expect(hidden).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(hidden).toEqual(missing);
  });

  it("lets the manager find the team's opportunities only", async () => {
    const { marcos, anaOpportunity, carlaOpportunity } = await createTeams();

    expect((await findVisibleOpportunity(marcos, anaOpportunity.id)).id).toBe(
      anaOpportunity.id,
    );
    await expect(
      findVisibleOpportunity(marcos, carlaOpportunity.id),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("visibleOpportunitiesWhere", () => {
  beforeEach(resetDatabase);

  it("limits the seller to their own opportunities", async () => {
    const { ana, anaOpportunity } = await createTeams();

    expect(await visibleIds(visibleOpportunitiesWhere(ana))).toEqual([
      anaOpportunity.id,
    ]);
  });

  it("limits the manager to the team's opportunities", async () => {
    const { marcos, anaOpportunity, brunoOpportunity } = await createTeams();

    expect(await visibleIds(visibleOpportunitiesWhere(marcos))).toEqual([
      anaOpportunity.id,
      brunoOpportunity.id,
    ]);
  });
});
