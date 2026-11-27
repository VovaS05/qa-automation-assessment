export function dollarsToCents(value: string): number {
  const match = /^\$(\d+)\.(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Expected a USD amount with two decimal places, received "${value}"`);
  }
  return Number(match[1]) * 100 + Number(match[2]);
}
