import { Router } from "express";
import { getHealth } from "../controllers/health.controller.ts";
import {
  getOpportunities,
  getOpportunity,
  patchOpportunity,
  postComment,
  postFollowUp,
  postLose,
  postMove,
  postOpportunity,
  postSnooze,
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

opportunities.get("/", getOpportunities);
opportunities.post("/", postOpportunity);
opportunities.get("/:id", getOpportunity);
opportunities.patch("/:id", patchOpportunity);
opportunities.post("/:id/move", postMove);
opportunities.post("/:id/lose", postLose);
opportunities.post("/:id/follow-up", postFollowUp);
opportunities.post("/:id/snooze", postSnooze);
opportunities.post("/:id/comments", postComment);
