import { randomUUID } from 'node:crypto';

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
export async function getRetailCrmStatus(externalId: string, eventId?: string): Promise<CrmStatus> {
  const key = process.env.RETAILCRM_API_KEY;
  const site = process.env.RETAILCRM_STATUS_SITE || process.env.RETAILCRM_SITE;
  if (!key || !site) throw new Error('Configure RETAILCRM_API_KEY and RETAILCRM_SITE');
  const base = (process.env.RETAILCRM_BASE_URL || 'https://uzshopping.retailcrm.ru/api/v5').replace(/\/$/, '');
  const url = new URL(base + '/orders/' + encodeURIComponent(externalId));
  url.search = new URLSearchParams({ apiKey: key, by: 'externalId', site }).toString();
  const requestId = randomUUID();
  const started = Date.now();
  const redact = (value: string) => {
    for (const secret of [key, process.env.RETAILCRM_WEBHOOK_SECRET, process.env.CRON_SECRET]) {
      if (secret) value = value.split(secret).join('[REDACTED]').split(encodeURIComponent(secret)).join('[REDACTED]');
    }
    return value;
  };
  const safeUrl = new URL(url); safeUrl.searchParams.set('apiKey', '[REDACTED]');
  const log = (phase: string, details: Record<string, unknown>) => console.log('[RetailCRM Status] ' + phase + ' ' + redact(JSON.stringify({
    requestId, externalId, ...(eventId ? { eventId } : {}), ...details,
  }, (_key, value) => /^(api_?key|authorization|password|secret|access_?token|refresh_?token)$/i.test(_key) ? '[REDACTED]' : value, 2)));
  log('REQUEST', { method: 'GET', url: safeUrl.toString(), body: null });
  let response: Response;
  let raw: string;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    raw = await response.text();
  } catch {
    log('ERROR', { durationMs: Date.now() - started, error: 'Request failed or timed out' });
    throw new Error('RetailCRM status request failed or timed out');
  }
  let data;
  try { data = JSON.parse(raw); }
  catch {
    log('RESPONSE', { httpStatus: response.status, durationMs: Date.now() - started, body: raw, invalidJson: true });
    throw new Error(response.ok ? 'Invalid RetailCRM JSON response' : 'RetailCRM HTTP ' + response.status);
  }
  log('RESPONSE', { httpStatus: response.status, durationMs: Date.now() - started, body: data });
  if (!response.ok) throw new Error('RetailCRM HTTP ' + response.status);
  const order = data && typeof data === 'object' ? data.order : undefined;
  if (data?.success !== true || !order || String(order.externalId) !== externalId ||
    !/^\d+$/.test(String(order.id)) || typeof order.status !== 'string' || !order.status || order.status.length > 255) {
    throw new Error('Invalid RetailCRM order response');
  }
  // GET order may omit this field; never substitute the trigger timestamp for the current state.
  const updatedAt = typeof order.statusUpdatedAt === 'string' && Number.isFinite(Date.parse(order.statusUpdatedAt))
    ? order.statusUpdatedAt : null;
  return { orderId: String(order.id), externalId, status: order.status, updatedAt };
}
