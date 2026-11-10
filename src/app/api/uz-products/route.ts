import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-auth';
import { prisma } from '@/lib/prisma';
import { uzProductId, uzProductMappingSchema } from '@/lib/uz-product';

async function writeMapping(request: Request, create: boolean) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const result = uzProductMappingSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { sourceId, ...data } = result.data;
  if (create) {
    try {
      await prisma.uzProduct.create({ data: { sourceId, ...data } });
      return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Sản phẩm đã có mapping. Tải lại danh sách để sửa.' }, { status: 409 });
      }
      throw error;
    }
  }
  await prisma.uzProduct.upsert({
    where: { sourceId },
    create: { sourceId, ...data },
    update: data,
  });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  return writeMapping(request, true);
}

export async function PUT(request: Request) {
  return writeMapping(request, false);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const sourceId = uzProductId.safeParse(body?.sourceId);
  if (!sourceId.success) return NextResponse.json({ error: 'ID sản phẩm không hợp lệ' }, { status: 400 });

  await prisma.uzProduct.deleteMany({ where: { sourceId: sourceId.data } });
  return NextResponse.json({ success: true });
}
