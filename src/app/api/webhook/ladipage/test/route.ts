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
 * Find the best matching variant by comparing the selected option text.
 */
function findMatchingVariant(
  variants: Array<{ id: number; label: string; quantity: number; price: number; delivery_fee: number; size: string | null; xml_id: string | null }>,
  packageText?: string,
  sizeText?: string,
) {
  if (!packageText && variants.length === 1) {
    return variants[0];
  }

  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^\w\d]/g, ' ').replace(/\s+/g, ' ').trim();

  const normalizedPackage = packageText ? normalize(packageText) : '';

  let bestMatch = variants[0];
  let bestScore = -1;

  for (const variant of variants) {
    let score = 0;
    const normalizedLabel = normalize(variant.label);

    if (normalizedPackage) {
      const labelNumbers: string[] = normalizedLabel.match(/\d+/g) || [];
      const packageNumbers: string[] = normalizedPackage.match(/\d+/g) || [];

      for (const num of labelNumbers) {
        if (packageNumbers.includes(num)) {
          score += 10;
        }
      }

      const labelWords = normalizedLabel.split(' ').filter(w => w.length > 2);
      const packageWords = normalizedPackage.split(' ').filter(w => w.length > 2);
      for (const word of labelWords) {
        if (packageWords.includes(word)) {
          score += 1;
        }
      }
    }

    if (sizeText && variant.size) {
      const normalizedSize = normalize(sizeText);
      const variantSize = normalize(variant.size);
      if (normalizedSize.includes(variantSize) || variantSize.includes(normalizedSize)) {
        score += 50;
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
      console.log(`[LadiPage TEST] ❌ Landing page not found for api_key: "${apiKey}"`);
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
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Unsupported content type' },
          { status: 400 },
        );
      }
    }

    console.log(`\n🧪 [LadiPage TEST] Received data for page: "${landingPage.name}" (api_key: ${apiKey})`);
    console.log('🧪 [LadiPage TEST] Product:', product.name, `(slug: ${product.slug})`);
    console.log('🧪 [LadiPage TEST] Raw body:', JSON.stringify(body, null, 2));

    // ── Extract fields ───────────────────────────────────────────
    const name = body.name || body.Ism || body.ism || body.ho_ten || body.fullname || body.full_name || '';
    const phone = body.phone || body.Telefon || body.telefon || body['Telefon raqami'] || body.telefon_raqami || body.sdt || '';
    const address = body.address || body.Manzil || body.manzil || body.dia_chi || body['Địa chỉ'] || '';
    const packageOption = body.products || body.package || body.goi || body.variant || body.to_plam || body["to'plam"] || body.combo || '';
    const sizeOption = body.size || body.o_lcham || body["o'lcham"] || body.olcham || body.kich_thuoc || '';

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
      console.log('🧪 [LadiPage TEST] ❌ No active variants for product:', product.name);
      return NextResponse.json(
        { success: false, error: 'No product variants configured' },
        { status: 500 },
      );
    }

    const matchedVariant = findMatchingVariant(variants, packageOption, sizeOption);

    console.log(`🧪 [LadiPage TEST] Matched variant: "${matchedVariant.label}" (price: ${matchedVariant.price}, qty: ${matchedVariant.quantity})`);

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
        source: 'ladipage-test',
        landing_slug: product.slug,
        selected_package: packageOption || matchedVariant.label,
        selected_size: sizeOption || matchedVariant.size || null,
        sync_status: 'PENDING',
      },
    });

    // ── Generate externalId (TEST prefix) ────────────────────────
    const externalId = generateExternalId(order.id);
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
      matchedVariant: {
        label: matchedVariant.label,
        price: matchedVariant.price,
        quantity: matchedVariant.quantity,
        delivery_fee: matchedVariant.delivery_fee,
        size: matchedVariant.size,
        xmlId,
      },
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
