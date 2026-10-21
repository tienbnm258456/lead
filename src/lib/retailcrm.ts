/**
 * RetailCRM API Service
 * Handles communication with UzShopping RetailCRM system
 *
 * Features:
 *   - Auto-retry: 3 lần với backoff (0s → 2s → 5s)
 *   - Chỉ retry cho timeout + lỗi mạng, KHÔNG retry cho lỗi validation (4xx)
 *   - Log chi tiết mỗi lần gọi
 */

const RETAILCRM_BASE_URL = process.env.RETAILCRM_BASE_URL || 'https://uzshopping.retailcrm.ru/api/v5';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
const RETAILCRM_SITE = process.env.RETAILCRM_SITE || 'uzshopping';
const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds

// ─── Retry Config ────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [0, 2_000, 5_000]; // Lần 1: ngay, Lần 2: 2s, Lần 3: 5s

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
  /** Số lần đã thử (1 = thành công lần đầu, 2-3 = có retry) */
  retryCount: number;
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

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if a failed result should be retried.
 * Only retry for timeout + network errors (5xx), NOT for validation errors (4xx).
 */
function shouldRetry(result: SingleAttemptResult): boolean {
  // Timeout → always retry
  if (result.status === 'TIMEOUT') return true;

  // Network exception (no httpStatus) → retry
  if (result.status === 'FAILED' && !result.httpStatus) return true;

  // Server error (5xx) → retry
  if (result.httpStatus && result.httpStatus >= 500) return true;

  // Client error (4xx) → DON'T retry (validation error, sẽ fail giống y vậy)
  return false;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

interface SingleAttemptResult {
  status: RetailCrmSyncStatus;
  httpStatus?: number;
  response?: RetailCrmResponse;
  errorMessage?: string;
  sentAt: Date;
  completedAt: Date;
}

// ─── Single Attempt ──────────────────────────────────────────────────────────

/**
 * Make a single API call to RetailCRM (no retry logic).
 */
async function singleAttempt(
  url: string,
  formBody: string,
): Promise<SingleAttemptResult> {
  const sentAt = new Date();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const completedAt = new Date();
    const responseBody: RetailCrmResponse = await response.json();

    if (response.ok && responseBody.success) {
      return { status: 'SUCCESS', httpStatus: response.status, response: responseBody, sentAt, completedAt };
    }

    const errorMessage =
      responseBody.errorMsg ||
      (responseBody.errors ? Object.values(responseBody.errors).join('; ') : `HTTP ${response.status}`);

    return { status: 'FAILED', httpStatus: response.status, response: responseBody, errorMessage, sentAt, completedAt };
  } catch (error: unknown) {
    const completedAt = new Date();

    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'TIMEOUT', errorMessage: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`, sentAt, completedAt };
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return { status: 'FAILED', errorMessage: message, sentAt, completedAt };
  }
}

// ─── Core API Call (with Auto-Retry) ─────────────────────────────────────────

/**
 * Create an order in RetailCRM via their v5 API.
 *
 * Auto-retry flow:
 *   Lần 1: Gọi ngay
 *   Lần 2: Chờ 2s → retry (chỉ nếu timeout/network/5xx)
 *   Lần 3: Chờ 5s → retry (chỉ nếu timeout/network/5xx)
 *   → Nếu vẫn fail → trả kết quả cuối cùng
 *
 * KHÔNG retry cho lỗi validation (4xx) vì sẽ fail giống y vậy.
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
      retryCount: 0,
    };
  }

  const url = `${RETAILCRM_BASE_URL}/orders/create?apiKey=${encodeURIComponent(key)}`;

  // RetailCRM expects form-data with site and order fields
  const orderJson = JSON.stringify(buildOrderPayload(payload));
  const formData = new URLSearchParams();
  formData.append('site', RETAILCRM_SITE);
  formData.append('order', orderJson);
  const formBody = formData.toString();

  const overallSentAt = new Date();

  // ── Log: Request ────────────────────────────────────────────────
  console.log('\n┌──────────────────────────────────────────────────────');
  console.log('│ 📤 [RetailCRM] Sending order to RetailCRM');
  console.log('│ URL:', `${RETAILCRM_BASE_URL}/orders/create`);
  console.log('│ ExternalId:', payload.externalId);
  console.log('│ Customer:', payload.firstName, '|', payload.phone);
  console.log('│ Items:', payload.items.length, 'item(s)');
  console.log('│ Payload:', orderJson);
  console.log('│ Sent at:', overallSentAt.toISOString());
  console.log('│ Max retries:', MAX_RETRIES);
  console.log('├──────────────────────────────────────────────────────');

  let lastResult: SingleAttemptResult | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Delay before retry (lần 1 = 0ms, lần 2 = 2s, lần 3 = 5s)
    const delay = RETRY_DELAYS_MS[attempt - 1] || 0;
    if (delay > 0) {
      console.log(`│ ⏳ [RetailCRM] Waiting ${delay / 1000}s before retry #${attempt}...`);
      await sleep(delay);
    }

    console.log(`│ 🔄 [RetailCRM] Attempt ${attempt}/${MAX_RETRIES}`);

    lastResult = await singleAttempt(url, formBody);
    const durationMs = lastResult.completedAt.getTime() - lastResult.sentAt.getTime();

    if (lastResult.status === 'SUCCESS') {
      // ── Log: Success ──────────────────────────────────────────
      console.log('│ ✅ [RetailCRM] SUCCESS');
      console.log('│ HTTP Status:', lastResult.httpStatus);
      console.log('│ RetailCRM Order ID:', lastResult.response?.id);
      console.log('│ Duration:', durationMs, 'ms');
      if (attempt > 1) console.log(`│ ✨ Succeeded on retry #${attempt}`);
      console.log('│ Response:', JSON.stringify(lastResult.response, null, 2).split('\n').join('\n│ '));
      console.log('└──────────────────────────────────────────────────────\n');

      return {
        status: 'SUCCESS',
        httpStatus: lastResult.httpStatus,
        response: lastResult.response,
        requestPayload: payload,
        sentAt: overallSentAt,
        completedAt: lastResult.completedAt,
        retryCount: attempt,
      };
    }

    // Log lỗi cho attempt này
    if (lastResult.status === 'TIMEOUT') {
      console.log('│ ⏱️ [RetailCRM] TIMEOUT');
      console.log('│ Duration:', durationMs, 'ms');
    } else {
      console.log('│ ❌ [RetailCRM] FAILED');
      console.log('│ HTTP Status:', lastResult.httpStatus || 'N/A');
      console.log('│ Error:', lastResult.errorMessage);
      console.log('│ Duration:', durationMs, 'ms');
    }

    // Kiểm tra có nên retry không
    if (attempt < MAX_RETRIES && shouldRetry(lastResult)) {
      console.log(`│ 🔁 Will retry (${lastResult.status} is retryable)`);
      continue;
    }

    // Không retry: lỗi validation (4xx) hoặc đã hết lượt
    if (!shouldRetry(lastResult)) {
      console.log('│ ⛔ Not retryable (client error / validation)');
    } else {
      console.log(`│ ⛔ All ${MAX_RETRIES} attempts exhausted`);
    }
    break;
  }

  // ── Log: Final failure ────────────────────────────────────────────
  if (lastResult?.response) {
    console.log('│ Response:', JSON.stringify(lastResult.response, null, 2).split('\n').join('\n│ '));
  }
  console.log('└──────────────────────────────────────────────────────\n');

  return {
    status: lastResult?.status || 'FAILED',
    httpStatus: lastResult?.httpStatus,
    response: lastResult?.response,
    errorMessage: lastResult?.errorMessage || 'All retry attempts failed',
    requestPayload: payload,
    sentAt: overallSentAt,
    completedAt: lastResult?.completedAt || new Date(),
    retryCount: MAX_RETRIES,
  };
}

