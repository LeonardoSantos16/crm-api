import { execSync } from "node:child_process";

// Roda uma vez antes da suíte: aplica as migrations no banco de teste
export default function setup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
