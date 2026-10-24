import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.ts";
import { createClock, type Clock } from "./lib/clock.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { notFound } from "./middlewares/not-found.ts";
import { requestTime } from "./middlewares/request-time.ts";
import { routes } from "./routes/index.ts";

export function createApp({
  clock = createClock({ referenceDate: env.REFERENCE_DATE }),
}: { clock?: Clock } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, exposedHeaders: ["X-Today"] }));
  app.use(requestTime(clock));
  app.use(express.json());

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
