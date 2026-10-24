import type { Request, Response } from "express";
import { z } from "zod";
import { FUNNEL_STAGES } from "../domain/stages.ts";
import { LossReason } from "../generated/prisma/client.ts";
import {
  loseOpportunity,
  moveOpportunity,
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

const loseSchema = z
  .object({
    reason: z.enum(LossReason),
    detail: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || undefined)
      .optional(),
  })
  .refine((body) => body.reason !== "OTHER" || body.detail, {
    path: ["detail"],
    message: "Detail is required when the reason is OTHER",
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
