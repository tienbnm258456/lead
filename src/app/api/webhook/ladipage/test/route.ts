import { ensureOfferXmlIds, readLandingBody, scalar, selections, resolveLandingItems, SelectionError } from '@/lib/ladipage-order';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withLogger } from '@/lib/api-logger';

/**
 * Generate a unique externalId from DB order id.
 */
function generateExternalId(orderId: number): string {
  return `TEST-${String(orderId).padStart(5, '0')}`;
}

/**
 * POST /api/webhook/ladipage/test?api_key=xxx
 *
 * ⚠️ TEST ENDPOINT — Giống hệt /api/webhook/ladipage nhưng KHÔNG gọi RetailCRM.
 *
 * Dùng để test luồng:
 *  1. Nhận data từ LadiPage
 *  2. Lookup landing page → product → variant
 *  3. Tạo order trong DB (sync_status = SKIPPED)
 *  4. Trả response (KHÔNG sync RetailCRM)
 *
 * Order được tạo sẽ có:
 *  - external_id prefix "TEST-" thay vì "ORD-"
 *  - sync_status = "PENDING" (không tự chuyển SUCCESS/FAILED)
 *  - source = "ladipage-test"
 */
export const POST = withLogger(async function POST(request: NextRequest) {
  // L3 Fix: Block test endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Test endpoint is disabled in production' },
      { status: 403 },
    );
  }

  const apiKey = request.nextUrl.searchParams.get('api_key');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Missing api_key parameter' },
      { status: 401 },
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
      console.log(`[LadiPage TEST] ❌ Landing page not found for api_key: "${apiKey}"`);
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive api_key' },
        { status: 401 },
      );
    }

    const product = landingPage.product;

    // ── Parse body (support both JSON and form-data) ──────────────
    const body = await readLandingBody(request);

    console.log(`\n🧪 [LadiPage TEST] Received data for page: "${landingPage.name}" (api_key: ${apiKey})`);
    console.log('🧪 [LadiPage TEST] Product:', product.name, `(slug: ${product.slug})`);
    console.log('🧪 [LadiPage TEST] Raw body:', JSON.stringify(body, null, 2));

    // ── Extract fields ───────────────────────────────────────────
    const name = scalar(body.name || body.Ism || body.ism || body.ho_ten || body.fullname || body.full_name || '');
    const phone = scalar(body.phone || body.Telefon || body.telefon || body['Telefon raqami'] || body.telefon_raqami || body.sdt || '');
    const address = scalar(body.address || body.Manzil || body.manzil || body.dia_chi || body['Địa chỉ'] || '');
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
      console.log('🧪 [LadiPage TEST] ❌ Validation failed:', errors);
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
      console.log('🧪 [LadiPage TEST] ❌ No active variants for product:', product.name);
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
        source: 'ladipage-test',
        url_page: scalar(body.url_page) || null,
        landing_slug: product.slug,
        group_id: landingPage.group_id,
        landing_page_id: landingPage.id,
        selected_package: packageOption || resolved?.items.map(item => item.variantLabel).join(" | ") || null,
        selected_size: sizeOption || null,
        sync_status: selectionError ? 'FAILED' : 'PENDING',
        sync_message: selectionError,
      },
    });

    // ── Generate externalId (TEST prefix) ────────────────────────
    const externalId = generateExternalId(order.id);
    if (selectionError) {
      await prisma.order.update({ where: { id: order.id }, data: { external_id: externalId } });
      return NextResponse.json({ success: true, accepted: true, orderId: order.id, externalId,
        syncStatus: 'FAILED', requiresReview: true, message: selectionError });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        external_id: externalId,
        sync_status: 'PENDING',
        sync_message: '⚠️ TEST MODE — RetailCRM sync skipped',
      },
    });

    console.log(`🧪 [LadiPage TEST] ✅ Order #${order.id} created → externalId: ${externalId} (page: ${landingPage.name})`);
    console.log('🧪 [LadiPage TEST] ⏭️ RetailCRM sync SKIPPED (test mode)');

    // ── Response (NO RetailCRM sync) ─────────────────────────────
    return NextResponse.json({
      success: true,
      test: true,
      message: 'Order created successfully (RetailCRM sync SKIPPED)',
      orderId: order.id,
      externalId,
      syncStatus: 'PENDING',
      matchedItems: resolved!.items,
      parsedFields: {
        name,
        phone,
        address,
        package: packageOption,
        size: sizeOption,
      },
    });
  } catch (error) {
    console.error(`🧪 [LadiPage TEST] Error for api_key "${apiKey}":`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
});
