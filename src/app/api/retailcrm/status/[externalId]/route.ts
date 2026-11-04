import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { dataScope } from '@/lib/permissions';
import { getRetailCrmStatus } from '@/lib/retailcrm-status';
export async function GET(_request: Request, context: { params: Promise<{ externalId: string }> }) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const { externalId } = await context.params;
  const order = await prisma.order.findFirst({ where: { external_id: externalId, ...dataScope(auth.user) } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  try { return NextResponse.json({ success: true, data: await getRetailCrmStatus(externalId) }); }
  catch { return NextResponse.json({ error: 'Không lấy được trạng thái từ RetailCRM' }, { status: 502 }); }
}
