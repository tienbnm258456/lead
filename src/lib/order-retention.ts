import { Prisma } from '@prisma/client';
/** Explicit final outcomes only. Delivered/preliminary/partial payment and pending refund stay protected. */
export const TERMINAL_CRM_STATUSES = ['payoff', 'no-call', 'cancel-other', 'duplicate', 'trash', 'testy', 'otmena-net-tovara', 'return', 'refund-done'] as const;
export function retentionDays(value: unknown): number {
  if (value === undefined || value === null) return 60;
  const days = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (![30, 60, 90].includes(days)) throw new Error('Thời hạn dọn đơn phải là 30, 60 hoặc 90 ngày');
  return days;
}
/** Used by preview AND DELETE; alias o is required. No timestamp fallback to last GET check or internal update. */
export function purgeEligibility(cutoff: Date) {
  return Prisma.sql`
    (o.exported_at IS NOT NULL OR o.sheets_exported_at IS NOT NULL)
    AND o.crm_status IN (${Prisma.join(TERMINAL_CRM_STATUSES)})
    AND (o.crm_status_updated_at IS NOT NULL OR EXISTS (
      SELECT 1 FROM retailcrm_events e WHERE e.external_id = o.external_id AND e.processed_at IS NOT NULL
    ))
    AND GREATEST(o.created_at, COALESCE(o.crm_status_updated_at, o.created_at), COALESCE((
      SELECT MAX(e.received_at) FROM retailcrm_events e WHERE e.external_id = o.external_id
    ), o.created_at)) < ${cutoff}
    AND NOT EXISTS (SELECT 1 FROM retailcrm_events e WHERE e.external_id = o.external_id AND e.processed_at IS NULL)
  `;
}
