'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, Trash2, ShieldAlert, RefreshCw, Database,
  CheckCircle2, AlertTriangle, FileSpreadsheet, ClipboardList, History,
} from 'lucide-react';
import { toast } from 'sonner';

interface StorageData {
  totalOrders: number;
  exportedOrders: number;
  unexportedOrders: number;
  dbSizeMB: number;
  dbSizeBytes: number;
  baseOverheadKB: number;
  tableBreakdown: { name: string; totalKB: number; dataKB: number; indexKB: number; rows: number }[];
  avgOrdersPerDay: number;
  daysTo100K: number | null;
  totalSyncLogs: number;
  totalActivityLogs: number;
  totalExportedAllTime: number;
  totalPurgedAllTime: number;
  todayExported: number;
  todayPurged: number;
  recentLogs: { id: number; action: string; count: number; note: string | null; created_at: string }[];
}

interface CleanupSettings {
  sync_log_cleanup_value: string;
  sync_log_cleanup_unit: string;
  activity_log_cleanup_value: string;
  activity_log_cleanup_unit: string;
}

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [purging, setPurging] = useState(false);
  const [showPurgePanel, setShowPurgePanel] = useState(false);
  const [settings, setSettings] = useState<CleanupSettings>({
    sync_log_cleanup_value: '30', sync_log_cleanup_unit: 'days',
    activity_log_cleanup_value: '90', activity_log_cleanup_unit: 'days',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [reloadingCache, setReloadingCache] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storage');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      toast.error('Lỗi khi tải thống kê dung lượng');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => { fetchData(); fetchSettings(); }, [fetchData, fetchSettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // UI chỉ cho cấu hình theo ngày → force unit = 'days'
      const payload = {
        ...settings,
        sync_log_cleanup_unit: 'days',
        activity_log_cleanup_unit: 'days',
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) toast.success('Đã lưu cấu hình cleanup');
      else toast.error(json.error);
    } catch { toast.error('Lỗi lưu cấu hình'); }
    finally { setSavingSettings(false); }
  };

  const handleReloadCache = async () => {
    setReloadingCache(true);
    try {
      const res = await fetch('/api/settings', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success('Cache đã reload từ DB');
        if (json.data) setSettings(json.data);
      } else {
        toast.error(json.error || 'Lỗi reload cache');
      }
    } catch { toast.error('Lỗi reload cache'); }
    finally { setReloadingCache(false); }
  };

  const handlePurge = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Vui lòng nhập chính xác: DELETE');
      return;
    }
    setPurging(true);
    try {
      const res = await fetch('/api/storage', {
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

  const formatNumber = (n: number) => n.toLocaleString('vi-VN');

  const cardBase = 'rounded-xl border p-5 transition-all duration-300';

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <RefreshCw className="h-6 w-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>Đang tải thống kê...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Quản lý Dung lượng</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Theo dõi & dọn dẹp dữ liệu đơn hàng đã xuất Excel
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      {/* Row 1: Core stats — 4 cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tổng đơn hàng */}
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Tổng đơn trong DB</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                {formatNumber(data.totalOrders)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20">
              <Database className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Dung lượng: <strong>{data.dbSizeMB >= 1024 ? `${(data.dbSizeMB / 1024).toFixed(1)} GB` : `${data.dbSizeMB} MB`}</strong>
          </p>
        </div>

        {/* Đã xuất Excel + chưa clear */}
        <div className={`${cardBase} ${data.exportedOrders > 0 ? 'border-amber-500/40' : ''}`} style={{ background: 'var(--card)', borderColor: data.exportedOrders > 0 ? undefined : 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Đã xuất Excel (chưa clear)</p>
              <p className={`mt-1.5 text-2xl font-bold tabular-nums ${data.exportedOrders > 0 ? 'text-amber-500' : ''}`} style={data.exportedOrders === 0 ? { color: 'var(--foreground)' } : {}}>
                {formatNumber(data.exportedOrders)}
              </p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${data.exportedOrders > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {data.exportedOrders > 0 ? '⚠ Có thể dọn dẹp để giải phóng' : '✓ Không có đơn cần dọn dẹp'}
          </p>
        </div>

        {/* Chưa xuất Excel */}
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Chưa xuất Excel</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-blue-500">{formatNumber(data.unexportedOrders)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/20">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Đơn hàng chưa được xuất ra file
          </p>
        </div>

        {/* Tổng đã clear (all time) */}
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Đã xuất & clear (tổng)</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-500">{formatNumber(data.totalPurgedAllTime)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Đã xuất tổng: <strong>{formatNumber(data.totalExportedAllTime)}</strong> bản ghi
          </p>
        </div>
      </div>

      {/* Row 2: Thống kê hôm nay */}
      <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          📊 Thống kê hôm nay
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Xuất Excel hôm nay</p>
            <p className="text-lg font-bold tabular-nums text-indigo-500 mt-1">{formatNumber(data.todayExported)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Clear data hôm nay</p>
            <p className="text-lg font-bold tabular-nums text-red-500 mt-1">{formatNumber(data.todayPurged)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tổng xuất Excel</p>
            <p className="text-lg font-bold tabular-nums text-emerald-500 mt-1">{formatNumber(data.totalExportedAllTime)}</p>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tổng đã clear</p>
            <p className="text-lg font-bold tabular-nums text-purple-500 mt-1">{formatNumber(data.totalPurgedAllTime)}</p>
          </div>
        </div>
      </div>

      {/* Row 2.5: DB Breakdown + Optimization */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Per-table breakdown */}
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            <Database className="h-4 w-4 text-blue-500" /> Chi tiết dung lượng ({data.dbSizeMB} MB)
          </h3>
          <div className="space-y-2">
            {data.tableBreakdown.map(table => {
              const maxKB = Math.max(...data.tableBreakdown.map(t => t.totalKB));
              const barWidth = maxKB > 0 ? (table.totalKB / maxKB) * 100 : 0;
              const tableName: Record<string, string> = {
                orders: 'Đơn hàng',
                order_sync_logs: 'Sync logs',
                activity_logs: 'Activity logs',
                products: 'Sản phẩm',
                product_variants: 'Gói SP',
                product_sizes: 'Tùy chọn',
                landing_pages: 'Landing Pages',
              };
              return (
                <div key={table.name} className="flex items-center gap-3 text-xs">
                  <span className="w-28 shrink-0 font-medium truncate" style={{ color: 'var(--muted-foreground)' }} title={table.name}>
                    {tableName[table.name] || table.name}
                  </span>
                  <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'var(--muted)' }}>
                    <div className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="w-16 text-right tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                    {table.totalKB >= 1024 ? `${(table.totalKB / 1024).toFixed(1)} MB` : `${table.totalKB} KB`}
                  </span>
                  <span className="w-14 text-right tabular-nums text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {formatNumber(table.rows)} rows
                  </span>
                </div>
              );
            })}
            <div className="border-t pt-2 mt-2 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              💡 PostgreSQL cần ~{formatNumber(data.baseOverheadKB)} KB overhead cho metadata + indexes. Phần data thực tế chỉ chiếm {Math.max(0, Math.round(data.dbSizeBytes / 1024 - data.baseOverheadKB))} KB.
            </div>
          </div>
        </div>

        {/* Optimization + Settings */}
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            📈 Dự báo & Cấu hình Cleanup
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Trung bình đơn/ngày (30 ngày)</span>
              <span className="font-bold tabular-nums">{data.avgOrdersPerDay}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Dự kiến đạt 100K records</span>
              <span className="font-bold tabular-nums">
                {data.daysTo100K ? (data.daysTo100K > 365 ? `${Math.round(data.daysTo100K / 365)} năm` : `${data.daysTo100K} ngày`) : '—'}
              </span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Sync logs hiện có</span>
              <span className="font-bold tabular-nums">{formatNumber(data.totalSyncLogs)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Activity logs hiện có</span>
              <span className="font-bold tabular-nums">{formatNumber(data.totalActivityLogs)}</span>
            </div>

            {/* Dynamic cleanup config */}
            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-xs" style={{ color: 'var(--foreground)' }}>🛡️ Cấu hình auto-cleanup (áp dụng khi dọn dẹp)</p>

              {/* Sync logs cleanup */}
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>Sync logs xóa sau</span>
                <input type="number" min="1" className="w-20 rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={settings.sync_log_cleanup_value}
                  onChange={e => setSettings(p => ({ ...p, sync_log_cleanup_value: e.target.value }))} />
                <span className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>Ngày</span>
              </div>

              {/* Activity logs cleanup */}
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>Activity logs xóa sau</span>
                <input type="number" min="1" className="w-20 rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={settings.activity_log_cleanup_value}
                  onChange={e => setSettings(p => ({ ...p, activity_log_cleanup_value: e.target.value }))} />
                <span className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>Ngày</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleSaveSettings} disabled={savingSettings}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all hover:shadow-xl">
                  {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
                <button onClick={handleReloadCache} disabled={reloadingCache}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <RefreshCw className={`h-3 w-3 ${reloadingCache ? 'animate-spin' : ''}`} />
                  {reloadingCache ? 'Đang reload...' : 'Reload cache'}
                </button>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                💡 Nếu thay đổi cấu hình trực tiếp trong DB, bấm &quot;Reload cache&quot; để áp dụng ngay.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Quy trình dọn dẹp */}
      <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          <HardDrive className="h-4 w-4 text-cyan-500" /> Quy trình dọn dẹp
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 font-bold text-sm">1</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Xuất Excel</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Tab Đơn hàng → Lọc theo sản phẩm/trạng thái → Xuất theo bộ lọc hoặc Xuất tất cả
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 font-bold text-sm">2</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Kiểm tra file</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Mở file Excel kiểm tra data đầy đủ. Đơn đã xuất sẽ hiện ở ô &ldquo;Đã xuất Excel (chưa clear)&rdquo;.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500 font-bold text-sm">3</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Dọn dẹp</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Nhập <strong>DELETE</strong> → Xóa đơn đã xuất Excel. Đơn chưa xuất giữ nguyên.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Purge action */}
      <div className={`${cardBase} border-2`}
        style={{ background: 'var(--card)', borderColor: showPurgePanel ? 'rgb(239 68 68 / 0.4)' : 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Dọn dẹp đơn đã xuất Excel</h3>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {data.exportedOrders > 0
                  ? `⚠ Có ${formatNumber(data.exportedOrders)} đơn đã xuất Excel chưa được clear`
                  : '✓ Không có đơn nào cần dọn dẹp'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowPurgePanel(!showPurgePanel)} disabled={data.exportedOrders === 0}
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-500/10 hover:border-red-500/30 disabled:opacity-40 disabled:pointer-events-none"
            style={{ borderColor: 'var(--border)' }}>
            <ShieldAlert className="h-4 w-4" /> {showPurgePanel ? 'Đóng' : 'Dọn dẹp'}
          </button>
        </div>

        {showPurgePanel && (
          <div className="mt-5 border-t pt-5 space-y-4 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="text-xs" style={{ color: 'var(--foreground)' }}>
                <p className="font-semibold">Lưu ý quan trọng:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  <li>Chỉ xóa đơn hàng đã được <strong>xuất Excel</strong> (exported_at ≠ null)</li>
                  <li>Đơn <strong>chưa xuất Excel</strong> được giữ nguyên an toàn</li>
                  <li>Hành động này <strong>không thể hoàn tác</strong> — hãy chắc chắn đã lưu file Excel</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Nhập <span className="text-red-500 font-mono">DELETE</span> để xác nhận xóa {formatNumber(data.exportedOrders)} đơn
              </label>
              <div className="flex gap-3">
                <input type="text" placeholder="DELETE" value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && confirmText === 'DELETE') handlePurge(); }} />
                <button onClick={handlePurge} disabled={purging || confirmText !== 'DELETE'}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none">
                  {purging ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Đang xóa...</>
                  ) : (
                    <><Trash2 className="h-4 w-4" /> Xóa {formatNumber(data.exportedOrders)} đơn</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 5: Lịch sử hoạt động */}
      {data.recentLogs.length > 0 && (
        <div className={cardBase} style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            <History className="h-4 w-4 text-purple-500" /> Lịch sử hoạt động gần nhất
          </h3>
          <div className="space-y-2">
            {data.recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    log.action === 'EXPORT'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {log.action === 'EXPORT' ? 'EXPORT' : 'CLEAR'}
                  </span>
                  <span style={{ color: 'var(--foreground)' }}>{log.note}</span>
                </div>
                <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(log.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
