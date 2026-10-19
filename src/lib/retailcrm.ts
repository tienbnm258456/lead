/**
 * RetailCRM API Service
 * Handles communication with UzShopping RetailCRM system
 */

const RETAILCRM_BASE_URL = 'https://uzshopping.retailcrm.ru/api/v5';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
const RETAILCRM_SITE = 'uzshopping';
const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds

// ─── Types ───────────────────────────────────────────────────────────────────

export type RetailCrmSyncStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface RetailCrmOrderItem {
  xmlId: string;
  quantity: number;
  /** Unit price in thousands of UZS (e.g. 250 = 250,000 UZS) */
  initialPrice: number;
}

export interface RetailCrmDeliveryAddress {
  countryIso?: string;
  city?: string;
  text: string; // full delivery address
}

export interface RetailCrmOrderPayload {
  externalId: string;
  firstName: string;
  phone: string;
  lastName?: string;
  delivery: {
    address: RetailCrmDeliveryAddress;
  };
  items: RetailCrmOrderItem[];
}

export interface RetailCrmResponse {
  success: boolean;
  id?: number;
  order?: Record<string, unknown>;
  errorMsg?: string;
  errors?: Record<string, string>;
}

export interface RetailCrmSyncResult {
  status: RetailCrmSyncStatus;
  httpStatus?: number;
  response?: RetailCrmResponse;
  errorMessage?: string;
  requestPayload: RetailCrmOrderPayload;
  sentAt: Date;
  completedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the order JSON payload matching RetailCRM v5 format
 */
export function buildOrderPayload(data: RetailCrmOrderPayload): Record<string, unknown> {
  return {
    externalId: data.externalId,
    firstName: data.firstName,
    phone: data.phone,
    ...(data.lastName && { lastName: data.lastName }),
    delivery: {
      address: {
        countryIso: data.delivery.address.countryIso || 'UZ',
        city: data.delivery.address.city || '',
        text: data.delivery.address.text,
      },
    },
    items: data.items.map((item) => ({
      offer: { xmlId: item.xmlId },
      quantity: item.quantity,
      initialPrice: item.initialPrice,
    })),
  };
}

// ─── Core API Call ───────────────────────────────────────────────────────────

/**
 * Create an order in RetailCRM via their v5 API.
 *
 * Flow:
 *  1. Build the form-data body (site + order JSON)
 *  2. POST to /orders/create with a timeout
 *  3. Return a structured result with status categorisation
 */
export async function createRetailCrmOrder(
  payload: RetailCrmOrderPayload,
  apiKey?: string,
): Promise<RetailCrmSyncResult> {
  const key = apiKey || RETAILCRM_API_KEY;
  if (!key) {
    return {
      status: 'FAILED',
      errorMessage: 'RETAILCRM_API_KEY is not configured',
      requestPayload: payload,
      sentAt: new Date(),
      completedAt: new Date(),
    };
  }

  const url = `${RETAILCRM_BASE_URL}/orders/create?apiKey=${encodeURIComponent(key)}`;

  // RetailCRM expects form-data with site and order fields
  const orderJson = JSON.stringify(buildOrderPayload(payload));
  const formData = new URLSearchParams();
  formData.append('site', RETAILCRM_SITE);
  formData.append('order', orderJson);

  const sentAt = new Date();

  // ── Log: Request ────────────────────────────────────────────────
  console.log('\n┌──────────────────────────────────────────────────────');
  console.log('│ 📤 [RetailCRM] Sending order to RetailCRM');
  console.log('│ URL:', `${RETAILCRM_BASE_URL}/orders/create`);
  console.log('│ ExternalId:', payload.externalId);
  console.log('│ Customer:', payload.firstName, '|', payload.phone);
  console.log('│ Items:', payload.items.length, 'item(s)');
  console.log('│ Payload:', orderJson);
  console.log('│ Sent at:', sentAt.toISOString());
  console.log('├──────────────────────────────────────────────────────');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - sentAt.getTime();

    const responseBody: RetailCrmResponse = await response.json();

    if (response.ok && responseBody.success) {
      // ── Log: Success ──────────────────────────────────────────
      console.log('│ ✅ [RetailCRM] SUCCESS');
      console.log('│ HTTP Status:', response.status);
      console.log('│ RetailCRM Order ID:', responseBody.id);
      console.log('│ Duration:', durationMs, 'ms');
      console.log('│ Response:', JSON.stringify(responseBody, null, 2).split('\n').join('\n│ '));
      console.log('└──────────────────────────────────────────────────────\n');

      return {
        status: 'SUCCESS',
        httpStatus: response.status,
        response: responseBody,
        requestPayload: payload,
        sentAt,
        completedAt,
      };
    }

    // ── Log: API Error ────────────────────────────────────────────
    const errorMessage =
      responseBody.errorMsg ||
      (responseBody.errors
        ? Object.values(responseBody.errors).join('; ')
        : `HTTP ${response.status}`);

    console.log('│ ❌ [RetailCRM] FAILED');
    console.log('│ HTTP Status:', response.status);
    console.log('│ Error:', errorMessage);
    console.log('│ Duration:', durationMs, 'ms');
    console.log('│ Response:', JSON.stringify(responseBody, null, 2).split('\n').join('\n│ '));
    console.log('└──────────────────────────────────────────────────────\n');

    return {
      status: 'FAILED',
      httpStatus: response.status,
      response: responseBody,
      errorMessage,
      requestPayload: payload,
      sentAt,
      completedAt,
    };
  } catch (error: unknown) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - sentAt.getTime();

    // Distinguish timeout from other failures
    if (error instanceof DOMException && error.name === 'AbortError') {
      // ── Log: Timeout ──────────────────────────────────────────
      console.log('│ ⏱️ [RetailCRM] TIMEOUT');
      console.log('│ Duration:', durationMs, 'ms (limit:', REQUEST_TIMEOUT_MS, 'ms)');
      console.log('└──────────────────────────────────────────────────────\n');

      return {
        status: 'TIMEOUT',
        errorMessage: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        requestPayload: payload,
        sentAt,
        completedAt,
      };
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // ── Log: Exception ────────────────────────────────────────────
    console.log('│ 💥 [RetailCRM] EXCEPTION');
    console.log('│ Error:', message);
    console.log('│ Duration:', durationMs, 'ms');
    console.log('└──────────────────────────────────────────────────────\n');

    return {
      status: 'FAILED',
      errorMessage: message,
      requestPayload: payload,
      sentAt,
      completedAt,
    };
  }
}
