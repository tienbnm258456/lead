import { NextRequest, NextResponse } from 'next/server';
import {
  createRetailCrmOrder,
  type RetailCrmOrderPayload,
  type RetailCrmSyncResult,
} from '@/lib/retailcrm';

/**
 * POST /api/retailcrm/orders
 *
 * Create an order in RetailCRM.
 * Use this endpoint to test via Postman before integrating with the full order flow.
 *
 * Request body (JSON):
 * {
 *   "externalId": "GF-10001",
 *   "firstName": "Ali Valiyev",
 *   "phone": "+998901234567",
 *   "delivery": {
 *     "address": {
 *       "countryIso": "UZ",
 *       "city": "Бухара",
 *       "text": "Бухоро"
 *     }
 *   },
 *   "items": [
 *     { "xmlId": "abc-123", "quantity": 1, "initialPrice": 250 }
 *   ]
 * }
 *
 * Response:
 * {
 *   "success": true/false,
 *   "syncResult": { status, httpStatus, response, errorMessage, sentAt, completedAt }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Basic validation ──────────────────────────────────────────────
    const errors: string[] = [];

    if (!body.externalId || typeof body.externalId !== 'string') {
      errors.push('externalId is required and must be a string');
    }
    if (!body.firstName || typeof body.firstName !== 'string') {
      errors.push('firstName is required and must be a string');
    }
    if (!body.phone || typeof body.phone !== 'string') {
      errors.push('phone is required and must be a string');
    }
    if (!body.delivery?.address?.text) {
      errors.push('delivery.address.text is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      errors.push('items must be a non-empty array');
    } else {
      body.items.forEach((item: Record<string, unknown>, idx: number) => {
        if (!item.xmlId) errors.push(`items[${idx}].xmlId is required`);
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1) {
          errors.push(`items[${idx}].quantity must be a positive number`);
        }
        if (item.initialPrice === undefined || typeof item.initialPrice !== 'number') {
          errors.push(`items[${idx}].initialPrice is required and must be a number`);
        }
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    // ── Build payload ─────────────────────────────────────────────────
    const payload: RetailCrmOrderPayload = {
      externalId: body.externalId,
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
      items: body.items.map((item: Record<string, unknown>) => ({
        xmlId: item.xmlId as string,
        quantity: item.quantity as number,
        initialPrice: item.initialPrice as number,
      })),
    };

    // ── Call RetailCRM ────────────────────────────────────────────────
    const syncResult: RetailCrmSyncResult = await createRetailCrmOrder(payload);

    const httpStatus = syncResult.status === 'SUCCESS' ? 200 : 
                       syncResult.status === 'TIMEOUT' ? 504 : 502;

    return NextResponse.json(
      {
        success: syncResult.status === 'SUCCESS',
        syncResult: {
          status: syncResult.status,
          httpStatus: syncResult.httpStatus,
          response: syncResult.response,
          errorMessage: syncResult.errorMessage,
          sentAt: syncResult.sentAt.toISOString(),
          completedAt: syncResult.completedAt.toISOString(),
          durationMs:
            syncResult.completedAt.getTime() - syncResult.sentAt.getTime(),
        },
      },
      { status: httpStatus },
    );
  } catch (error) {
    console.error('Error in RetailCRM order creation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
