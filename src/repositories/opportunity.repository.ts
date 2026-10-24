import type { Opportunity } from "../generated/prisma/client.ts";
import type {
  OpportunityCardRow,
  OpportunityDetailRow,
} from "../types/opportunity-rows.types.ts";
import type {
  CardFilter,
  CommentRecord,
  FollowUpRecord,
  ItemData,
  NewOpportunity,
  OpportunityChanges,
  SnoozeRecord,
  StageChange,
} from "../types/opportunity.types.ts";
import type { CurrentUser } from "../types/user.types.ts";

export interface OpportunityReader {
  findVisible(user: CurrentUser, id: number): Promise<Opportunity | null>;
  findVisibleCards(
    user: CurrentUser,
    filter: CardFilter,
  ): Promise<OpportunityCardRow[]>;
  findDetail(id: number): Promise<OpportunityDetailRow>;
  countItems(id: number): Promise<number>;
}

export interface OpportunityWriter {
  create(opportunity: NewOpportunity): Promise<number>;
  update(id: number, changes: OpportunityChanges): Promise<void>;
  replaceItems(id: number, items: ItemData[]): Promise<void>;
  changeStage(change: StageChange): Promise<void>;
  recordFollowUp(followUp: FollowUpRecord): Promise<void>;
  recordSnooze(snooze: SnoozeRecord): Promise<void>;
  addComment(comment: CommentRecord): Promise<void>;
}

export interface OpportunityRepository
  extends OpportunityReader, OpportunityWriter {}
