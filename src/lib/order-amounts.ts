import { Prisma } from '@prisma/client';
import { getCrmStatusDisplay } from './crm-status-display';

export interface OrderAmounts {
  total: string;
  completed: string;
  other: string;
  cancelled: string;
}

export function sumOrderAmounts(rows: {
  crm_status: string | null;
  _sum: { total_price: Prisma.Decimal | string | number | null };
}[]): OrderAmounts {
  let total = new Prisma.Decimal(0);
  let completed = new Prisma.Decimal(0);
  let cancelled = new Prisma.Decimal(0);
  for (const row of rows) {
    const amount = row._sum.total_price ?? 0;
    total = total.plus(amount);
    const group = getCrmStatusDisplay(row.crm_status).group;
    if (group === 'completed') completed = completed.plus(amount);
    if (group === 'cancelled') cancelled = cancelled.plus(amount);
  }
  return { total: total.toString(), completed: completed.toString(),
    other: total.minus(completed).toString(), cancelled: cancelled.toString() };
}
