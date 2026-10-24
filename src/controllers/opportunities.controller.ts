import type { Request, Response } from "express";
import { z } from "zod";
import {
  addDays,
  isCalendarDate,
  toLocalDate,
  type CalendarDate,
} from "../domain/dates.ts";
import { ALERT_STATES } from "../domain/alert.ts";
import { FUNNEL_STAGES } from "../domain/stages.ts";
import { FollowUpChannel, LossReason } from "../generated/prisma/client.ts";
import {
  commentOpportunity,
  createOpportunity,
  followUpOpportunity,
  getOpportunityDetail,
  listOpportunities,
  loseOpportunity,
  moveOpportunity,
  snoozeOpportunity,
} from "../services/opportunities.service.ts";
import { opportunityNotFound } from "../services/visibility.ts";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.int().positive(),
  unitValue: z.number().positive().optional(),
});

const moveSchema = z.object({
  toStage: z.enum([...FUNNEL_STAGES, "LOST"]),
  complete: z
    .object({
      estimatedValue: z.number().positive().optional(),
      items: z.array(itemSchema).min(1).optional(),
    })
    .optional(),
});

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || undefined)
  .optional();

const loseSchema = z
  .object({
    reason: z.enum(LossReason),
    detail: optionalText,
  })
  .refine((body) => body.reason !== "OTHER" || body.detail, {
    path: ["detail"],
    message: "Detail is required when the reason is OTHER",
  });

const ACTION_WINDOW_DAYS = 30;

const actionDate = (today: CalendarDate) =>
  z
    .string()
    .refine(isCalendarDate, "Expected a YYYY-MM-DD date")
    .refine(
      (date) => date > today && date <= addDays(today, ACTION_WINDOW_DAYS),
      `Expected a date after today and within ${ACTION_WINDOW_DAYS} days`,
    );

const followUpSchema = (today: CalendarDate) =>
  z.object({
    channel: z.enum(FollowUpChannel).optional(),
    summary: optionalText,
    nextDate: actionDate(today).optional(),
  });

const snoozeSchema = (today: CalendarDate) =>
  z.object({
    until: actionDate(today),
    reason: optionalText,
  });

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const repeatedParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : [value].flat()),
    z.array(schema).optional(),
  );

const booleanParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const listSchema = z.object({
  q: z.string().trim().optional(),
  situation: repeatedParam(z.enum(ALERT_STATES)),
  ownerId: z.coerce.number().int().positive().optional(),
  sort: z.enum(["priority", "value"]).optional(),
  allClosed: booleanParam,
  includeLost: booleanParam,
});

const requiredName = z.string().trim().min(1).max(200);

const createSchema = z.object({
  companyName: requiredName,
  contactName: requiredName,
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().pipe(z.email()).optional(),
  ownerId: z.int().positive().optional(),
  item: itemSchema.optional(),
  estimatedValue: z.number().positive().optional(),
});

function parseOpportunityId(value: string) {
  if (!POSITIVE_INTEGER.test(value)) throw opportunityNotFound();
  return Number(value);
}

export async function postMove(req: Request<{ id: string }>, res: Response) {
  const id = parseOpportunityId(req.params.id);
  const input = moveSchema.parse(req.body);

  res.json(await moveOpportunity(res.locals.user, id, input, res.locals.now));
}

export async function postLose(req: Request<{ id: string }>, res: Response) {
  const id = parseOpportunityId(req.params.id);
  const input = loseSchema.parse(req.body);

  res.json(await loseOpportunity(res.locals.user, id, input, res.locals.now));
}

export async function getOpportunity(
  req: Request<{ id: string }>,
  res: Response,
) {
  const id = parseOpportunityId(req.params.id);

  res.json(await getOpportunityDetail(res.locals.user, id, res.locals.now));
}

export async function postFollowUp(
  req: Request<{ id: string }>,
  res: Response,
) {
  const id = parseOpportunityId(req.params.id);
  const input = followUpSchema(toLocalDate(res.locals.now)).parse(req.body);

  res.json(
    await followUpOpportunity(res.locals.user, id, input, res.locals.now),
  );
}

export async function postSnooze(req: Request<{ id: string }>, res: Response) {
  const id = parseOpportunityId(req.params.id);
  const input = snoozeSchema(toLocalDate(res.locals.now)).parse(req.body);

  res.json(await snoozeOpportunity(res.locals.user, id, input, res.locals.now));
}

export async function postComment(req: Request<{ id: string }>, res: Response) {
  const id = parseOpportunityId(req.params.id);
  const { body } = commentSchema.parse(req.body);

  res.json(await commentOpportunity(res.locals.user, id, body, res.locals.now));
}

export async function getOpportunities(req: Request, res: Response) {
  const query = listSchema.parse(req.query);

  res.json(await listOpportunities(res.locals.user, query, res.locals.now));
}

export async function postOpportunity(req: Request, res: Response) {
  const input = createSchema.parse(req.body);

  res
    .status(201)
    .json(await createOpportunity(res.locals.user, input, res.locals.now));
}
