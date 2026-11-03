import { ensureOfferXmlIds, readLandingBody, scalar, selections, resolveLandingItems, SelectionError } from '@/lib/ladipage-order';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createRetailCrmOrder,
  type RetailCrmOrderPayload,
} from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';
import { withLogger } from '@/lib/api-logger';
import { rateLimiter } from '@/lib/rate-limiter';
import { generateExternalId } from '@/lib/order-id';

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
      where: { api_key: apiKey, active: true, deleted_at: null },
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
    const body = await readLandingBody(request);

    console.log(`\n[LadiPage Webhook] Received data for page: "${landingPage.name}" (api_key: ${apiKey})`);
    console.log('[LadiPage Webhook] Product:', product.name, `(slug: ${product.slug})`);
    console.log('[LadiPage Webhook] Raw body:', JSON.stringify(body, null, 2));

    // ── Extract fields (flexible field name mapping) ──────────────
    // Standard POS mapping: name, phone, address, products
    // Also support various Vietnamese/Uzbek field names for backward compatibility
    const name = scalar(body.name || body.Ism || body.ism || body.ho_ten || body.fullname || body.full_name || '');
    const phone = scalar(body.phone || body.Telefon || body.telefon || body['Telefon raqami'] || body.telefon_raqami || body.sdt || '');
    const address = scalar(body.address || body.Manzil || body.manzil || body.dia_chi || body['Địa chỉ'] || '');

    // "products" field from POS mapping — contains the selected package/variant info
    const packageSelections = selections(body.products || body.package || body.goi || body.variant || body.to_plam || body["to'plam"] || body.combo || '');
    const packageOption = packageSelections.join(" | ");
    const sizeSelections = selections(body.size || body.o_lcham || body["o'lcham"] || body.olcham || body.kich_thuoc || '');
    const sizeOption = sizeSelections.join(" | ");

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
    const variants = (await ensureOfferXmlIds(prisma, product.variants)).map(v => ({
      id: v.id,
      label: v.label,
      quantity: v.quantity,
      price: Number(v.price),
      delivery_fee: Number(v.delivery_fee),
      size: v.size,
      xml_id: v.xml_id,
      promotion: v.promotion,
    }));

    if (variants.length === 0) {
      console.log('[LadiPage Webhook] ❌ No active variants for product:', product.name);
      return NextResponse.json(
        { success: false, error: 'No product variants configured' },
        { status: 500 },
      );
    }

    let resolved;
    let selectionError: string | null = null;
    try {
      resolved = resolveLandingItems(variants, packageSelections, sizeSelections, product);
    } catch (error) {
      if (!(error instanceof SelectionError)) throw error;
      selectionError = error.message;
    }
    const items = resolved?.items || [{
      rawPayload: body, selectionError, quantity: 1, initialPrice: 0, deliveryFee: 0,
      productName: product.name, variantLabel: packageOption,
    }];
    const totalPrice = resolved?.totalPrice || 0;

    // ── Create order in DB ───────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        external_id: `TEMP-${Date.now()}`,
        customer_name: name,
        customer_phone: phone,
        delivery_address: address,
        items_json: JSON.stringify(items.map((item, index) => index === 0 ? { ...item, rawPayload: body } : item)),
        total_price: totalPrice,
        source: 'ladipage',
        landing_slug: product.slug,
        group_id: landingPage.group_id,
        landing_page_id: landingPage.id,
        selected_package: packageOption || resolved?.items.map(item => item.variantLabel).join(" | ") || null,
        selected_size: sizeOption || null,
        sync_status: selectionError ? 'FAILED' : 'PENDING',
        sync_message: selectionError,
      },
    });

    // ── Generate externalId ──────────────────────────────────────
    const externalId = generateExternalId(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { external_id: externalId },
    });

    console.log(`[LadiPage Webhook] Order #${order.id} created → externalId: ${externalId} (page: ${landingPage.name})`);

    if (selectionError) {
      await prisma.order.update({ where: { id: order.id }, data: { external_id: externalId } });
      return NextResponse.json({ success: true, accepted: true, orderId: order.id, externalId,
        syncStatus: 'FAILED', requiresReview: true, message: selectionError });
    }

    // ── Sync to RetailCRM ────────────────────────────────────────
    const payload: RetailCrmOrderPayload = {
      externalId,
      firstName: name,
      phone,
      delivery: {
        cost: resolved!.deliveryFee, // Phí ship tách riêng
        address: {
          countryIso: 'UZ',
          text: address,
        },
      },
      items: resolved!.items,
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
