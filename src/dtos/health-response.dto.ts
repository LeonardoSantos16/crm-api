export type HealthDto = {
  status: "ok" | "unavailable";
  database: boolean;
};
