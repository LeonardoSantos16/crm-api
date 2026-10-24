import type { Request, Response } from "express";
import { toLocalDate } from "../domain/dates.ts";
import { OpportunityNotFoundError } from "../errors/opportunity-errors.ts";
import { parsePositiveInteger } from "../lib/positive-integer.ts";
import {
  commentSchema,
  createSchema,
  followUpSchema,
  listSchema,
  loseSchema,
  moveSchema,
  snoozeSchema,
  updateSchema,
} from "../schemas/opportunity.schemas.ts";
import {
  commentOpportunity,
  createOpportunity,
  followUpOpportunity,
  getOpportunityDetail,
  listOpportunities,
  loseOpportunity,
  moveOpportunity,
  snoozeOpportunity,
  updateOpportunity,
} from "../services/opportunities.service.ts";

function parseOpportunityId(value: string) {
  const id = parsePositiveInteger(value);
  if (id === undefined) throw new OpportunityNotFoundError();
  return id;
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
  const input = commentSchema.parse(req.body);

  res.json(
    await commentOpportunity(res.locals.user, id, input, res.locals.now),
  );
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

export async function patchOpportunity(
  req: Request<{ id: string }>,
  res: Response,
) {
  const id = parseOpportunityId(req.params.id);
  const input = updateSchema.parse(req.body);

  res.json(await updateOpportunity(res.locals.user, id, input, res.locals.now));
}
