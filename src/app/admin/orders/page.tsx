'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Filter, X, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
  ShoppingCart, Package, Globe, Plus, Edit2, Trash2, Download, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: number;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_price: string;
  selected_package: string | null;
  selected_size: string | null;
  sync_status: string;
  landing_slug: string | null;
  exported_at: string | null;
  created_at: string;
}

interface LandingPageOption {
  slug: string;
  name: string;
  productName: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  landingPages: LandingPageOption[];
}

interface OrderFilters {
  search?: string;
  status?: string;
  landingSlug?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const statusOptions = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'SUCCESS', label: 'Thành công' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'TIMEOUT', label: 'Timeout' },
];

const statusConfig: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Chờ xử lý', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  SUCCESS: { label: 'Thành công', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  FAILED: { label: 'Thất bại', classes: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  TIMEOUT: { label: 'Timeout', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
};

async function fetchOrders(filters: OrderFilters): Promise<OrdersResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.landingSlug) params.set('landingSlug', filters.landingSlug);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const res = await fetch(`/api/orders?${params}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState({ customer_name: '', customer_phone: '', delivery_address: '', total_price: '', selected_package: '', selected_size: '' });
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
  });

  const orders = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const landingPages = data?.landingPages || [];

  // Build a lookup map: slug → landing page name for the table column
  const landingPageMap = new Map<string, LandingPageOption>();
  landingPages.forEach(lp => {
    if (!landingPageMap.has(lp.slug)) {
      landingPageMap.set(lp.slug, lp);
    }
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showForm]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Tạo đơn hàng thành công!'); closeForm(); queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Cập nhật thành công!'); closeForm(); queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { toast.success('Xóa thành công!'); setDeleteConfirm(null); queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onError: () => toast.error('Lỗi khi xóa'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch('/api/orders/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error('Bulk delete failed');
      return res.json();
    },
    onSuccess: (data) => { toast.success(data.message); setSelectedIds(new Set()); queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onError: () => toast.error('Lỗi khi xóa hàng loạt'),
  });

  const closeForm = () => { setShowForm(false); setEditOrder(null); setFormData({ customer_name: '', customer_phone: '', delivery_address: '', total_price: '', selected_package: '', selected_size: '' }); };

  const openCreateForm = () => { setEditOrder(null); setFormData({ customer_name: '', customer_phone: '', delivery_address: '', total_price: '', selected_package: '', selected_size: '' }); setShowForm(true); };

  const openEditForm = (o: Order) => {
    setEditOrder(o);
    setFormData({ customer_name: o.customer_name, customer_phone: o.customer_phone, delivery_address: o.delivery_address, total_price: String(parseFloat(o.total_price)), selected_package: o.selected_package || '', selected_size: o.selected_size || '' });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editOrder) {
      updateMutation.mutate({ id: editOrder.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExport = async (mode: 'all' | 'filtered') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('mode', mode);
      // Pass current filters for filtered export
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.landingSlug) params.set('landingSlug', filters.landingSlug);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      window.open(`/api/orders/export?${params}`, '_blank');
      toast.success('Đang tải file Excel...');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['orders'] }), 2000);
    } catch { toast.error('Lỗi xuất Excel'); }
    finally { setExporting(false); }
  };

  // Bulk select helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xác nhận xóa ${selectedIds.size} đơn hàng?`)) return;
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const isFormValid = formData.customer_name.trim() && formData.customer_phone.trim() && formData.delivery_address.trim();

  const handleSort = useCallback((col: string) => {
    setFilters(p => ({
      ...p,
      sortBy: col,
      sortOrder: p.sortBy === col && p.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleSearch = useCallback(() => {
    setFilters(p => ({ ...p, search: searchInput, page: 1 }));
  }, [searchInput]);

  const SortIcon = ({ col }: { col: string }) => {
    if (filters.sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return filters.sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const columns = [
    { key: 'external_id', label: 'Mã đơn' },
    { key: 'landing_slug', label: 'Landing Page' },
    { key: 'customer_name', label: 'Khách hàng' },
    { key: 'customer_phone', label: 'SĐT' },
    { key: 'delivery_address', label: 'Địa chỉ', noSort: true },
    { key: 'total_price', label: 'Tổng tiền' },
    { key: 'selected_package', label: 'Gói SP', noSort: true },
    { key: 'sync_status', label: 'Trạng thái' },
    { key: 'created_at', label: 'Ngày tạo' },
    { key: 'actions', label: '', noSort: true },
  ];

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('uz-UZ').format(num) + ' UZS';
  };

  // Get the active filter count to show on the filter button
  const activeFilterCount = [filters.status, filters.landingSlug, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  const btnBase = "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Quản lý Đơn hàng
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Danh sách đơn hàng từ LadiPage ({total} đơn)
            {filters.landingSlug && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Globe className="h-3 w-3" />
                {landingPageMap.get(filters.landingSlug)?.name || filters.landingSlug}
                <button
                  onClick={() => setFilters(p => ({ ...p, landingSlug: '', page: 1 }))}
                  className="ml-0.5 hover:text-indigo-900 dark:hover:text-indigo-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('filtered')} disabled={exporting}
            className={btnBase + ' border'} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <Download className="h-4 w-4" /> {exporting ? 'Đang xuất...' : 'Xuất theo bộ lọc'}
          </button>
          <button onClick={() => handleExport('all')} disabled={exporting}
            className={btnBase + ' border'} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <FileSpreadsheet className="h-4 w-4" /> Xuất tất cả
          </button>
          <button onClick={openCreateForm}
            className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl'}>
            <Plus className="h-4 w-4" /> Thêm đơn
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              placeholder="Tìm theo tên, SĐT, mã đơn..."
              className="h-10 flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--foreground)' }}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setFilters(p => ({ ...p, search: '', page: 1 })); }}>
                <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={btnBase + " border relative"}
            style={{ borderColor: activeFilterCount > 0 ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)' }}
          >
            <Filter className="h-4 w-4" /> Lọc
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
            className={btnBase + " border"}
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
            {/* Landing Page filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Landing Page</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.landingSlug || ''}
                onChange={e => setFilters(p => ({ ...p, landingSlug: e.target.value, page: 1 }))}
              >
                <option value="">Tất cả trang</option>
                {landingPages.map(lp => (
                  <option key={lp.slug} value={lp.slug}>
                    {lp.name} ({lp.productName})
                  </option>
                ))}
              </select>
            </div>
            {/* Status filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Trạng thái</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.status || ''}
                onChange={e => setFilters(p => ({ ...p, status: e.target.value, page: 1 }))}
              >
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Date from */}
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Từ ngày</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.dateFrom || ''}
                onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value, page: 1 }))}
              />
            </div>
            {/* Date to */}
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Đến ngày</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.dateTo || ''}
                onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value, page: 1 }))}
              />
            </div>
            {/* Clear all filters */}
            {activeFilterCount > 0 && (
              <div className="col-span-full flex justify-end">
                <button
                  onClick={() => setFilters(p => ({ ...p, status: '', landingSlug: '', dateFrom: '', dateTo: '', page: 1 }))}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border p-3 animate-fade-in"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Đã chọn <span className="text-indigo-500 font-bold">{selectedIds.size}</span> đơn
          </span>
          <button onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}
            className={btnBase + ' bg-red-600 text-white hover:bg-red-700 text-xs'}>
            <Trash2 className="h-3.5 w-3.5" /> {bulkDeleteMutation.isPending ? 'Đang xóa...' : 'Xóa đã chọn'}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs font-medium transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="rounded" checked={orders.length > 0 && selectedIds.size === orders.length}
                    onChange={toggleSelectAll} />
                </th>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left">
                    {col.noSort ? (
                      <span className="font-semibold" style={{ color: 'var(--muted-foreground)' }}>{col.label}</span>
                    ) : (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1.5 font-semibold transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {col.label} <SortIcon col={col.key} />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {Array.from({ length: columns.length }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded" style={{ background: 'var(--muted)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <ShoppingCart className="mx-auto h-10 w-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
                    <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Chưa có đơn hàng nào</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {filters.landingSlug
                        ? 'Không tìm thấy đơn hàng cho trang này'
                        : 'Đơn hàng sẽ hiển thị khi có khách đặt hàng từ LadiPage'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order: Order) => (
                  <tr
                    key={order.id}
                    className="border-t transition-colors group"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input type="checkbox" className="rounded"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)} />
                    </td>
                    {/* External ID */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold font-mono bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <Package className="h-3 w-3" />
                        {order.external_id}
                      </span>
                    </td>
                    {/* Landing Page */}
                    <td className="px-4 py-3">
                      {order.landing_slug ? (
                        <button
                          onClick={() => setFilters(p => ({ ...p, landingSlug: order.landing_slug!, page: 1 }))}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-950/60"
                          title={`Lọc theo: ${landingPageMap.get(order.landing_slug)?.name || order.landing_slug}`}
                        >
                          <Globe className="h-3 w-3" />
                          {landingPageMap.get(order.landing_slug)?.name || order.landing_slug}
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>
                      )}
                    </td>
                    {/* Customer name */}
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                      {order.customer_name}
                    </td>
                    {/* Phone */}
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {order.customer_phone}
                    </td>
                    {/* Address */}
                    <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="line-clamp-2" title={order.delivery_address}>
                        {order.delivery_address}
                      </span>
                    </td>
                    {/* Total price */}
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                      {formatPrice(order.total_price)}
                    </td>
                    {/* Selected package */}
                    <td className="px-4 py-3 text-xs max-w-[180px]" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="line-clamp-2" title={order.selected_package || '—'}>
                        {order.selected_package || '—'}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        statusConfig[order.sync_status]?.classes || 'bg-gray-100 text-gray-700'
                      }`}>
                        {statusConfig[order.sync_status]?.label || order.sync_status}
                      </span>
                    </td>
                    {/* Created at */}
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(order.created_at).toLocaleDateString('vi-VN', {
                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                      {order.exported_at && (
                        <span className="ml-1 text-[10px] text-emerald-500" title={`Exported: ${new Date(order.exported_at).toLocaleString('vi-VN')}`}>✓</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditForm(order)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          title="Sửa">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {deleteConfirm === order.id ? (
                          <>
                            <button onClick={() => deleteMutation.mutate(order.id)}
                              className="flex h-7 items-center justify-center rounded-lg px-2 bg-red-600 text-white text-xs font-medium">
                              Xóa
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="flex h-7 items-center justify-center rounded-lg px-2 border text-xs"
                              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                              Hủy
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(order.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            title="Xóa">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Trang {filters.page} / {totalPages} · {total} đơn hàng
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) - 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = filters.page! <= 3 ? i + 1 : filters.page! - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setFilters(prev => ({ ...prev, page: p }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      p === filters.page ? 'bg-indigo-500 text-white' : 'border'
                    }`}
                    style={p !== filters.page ? { borderColor: 'var(--border)', color: 'var(--foreground)' } : {}}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={filters.page === totalPages}
                onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) + 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={closeForm}>
          <div className="w-full max-w-xl flex flex-col rounded-2xl border shadow-2xl animate-fade-in"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', maxHeight: 'calc(100vh - 2rem)' }}
            onClick={e => e.stopPropagation()}>

            <div className="shrink-0 px-7 pt-7 pb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                {editOrder ? 'Sửa đơn hàng' : 'Thêm đơn hàng'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {editOrder ? `Chỉnh sửa đơn ${editOrder.external_id}` : 'Tạo đơn hàng thủ công'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-7 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tên khách <span className="text-red-500">*</span></label>
                  <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    placeholder="Họ tên" value={formData.customer_name} onChange={e => setFormData(p => ({ ...p, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>SĐT <span className="text-red-500">*</span></label>
                  <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    placeholder="+998..." value={formData.customer_phone} onChange={e => setFormData(p => ({ ...p, customer_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Địa chỉ <span className="text-red-500">*</span></label>
                <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="Địa chỉ giao hàng" value={formData.delivery_address} onChange={e => setFormData(p => ({ ...p, delivery_address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tổng tiền (UZS)</label>
                  <input type="number" className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    placeholder="0" value={formData.total_price} onChange={e => setFormData(p => ({ ...p, total_price: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Gói SP</label>
                  <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    placeholder="Gói sản phẩm" value={formData.selected_package} onChange={e => setFormData(p => ({ ...p, selected_package: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tùy chọn</label>
                  <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    placeholder="Size, kg..." value={formData.selected_size} onChange={e => setFormData(p => ({ ...p, selected_size: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3 px-7 py-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={closeForm} className={btnBase + ' border'} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Hủy</button>
              <button onClick={handleSubmit} disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
                className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg disabled:opacity-50'}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Đang lưu...' : editOrder ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>

          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
