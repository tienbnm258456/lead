import { groupDashboardCrmStatuses } from '@/lib/dashboard-crm-groups';
import { requireAuth } from '@/lib/require-auth';
import { dataScope } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import DashboardCharts from '@/components/dashboard-charts';

// Luôn fetch data mới từ DB mỗi lần truy cập — không dùng cache tĩnh từ lúc build
export const dynamic = 'force-dynamic';

async function getOverview(scope: Prisma.OrderWhereInput) {
  const [total, todayCount, rawStatuses] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.count({ where: { ...scope, created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.order.groupBy({ by: ['crm_status'], where: scope, _count: { id: true } }),
  ]);
  const statusDistribution = groupDashboardCrmStatuses(rawStatuses);
  const count = (key: string) => statusDistribution.find(group => group.key === key)?.value || 0;
  return { stats: { total, todayCount, processingCount: count('processing'), completedCount: count('completed') }, statusDistribution };
}

async function getDailyOrders(scope: Prisma.OrderWhereInput) {
  const days = 7;
  const result: { date: string; count: number; revenue: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [count, revenueResult] = await Promise.all([
      prisma.order.count({
        where: { ...scope, created_at: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.order.aggregate({
        where: { ...scope, created_at: { gte: dayStart, lte: dayEnd } },
        _sum: { total_price: true },
      }),
    ]);

    result.push({
      date: dayStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      count,
      revenue: Number(revenueResult._sum.total_price ?? 0),
    });
  }

  return result;
}

async function getTopLandingPages(scope: Prisma.OrderWhereInput) {
  // Group orders by landing_slug and count
  const results = await prisma.order.groupBy({
    by: ['landing_slug'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
    where: { ...scope, landing_slug: { not: null } },
  });

  // Get product names for slugs
  const slugs = results
    .map((r) => r.landing_slug)
    .filter((s): s is string => s !== null);

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true },
  });

  const nameMap = new Map(products.map((p) => [p.slug, p.name]));

  return results.map((r) => ({
    name: nameMap.get(r.landing_slug ?? '') ?? r.landing_slug ?? 'Unknown',
    orders: r._count.id,
  }));
}

async function getRecentOrders(scope: Prisma.OrderWhereInput) {
  const orders = await prisma.order.findMany({
    where: scope,
    orderBy: { created_at: 'desc' },
    take: 5,
  });

  return orders.map((o) => ({
    id: o.id,
    external_id: o.external_id,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    total_price: o.total_price.toString(),
    crm_status: o.crm_status,
    created_at: o.created_at.toISOString(),
  }));
}

export default async function AdminDashboard() {
  const auth = await requireAuth();
  if (auth.error) redirect('/login');
  const scope = dataScope(auth.user);
  const [overview, dailyOrders, topLandingPages, recentOrders] =
    await Promise.all([
      getOverview(scope),
      getDailyOrders(scope),
      getTopLandingPages(scope),
      getRecentOrders(scope),
    ]);

  return (
    <DashboardCharts
      stats={overview.stats}
      dailyOrders={dailyOrders}
      statusDistribution={overview.statusDistribution}
      topLandingPages={topLandingPages}
      recentOrders={recentOrders}
    />
  );
}
