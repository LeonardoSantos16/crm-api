import type { Alert } from "../domain/alert.ts";
import type { CalendarDate } from "../domain/dates.ts";
import type { Stage } from "../domain/stages.ts";
import type { Move } from "../domain/transitions.ts";
import type {
  FollowUpChannel,
  LossReason,
} from "../generated/prisma/client.ts";

export type RefDto = { id: number; name: string };

export type ItemDto = {
  id: number;
  description: string;
  quantity: number;
  unitValue: number | null;
};

export type OpportunitySummaryDto = {
  id: number;
  code: string;
  company: RefDto;
  owner: RefDto;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  estimatedValue: number | null;
  items: ItemDto[];
  proposalValidUntil: CalendarDate | null;
  eventDate: CalendarDate | null;
  stage: Stage;
  stageEnteredAt: Date;
  lastContactAt: Date | null;
  nextFollowUpAt: CalendarDate | null;
  snoozedUntil: CalendarDate | null;
  snoozeCount: number;
  lossReason: LossReason | null;
  lossDetail: string | null;
  alert: Alert | null;
  moves: Move[];
};

type TimelineBase = { at: Date; author: RefDto | null };

export type TimelineEntryDto =
  | (TimelineBase & { type: "CREATED"; stage: Stage })
  | (TimelineBase & {
      type: "STAGE_CHANGE";
      fromStage: Stage;
      toStage: Stage;
    })
  | (TimelineBase & {
      type: "LOST";
      fromStage: Stage;
      reason: LossReason | null;
      detail: string | null;
    })
  | (TimelineBase & {
      type: "FOLLOW_UP";
      channel: FollowUpChannel | null;
      summary: string | null;
      nextDate: CalendarDate | null;
    })
  | (TimelineBase & {
      type: "SNOOZE";
      until: CalendarDate;
      reason: string | null;
    })
  | (TimelineBase & { type: "COMMENT"; body: string })
  | (TimelineBase & {
      type: "ESCALATED";
      author: null;
      date: CalendarDate;
      cause: "SNOOZES" | "DEADLINE";
    });

export type OpportunityDetailDto = OpportunitySummaryDto & {
  timeline: TimelineEntryDto[];
};

export type OpportunityCardDto = OpportunitySummaryDto & {
  lostFromStage: Stage | null;
};

export type OpportunityBoardDto = {
  opportunities: OpportunityCardDto[];
  needsAttention: number;
};
