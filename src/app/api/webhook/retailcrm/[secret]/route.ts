import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStatusEvent } from '@/lib/retailcrm-status';
export async function POST(request: Request, context: { params: Promise<{ secret: string }> }) {
  const expected = process.env.RETAILCRM_WEBHOOK_SECRET;
  if (!expected || expected.length < 32) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  const { secret } = await context.params;
  const a = Buffer.from(secret); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let event;
  try {
    const text = await request.text();
    if (text.length > 16384) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    event = parseStatusEvent(JSON.parse(text));
  } catch { return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 }); }
  try {
    await prisma.retailCrmEvent.create({ data: { event_id: event.eventId, order_id: event.orderId,
      external_id: event.externalId, status: event.status, status_updated_at: new Date(event.updatedAt) } });
    return NextResponse.json({ success: true, accepted: true }, { status: 202 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: true, duplicate: true });
    }
    return NextResponse.json({ error: 'Could not persist webhook; retry later' }, { status: 503 });
  }
}
