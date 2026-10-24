import type { Request, Response } from "express";
import { z } from "zod";
import {
  addDays,
  isCalendarDate,
  toLocalDate,
  type CalendarDate,
} from "../domain/dates.ts";
import { FUNNEL_STAGES } from "../domain/stages.ts";
import { FollowUpChannel, LossReason } from "../generated/prisma/client.ts";
import {
  commentOpportunity,
  followUpOpportunity,
  getOpportunityDetail,
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
