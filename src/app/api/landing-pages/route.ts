import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * GET /api/landing-pages
 * List all landing pages with product + variants info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { api_key: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

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
  try {
    const body = await request.json();

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
          slug,
          has_sizes: !!body.has_sizes,
          // sizes stored as { label: "Size", options: ["S", "M", "L"] }
          sizes: body.has_sizes ? { label: body.option_label || 'Size', options: body.sizes || [] } : undefined,
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
            size: v.size || null,
            active: true,
          },
        });
      }

      // 3. Create LandingPage
      const lp = await tx.landingPage.create({
        data: {
          name: pageName,
          api_key: apiKey,
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
    console.error('Error creating landing page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
