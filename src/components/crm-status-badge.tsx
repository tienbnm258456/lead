import { getCrmStatusDisplay } from '@/lib/crm-status-display';
export function CrmStatusBadge({ code }: { code?: string | null }) {
  const status = getCrmStatusDisplay(code);
  return <span className="inline-flex max-w-[360px] items-center gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium select-text"
    style={{ color: status.color, background: status.color + '12', borderColor: status.color + '38' }}
    title={[status.groupLabel, status.code, status.label, status.description].filter(Boolean).join(' · ')}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    <span className="truncate">{status.label}</span>
  </span>;
}
