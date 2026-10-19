/**
 * Settings Cache Module
 *
 * Cache cấu hình system_settings trong memory.
 * - Tự load từ DB khi khởi động
 * - Invalidate khi admin update settings từ UI
 * - Dùng bởi cron job và API
 */

import { prisma } from '@/lib/prisma';

const DEFAULTS: Record<string, string> = {
  sync_log_cleanup_value: '30',
  sync_log_cleanup_unit: 'days',
  activity_log_cleanup_value: '90',
  activity_log_cleanup_unit: 'days',
};

let cached: Record<string, string> | null = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 60_000; // Reload from DB mỗi 60s tối đa

/**
 * Lấy settings từ cache (lazy load từ DB nếu chưa có hoặc hết TTL)
 */
export async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cached && (now - lastLoadedAt) < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const rows = await prisma.systemSetting.findMany();
    cached = { ...DEFAULTS };
    for (const row of rows) {
      cached[row.key] = row.value;
    }
    lastLoadedAt = now;
  } catch (error) {
    console.error('[SettingsCache] Failed to load:', error);
    if (!cached) cached = { ...DEFAULTS };
  }

  return cached;
}

/**
 * Invalidate cache → force reload from DB ở lần gọi tiếp theo
 */
export function invalidateSettingsCache(): void {
  cached = null;
  lastLoadedAt = 0;
}

/**
 * Chuyển đổi value + unit → milliseconds
 */
export function toMs(value: number, unit: string): number {
  switch (unit) {
    case 'seconds': return value * 1000;
    case 'minutes': return value * 60 * 1000;
    case 'hours':   return value * 60 * 60 * 1000;
    case 'days':    return value * 24 * 60 * 60 * 1000;
    default:        return value * 24 * 60 * 60 * 1000;
  }
}
