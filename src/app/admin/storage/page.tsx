'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Trash2,
  FileSpreadsheet,
  ShieldAlert,
  RefreshCw,
  Database,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  ArrowDownToLine,
  Eraser,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogEntry {
  id: number;
  action: 'EXPORT' | 'PURGE';
  count: number;
  note: string | null;
  created_at: string;
}

interface StorageData {
  totalCount: number;
  exportedCount: number;
  unexportedCount: number;
  todayCount: number;
  estimatedSizeMB: number;
  exportedSizeMB: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  totalExportedAllTime: number;
  totalPurgedAllTime: number;
  todayExported: number;
  todayPurged: number;
  recentLogs: LogEntry[];
  weeklyBreakdown: { weekStart: string; count: number }[];
}

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [purging, setPurging] = useState(false);
  const [showPurgePanel, setShowPurgePanel] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads/storage');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      toast.error('Lỗi khi tải thống kê dung lượng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePurge = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Vui lòng nhập chính xác: DELETE');
      return;
    }
    setPurging(true);
    try {
      const res = await fetch('/api/leads/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setConfirmText('');
        setShowPurgePanel(false);
        fetchData();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Lỗi khi dọn dẹp dữ liệu');
    } finally {
      setPurging(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (n: number) => n.toLocaleString('vi-VN');

  const cardBase = 'rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5';

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <RefreshCw className="h-6 w-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Đang tải thống kê...
        </span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Quản lý Dung lượng
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Theo dõi, xuất Excel & dọn dẹp dữ liệu Lead để tối ưu chi phí server
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Row 1: Database stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Tổng bản ghi trong DB</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                {formatNumber(data.totalCount)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20">
              <Database className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            ≈ {data.estimatedSizeMB} MB dung lượng
          </p>
        </div>

        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Chờ xuất Excel</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-500">
                {formatNumber(data.unexportedCount)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Cần xuất trước khi dọn dẹp
          </p>
        </div>

        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Đã xuất (chờ dọn dẹp)</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-500">
                {formatNumber(data.exportedCount)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            ≈ {data.exportedSizeMB} MB có thể giải phóng
          </p>
        </div>

        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Lead mới hôm nay</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                {formatNumber(data.todayCount)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Tiếp nhận trong ngày
          </p>
        </div>
      </div>

      {/* Row 2: Permanent export/purge stats + Timeline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <ArrowDownToLine className="h-4.5 w-4.5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Đã xuất hôm nay</p>
              <p className="text-lg font-bold tabular-nums text-blue-500">{formatNumber(data.todayExported)}</p>
            </div>
          </div>
        </div>
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Eraser className="h-4.5 w-4.5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Đã dọn dẹp hôm nay</p>
              <p className="text-lg font-bold tabular-nums text-red-500">{formatNumber(data.todayPurged)}</p>
            </div>
          </div>
        </div>
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Tổng đã xuất (all-time)</p>
              <p className="text-lg font-bold tabular-nums text-emerald-500">{formatNumber(data.totalExportedAllTime)}</p>
            </div>
          </div>
        </div>
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <Trash2 className="h-4.5 w-4.5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Tổng đã dọn (all-time)</p>
              <p className="text-lg font-bold tabular-nums text-purple-500">{formatNumber(data.totalPurgedAllTime)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Timeline info + Weekly chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            <Info className="h-4 w-4 text-blue-500" />
            Thông tin Database
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted-foreground)' }}>Bản ghi cũ nhất</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{formatDate(data.oldestRecord)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted-foreground)' }}>Bản ghi mới nhất</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>{formatDate(data.newestRecord)}</span>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted-foreground)' }}>Dung lượng ước tính</span>
                <span className="font-bold" style={{ color: 'var(--foreground)' }}>
                  {data.estimatedSizeMB >= 1024
                    ? `${(data.estimatedSizeMB / 1024).toFixed(1)} GB`
                    : `${data.estimatedSizeMB} MB`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            <FileSpreadsheet className="h-4 w-4 text-purple-500" />
            Lead theo tuần (8 tuần gần nhất)
          </h3>
          <div className="mt-4 space-y-2">
            {data.weeklyBreakdown.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Chưa có dữ liệu</p>
            ) : (
              data.weeklyBreakdown.map((w) => {
                const maxCount = Math.max(...data.weeklyBreakdown.map((x) => x.count));
                const barWidth = maxCount > 0 ? (w.count / maxCount) * 100 : 0;
                return (
                  <div key={w.weekStart} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 tabular-nums font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(w.weekStart).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'var(--muted)' }}>
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                      {formatNumber(w.count)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Activity log */}
      <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          <History className="h-4 w-4 text-cyan-500" />
          Lịch sử hoạt động
        </h3>
        <div className="mt-4">
          {data.recentLogs.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
              Chưa có hoạt động xuất/dọn dẹp nào
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      log.action === 'EXPORT' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    {log.action === 'EXPORT' ? (
                      <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Eraser className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {log.note || (log.action === 'EXPORT' ? 'Xuất Excel' : 'Dọn dẹp')}
                    </p>
                    <p className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                      log.action === 'EXPORT'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {log.action === 'EXPORT' ? '+' : '-'}{formatNumber(log.count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Workflow guide */}
      <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          <HardDrive className="h-4 w-4 text-cyan-500" />
          Quy trình dọn dẹp dữ liệu
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 font-bold text-sm">1</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Xuất Excel</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Vào Quản lý Lead → Xuất Excel. Hệ thống tự đánh dấu &quot;đã xuất&quot;.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 font-bold text-sm">2</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Kiểm tra file</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Mở file Excel, xác nhận dữ liệu đầy đủ & chính xác.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500 font-bold text-sm">3</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Dọn dẹp</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Nhập <strong>DELETE</strong> → Xóa sạch data đã xuất khỏi database.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 6: Purge action */}
      <div
        className={`${cardBase} border-2`}
        style={{
          background: 'var(--card)',
          borderColor: showPurgePanel ? 'rgb(239 68 68 / 0.4)' : 'var(--border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Dọn dẹp dữ liệu đã xuất
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Xóa toàn bộ {formatNumber(data.exportedCount)} bản ghi đã xuất Excel · Giải phóng ≈ {data.exportedSizeMB} MB
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPurgePanel(!showPurgePanel)}
            disabled={data.exportedCount === 0}
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-500/10 hover:border-red-500/30 disabled:opacity-40 disabled:pointer-events-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <ShieldAlert className="h-4 w-4" />
            {showPurgePanel ? 'Đóng' : 'Dọn dẹp'}
          </button>
        </div>

        {showPurgePanel && (
          <div className="mt-5 border-t pt-5 space-y-4 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="text-xs" style={{ color: 'var(--foreground)' }}>
                <p className="font-semibold">Lưu ý quan trọng:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  <li>Chỉ xóa bản ghi <strong>đã được xuất Excel</strong></li>
                  <li>Bản ghi <strong>chưa xuất</strong> sẽ được giữ nguyên</li>
                  <li>Lịch sử xuất/dọn dẹp <strong>luôn được lưu lại</strong></li>
                  <li>Hành động này <strong>không thể hoàn tác</strong></li>
                </ul>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Nhập <span className="text-red-500 font-mono">DELETE</span> để xác nhận xóa
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && confirmText === 'DELETE') handlePurge();
                  }}
                />
                <button
                  onClick={handlePurge}
                  disabled={purging || confirmText !== 'DELETE'}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {purging ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Xóa {formatNumber(data.exportedCount)} bản ghi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
