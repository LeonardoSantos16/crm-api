import type { CalendarDate } from "../domain/dates.ts";
import type { Stage } from "../domain/stages.ts";
import type {
  FollowUpChannel,
  LossReason,
} from "../generated/prisma/client.ts";

export type ItemData = {
  description: string;
  quantity: number;
  unitValue?: number | undefined;
};

export type CardFilter = {
  ownerId?: number | undefined;
  includeLost: boolean;
};

export type NewOpportunity = {
  companyId: number;
  ownerId: number;
  contactName: string;
  contactPhone?: string | undefined;
  contactEmail?: string | undefined;
  estimatedValue?: number | undefined;
  item?: ItemData | undefined;
  createdById: number;
  createdAt: Date;
};

export type OpportunityChanges = {
  companyId?: number | undefined;
  contactName?: string | undefined;
  contactPhone?: string | null | undefined;
  contactEmail?: string | null | undefined;
  proposalValidUntil?: CalendarDate | null | undefined;
  eventDate?: CalendarDate | null | undefined;
  estimatedValue?: number | null | undefined;
};

export type StageChange = {
  opportunityId: number;
  fromStage: Stage;
  toStage: Stage;
  userId: number;
  at: Date;
  estimatedValue?: number | undefined;
  lossReason?: LossReason | undefined;
  lossDetail?: string | null | undefined;
};

export type FollowUpRecord = {
  opportunityId: number;
  userId: number;
  channel: FollowUpChannel | null;
  summary: string | null;
  nextDate: CalendarDate | null;
  at: Date;
};

export type SnoozeRecord = {
  opportunityId: number;
  userId: number;
  until: CalendarDate;
  reason: string | null;
  at: Date;
};

export type CommentRecord = {
  opportunityId: number;
  userId: number;
  body: string;
  at: Date;
};
