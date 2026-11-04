export interface CrmStatus {
  orderId: string; externalId: string; status: string; updatedAt: string | null;
}
export interface StatusEvent { eventId: string; orderId: string; externalId: string; status: string; updatedAt: string }
export function parseStatusEvent(value: unknown): StatusEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  const body = value as Record<string, unknown>;
  for (const [key, max] of Object.entries({ eventId: 500, orderId: 100, externalId: 100, status: 255, updatedAt: 80 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > max) throw new Error('Invalid ' + key);
  }
  if (!/^\d+$/.test(body.orderId as string) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.updatedAt as string) ||
    !Number.isFinite(Date.parse(body.updatedAt as string))) throw new Error('Invalid orderId or updatedAt');
  return Object.fromEntries(['eventId', 'orderId', 'externalId', 'status', 'updatedAt'].map(key => [key, (body[key] as string).trim()])) as unknown as StatusEvent;
}
export async function getRetailCrmStatus(externalId: string): Promise<CrmStatus> {
  const key = process.env.RETAILCRM_API_KEY;
  const site = process.env.RETAILCRM_SITE;
  if (!key || !site) throw new Error('Configure RETAILCRM_API_KEY and RETAILCRM_SITE');
  const base = (process.env.RETAILCRM_BASE_URL || 'https://uzshopping.retailcrm.ru/api/v5').replace(/\/$/, '');
  const url = new URL(base + '/orders/' + encodeURIComponent(externalId));
  url.search = new URLSearchParams({ apiKey: key, by: 'externalId', site }).toString();
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('RetailCRM status request failed or timed out'); }
  if (!response.ok) throw new Error('RetailCRM HTTP ' + response.status);
  const data = await response.json();
  const order = data.order;
  if (data.success !== true || !order || String(order.externalId) !== externalId ||
    !/^\d+$/.test(String(order.id)) || typeof order.status !== 'string' || !order.status || order.status.length > 255) {
    throw new Error('Invalid RetailCRM order response');
  }
  // GET order may omit this field; never substitute the trigger timestamp for the current state.
  const updatedAt = typeof order.statusUpdatedAt === 'string' && Number.isFinite(Date.parse(order.statusUpdatedAt))
    ? order.statusUpdatedAt : null;
  return { orderId: String(order.id), externalId, status: order.status, updatedAt };
}
