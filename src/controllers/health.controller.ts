import type { Request, Response } from "express";
import type { HealthDto } from "../dtos/health-response.dto.ts";
import type { CheckHealthUseCase } from "../use-cases/health/check-health.use-case.ts";

export class HealthController {
  private readonly checkHealth: CheckHealthUseCase;

  constructor(checkHealth: CheckHealthUseCase) {
    this.checkHealth = checkHealth;
  }

  get = async (_req: Request, res: Response<HealthDto>) => {
    const health = await this.checkHealth.execute();
    res.status(health.database ? 200 : 503).json(health);
  };
}
