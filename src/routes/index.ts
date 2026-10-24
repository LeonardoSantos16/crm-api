import { Router } from "express";
import { getHealth } from "../controllers/health.controller.ts";
import {
  getOpportunity,
  postLose,
  postMove,
} from "../controllers/opportunities.controller.ts";
import { getUsers } from "../controllers/users.controller.ts";
import { requireUser } from "../middlewares/identity.ts";

export const routes = Router();

routes.get("/health", getHealth);

const api = Router();
routes.use("/api", api);

api.get("/users", getUsers);

const opportunities = Router();
api.use("/opportunities", requireUser, opportunities);

opportunities.get("/:id", getOpportunity);
opportunities.post("/:id/move", postMove);
opportunities.post("/:id/lose", postLose);
