import { Prisma } from '@prisma/client';
import { isLandingXmlId, parseLandingTones, parseLandingUrl, scalar, SelectionError } from '@/lib/ladipage-order';
import { landingScope, isTotalAdmin, managedGroupWhere } from '@/lib/permissions';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { requireAuth } from '@/lib/require-auth';

/**
 * GET /api/landing-pages
 * List all landing pages with product + variants info
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';

    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { api_key: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const where = { ...searchWhere, ...landingScope(auth.user) };
    const [data, total] = await Promise.all([
      prisma.landingPage.findMany({
        where,
        include: {
          product: {
            include: {
              variants: {
                where: { active: true },
                orderBy: { price: 'asc' as const },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.landingPage.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Generate a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || `page-${Date.now()}`;
}

/**
 * POST /api/landing-pages
 * Create a new landing page with auto-generated api_key.
 * Also auto-creates a Product + Variants in one step.
 *
 * Body:
 * {
 *   name: "Kem tẩy lông",
 *   variants: [
 *     { label: "1 quti – 299.000 UZS", quantity: 1, price: 299000, delivery_fee: 50000 },
 *     { label: "2 quti – 549.000 UZS", quantity: 2, price: 549000, delivery_fee: 0 },
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const tones = parseLandingTones(body.tone_xml_ids);
    const optionLabel = scalar(body.option_label);
    if (tones.length && body.has_sizes !== undefined && (!body.has_sizes || !optionLabel)) {
      throw new SelectionError('Bật tùy chọn và nhập tên tùy chọn khi cấu hình XML ID riêng.');
    }
    const landingUrl = body.landing_url === undefined ? undefined : parseLandingUrl(body.landing_url);
    if (!tones.length && !isLandingXmlId(body.xml_id)) {
      throw new SelectionError('Vui lòng nhập XML ID gốc do đối tác cấp, tối đa 255 ký tự, không chứa dấu phẩy hoặc xuống dòng.');
    }
    if (Array.isArray(body.variants)) {
      const invalidPromotion = body.variants.findIndex((v: Record<string, unknown> | null) =>
        !v || typeof v.promotion !== 'string' || !v.promotion.trim() || v.promotion.trim().length > 100);
      if (invalidPromotion >= 0) return NextResponse.json({
        error: 'Gói ' + (invalidPromotion + 1) + ': Thông tin khuyến mại là bắt buộc, tối đa 100 ký tự. Nhập mã đã thống nhất với đối tác, ví dụ 1+1 hoặc 2+2, để ghép vào XML ID gửi CRM.',
      }, { status: 400 });
    }
    if (body.variants !== undefined && (!Array.isArray(body.variants) || body.variants.length === 0 || body.variants.some((v: Record<string, unknown>) =>
      typeof v.label !== 'string' || !v.label.trim() ||
      typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0 ||
      (v.delivery_fee !== undefined && (typeof v.delivery_fee !== 'number' || !Number.isFinite(v.delivery_fee) || v.delivery_fee < 0)) ||
      (v.promotion != null && (typeof v.promotion !== 'string' || v.promotion.trim().length > 100)) || (v.xml_id != null && typeof v.xml_id !== 'string') || (v.size != null && typeof v.size !== 'string')
    ))) return NextResponse.json({ error: 'Gói sản phẩm phải có tên và giá/ship UZS hợp lệ' }, { status: 400 });

    const errors: string[] = [];
    if (!body.name?.trim()) errors.push('Tên trang là bắt buộc');
    if (!body.variants || !Array.isArray(body.variants) || body.variants.length === 0) {
      errors.push('Cần ít nhất 1 gói sản phẩm');
    } else {
      body.variants.forEach((v: Record<string, unknown>, i: number) => {
        if (!v.label) errors.push(`Gói ${i + 1}: Tên gói là bắt buộc`);
        if (v.price === undefined || v.price === null || Number(v.price) < 0) errors.push(`Gói ${i + 1}: Giá không hợp lệ`);
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const groupId = isTotalAdmin(auth.user) ? (body.group_id == null ? null : Number(body.group_id)) : auth.user.group_id;
    if (!isTotalAdmin(auth.user) && !groupId) return NextResponse.json({ error: 'Tài khoản chưa được gán nhóm' }, { status: 403 });
    if (groupId && !await prisma.accessGroup.findFirst({ where: isTotalAdmin(auth.user) ? managedGroupWhere(groupId) : { id: groupId, active: true } })) return NextResponse.json({ error: 'Không thể gán nhóm không có Quản lý đang hoạt động' }, { status: 400 });
    const pageName = body.name.trim();
    const slug = generateSlug(pageName) + '-' + Date.now().toString(36);

    // Auto-generate unique api_key
    const apiKey = crypto.randomBytes(24).toString('base64url');

    // Create Product + Variants + LandingPage in a single transaction
    const landingPage = await prisma.$transaction(async (tx) => {
      // 1. Create Product
      const product = await tx.product.create({
        data: {
          name: pageName,
          xml_id: tones.length ? null : body.xml_id.trim(),
          tone_xml_ids: tones.length ? tones : Prisma.DbNull,
          group_id: groupId,
          slug,
          has_sizes: Boolean(tones.length || body.has_sizes),
          // sizes stored as { label: "Size", options: ["S", "M", "L"] }
          sizes: tones.length ? { label: optionLabel || 'Tone', options: tones.map(tone => tone.label) }
            : body.has_sizes ? { label: optionLabel || 'Size', options: body.sizes || [] } : undefined,
          active: true,
        },
      });

      // 2. Create Variants
      for (const v of body.variants) {
        await tx.productVariant.create({
          data: {
            product_id: product.id,
            label: v.label.trim(),
            quantity: v.quantity || 1,
            price: Number(v.price),
            delivery_fee: Number(v.delivery_fee || 0),
            size: null,
                promotion: v.promotion?.trim() || null,
                xml_id: v.xml_id?.trim() || null,
            active: true,
          },
        });
      }


      // 3. Create LandingPage
      const lp = await tx.landingPage.create({
        data: {
          name: pageName,
          api_key: apiKey,
          landing_url: landingUrl,
          group_id: groupId,
          created_by_id: auth.user.id,
          product_id: product.id,
          active: true,
        },
        include: {
          product: {
            include: {
              variants: { where: { active: true }, orderBy: { price: 'asc' } },
            },
          },
        },
      });

      return lp;
    });

    return NextResponse.json(landingPage, { status: 201 });
  } catch (error) {
    if (error instanceof SelectionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error creating landing page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
