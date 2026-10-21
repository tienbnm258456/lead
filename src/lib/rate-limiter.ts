// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Rate Limiter
//
// Giới hạn số lượng request theo IP trong 1 khoảng thời gian.
// Không cần Redis — chạy in-memory, phù hợp cho single-instance PM2.
//
// Usage:
//   import { rateLimiter } from '@/lib/rate-limiter';
//
//   // Trong API route:
//   const ip = request.headers.get('x-forwarded-for') || 'unknown';
//   const allowed = rateLimiter.check(ip, 30, 60_000); // 30 req / 60s
//   if (!allowed) return NextResponse.json({error: 'Too many requests'}, {status: 429});
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp (ms)
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Dọn dẹp entries hết hạn mỗi 5 phút để tránh memory leak
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Kiểm tra và đếm request.
   *
   * @param key   - Định danh (thường là IP hoặc IP:apiKey)
   * @param limit - Số request tối đa trong windowMs
   * @param windowMs - Khoảng thời gian (ms), mặc định 60s
   * @returns { allowed, remaining, resetAt }
   */
  check(
    key: string,
    limit: number,
    windowMs: number = 60_000,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Entry mới hoặc đã hết window → reset
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    // Còn trong window → tăng count
    entry.count += 1;

    if (entry.count > limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  /** Xóa entries đã hết hạn */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /** Chỉ dùng cho testing */
  _destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton — tồn tại suốt lifetime của process
export const rateLimiter = new RateLimiter();
