import { CRM_STATUS_GROUPS, getCrmStatusDisplay } from '@/lib/crm-status-display';
export interface DashboardCrmGroup { key: string; name: string; value: number; color: string }
export function dashboardCrmGroup(code?: string | null): DashboardCrmGroup {
  const status = getCrmStatusDisplay(code);
  return { key: status.group || (code ? 'unknown' : 'missing'), name: status.groupLabel, value: 0, color: !code ? '#94a3b8' : status.color };
}
export function groupDashboardCrmStatuses(rows: { crm_status: string | null; _count: { id: number } }[]): DashboardCrmGroup[] {
  const groups = new Map<string, DashboardCrmGroup>(Object.entries(CRM_STATUS_GROUPS).map(([key, group]) => [key, { key, name: group.label, color: group.color, value: 0 }]));
  for (const row of rows) {
    const group = dashboardCrmGroup(row.crm_status);
    const current = groups.get(group.key) || group;
    current.value += row._count.id;
    groups.set(group.key, current);
  }
  return [...groups.values()];
}
