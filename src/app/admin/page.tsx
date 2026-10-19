import { prisma } from '@/lib/prisma';
import { ShoppingCart, PackagePlus, Clock, AlertCircle } from 'lucide-react';

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

async function getRecentOrders() {
  return prisma.order.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
  });
}

const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  TIMEOUT: 'Timeout',
};

const statusClasses: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  TIMEOUT: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
};

export default async function AdminDashboard() {
  const [stats, recentOrders] = await Promise.all([getStats(), getRecentOrders()]);

  const cards = [
    {
      title: 'Tổng đơn hàng',
      value: stats.total,
      icon: ShoppingCart,
      gradient: 'from-indigo-500 to-blue-600',
      shadow: 'shadow-indigo-500/20',
    },
    {
      title: 'Đơn hôm nay',
      value: stats.todayCount,
      icon: PackagePlus,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
    },
    {
      title: 'Chờ xử lý',
      value: stats.pendingCount,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
    },
    {
      title: 'Thất bại',
      value: stats.failedCount,
      icon: AlertCircle,
      gradient: 'from-red-500 to-rose-600',
      shadow: 'shadow-red-500/20',
    },
  ];

  const formatPrice = (price: unknown) => {
    const num = typeof price === 'string' ? parseFloat(price) : Number(price);
    return new Intl.NumberFormat('uz-UZ').format(num) + ' UZS';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Tổng quan hệ thống quản lý Đơn hàng
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${card.shadow}`}
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {card.value.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg ${card.shadow} transition-transform group-hover:scale-110`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            {/* Decorative gradient line */}
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${card.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div
        className="rounded-xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Đơn hàng mới nhất
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            5 đơn hàng gần nhất
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Mã đơn</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Khách hàng</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>SĐT</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tổng tiền</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Trạng thái</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    Chưa có đơn hàng nào
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t transition-colors hover:bg-[var(--muted)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {order.external_id}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{order.customer_name}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{order.customer_phone}</td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {formatPrice(order.total_price)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        statusClasses[order.sync_status] || 'bg-gray-100 text-gray-700'
                      }`}>
                        {statusLabels[order.sync_status] || order.sync_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(order.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
