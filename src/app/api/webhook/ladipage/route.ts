import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createRetailCrmOrder,
  type RetailCrmOrderPayload,
} from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';
import { withLogger } from '@/lib/api-logger';
import { rateLimiter } from '@/lib/rate-limiter';

/**
 * Generate a unique externalId from DB order id.
 */
function generateExternalId(orderId: number): string {
  return `ORD-${String(orderId).padStart(5, '0')}`;
}

/**
 * Find the best matching variant by comparing the selected option text.
 * Uses a simple keyword matching approach since LadiPage may send
 * slightly different text than what we stored.
 */
function findMatchingVariant(
  variants: Array<{ id: number; label: string; quantity: number; price: number; delivery_fee: number; size: string | null; xml_id: string | null }>,
  packageText?: string,
  sizeText?: string,
) {
  if (!packageText && variants.length === 1) {
    return variants[0]; // Only one variant, return it
  }

  // Normalize text for comparison
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^\w\d]/g, ' ').replace(/\s+/g, ' ').trim();

  const normalizedPackage = packageText ? normalize(packageText) : '';

  // Score each variant based on keyword overlap
  let bestMatch = variants[0];
  let bestScore = -1;

  for (const variant of variants) {
    let score = 0;
    const normalizedLabel = normalize(variant.label);

    // Check if package text contains key numbers from the label
    if (normalizedPackage) {
      // Extract numbers from both strings for comparison
      const labelNumbers: string[] = normalizedLabel.match(/\d+/g) || [];
      const packageNumbers: string[] = normalizedPackage.match(/\d+/g) || [];

      for (const num of labelNumbers) {
        if (packageNumbers.includes(num)) {
          score += 10;
        }
      }

      // Check word overlap
      const labelWords = normalizedLabel.split(' ').filter(w => w.length > 2);
      const packageWords = normalizedPackage.split(' ').filter(w => w.length > 2);
      for (const word of labelWords) {
        if (packageWords.includes(word)) {
          score += 1;
        }
      }
    }

    // If size is specified, filter by size
    if (sizeText && variant.size) {
      const normalizedSize = normalize(sizeText);
      const variantSize = normalize(variant.size);
      if (normalizedSize.includes(variantSize) || variantSize.includes(normalizedSize)) {
        score += 50; // Strong boost for size match
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant;
    }
  }

  return bestMatch;
}

/**
 * POST /api/webhook/ladipage?api_key=xxx
 *
 * Unified webhook endpoint for ALL LadiPage landing pages.
 * Each LadiPage page is identified by its unique `api_key` query parameter.
 *
 * The api_key maps to a `LandingPage` record in the DB, which tells us
 * which Product this page is selling.
 *
 * LadiPage POS API sends fields mapped in the LadiPage admin:
 * {
 *   "name": "Customer Name",        // mapped from bill_full_name
 *   "phone": "+998901234567",        // mapped from bill_phone_number
 *   "address": "Tashkent...",        // mapped from shipping_address
 *   "products": "1 quti xarid...",   // mapped from note — contains package/variant info
 * }
 *
 * The endpoint will:
 * 1. Look up LandingPage by api_key
 * 2. Look up the associated Product + variants
 * 3. Match the selected package/size to a ProductVariant
 * 4. Create Order in DB
 * 5. Sync to RetailCRM
 */
export const POST = withLogger(async function POST(request: NextRequest) {
  // ── Rate Limiting ───────────────────────────────────────────────────
  // Chống spam: giới hạn request theo IP
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const apiKey = request.nextUrl.searchParams.get('api_key');

  // Có API key → 30 req/phút, không có → 5 req/phút (chặn spam nhanh)
  const rateLimit = apiKey ? 30 : 5;
  const rateLimitKey = apiKey ? `${clientIp}:${apiKey}` : `${clientIp}:nokey`;
  const { allowed, remaining, resetAt } = rateLimiter.check(rateLimitKey, rateLimit, 60_000);

  if (!allowed) {
    console.log(`[LadiPage Webhook] 🚫 Rate limited IP: ${clientIp} (key: ${apiKey ? 'yes' : 'no'})`);
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rateLimit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        },
      },
    );
  }

  // ── Extract api_key from query params ────────────────────────────
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Missing api_key parameter' },
      {
        status: 401,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  try {
    // ── Look up LandingPage by api_key ─────────────────────────────
    const landingPage = await prisma.landingPage.findUnique({
      where: { api_key: apiKey, active: true },
      include: {
        product: {
          include: {
            variants: { where: { active: true } },
          },
        },
      },
    });

    if (!landingPage) {
      console.log(`[LadiPage Webhook] ❌ Landing page not found for api_key: "${apiKey}"`);
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive api_key' },
        { status: 401 },
      );
    }

    const product = landingPage.product;

    // ── Parse body (support both JSON and form-data) ──────────────
    let body: Record<string, string>;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {};
      formData.forEach((value, key) => {
        body[key] = String(value);
      });
    } else {
      // Try JSON first, fallback to error
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Unsupported content type' },
          { status: 400 },
        );
      }
    }

    console.log(`\n[LadiPage Webhook] Received data for page: "${landingPage.name}" (api_key: ${apiKey})`);
    console.log('[LadiPage Webhook] Product:', product.name, `(slug: ${product.slug})`);
    console.log('[LadiPage Webhook] Raw body:', JSON.stringify(body, null, 2));

    // ── Extract fields (flexible field name mapping) ──────────────
    // Standard POS mapping: name, phone, address, products
    // Also support various Vietnamese/Uzbek field names for backward compatibility
    const name = body.name || body.Ism || body.ism || body.ho_ten || body.fullname || body.full_name || '';
    const phone = body.phone || body.Telefon || body.telefon || body['Telefon raqami'] || body.telefon_raqami || body.sdt || '';
    const address = body.address || body.Manzil || body.manzil || body.dia_chi || body['Địa chỉ'] || '';

    // "products" field from POS mapping — contains the selected package/variant info
    const packageOption = body.products || body.package || body.goi || body.variant || body.to_plam || body["to'plam"] || body.combo || '';
    const sizeOption = body.size || body.o_lcham || body["o'lcham"] || body.olcham || body.kich_thuoc || '';

    // ── Validate required fields ─────────────────────────────────
    const errors: string[] = [];
    if (!name) errors.push('name is required');
    if (!phone) errors.push('phone is required');
    if (!address) errors.push('address is required');

    if (errors.length > 0) {
      console.log('[LadiPage Webhook] ❌ Validation failed:', errors);
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    // ── Match variant ────────────────────────────────────────────
    const variants = product.variants.map(v => ({
      id: v.id,
      label: v.label,
      quantity: v.quantity,
      price: Number(v.price),
      delivery_fee: Number(v.delivery_fee),
      size: v.size,
      xml_id: v.xml_id,
    }));

    if (variants.length === 0) {
      console.log('[LadiPage Webhook] ❌ No active variants for product:', product.name);
      return NextResponse.json(
        { success: false, error: 'No product variants configured' },
        { status: 500 },
      );
    }

    const matchedVariant = findMatchingVariant(variants, packageOption, sizeOption);

    console.log(`[LadiPage Webhook] Matched variant: "${matchedVariant.label}" (price: ${matchedVariant.price}, qty: ${matchedVariant.quantity})`);

    // ── Determine xmlId ──────────────────────────────────────────
    const xmlId = matchedVariant.xml_id || product.xml_id || 'PENDING_XML_ID';
    const totalPrice = matchedVariant.price + matchedVariant.delivery_fee;

    // ── Create order in DB ───────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        external_id: `TEMP-${Date.now()}`,
        customer_name: name,
        customer_phone: phone,
        delivery_address: address,
        items_json: JSON.stringify([{
          xmlId,
          quantity: matchedVariant.quantity,
          initialPrice: matchedVariant.price,
          productName: product.name,
          variantLabel: matchedVariant.label,
          size: matchedVariant.size || undefined,
          deliveryFee: matchedVariant.delivery_fee,
        }]),
        total_price: totalPrice,
        source: 'ladipage',
        landing_slug: product.slug,
        selected_package: packageOption || matchedVariant.label,
        selected_size: sizeOption || matchedVariant.size || null,
        sync_status: 'PENDING',
      },
    });

    // ── Generate externalId ──────────────────────────────────────
    const externalId = generateExternalId(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { external_id: externalId },
    });

    console.log(`[LadiPage Webhook] Order #${order.id} created → externalId: ${externalId} (page: ${landingPage.name})`);

    // ── Sync to RetailCRM ────────────────────────────────────────
    const payload: RetailCrmOrderPayload = {
      externalId,
      firstName: name,
      phone,
      delivery: {
        address: {
          countryIso: 'UZ',
          text: address,
        },
      },
      items: [{
        xmlId,
        quantity: matchedVariant.quantity,
        initialPrice: matchedVariant.price,
      }],
    };

    const syncResult = await createRetailCrmOrder(payload);
    const durationMs = syncResult.completedAt.getTime() - syncResult.sentAt.getTime();
    const dbSyncStatus: OrderSyncStatus = syncResult.status as OrderSyncStatus;

    // ── Update order + log ───────────────────────────────────────
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          sync_status: dbSyncStatus,
          sync_message:
            syncResult.status === 'SUCCESS'
              ? `Synced (RetailCRM ID: ${syncResult.response?.id})`
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

    // ── Response ──────────────────────────────────────────────────
    return NextResponse.json({
      success: syncResult.status === 'SUCCESS',
      orderId: order.id,
      externalId,
      syncStatus: dbSyncStatus,
    });
  } catch (error) {
    console.error(`[LadiPage Webhook] Error for api_key "${apiKey}":`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
});
