/** Fixed Vietnamese separators; identical output regardless of ICU/browser locale. */
export function formatDisplayNumber(value: unknown): string {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return '—';
  const [integer, decimal] = number.toFixed(2).split('.');
  const fraction = decimal?.replace(/0+$/, '');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? ',' + fraction : '');
}
/** Explicit timezone and assembled parts avoid server/browser date punctuation differences. */
export function formatDashboardDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return part('hour') + ':' + part('minute') + ' ' + part('day') + '/' + part('month');
}
