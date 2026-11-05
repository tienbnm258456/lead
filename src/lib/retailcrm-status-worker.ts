import { prisma } from '@/lib/prisma';
import { getRetailCrmStatus } from '@/lib/retailcrm-status';
/** One DB-wide lock serializes fetch + writes across all PM2 instances. Crash rolls back the task. */
export async function processRetailCrmEvents() {
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(774201100) AS locked`;
    if (!lock.locked) return { processed: 0, busy: true };
    const event = await tx.retailCrmEvent.findFirst({ where: { processed_at: null, next_attempt_at: { lte: new Date() }, attempts: { lt: 12 } }, orderBy: { received_at: 'asc' } });
    if (!event) return { processed: 0 };
    try {
      const order = await tx.order.findUnique({ where: { external_id: event.external_id } });
      if (!order) throw new Error('Local order missing or previously purged');
      const current = await getRetailCrmStatus(event.external_id, event.event_id);
      if (current.orderId !== event.order_id || (order.retailcrm_id !== null && String(order.retailcrm_id) !== current.orderId)) throw new Error('CRM order ID mismatch');
      const date = current.updatedAt ? new Date(current.updatedAt) : null;
      if (!date || !order.crm_status_updated_at || date >= order.crm_status_updated_at) {
        await tx.order.update({ where: { id: order.id }, data: { crm_status: current.status,
          crm_status_updated_at: date, crm_status_checked_at: new Date() } });
      }
      await tx.retailCrmEvent.update({ where: { event_id: event.event_id }, data: { processed_at: new Date(), attempts: { increment: 1 }, error: null } });
      return { processed: 1 };
    } catch (error) {
      await tx.retailCrmEvent.update({ where: { event_id: event.event_id }, data: { attempts: { increment: 1 },
        next_attempt_at: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** event.attempts)),
        error: error instanceof Error ? error.message : 'Status processing failed' } });
      return { processed: 0, failed: 1 };
    }
  }, { timeout: 25000, maxWait: 5000 });
}
