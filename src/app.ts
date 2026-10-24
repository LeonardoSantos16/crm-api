import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { notFound } from "./middlewares/not-found.ts";
import { routes } from "./routes/index.ts";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
