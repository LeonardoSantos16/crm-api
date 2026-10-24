import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.ts";
import { createContainer } from "./container.ts";
import type { PrismaClient } from "./generated/prisma/client.ts";
import { createClock, type Clock } from "./lib/clock.ts";
import { prisma as defaultPrisma } from "./lib/prisma.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { notFound } from "./middlewares/not-found.ts";
import { requestTime } from "./middlewares/request-time.ts";
import { createRoutes } from "./routes/index.ts";

export function createApp({
  clock = createClock({ referenceDate: env.REFERENCE_DATE }),
  prisma = defaultPrisma,
}: { clock?: Clock; prisma?: PrismaClient } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, exposedHeaders: ["X-Today"] }));
  app.use(requestTime(clock));
  app.use(express.json());

  app.use(createRoutes(createContainer(prisma)));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
