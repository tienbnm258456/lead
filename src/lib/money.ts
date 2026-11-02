/** Accept full UZS, including grouped input such as 299.000 or 299,000. */
export function parseUZS(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  return Number(/^\d{1,3}([.,]\d{3})+$/.test(trimmed) ? trimmed.replace(/[.,]/g, '') : trimmed.replace(/\s/g, ''));
}
