import { needsAttention, type AlertState } from "./alert.ts";
import { diffDays, toLocalDate } from "./dates.ts";
import {
  byMostRecent,
  byPriority,
  byValue,
  type Rankable,
} from "./priority.ts";
import type { Stage } from "./stages.ts";

export const RECENT_FINAL_DAYS = 30;

export type BoardCard = Rankable & {
  code: string;
  company: { name: string };
  stage: Stage;
};

export type BoardFilter = {
  q?: string | undefined;
  situation?: AlertState[] | undefined;
  sort?: "priority" | "value" | undefined;
  allClosed?: boolean | undefined;
};

const boardGroup = (card: BoardCard) =>
  card.stage === "CLOSING" ? 1 : card.stage === "LOST" ? 2 : 0;

function byBoardPriority(a: BoardCard, b: BoardCard) {
  const group = boardGroup(a) - boardGroup(b);
  if (group !== 0) return group;
  return boardGroup(a) === 0 ? byPriority(a, b) : byMostRecent(a, b);
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function buildBoard<T extends BoardCard>(
  cards: T[],
  { q, situation, sort = "priority", allClosed = false }: BoardFilter,
  now: Date,
) {
  const today = toLocalDate(now);
  const isRecent = (enteredAt: Date) =>
    diffDays(toLocalDate(enteredAt), today) <= RECENT_FINAL_DAYS;
  const search = q ? normalizeText(q) : undefined;

  const isListed = (card: T) => {
    if (card.stage === "CLOSING") {
      return allClosed || isRecent(card.stageEnteredAt);
    }
    if (card.stage === "LOST") return isRecent(card.stageEnteredAt);
    return true;
  };
  const matchesSearch = (card: T) =>
    !search ||
    normalizeText(card.code).includes(search) ||
    normalizeText(card.company.name).includes(search);
  const matchesSituation = (card: T) =>
    !situation || (card.alert !== null && situation.includes(card.alert.state));

  const matching = cards.filter(
    (card) => isListed(card) && matchesSearch(card) && matchesSituation(card),
  );

  return {
    opportunities: matching.sort(sort === "value" ? byValue : byBoardPriority),
    needsAttention: cards.filter((card) => needsAttention(card.alert)).length,
  };
}
