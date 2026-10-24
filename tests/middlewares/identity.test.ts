import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.ts";
import { errorHandler } from "../../src/middlewares/error-handler.ts";
import { requireUser } from "../../src/middlewares/identity.ts";
import { PrismaUserRepository } from "../../src/repositories/prisma/prisma-user.repository.ts";
import { IdentifyUserUseCase } from "../../src/use-cases/users/identify-user.use-case.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/factories.ts";

const app = express();
app.get(
  "/me",
  requireUser(new IdentifyUserUseCase(new PrismaUserRepository(prisma))),
  (_req, res) => {
    res.json(res.locals.user);
  },
);
app.use(errorHandler);

const unauthenticated = {
  error: {
    code: "UNAUTHENTICATED",
    message: "X-User-Id header must identify an existing user",
  },
};

describe("requireUser", () => {
  beforeEach(resetDatabase);

  it("responds 401 without the X-User-Id header", async () => {
    const res = await request(app).get("/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(unauthenticated);
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 401 for the invalid id %j",
    async (userId) => {
      const res = await request(app).get("/me").set("X-User-Id", userId);

      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthenticated);
    },
  );

  it("responds 401 for a user that does not exist", async () => {
    const res = await request(app).get("/me").set("X-User-Id", "999");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(unauthenticated);
  });

  it("exposes the current user to the route", async () => {
    const manager = await createUser({ name: "Marcos", role: "MANAGER" });
    const seller = await createUser({ name: "Ana", managerId: manager.id });

    const res = await request(app)
      .get("/me")
      .set("X-User-Id", String(seller.id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: seller.id,
      name: "Ana",
      role: "SELLER",
      managerId: manager.id,
    });
  });
});
