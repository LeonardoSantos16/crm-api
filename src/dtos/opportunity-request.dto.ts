import type { z } from "zod";
import type {
  commentSchema,
  createSchema,
  followUpSchema,
  listSchema,
  loseSchema,
  moveSchema,
  snoozeSchema,
  updateSchema,
} from "../schemas/opportunity.schemas.ts";

export type ListOpportunitiesDto = z.infer<typeof listSchema>;
export type CreateOpportunityDto = z.infer<typeof createSchema>;
export type UpdateOpportunityDto = z.infer<typeof updateSchema>;
export type MoveOpportunityDto = z.infer<typeof moveSchema>;
export type LoseOpportunityDto = z.infer<typeof loseSchema>;
export type FollowUpOpportunityDto = z.infer<ReturnType<typeof followUpSchema>>;
export type SnoozeOpportunityDto = z.infer<ReturnType<typeof snoozeSchema>>;
export type CommentOpportunityDto = z.infer<typeof commentSchema>;
