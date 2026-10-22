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

    // Fetch existing landing page
    const existing = await prisma.landingPage.findUnique({
      where: { id: numId },
      include: { product: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update landing page fields
      const updateLP: Record<string, unknown> = {};
      const updateProduct: Record<string, unknown> = {};

      if (body.name !== undefined) {
        updateLP.name = body.name.trim();
        updateProduct.name = body.name.trim();
      }
      if (body.has_sizes !== undefined) {
        updateProduct.has_sizes = !!body.has_sizes;
        updateProduct.sizes = body.has_sizes
          ? { label: body.option_label || 'Size', options: body.sizes || [] }
          : null;
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
          where: { id: numId },
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
                size: v.size || null,
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
                size: v.size || null,
                active: true,
              },
            });
          }
        }
      }

      // 3. Return updated landing page
      return tx.landingPage.findUnique({
        where: { id: numId },
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
    const lp = await prisma.landingPage.findUnique({ where: { id: numId } });
    if (!lp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete landing page, then product (cascade deletes variants)
    await prisma.$transaction([
      prisma.landingPage.delete({ where: { id: numId } }),
      prisma.product.delete({ where: { id: lp.product_id } }),
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
      where: { id: numId },
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
