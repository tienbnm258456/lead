import { prisma } from '@/lib/prisma';
import { Users, UserPlus, Clock, AlertCircle } from 'lucide-react';

async function getStats() {
  const [total, newCount, processingCount, failedCount, todayCount] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.lead.count({ where: { status: 'PROCESSING' } }),
    prisma.lead.count({ where: { status: 'FAILED' } }),
    prisma.lead.count({
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return { total, newCount, processingCount, failedCount, todayCount };
}

async function getRecentLeads() {
  return prisma.lead.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
  });
}

const statusLabels: Record<string, string> = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Lỗi',
};

export default async function AdminDashboard() {
  const [stats, recentLeads] = await Promise.all([getStats(), getRecentLeads()]);

  const cards = [
    {
      title: 'Tổng Lead',
      value: stats.total,
      icon: Users,
      gradient: 'from-indigo-500 to-blue-600',
      shadow: 'shadow-indigo-500/20',
    },
    {
      title: 'Lead hôm nay',
      value: stats.todayCount,
      icon: UserPlus,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
    },
    {
      title: 'Đang xử lý',
      value: stats.processingCount,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
    },
    {
      title: 'Cần xử lý (Mới)',
      value: stats.newCount,
      icon: AlertCircle,
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-500/20',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Tổng quan hệ thống quản lý Lead
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

      {/* Recent leads */}
      <div
        className="rounded-xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Lead mới nhất
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            5 lead gần nhất được tiếp nhận
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Họ tên</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>SĐT</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Nguồn</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Trạng thái</th>
                <th className="px-5 py-3 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    Chưa có dữ liệu lead nào
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-t transition-colors hover:bg-[var(--muted)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{lead.fullname}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--muted-foreground)' }}>{lead.phone}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--muted-foreground)' }}>{lead.source}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        lead.status === 'NEW' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        lead.status === 'PROCESSING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                        lead.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                        'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}>
                        {statusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(lead.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
