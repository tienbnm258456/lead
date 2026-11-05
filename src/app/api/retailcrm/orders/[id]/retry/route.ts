import { ensureOfferXmlIds, resolveLandingItems, SelectionError } from '@/lib/ladipage-order';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRetailCrmOrder, type RetailCrmOrderPayload } from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/require-auth';

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
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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

    let items = JSON.parse(order.items_json) as Array<{
      xmlId: string; quantity: number; initialPrice: number; deliveryFee?: number;
      rawPayload?: Record<string, unknown>; selectionError?: string;
    }>;
    if (items[0]?.selectionError) {
      const page = await prisma.landingPage.findFirst({ where: { product: { slug: order.landing_slug || '' } },
        include: { product: { include: { variants: { where: { active: true } } } } } });
      if (!page) return NextResponse.json({ error: 'Landing page không còn tồn tại' }, { status: 400 });
      const body = items[0].rawPayload || {};
      try {
        const resolved = resolveLandingItems((page.product.xml_id ? page.product.variants : await ensureOfferXmlIds(prisma, page.product.variants)).map(v => ({ ...v, price: Number(v.price), delivery_fee: Number(v.delivery_fee) })),
          body.products || body.package || body.goi || body.variant || body.to_plam || body["to'plam"] || body.combo,
          body.size || body.o_lcham || body["o'lcham"] || body.olcham || body.kich_thuoc, page.product);
        items = resolved.items;
        await prisma.order.update({ where: { id: orderId }, data: { items_json: JSON.stringify(items), total_price: resolved.totalPrice } });
      } catch (error) {
        if (error instanceof SelectionError) return NextResponse.json({ error: error.message, requiresReview: true }, { status: 422 });
        throw error;
      }
    }
    if (!items.length || items.some(item => !item.xmlId || item.xmlId === 'PENDING_XML_ID')) {
      return NextResponse.json({ error: 'Chưa có XML ID hợp lệ cho tất cả dòng hàng' }, { status: 422 });
    }
    await prisma.order.update({ where: { id: orderId }, data: { sync_status: 'PENDING' } });

    const nameParts = order.customer_name.split(' ');
    const payload: RetailCrmOrderPayload = {
      externalId: order.external_id,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || undefined,
      phone: order.customer_phone,
      delivery: {
        cost: items.reduce((sum, item) => sum + (Number(item.deliveryFee) || 0), 0),
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
