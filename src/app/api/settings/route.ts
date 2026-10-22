import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateSettingsCache } from '@/lib/settings-cache';
import { requireAuth } from '@/lib/require-auth';

/**
 * GET /api/settings
 * Trả về tất cả cấu hình hệ thống.
 * Nếu key chưa tồn tại, trả về giá trị mặc định.
 */
const DEFAULTS: Record<string, string> = {
  sync_log_cleanup_value: '30',
  sync_log_cleanup_unit: 'days',
  activity_log_cleanup_value: '90',
  activity_log_cleanup_unit: 'days',
};

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const rows = await prisma.systemSetting.findMany();
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Cập nhật 1 hoặc nhiều cấu hình.
 * Body: { "key1": "value1", "key2": "value2" }
 */
export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json() as Record<string, string>;

    const allowedKeys = Object.keys(DEFAULTS);
    const updates: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;

      // Validate unit
      if (key.endsWith('_unit')) {
        if (!['days', 'hours', 'minutes', 'seconds'].includes(value)) {
          return NextResponse.json({ success: false, error: `Đơn vị không hợp lệ: ${value}` }, { status: 400 });
        }
      }

      // Validate value (numeric)
      if (key.endsWith('_value')) {
        const num = Number(value);
        if (isNaN(num) || num < 1) {
          return NextResponse.json({ success: false, error: `Giá trị phải là số >= 1: ${value}` }, { status: 400 });
        }
      }

      updates.push({ key, value: String(value) });
    }

    // Upsert all settings
    await Promise.all(
      updates.map(({ key, value }) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    // Invalidate memory cache → cron job sẽ dùng config mới
    invalidateSettingsCache();

    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình' });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Reload settings cache từ DB (dùng khi thay đổi trực tiếp trong DB)
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    invalidateSettingsCache();
    // Force re-load
    const rows = await prisma.systemSetting.findMany();
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json({ success: true, message: 'Cache đã được reload từ DB', data: settings });
  } catch (error) {
    console.error('Settings reload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
