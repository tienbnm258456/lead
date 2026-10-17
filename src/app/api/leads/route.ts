import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLeadSchema } from '@/lib/validations';
import { LeadStatus, Prisma } from '@prisma/client';

// POST /api/leads - Public endpoint to receive leads from Landing Page
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const lead = await prisma.lead.create({
      data: {
        fullname: data.fullname,
        phone: data.phone,
        email: data.email || null,
        note: data.note || null,
        source: data.source || 'Landing Page',
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
      },
    });

    return NextResponse.json(
      { success: true, data: lead },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/leads - List leads with filtering, sorting, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Prisma.LeadWhereInput = {};

    if (search) {
      where.OR = [
        { fullname: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { note: { contains: search } },
      ];
    }

    if (status && Object.values(LeadStatus).includes(status as LeadStatus)) {
      where.status = status as LeadStatus;
    }

    if (source) {
      where.source = { contains: source };
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) {
        where.created_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.created_at.lte = endDate;
      }
    }

    const allowedSortFields = ['id', 'fullname', 'phone', 'email', 'source', 'status', 'created_at', 'updated_at'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
