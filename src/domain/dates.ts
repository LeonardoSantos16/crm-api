export type CalendarDate = string;

const MS_PER_DAY = 86_400_000;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const localDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toUtcMidnight = (date: CalendarDate) => new Date(`${date}T00:00:00Z`);

export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;

  const date = toUtcMidnight(value);
  return !Number.isNaN(date.getTime()) && fromDbDate(date) === value;
}

export function toLocalDate(instant: Date): CalendarDate {
  return localDateFormat.format(instant);
}

export function fromDbDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromDbDate(
    new Date(toUtcMidnight(date).getTime() + days * MS_PER_DAY),
  );
}

export function diffDays(from: CalendarDate, to: CalendarDate): number {
  return (
    (toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / MS_PER_DAY
  );
}
