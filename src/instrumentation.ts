/**
 * Next.js Instrumentation — Background Jobs
 *
 * Chạy 1 lần khi server khởi động.
 * Tạo interval gọi /api/cron/cleanup định kỳ (mỗi 5 phút).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server side (not edge)
  if (typeof window !== 'undefined') return;

  // Chờ server sẵn sàng (2 giây)
  await new Promise(resolve => setTimeout(resolve, 2000));

  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
  const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  console.log(`[Instrumentation] Starting cleanup cron job (every ${CLEANUP_INTERVAL_MS / 1000}s)`);

  const runCleanup = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/cleanup`, {
        method: 'GET',
        headers: { 'x-cron-secret': 'internal' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deletedSyncLogs > 0 || data.deletedActivityLogs > 0) {
          console.log(`[Cron] Cleanup: ${data.message}`);
        }
      }
    } catch (error) {
      // Silent fail — server might not be ready yet
      console.error('[Cron] Cleanup failed:', error instanceof Error ? error.message : error);
    }
  };

  // Chạy lần đầu sau 10 giây
  setTimeout(runCleanup, 10_000);

  // Chạy định kỳ mỗi 5 phút
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}
