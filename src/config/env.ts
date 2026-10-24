import "dotenv/config";
import { z } from "zod";
import { isCalendarDate } from "../domain/dates.ts";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  REFERENCE_DATE: z
    .string()
    .transform((value) => value || undefined)
    .pipe(
      z
        .string()
        .refine(isCalendarDate, "Expected a YYYY-MM-DD date")
        .optional(),
    )
    .optional(),
});

export function parseEnv(source: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
