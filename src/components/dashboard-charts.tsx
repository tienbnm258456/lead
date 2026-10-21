'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ShoppingCart,
  PackagePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
interface DashboardChartsProps {
  stats: {
    total: number;
    todayCount: number;
    pendingCount: number;
    successCount: number;
    failedCount: number;
  };
  dailyOrders: { date: string; count: number; revenue: number }[];
  statusDistribution: { name: string; value: number; color: string }[];
  topLandingPages: { name: string; orders: number }[];
  recentOrders: {
    id: number;
    external_id: string;
    customer_name: string;
    customer_phone: string;
    total_price: string | number;
    sync_status: string;
    created_at: string;
  }[];
}

// ── Status maps — Using new CSS variable–based badge classes ──
const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  TIMEOUT: 'Timeout',
};
const statusBadge: Record<string, string> = {
  PENDING: 'badge-warning',
  SUCCESS: 'badge-success',
  FAILED: 'badge-error',
  TIMEOUT: 'badge-error',
};

// ── Custom chart tooltip ──
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-elevated px-3 py-2 text-xs !shadow-lg">
      <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: 'var(--muted-foreground)' }}>
          {p.name}: <span className="font-bold" style={{ color: 'var(--foreground)' }}>{p.value.toLocaleString('vi-VN')}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardCharts({
  stats,
  dailyOrders,
  statusDistribution,
  topLandingPages,
  recentOrders,
}: DashboardChartsProps) {
  const formatPrice = (price: unknown) => {
    const num = typeof price === 'string' ? parseFloat(price) : Number(price);
    return new Intl.NumberFormat('uz-UZ').format(num);
  };

  const successRate = stats.total > 0 ? Math.round((stats.successCount / stats.total) * 100) : 0;

  const cards = [
    {
      title: 'Tổng đơn hàng',
      value: stats.total,
      icon: ShoppingCart,
      gradient: 'from-indigo-500 to-blue-600',
      shadow: 'shadow-indigo-500/15',
      ring: 'ring-indigo-500/10',
    },
    {
      title: 'Đơn hôm nay',
      value: stats.todayCount,
      icon: PackagePlus,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/15',
      ring: 'ring-emerald-500/10',
    },
    {
      title: 'Chờ xử lý',
      value: stats.pendingCount,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/15',
      ring: 'ring-amber-500/10',
    },
    {
      title: 'Tỉ lệ thành công',
      value: `${successRate}%`,
      icon: successRate >= 80 ? TrendingUp : successRate > 0 ? TrendingDown : Activity,
      gradient: successRate >= 80 ? 'from-emerald-500 to-green-600' : 'from-red-500 to-rose-600',
      shadow: successRate >= 80 ? 'shadow-emerald-500/15' : 'shadow-red-500/15',
      ring: successRate >= 80 ? 'ring-emerald-500/10' : 'ring-red-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-caption mt-1">Tổng quan hệ thống quản lý Đơn hàng</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="card-elevated group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-caption">{card.title}</p>
                <p className="text-metric">
                  {typeof card.value === 'number' ? card.value.toLocaleString('vi-VN') : card.value}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg ${card.shadow} transition-transform group-hover:scale-110`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            {/* Bottom accent line on hover */}
            <div className={`absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r ${card.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Area Chart — Daily orders */}
        <div className="lg:col-span-2 card-elevated p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-section-heading">Đơn hàng 7 ngày gần nhất</h2>
              <p className="text-caption mt-0.5">Số lượng đơn hàng theo ngày</p>
            </div>
            <div className="flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-caption"
              style={{ borderColor: 'var(--border)' }}>
              <Activity className="h-3.5 w-3.5" />
              7 ngày
            </div>
          </div>

          <div className="h-[260px]">
            {dailyOrders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyOrders} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Đơn hàng"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fill="url(#colorOrders)"
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: 'var(--card)' }}
                    activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2, fill: 'var(--card)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-caption">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart — Status distribution */}
        <div className="card-elevated p-5">
          <div className="mb-4">
            <h2 className="text-section-heading">Phân bố trạng thái</h2>
            <p className="text-caption mt-0.5">Tỉ lệ trạng thái đồng bộ</p>
          </div>

          <div className="h-[180px]">
            {statusDistribution.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusDistribution.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value} đơn`, name]}
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: 'var(--card-shadow)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-caption">Chưa có dữ liệu</p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {statusDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-caption">{item.name}</span>
                <span className="ml-auto font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Bar Chart — Top Landing Pages */}
        <div className="lg:col-span-2 card-elevated p-5">
          <div className="mb-4">
            <h2 className="text-section-heading flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              Top Landing Pages
            </h2>
            <p className="text-caption mt-0.5">Số đơn hàng theo Landing Page</p>
          </div>

          <div className="h-[240px]">
            {topLandingPages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topLandingPages} layout="vertical" margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="orders"
                    name="Đơn hàng"
                    fill="#4f46e5"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  >
                    {topLandingPages.map((_, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={['#4f46e5', '#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe'][index % 5]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-caption">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent orders — card list */}
        <div className="lg:col-span-3 card-elevated p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-section-heading">Đơn hàng gần nhất</h2>
              <p className="text-caption mt-0.5">5 đơn hàng mới nhất</p>
            </div>
            <a
              href="/admin/orders"
              className="flex items-center gap-1 text-xs font-semibold transition-colors hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              Xem tất cả <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2.5">
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart className="mx-auto h-10 w-10 mb-2" style={{ color: 'var(--disabled)' }} />
                <p className="text-body font-medium" style={{ color: 'var(--foreground)' }}>
                  Chưa có đơn hàng nào
                </p>
              </div>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--muted)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Status icon */}
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                    order.sync_status === 'SUCCESS' ? 'badge-success' :
                    order.sync_status === 'PENDING' ? 'badge-warning' :
                    'badge-error'
                  )}>
                    {order.sync_status === 'SUCCESS' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : order.sync_status === 'PENDING' ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--primary)' }}>
                        {order.external_id}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        statusBadge[order.sync_status] || 'badge-info'
                      }`}>
                        {statusLabels[order.sync_status] || order.sync_status}
                      </span>
                    </div>
                    <p className="text-caption truncate mt-0.5">
                      {order.customer_name} · {order.customer_phone}
                    </p>
                  </div>

                  {/* Price + date */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {formatPrice(order.total_price)} UZS
                    </p>
                    <p className="text-caption mt-0.5 tabular-nums">
                      {new Date(order.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
