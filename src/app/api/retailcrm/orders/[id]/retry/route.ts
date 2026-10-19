import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRetailCrmOrder, type RetailCrmOrderPayload } from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/retailcrm/orders/[id]/retry
 *
 * Retry syncing a failed/timeout order to RetailCRM.
 * Only orders with sync_status FAILED or TIMEOUT can be retried.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 },
      );
    }

    // ── Fetch order ───────────────────────────────────────────────────
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    if (order.sync_status === 'SUCCESS') {
      return NextResponse.json(
        { success: false, error: 'Order already synced successfully' },
        { status: 400 },
      );
    }

    if (order.sync_status === 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Order is currently being synced' },
        { status: 400 },
      );
    }

    // ── Update status to PENDING before retrying ──────────────────────
    await prisma.order.update({
      where: { id: orderId },
      data: { sync_status: 'PENDING' },
    });

    // ── Rebuild payload from stored data ──────────────────────────────
    const items = JSON.parse(order.items_json) as Array<{
      xmlId: string;
      quantity: number;
      initialPrice: number;
    }>;

    const nameParts = order.customer_name.split(' ');
    const payload: RetailCrmOrderPayload = {
      externalId: order.external_id,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || undefined,
      phone: order.customer_phone,
      delivery: {
        address: {
          countryIso: 'UZ',
          text: order.delivery_address,
        },
      },
      items,
    };

    // ── Call RetailCRM ────────────────────────────────────────────────
    const syncResult = await createRetailCrmOrder(payload);
    const durationMs = syncResult.completedAt.getTime() - syncResult.sentAt.getTime();
    const dbSyncStatus: OrderSyncStatus = syncResult.status as OrderSyncStatus;

    // ── Update order + create sync log ────────────────────────────────
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          sync_status: dbSyncStatus,
          sync_message:
            syncResult.status === 'SUCCESS'
              ? `Order synced on retry (RetailCRM ID: ${syncResult.response?.id})`
              : syncResult.errorMessage || null,
          retailcrm_id: syncResult.response?.id || null,
          synced_at: syncResult.completedAt,
        },
      }),
      prisma.orderSyncLog.create({
        data: {
          order_id: orderId,
          status: dbSyncStatus,
          http_status: syncResult.httpStatus || null,
          request_payload: JSON.stringify(payload),
          response_body: syncResult.response ? JSON.stringify(syncResult.response) : null,
          error_message: syncResult.errorMessage || null,
          duration_ms: durationMs,
        },
      }),
    ]);

    const httpStatus =
      syncResult.status === 'SUCCESS' ? 200 :
      syncResult.status === 'TIMEOUT' ? 504 : 502;

    return NextResponse.json(
      {
        success: syncResult.status === 'SUCCESS',
        order: {
          id: updatedOrder.id,
          externalId: updatedOrder.external_id,
          syncStatus: updatedOrder.sync_status,
          syncMessage: updatedOrder.sync_message,
          retailcrmId: updatedOrder.retailcrm_id,
          syncedAt: updatedOrder.synced_at?.toISOString(),
        },
        sync: {
          status: syncResult.status,
          httpStatus: syncResult.httpStatus,
          durationMs,
          errorMessage: syncResult.errorMessage,
        },
      },
      { status: httpStatus },
    );
  } catch (error) {
    console.error('Error retrying order sync:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
