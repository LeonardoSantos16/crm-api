const POSITIVE_INTEGER = /^[1-9]\d*$/;

export function parsePositiveInteger(
  value: string | undefined,
): number | undefined {
  if (!value || !POSITIVE_INTEGER.test(value)) return undefined;
  return Number(value);
}
