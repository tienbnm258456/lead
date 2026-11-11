import { dataScope, landingScope } from '@/lib/permissions';
import { ensureOfferXmlIds, landingTones, resolveLandingItems, scalar, SelectionError } from '@/lib/ladipage-order';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRetailCrmOrder, RetailCrmOrderPayload } from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';
import { requireAuth } from '@/lib/require-auth';
import { orderFilterWhere, orderXmlId, OrderFilterError } from '@/lib/order-filters';
import { orderIdsForXmlId } from '@/lib/order-xml-filter';
import { sumOrderAmounts } from '@/lib/order-amounts';

/**
 * GET /api/orders
 * List orders with pagination, search, and filtering
 * Supports filtering by landing_slug to view orders per landing page
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page') || '1');
    const requestedPageSize = Number(searchParams.get('pageSize') || '50');
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(requestedPageSize) || requestedPageSize < 1) {
      return NextResponse.json({ error: 'Trang và số bản ghi mỗi trang phải là số nguyên dương' }, { status: 400 });
    }
    const pageSize = Math.min(requestedPageSize, 200);
    if (!Number.isSafeInteger((page - 1) * pageSize)) return NextResponse.json({ error: 'Số trang không hợp lệ' }, { status: 400 });
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const landingSlug = searchParams.get('landingSlug') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build where clause
    const where: Record<string, unknown> = { ...dataScope(auth.user) };
    where.AND = [orderFilterWhere(searchParams)];
    const xmlId = orderXmlId(searchParams);
    if (xmlId) where.id = { in: await orderIdsForXmlId(xmlId, auth.user) };

    if (search) {
      where.OR = [
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
        { external_id: { contains: search, mode: 'insensitive' } },
        { delivery_address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.sync_status = status;
    }

    if (landingSlug) {
      where.landing_slug = landingSlug;
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) (where.created_at as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.created_at as Record<string, unknown>).lte = endDate;
      }
    }

    // Filter by export status
    const exportStatus = searchParams.get('exportStatus') || '';
    if (exportStatus === 'not_exported') {
      where.exported_at = null;
    } else if (exportStatus === 'exported') {
      where.exported_at = { not: null };
    }

    // Validate sortBy to prevent injection
    const allowedSortFields = ['external_id', 'customer_name', 'customer_phone', 'total_price', 'sync_status', 'created_at', 'landing_slug'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    // Fetch orders + total + distinct landing pages (for filter dropdown)
    const [data, total, landingPages, amountGroups] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [safeSortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
      // Get all landing pages with product info for the filter dropdown
      prisma.landingPage.findMany({
        where: { active: true, ...landingScope(auth.user) },
        include: {
          product: { select: { name: true, slug: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // All matching orders; pagination applies only to findMany above.
      prisma.order.groupBy({ by: ['crm_status'], where, _sum: { total_price: true } }),
    ]);

    // Parse delivery_fee từ items_json để tách giá SP và phí ship
    const ordersWithFee = data.map(order => {
      let deliveryFee = 0;
      let xmlIdLabel: string | null = null;
      try {
        const items = JSON.parse(order.items_json);
        if (Array.isArray(items) && items.length > 0) {
          deliveryFee = Number(items[0]?.deliveryFee) || 0;
          if (typeof items[0]?.tone === 'string') xmlIdLabel = items[0].tone.trim() || null;
        }
      } catch { /* ignore */ }
      const totalPrice = Number(order.total_price);
      return {
        ...order,
        product_price: String(totalPrice - deliveryFee),
        xml_id_label: xmlIdLabel,
        delivery_fee: String(deliveryFee),
      };
    });

    return NextResponse.json({
      data: ordersWithFee,
      total,
      amounts: sumOrderAmounts(amountGroups),
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      landingPages: landingPages.map(lp => ({
        slug: lp.product.slug,
        name: lp.name,
        productName: lp.product.name,
      })),
    });
  } catch (error) {
    if (error instanceof OrderFilterError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/orders
 * Tạo đơn hàng thủ công từ admin + đồng bộ sang RetailCRM
 *
 * Flow:
 *  1. Validate input
 *  2. Tạo order trong DB (sync_status = PENDING)
 *  3. Gọi RetailCRM /api/v5/orders/create
 *  4. Cập nhật sync_status + tạo OrderSyncLog
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const customer_name = scalar(body.customer_name);
    const customer_phone = scalar(body.customer_phone);
    const delivery_address = scalar(body.delivery_address);
    if (!customer_name || !customer_phone || !delivery_address) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const landingPageId = Number(body.landing_page_id);
    const variantId = Number(body.variant_id);
    if (!Number.isInteger(landingPageId) || landingPageId <= 0 || !Number.isInteger(variantId) || variantId <= 0) {
      return NextResponse.json({ error: 'Vui lòng chọn sản phẩm và gói sản phẩm' }, { status: 400 });
    }
    const page = await prisma.landingPage.findUnique({
      where: { id: landingPageId, active: true, ...landingScope(auth.user) },
      include: { product: { include: { variants: { where: { id: variantId, active: true } } } } },
    });
    if (!page || !page.product.active || page.product.variants.length !== 1) {
      return NextResponse.json({ error: 'Gói sản phẩm không thuộc sản phẩm hoặc đã ngừng hoạt động' }, { status: 400 });
    }
    const hasOptionXmlIds = landingTones(page.product.tone_xml_ids).length > 0;
    const configured = page.product.xml_id || hasOptionXmlIds ? page.product.variants : await ensureOfferXmlIds(prisma, page.product.variants);
    const resolved = resolveLandingItems(configured.map(v => ({ ...v, price: Number(v.price), delivery_fee: Number(v.delivery_fee) })),
      configured[0].label,
      hasOptionXmlIds ? (body.selected_tone ? body.selected_size : undefined) : body.selected_option ?? body.selected_size,
      page.product,
      hasOptionXmlIds ? body.selected_option ?? body.selected_tone ?? body.selected_size : undefined);
    const selected_package = configured[0].label;
    const selected_size = resolved.selectedOption;
    const landing_slug = page.product.slug;

    // M6 Fix: Dùng TEMP ID trước, update sau khi có DB auto-increment ID (chống race condition)
    const tempExternalId = `MAN-TEMP-${Date.now()}`;

    const order = await prisma.order.create({
      data: {
        external_id: tempExternalId,
        customer_name,
        customer_phone,
        delivery_address,
        url_page: page.landing_url || null,
        items_json: JSON.stringify(resolved.items),
        total_price: resolved.totalPrice,
        source: 'admin',
        group_id: page.group_id,
        landing_page_id: page.id,
        created_by_id: auth.user.id,
        landing_slug: landing_slug || null,
        selected_package: selected_package || null,
        selected_size: selected_size || null,
        sync_status: 'PENDING',
      },
    });

    // M6 Fix: Update external_id với DB auto-increment ID (an toàn race condition)
    const externalId = `MAN-${String(order.id).padStart(5, '0')}`;
    await prisma.order.update({
      where: { id: order.id },
      data: { external_id: externalId },
    });

    console.log(`[Admin] Order #${order.id} created → externalId: ${externalId}`);

    // ── Sync to RetailCRM ────────────────────────────────────────────
    const crmPayload: RetailCrmOrderPayload = {
      externalId,
      firstName: customer_name,
      phone: customer_phone,
      delivery: {
        cost: resolved.deliveryFee,
        address: {
          countryIso: 'UZ',
          text: delivery_address,
        },
      },
      items: resolved.items,
    };

    const syncResult = await createRetailCrmOrder(crmPayload);
    const durationMs = syncResult.completedAt.getTime() - syncResult.sentAt.getTime();
    const dbSyncStatus: OrderSyncStatus = syncResult.status as OrderSyncStatus;

    // ── Update order + create sync log ───────────────────────────────
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
          synced_at: syncResult.status === 'SUCCESS' ? syncResult.completedAt : null,
        },
      }),
      prisma.orderSyncLog.create({
        data: {
          order_id: order.id,
          status: dbSyncStatus,
          http_status: syncResult.httpStatus || null,
          request_payload: JSON.stringify(crmPayload),
          response_body: syncResult.response ? JSON.stringify(syncResult.response) : null,
          error_message: syncResult.errorMessage || null,
          duration_ms: durationMs,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { ...order, external_id: externalId, sync_status: dbSyncStatus },
      syncStatus: dbSyncStatus,
      syncMessage: syncResult.status === 'SUCCESS'
        ? `Đồng bộ CRM thành công (ID: ${syncResult.response?.id})`
        : `Đồng bộ CRM thất bại: ${syncResult.errorMessage}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SelectionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
