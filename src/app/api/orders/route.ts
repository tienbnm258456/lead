import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRetailCrmOrder, RetailCrmOrderPayload } from '@/lib/retailcrm';
import { OrderSyncStatus } from '@prisma/client';

/**
 * GET /api/orders
 * List orders with pagination, search, and filtering
 * Supports filtering by landing_slug to view orders per landing page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const landingSlug = searchParams.get('landingSlug') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

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

    // Validate sortBy to prevent injection
    const allowedSortFields = ['external_id', 'customer_name', 'customer_phone', 'total_price', 'sync_status', 'created_at', 'landing_slug'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    // Fetch orders + total + distinct landing pages (for filter dropdown)
    const [data, total, landingPages] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { [safeSortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
      // Get all landing pages with product info for the filter dropdown
      prisma.landingPage.findMany({
        where: { active: true },
        include: {
          product: { select: { name: true, slug: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      data,
      total,
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
  try {
    const body = await request.json();
    const { customer_name, customer_phone, delivery_address, total_price, selected_package, selected_size, landing_slug } = body;

    if (!customer_name || !customer_phone || !delivery_address) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Generate external_id
    const lastOrder = await prisma.order.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const nextId = (lastOrder?.id || 0) + 1;
    const externalId = `MAN-${String(nextId).padStart(5, '0')}`;

    const order = await prisma.order.create({
      data: {
        external_id: externalId,
        customer_name,
        customer_phone,
        delivery_address,
        items_json: JSON.stringify([{ productName: selected_package || 'Manual', quantity: 1, initialPrice: Number(total_price) || 0 }]),
        total_price: Number(total_price) || 0,
        source: 'admin',
        landing_slug: landing_slug || null,
        selected_package: selected_package || null,
        selected_size: selected_size || null,
        sync_status: 'PENDING',
      },
    });

    console.log(`[Admin] Order #${order.id} created → externalId: ${externalId}`);

    // ── Sync to RetailCRM ────────────────────────────────────────────
    const crmPayload: RetailCrmOrderPayload = {
      externalId,
      firstName: customer_name,
      phone: customer_phone,
      delivery: {
        address: {
          countryIso: 'UZ',
          text: delivery_address,
        },
      },
      items: [{
        xmlId: externalId, // Use externalId as xmlId for manual orders
        quantity: 1,
        initialPrice: Number(total_price) || 0,
      }],
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
      data: { ...order, sync_status: dbSyncStatus },
      syncStatus: dbSyncStatus,
      syncMessage: syncResult.status === 'SUCCESS'
        ? `Đồng bộ CRM thành công (ID: ${syncResult.response?.id})`
        : `Đồng bộ CRM thất bại: ${syncResult.errorMessage}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
