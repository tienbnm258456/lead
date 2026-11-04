/** Process-local background jobs. Dev runs explicitly configured test intervals. */
type JobState = {
  signature: string;
  timers: ReturnType<typeof setTimeout>[];
  running: boolean;
};
const jobGlobal = globalThis as typeof globalThis & { __leadBackgroundJobs?: Map<string, JobState> };
function minutes(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed * 60000 <= 2147483647 ? parsed : undefined;
}

export function register() {
  if (typeof window !== 'undefined' || process.env.NEXT_RUNTIME === 'edge' || process.env.NODE_ENV === 'test') return;
  const production = process.env.NODE_ENV === 'production';
  const registry: Map<string, JobState> = jobGlobal.__leadBackgroundJobs ||= new Map<string, JobState>();
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:' + (process.env.PORT || '3000');
  const secret = process.env.CRON_SECRET || 'internal';

  function install(name: string, path: string, interval: number | undefined, hour: number, initialDelay: number) {
    const enabled = production || interval !== undefined;
    const signature = JSON.stringify([enabled, baseUrl, secret, interval, hour, production]);
    const previous = registry.get(name);
    if (previous?.signature === signature) return;
    if (previous) previous.timers.forEach(timer => clearTimeout(timer));
    if (!enabled) {
      registry.delete(name);
      console.log('[Instrumentation] ' + name + ': chưa đặt interval, không chạy lịch ngày trong dev');
      return;
    }
    const state: JobState = previous || { signature, timers: [], running: false };
    state.signature = signature;
    state.timers = [];
    registry.set(name, state);

    const run = async () => {
      if (state.running) {
        console.log('[Cron] ' + name + ': lượt trước chưa xong, bỏ qua lượt trùng');
        return;
      }
      state.running = true;
      try {
        console.log('[Cron] ' + name + ': bắt đầu quét');
        const response = await fetch(baseUrl.replace(/\/$/, '') + path, {
          method: 'GET', cache: 'no-store', headers: { 'x-cron-secret': secret },
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
          console.error('[Cron] ' + name + ': HTTP ' + response.status + ' — ' + (data.error || data.message || 'Job failed'));
        } else if (data.skipped) {
          if (!production) console.log('[Cron] ' + name + ': bỏ qua — ' + data.message);
        } else {
          console.log('[Cron] ' + name + ': ' + (data.message || 'Hoàn tất'));
        }
      } catch (error) {
        console.error('[Cron] ' + name + ': ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        state.running = false;
      }
    };
    state.timers.push(setTimeout(run, initialDelay));
    if (interval !== undefined) {
      console.log('[Instrumentation] ' + name + ': mỗi ' + interval + ' phút | ' + (production ? 'production' : 'dev'));
      state.timers.push(setInterval(run, interval * 60000));
    } else {
      console.log('[Instrumentation] ' + name + ': hằng ngày lúc ' + hour + ':00');
      const schedule = () => {
        const now = new Date();
        const target = new Date(now);
        target.setHours(hour, 0, 0, 0);
        if (now >= target) target.setDate(target.getDate() + 1);
        const timer = setTimeout(async () => {
          state.timers = state.timers.filter(value => value !== timer);
          await run();
          if (registry.get(name) === state && state.signature === signature) schedule();
        }, target.getTime() - now.getTime());
        state.timers.push(timer);
      };
      schedule();
    }
  }
  if (process.env.RETAILCRM_WEBHOOK_SECRET && process.env.CRON_SECRET) {
    install('RetailCRM Status', '/api/cron/retailcrm-status', 0.25, 0, 5000);
  }
  const cleanupHour = Number(process.env.CLEANUP_CRON_HOUR ?? '23');
  install('Cleanup', '/api/cron/cleanup', minutes(process.env.CLEANUP_INTERVAL_MINUTES),
    Number.isInteger(cleanupHour) && cleanupHour >= 0 && cleanupHour <= 23 ? cleanupHour : 23, 10000);
  install('Sheets Export', '/api/cron/export-sheets', minutes(process.env.SHEETS_EXPORT_INTERVAL_MINUTES), 0, 15000);
}
