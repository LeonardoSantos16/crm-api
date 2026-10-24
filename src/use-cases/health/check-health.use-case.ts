import type { HealthDto } from "../../dtos/health-response.dto.ts";
import type { HealthRepository } from "../../repositories/health.repository.ts";

export class CheckHealthUseCase {
  private readonly health: HealthRepository;

  constructor(health: HealthRepository) {
    this.health = health;
  }

  async execute(): Promise<HealthDto> {
    const database = await this.health.isDatabaseUp();
    return { status: database ? "ok" : "unavailable", database };
  }
}
