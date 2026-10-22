import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createRetailCrmOrder,
  type RetailCrmOrderPayload,
} from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';
import { generateExternalId } from '@/lib/order-id';
import { requireAuth } from '@/lib/require-auth';

/**
 * POST /api/retailcrm/orders/sync
 *
 * Full flow: Create order in DB → Auto-gen externalId → Sync to RetailCRM → Update status + log.
 *
 * Request body (JSON):
 * {
 *   "firstName": "Ali Valiyev",
 *   "phone": "+998901234567",
 *   "delivery": {
 *     "address": {
 *       "countryIso": "UZ",
 *       "city": "Бухара",
 *       "text": "Бухоро, ул. Абдурахмана 15"
 *     }
 *   },
 *   "items": [
 *     { "xmlId": "abc-123", "quantity": 1, "initialPrice": 250 }
 *   ]
 * }
 *
 * externalId is auto-generated as ORD-{orderId} (e.g. ORD-00001)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    // ── Validation ────────────────────────────────────────────────────
    const errors: string[] = [];
    if (!body.firstName) errors.push('firstName is required');
    if (!body.phone) errors.push('phone is required');
    if (!body.delivery?.address?.text) errors.push('delivery.address.text is required');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      errors.push('items must be a non-empty array');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    // ── Calculate total price ─────────────────────────────────────────
    const totalPrice = body.items.reduce(
      (sum: number, item: { initialPrice: number; quantity: number }) =>
        sum + item.initialPrice * item.quantity,
      0,
    );

    // ── Step 1: Create order in DB with PENDING status + temp externalId
    const order = await prisma.order.create({
      data: {
        external_id: `TEMP-${Date.now()}`, // temporary, will be updated below
        customer_name: body.firstName + (body.lastName ? ` ${body.lastName}` : ''),
        customer_phone: body.phone,
        delivery_address: body.delivery.address.text,
        items_json: JSON.stringify(body.items),
        total_price: totalPrice,
        sync_status: 'PENDING',
      },
    });

    // ── Step 2: Generate externalId from DB order id ───────────────────
    const externalId = generateExternalId(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { external_id: externalId },
    });

    console.log(`[Order] Created order #${order.id} → externalId: ${externalId}`);

    // ── Step 3: Call RetailCRM API ────────────────────────────────────
    const payload: RetailCrmOrderPayload = {
      externalId,
      firstName: body.firstName,
      phone: body.phone,
      lastName: body.lastName,
      delivery: {
        address: {
          countryIso: body.delivery.address.countryIso || 'UZ',
          city: body.delivery.address.city || '',
          text: body.delivery.address.text,
        },
      },
      items: body.items.map((item: { xmlId: string; quantity: number; initialPrice: number }) => ({
        xmlId: item.xmlId,
        quantity: item.quantity,
        initialPrice: item.initialPrice,
      })),
    };

    const syncResult = await createRetailCrmOrder(payload);
    const durationMs = syncResult.completedAt.getTime() - syncResult.sentAt.getTime();

    // ── Step 4: Update order status + create sync log ─────────────────
    const dbSyncStatus: OrderSyncStatus = syncResult.status as OrderSyncStatus;

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          sync_status: dbSyncStatus,
          sync_message:
            syncResult.status === 'SUCCESS'
              ? `Order created successfully (RetailCRM ID: ${syncResult.response?.id})`
              : syncResult.errorMessage || null,
          retailcrm_id: syncResult.response?.id || null,
          synced_at: syncResult.completedAt,
        },
      }),
      prisma.orderSyncLog.create({
        data: {
          order_id: order.id,
          status: dbSyncStatus,
          http_status: syncResult.httpStatus || null,
          request_payload: JSON.stringify(payload),
          response_body: syncResult.response ? JSON.stringify(syncResult.response) : null,
          error_message: syncResult.errorMessage || null,
          duration_ms: durationMs,
        },
      }),
    ]);

    // ── Response ──────────────────────────────────────────────────────
    const httpStatus =
      syncResult.status === 'SUCCESS' ? 201 :
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
          createdAt: updatedOrder.created_at.toISOString(),
        },
        sync: {
          status: syncResult.status,
          httpStatus: syncResult.httpStatus,
          durationMs,
          errorMessage: syncResult.errorMessage,
          retailcrmResponse: syncResult.response,
        },
      },
      { status: httpStatus },
    );
  } catch (error: unknown) {
    console.error('Error in order sync:', error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
