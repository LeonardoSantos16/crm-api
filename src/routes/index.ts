import { Router } from "express";
import { getHealth } from "../controllers/health.controller.ts";
import { getUsers } from "../controllers/users.controller.ts";

export const routes = Router();

routes.get("/health", getHealth);

const api = Router();
routes.use("/api", api);

api.get("/users", getUsers);
