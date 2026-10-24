import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedCaseData } from "../../prisma/seed-case-data.ts";
import { createApp } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { resetDatabase } from "../helpers/database.ts";

const app = createApp();

describe("GET /api/users", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedCaseData(prisma);
  });

  it("lists the users without the X-User-Id header, manager first", async () => {
    const idOf = async (name: string) =>
      (await prisma.user.findFirstOrThrow({ where: { name } })).id;

    const res = await request(app).get("/api/users");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      users: [
        { id: await idOf("Marcos"), name: "Marcos", role: "MANAGER" },
        { id: await idOf("Ana"), name: "Ana", role: "SELLER" },
        { id: await idOf("Bruno"), name: "Bruno", role: "SELLER" },
        { id: await idOf("Carla"), name: "Carla", role: "SELLER" },
      ],
    });
  });
});
