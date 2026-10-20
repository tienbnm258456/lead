import { prisma } from '@/lib/prisma';
import DashboardCharts from '@/components/dashboard-charts';

async function getStats() {
  const [total, pendingCount, successCount, failedCount, todayCount] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { sync_status: 'PENDING' } }),
    prisma.order.count({ where: { sync_status: 'SUCCESS' } }),
    prisma.order.count({ where: { sync_status: { in: ['FAILED', 'TIMEOUT'] } } }),
    prisma.order.count({
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return { total, pendingCount, successCount, failedCount, todayCount };
}

async function getDailyOrders() {
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
        where: { created_at: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.order.aggregate({
        where: { created_at: { gte: dayStart, lte: dayEnd } },
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

async function getStatusDistribution() {
  const [pending, success, failed, timeout] = await Promise.all([
    prisma.order.count({ where: { sync_status: 'PENDING' } }),
    prisma.order.count({ where: { sync_status: 'SUCCESS' } }),
    prisma.order.count({ where: { sync_status: 'FAILED' } }),
    prisma.order.count({ where: { sync_status: 'TIMEOUT' } }),
  ]);

  return [
    { name: 'Thành công', value: success, color: '#10b981' },
    { name: 'Chờ xử lý', value: pending, color: '#f59e0b' },
    { name: 'Thất bại', value: failed, color: '#ef4444' },
    { name: 'Timeout', value: timeout, color: '#f97316' },
  ];
}

async function getTopLandingPages() {
  // Group orders by landing_slug and count
  const results = await prisma.order.groupBy({
    by: ['landing_slug'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
    where: { landing_slug: { not: null } },
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

async function getRecentOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
  });

  return orders.map((o) => ({
    id: o.id,
    external_id: o.external_id,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    total_price: o.total_price.toString(),
    sync_status: o.sync_status,
    created_at: o.created_at.toISOString(),
  }));
}

export default async function AdminDashboard() {
  const [stats, dailyOrders, statusDistribution, topLandingPages, recentOrders] =
    await Promise.all([
      getStats(),
      getDailyOrders(),
      getStatusDistribution(),
      getTopLandingPages(),
      getRecentOrders(),
    ]);

  return (
    <DashboardCharts
      stats={stats}
      dailyOrders={dailyOrders}
      statusDistribution={statusDistribution}
      topLandingPages={topLandingPages}
      recentOrders={recentOrders}
    />
  );
}
