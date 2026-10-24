import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ quiet: true });
const testDatabaseUrl = process.env["DATABASE_URL_TEST"];
if (!testDatabaseUrl) throw new Error("DATABASE_URL_TEST is not set");
process.env["DATABASE_URL"] = testDatabaseUrl;
process.env["NODE_ENV"] = "test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
  },
});
