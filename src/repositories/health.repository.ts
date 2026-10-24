export interface HealthRepository {
  isDatabaseUp(): Promise<boolean>;
}
