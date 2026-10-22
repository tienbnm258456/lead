/**
 * Generate a unique externalId from DB order id.
 *
 * Prefix is controlled by the ORDER_PREFIX environment variable.
 * - Local/dev: ORDER_PREFIX=ORD-  → ORD-00001
 * - Production: ORDER_PREFIX=LDP- → LDP-00001
 *
 * Defaults to "ORD-" if not set.
 */
export function generateExternalId(orderId: number): string {
  const prefix = process.env.ORDER_PREFIX || 'ORD-';
  return `${prefix}${String(orderId).padStart(5, '0')}`;
}
