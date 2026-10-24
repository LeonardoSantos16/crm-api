import type { Request, Response } from "express";
import { toLocalDate } from "../domain/dates.ts";
import type {
  OpportunityBoardDto,
  OpportunityDetailDto,
} from "../dtos/opportunity-response.dto.ts";
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
import type { CommentOpportunityUseCase } from "../use-cases/opportunities/comment-opportunity.use-case.ts";
import type { CreateOpportunityUseCase } from "../use-cases/opportunities/create-opportunity.use-case.ts";
import type { FollowUpOpportunityUseCase } from "../use-cases/opportunities/follow-up-opportunity.use-case.ts";
import type { GetOpportunityDetailUseCase } from "../use-cases/opportunities/get-opportunity-detail.use-case.ts";
import type { ListOpportunitiesUseCase } from "../use-cases/opportunities/list-opportunities.use-case.ts";
import type { LoseOpportunityUseCase } from "../use-cases/opportunities/lose-opportunity.use-case.ts";
import type { MoveOpportunityUseCase } from "../use-cases/opportunities/move-opportunity.use-case.ts";
import type { SnoozeOpportunityUseCase } from "../use-cases/opportunities/snooze-opportunity.use-case.ts";
import type { UpdateOpportunityUseCase } from "../use-cases/opportunities/update-opportunity.use-case.ts";

export type OpportunityUseCases = {
  list: ListOpportunitiesUseCase;
  getDetail: GetOpportunityDetailUseCase;
  create: CreateOpportunityUseCase;
  update: UpdateOpportunityUseCase;
  move: MoveOpportunityUseCase;
  lose: LoseOpportunityUseCase;
  followUp: FollowUpOpportunityUseCase;
  snooze: SnoozeOpportunityUseCase;
  comment: CommentOpportunityUseCase;
};

type IdRequest = Request<{ id: string }>;
type DetailResponse = Response<OpportunityDetailDto>;

function parseOpportunityId(value: string) {
  const id = parsePositiveInteger(value);
  if (id === undefined) throw new OpportunityNotFoundError();
  return id;
}

export class OpportunitiesController {
  private readonly useCases: OpportunityUseCases;

  constructor(useCases: OpportunityUseCases) {
    this.useCases = useCases;
  }

  list = async (req: Request, res: Response<OpportunityBoardDto>) => {
    const query = listSchema.parse(req.query);

    res.json(
      await this.useCases.list.execute(res.locals.user, query, res.locals.now),
    );
  };

  getDetail = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);

    res.json(
      await this.useCases.getDetail.execute(
        res.locals.user,
        id,
        res.locals.now,
      ),
    );
  };

  create = async (req: Request, res: DetailResponse) => {
    const input = createSchema.parse(req.body);

    res
      .status(201)
      .json(
        await this.useCases.create.execute(
          res.locals.user,
          input,
          res.locals.now,
        ),
      );
  };

  update = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = updateSchema.parse(req.body);

    res.json(
      await this.useCases.update.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };

  move = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = moveSchema.parse(req.body);

    res.json(
      await this.useCases.move.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };

  lose = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = loseSchema.parse(req.body);

    res.json(
      await this.useCases.lose.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };

  followUp = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = followUpSchema(toLocalDate(res.locals.now)).parse(req.body);

    res.json(
      await this.useCases.followUp.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };

  snooze = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = snoozeSchema(toLocalDate(res.locals.now)).parse(req.body);

    res.json(
      await this.useCases.snooze.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };

  comment = async (req: IdRequest, res: DetailResponse) => {
    const id = parseOpportunityId(req.params.id);
    const input = commentSchema.parse(req.body);

    res.json(
      await this.useCases.comment.execute(
        res.locals.user,
        id,
        input,
        res.locals.now,
      ),
    );
  };
}
