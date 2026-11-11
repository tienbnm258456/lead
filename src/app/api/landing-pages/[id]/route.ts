import { Prisma } from '@prisma/client';
import { isLandingXmlId, parseLandingTones, parseLandingUrl, parseOfferName, scalar, SelectionError } from '@/lib/ladipage-order';
import { landingScope, isTotalAdmin, managedGroupWhere } from '@/lib/permissions';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { requireAuth } from '@/lib/require-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PUT /api/landing-pages/[id]
 * Update a landing page name/active + sync variants
 *
 * Body:
 * {
 *   name: "Kem tẩy lông (updated)",
 *   active: true,
 *   variants: [
 *     { id: 1, label: "...", quantity: 1, price: 299000, delivery_fee: 50000 },  // update existing
 *     { label: "New package", quantity: 3, price: 749000, delivery_fee: 0 },      // create new (no id)
 *   ]
 * }
 * Variants NOT in the array will be soft-deleted (active=false).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const numId = parseInt(id);

  if (isNaN(numId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const tones = parseLandingTones(body.tone_xml_ids);
    const offerName = body.name_xml_id === undefined ? undefined : parseOfferName(body.name_xml_id);
    const optionLabel = scalar(body.option_label);
    if (tones.length && body.has_sizes !== undefined && (!body.has_sizes || !optionLabel)) {
      throw new SelectionError('Bật tùy chọn và nhập tên tùy chọn khi cấu hình XML ID riêng.');
    }
    const landingUrl = body.landing_url === undefined ? undefined : parseLandingUrl(body.landing_url);
    if (!tones.length && (body.xml_id !== undefined || body.tone_xml_ids !== undefined) && !isLandingXmlId(body.xml_id)) {
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

    // Fetch existing landing page
    const existing = await prisma.landingPage.findUnique({
      where: { id: numId, ...landingScope(auth.user) },
      include: { product: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
    }

    let assignedGroup = existing.group_id;
    if (isTotalAdmin(auth.user) && body.group_id !== undefined) {
      assignedGroup = body.group_id === null ? null : Number(body.group_id);
      if (assignedGroup !== null && (!Number.isInteger(assignedGroup) || assignedGroup <= 0)) return NextResponse.json({ error: 'Nhóm không hợp lệ hoặc Quản lý của nhóm đã bị khóa' }, { status: 400 });
      if (assignedGroup && !await prisma.accessGroup.findFirst({ where: assignedGroup !== existing.group_id ? managedGroupWhere(assignedGroup) : { id: assignedGroup, active: true } })) return NextResponse.json({ error: 'Nhóm không hợp lệ' }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      if (assignedGroup !== existing.group_id) {
        await tx.landingPage.update({ where: { id: numId }, data: { group_id: assignedGroup } });
        await tx.product.update({ where: { id: existing.product_id }, data: { group_id: assignedGroup } });
        const product = await tx.product.findUniqueOrThrow({ where: { id: existing.product_id } });
        await tx.order.updateMany({ where: { OR: [{ landing_page_id: numId }, { landing_page_id: null, landing_slug: product.slug }] }, data: { group_id: assignedGroup, landing_page_id: numId } });
      }
      // 1. Update landing page fields
      const updateLP: Record<string, unknown> = {};
      const updateProduct: Record<string, unknown> = {};
      if (body.tone_xml_ids !== undefined) updateProduct.tone_xml_ids = tones.length ? tones : Prisma.DbNull;
      if (tones.length || body.xml_id !== undefined) updateProduct.xml_id = tones.length ? null : body.xml_id.trim();
      if (offerName !== undefined) updateProduct.name_xml_id = offerName;
      if (landingUrl !== undefined) updateLP.landing_url = landingUrl;

      if (body.name !== undefined) {
        updateLP.name = body.name.trim();
        updateProduct.name = body.name.trim();
      }
      if (tones.length) {
        updateProduct.has_sizes = true;
        updateProduct.sizes = { label: optionLabel || 'Tone', options: tones.map(tone => tone.label) };
      } else if (body.has_sizes !== undefined) {
        updateProduct.has_sizes = !!body.has_sizes;
        updateProduct.sizes = body.has_sizes
          ? { label: optionLabel || 'Size', options: body.sizes || [] }
          : Prisma.DbNull;
      }
      if (body.active !== undefined) updateLP.active = body.active;

      // Update product
      if (Object.keys(updateProduct).length > 0) {
        await tx.product.update({
          where: { id: existing.product_id },
          data: updateProduct,
        });
      }

      // Update landing page
      if (Object.keys(updateLP).length > 0) {
        await tx.landingPage.update({
          where: { id: numId, ...landingScope(auth.user) },
          data: updateLP,
        });
      }

      // 2. Sync variants if provided
      if (body.variants && Array.isArray(body.variants)) {
        const sentIds = body.variants
          .filter((v: Record<string, unknown>) => v.id)
          .map((v: Record<string, unknown>) => Number(v.id));

        // Soft-delete variants not in the array
        await tx.productVariant.updateMany({
          where: {
            product_id: existing.product_id,
            id: { notIn: sentIds },
          },
          data: { active: false },
        });

        if (sentIds.length && await tx.productVariant.count({ where: { id: { in: sentIds }, product_id: existing.product_id } }) !== new Set(sentIds).size) throw new Error('Variant không thuộc sản phẩm');
        // Upsert each variant
        for (const v of body.variants) {
          if (v.id) {
            // Update existing
            await tx.productVariant.update({
              where: { id: Number(v.id) },
              data: {
                label: v.label.trim(),
                quantity: v.quantity || 1,
                price: Number(v.price),
                delivery_fee: Number(v.delivery_fee || 0),
                size: null,
                promotion: v.promotion?.trim() || null,
                ...(v.xml_id?.trim() ? { xml_id: v.xml_id.trim() } : {}),
                active: true,
              },
            });
          } else {
            // Create new
            await tx.productVariant.create({
              data: {
                product_id: existing.product_id,
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
        }
      }


      // 3. Return updated landing page
      return tx.landingPage.findUnique({
        where: { id: numId, ...landingScope(auth.user) },
        include: {
          product: {
            include: {
              variants: { where: { active: true }, orderBy: { price: 'asc' } },
            },
          },
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SelectionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error updating landing page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/landing-pages/[id]
 * Delete a landing page (and its product + variants)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const numId = parseInt(id);

  if (isNaN(numId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const lp = await prisma.landingPage.findUnique({ where: { id: numId, ...landingScope(auth.user) } });
    if (!lp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete landing page, then product (cascade deletes variants)
    await prisma.$transaction([
      prisma.landingPage.update({ where: { id: numId, ...landingScope(auth.user) }, data: { active: false, deleted_at: new Date() } }),
      prisma.product.update({ where: { id: lp.product_id }, data: { active: false } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting landing page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/landing-pages/[id]
 * Regenerate api_key for a landing page
 */
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const numId = parseInt(id);

  if (isNaN(numId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const newApiKey = crypto.randomBytes(24).toString('base64url');

    const landingPage = await prisma.landingPage.update({
      where: { id: numId, ...landingScope(auth.user) },
      data: { api_key: newApiKey },
      include: {
        product: {
          include: {
            variants: { where: { active: true }, orderBy: { price: 'asc' } },
          },
        },
      },
    });

    return NextResponse.json(landingPage);
  } catch (error) {
    console.error('Error regenerating api key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
