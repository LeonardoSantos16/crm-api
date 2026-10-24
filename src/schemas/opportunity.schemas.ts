import { z } from "zod";
import { ALERT_STATES } from "../domain/alert.ts";
import { addDays, isCalendarDate, type CalendarDate } from "../domain/dates.ts";
import { FUNNEL_STAGES } from "../domain/stages.ts";
import { FollowUpChannel, LossReason } from "../generated/prisma/client.ts";

const ACTION_WINDOW_DAYS = 30;

const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.int().positive(),
  unitValue: z.number().positive().optional(),
});

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || undefined)
  .optional();

const requiredName = z.string().trim().min(1).max(200);

const optionalDate = z
  .string()
  .refine(isCalendarDate, "Expected a YYYY-MM-DD date")
  .nullable()
  .optional();

const actionDate = (today: CalendarDate) =>
  z
    .string()
    .refine(isCalendarDate, "Expected a YYYY-MM-DD date")
    .refine(
      (date) => date > today && date <= addDays(today, ACTION_WINDOW_DAYS),
      `Expected a date after today and within ${ACTION_WINDOW_DAYS} days`,
    );

const repeatedParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : [value].flat()),
    z.array(schema).optional(),
  );

const booleanParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const moveSchema = z.object({
  toStage: z.enum([...FUNNEL_STAGES, "LOST"]),
  complete: z
    .object({
      estimatedValue: z.number().positive().optional(),
      items: z.array(itemSchema).min(1).optional(),
    })
    .optional(),
});

export const loseSchema = z
  .object({
    reason: z.enum(LossReason),
    detail: optionalText,
  })
  .refine((body) => body.reason !== "OTHER" || body.detail, {
    path: ["detail"],
    message: "Detail is required when the reason is OTHER",
  });

export const followUpSchema = (today: CalendarDate) =>
  z.object({
    channel: z.enum(FollowUpChannel).optional(),
    summary: optionalText,
    nextDate: actionDate(today).optional(),
  });

export const snoozeSchema = (today: CalendarDate) =>
  z.object({
    until: actionDate(today),
    reason: optionalText,
  });

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const listSchema = z.object({
  q: z.string().trim().optional(),
  situation: repeatedParam(z.enum(ALERT_STATES)),
  ownerId: z.coerce.number().int().positive().optional(),
  sort: z.enum(["priority", "value"]).optional(),
  allClosed: booleanParam,
  includeLost: booleanParam,
});

export const createSchema = z.object({
  companyName: requiredName,
  contactName: requiredName,
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().pipe(z.email()).optional(),
  ownerId: z.int().positive().optional(),
  item: itemSchema.optional(),
  estimatedValue: z.number().positive().optional(),
});

export const updateSchema = z
  .object({
    companyName: requiredName.optional(),
    contactName: requiredName.optional(),
    contactPhone: z.string().trim().max(30).nullable().optional(),
    contactEmail: z.string().trim().pipe(z.email()).nullable().optional(),
    proposalValidUntil: optionalDate,
    eventDate: optionalDate,
    items: z.array(itemSchema).optional(),
    estimatedValue: z.number().positive().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });
