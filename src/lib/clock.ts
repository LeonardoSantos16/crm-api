import { diffDays, toLocalDate, type CalendarDate } from "../domain/dates.ts";

const MS_PER_DAY = 86_400_000;

export type Clock = () => Date;

export function createClock({
  referenceDate,
  realNow = () => new Date(),
}: {
  referenceDate?: CalendarDate | undefined;
  realNow?: () => Date;
} = {}): Clock {
  if (!referenceDate) return realNow;

  const offsetMs = diffDays(toLocalDate(realNow()), referenceDate) * MS_PER_DAY;
  return () => new Date(realNow().getTime() + offsetMs);
}
