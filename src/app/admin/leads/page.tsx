'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Download, Trash2, Search, Filter, X, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Edit2, Eye, MoreHorizontal, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/leads/status-badge';
import { LeadForm } from '@/components/leads/lead-form';
import { DeleteDialog } from '@/components/leads/delete-dialog';
import type { Lead, LeadFilters, LeadsResponse } from '@/lib/types';

const statusOptions = [
  { value: '', label: 'Tất cả' },
  { value: 'NEW', label: 'Mới' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'FAILED', label: 'Lỗi' },
];

async function fetchLeads(filters: LeadFilters): Promise<LeadsResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const res = await fetch(`/api/leads?${params}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LeadFilters>({ page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => fetchLeads(filters),
  });

  const leads = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.details ? Object.values(err.details).flat().join(', ') : err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Thêm lead thành công!'); setShowForm(false); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (err: Error) => toast.error(err.message || 'Lỗi khi thêm lead'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: formData }: { id: number; data: Record<string, string> }) => {
      const res = await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.details ? Object.values(err.details).flat().join(', ') : err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Cập nhật thành công!'); setEditLead(null); setShowForm(false); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (err: Error) => toast.error(err.message || 'Lỗi khi cập nhật'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 1) {
        const res = await fetch(`/api/leads/${ids[0]}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        return res.json();
      }
      const res = await fetch('/api/leads/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => { toast.success('Xóa thành công!'); setShowDelete(false); setDeleteIds([]); setSelected(new Set()); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: () => toast.error('Lỗi khi xóa'),
  });

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

  const handleExport = async (exportSelected: boolean) => {
    try {
      const body: Record<string, unknown> = {};
      if (exportSelected && selected.size > 0) {
        body.ids = Array.from(selected);
      } else {
        body.filters = { search: filters.search, status: filters.status, source: filters.source, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
      }
      const res = await fetch('/api/leads/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Xuất Excel thành công!');
    } catch { toast.error('Lỗi khi xuất Excel'); }
  };

  const toggleSelectAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l: Lead) => l.id)));
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (filters.sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return filters.sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const columns = [
    { key: 'fullname', label: 'Họ tên' },
    { key: 'phone', label: 'SĐT' },
    { key: 'email', label: 'Email' },
    { key: 'source', label: 'Nguồn' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'created_at', label: 'Ngày tạo' },
  ];

  const btnBase = "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Quản lý Lead</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>Quản lý danh sách data lead từ Landing Page ({total} lead)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport(false)} className={btnBase + " border"} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <Download className="h-4 w-4" /> Xuất Excel
          </button>
          <button onClick={() => { setEditLead(null); setShowForm(true); }}
            className={btnBase + " bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl"}>
            <Plus className="h-4 w-4" /> Thêm Lead
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input placeholder="Tìm theo tên, SĐT, email..." className="h-10 flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--foreground)' }} value={searchInput}
              onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            {searchInput && <button onClick={() => { setSearchInput(''); setFilters(p => ({ ...p, search: '', page: 1 })); }}><X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={btnBase + " border"} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <Filter className="h-4 w-4" /> Lọc
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['leads'] })} className={btnBase + " border"} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Trạng thái</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.status || ''} onChange={e => setFilters(p => ({ ...p, status: e.target.value as LeadFilters['status'], page: 1 }))}>
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Nguồn</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                placeholder="Nhập nguồn..." value={filters.source || ''} onChange={e => setFilters(p => ({ ...p, source: e.target.value, page: 1 }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Từ ngày</label>
              <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.dateFrom || ''} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value, page: 1 }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Đến ngày</label>
              <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                value={filters.dateTo || ''} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value, page: 1 }))} />
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border p-3 animate-slide-in" style={{ background: 'var(--card)', borderColor: 'var(--primary)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Đã chọn <span className="font-bold text-indigo-500">{selected.size}</span> lead
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleExport(true)} className={btnBase + " border"} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              <Download className="h-4 w-4" /> Xuất đã chọn
            </button>
            <button onClick={() => { setDeleteIds(Array.from(selected)); setShowDelete(true); }}
              className={btnBase + " bg-red-600 text-white hover:bg-red-700"}>
              <Trash2 className="h-4 w-4" /> Xóa đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={leads.length > 0 && selected.size === leads.length} onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 accent-indigo-500" />
                </th>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left">
                    <button onClick={() => handleSort(col.key)} className="flex items-center gap-1.5 font-semibold transition-colors"
                      style={{ color: 'var(--muted-foreground)' }}>
                      {col.label} <SortIcon col={col.key} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--muted-foreground)' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 w-full animate-pulse rounded" style={{ background: 'var(--muted)' }} /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center" style={{ color: 'var(--muted-foreground)' }}>Không tìm thấy lead nào</td></tr>
              ) : (
                leads.map((lead: Lead) => (
                  <tr key={lead.id} className="border-t transition-colors group" style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-indigo-500" />
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{lead.fullname}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{lead.phone}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{lead.email || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{lead.source}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(lead.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditLead(lead); setShowForm(true); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setDeleteIds([lead.id]); setShowDelete(true); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors"
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
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
              Trang {filters.page} / {totalPages} · {total} kết quả
            </p>
            <div className="flex items-center gap-1">
              <button disabled={filters.page === 1} onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) - 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = filters.page! <= 3 ? i + 1 : filters.page! - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setFilters(prev => ({ ...prev, page: p }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${p === filters.page ? 'bg-indigo-500 text-white' : 'border'}`}
                    style={p !== filters.page ? { borderColor: 'var(--border)', color: 'var(--foreground)' } : {}}>
                    {p}
                  </button>
                );
              })}
              <button disabled={filters.page === totalPages} onClick={() => setFilters(p => ({ ...p, page: (p.page || 1) + 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <LeadForm open={showForm} lead={editLead} loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => { setShowForm(false); setEditLead(null); }}
        onSubmit={(data) => editLead ? updateMutation.mutate({ id: editLead.id, data }) : createMutation.mutate(data)} />

      {showDelete && (
        <DeleteDialog count={deleteIds.length} loading={deleteMutation.isPending}
          onCancel={() => { setShowDelete(false); setDeleteIds([]); }}
          onConfirm={() => deleteMutation.mutate(deleteIds)} />
      )}
    </div>
  );
}
