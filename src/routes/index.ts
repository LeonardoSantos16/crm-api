import { Router, type RequestHandler } from "express";
import type { HealthController } from "../controllers/health.controller.ts";
import type { OpportunitiesController } from "../controllers/opportunities.controller.ts";
import type { UsersController } from "../controllers/users.controller.ts";

export type RouteHandlers = {
  health: HealthController;
  users: UsersController;
  opportunities: OpportunitiesController;
  requireUser: RequestHandler;
};

export function createRoutes({
  health,
  users,
  opportunities,
  requireUser,
}: RouteHandlers) {
  const routes = Router();

  routes.get("/health", health.get);

  const api = Router();
  routes.use("/api", api);

  api.get("/users", users.list);

  const opportunityRoutes = Router();
  api.use("/opportunities", requireUser, opportunityRoutes);

  opportunityRoutes.get("/", opportunities.list);
  opportunityRoutes.post("/", opportunities.create);
  opportunityRoutes.get("/:id", opportunities.getDetail);
  opportunityRoutes.patch("/:id", opportunities.update);
  opportunityRoutes.post("/:id/move", opportunities.move);
  opportunityRoutes.post("/:id/lose", opportunities.lose);
  opportunityRoutes.post("/:id/follow-up", opportunities.followUp);
  opportunityRoutes.post("/:id/snooze", opportunities.snooze);
  opportunityRoutes.post("/:id/comments", opportunities.comment);

  return routes;
}
