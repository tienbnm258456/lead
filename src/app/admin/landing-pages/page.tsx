'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, X, RefreshCw, Trash2, Edit2, Copy, Key,
  Globe, CheckCircle, XCircle, ExternalLink, RotateCcw, Package, Ruler,
} from 'lucide-react';
import { toast } from 'sonner';

interface Variant {
  id?: number;
  label: string;
  quantity: number;
  price: number;
  delivery_fee: number;
  size: string | null;
}

interface SizesConfig {
  label: string;
  options: string[];
}

interface Product {
  id: number;
  name: string;
  slug: string;
  has_sizes: boolean;
  sizes: SizesConfig | null;
  variants: Variant[];
}

interface LandingPage {
  id: number;
  name: string;
  api_key: string;
  product_id: number;
  product: Product;
  active: boolean;
  created_at: string;
}

interface LandingPagesResponse {
  data: LandingPage[];
  total: number;
}

interface FormVariant {
  id?: number;
  label: string;
  quantity: number;
  price: string;
  delivery_fee: string;
}

async function fetchLandingPages(search: string): Promise<LandingPagesResponse> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('pageSize', '100');
  const res = await fetch(`/api/landing-pages?${params}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

const formatUZS = (val: number) => new Intl.NumberFormat('uz-UZ').format(val) + ' UZS';

const emptyVariant = (): FormVariant => ({ label: '', quantity: 1, price: '', delivery_fee: '0' });

export default function LandingPagesPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<LandingPage | null>(null);
  const [formName, setFormName] = useState('');
  const [formVariants, setFormVariants] = useState<FormVariant[]>([emptyVariant()]);
  const [formHasSizes, setFormHasSizes] = useState(false);
  const [formOptionLabel, setFormOptionLabel] = useState('Size');
  const [formSizes, setFormSizes] = useState<string[]>([]);
  const [newSizeInput, setNewSizeInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['landing-pages', search],
    queryFn: () => fetchLandingPages(search),
  });

  const pages = data?.data || [];

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showForm]);

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.details?.join(', ') || err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Tạo Landing Page thành công!'); closeForm(); queryClient.invalidateQueries({ queryKey: ['landing-pages'] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/landing-pages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.details?.join(', ') || err.error); }
      return res.json();
    },
    onSuccess: () => { toast.success('Cập nhật thành công!'); closeForm(); queryClient.invalidateQueries({ queryKey: ['landing-pages'] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/landing-pages/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => { toast.success('Xóa thành công!'); setShowDeleteConfirm(null); queryClient.invalidateQueries({ queryKey: ['landing-pages'] }); },
    onError: () => toast.error('Lỗi khi xóa'),
  });

  const regenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/landing-pages/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Regenerate failed');
      return res.json();
    },
    onSuccess: () => { toast.success('Đã tạo lại API Key mới!'); queryClient.invalidateQueries({ queryKey: ['landing-pages'] }); },
    onError: () => toast.error('Lỗi khi tạo lại API Key'),
  });

  // ── Form helpers ──────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false); setEditItem(null); setFormName('');
    setFormVariants([emptyVariant()]); setFormHasSizes(false);
    setFormOptionLabel('Size'); setFormSizes([]); setNewSizeInput('');
  };

  const openCreateForm = () => {
    setEditItem(null); setFormName('');
    setFormVariants([emptyVariant()]); setFormHasSizes(false);
    setFormOptionLabel('Size'); setFormSizes([]); setNewSizeInput('');
    setShowForm(true);
  };

  const openEditForm = (page: LandingPage) => {
    setEditItem(page);
    setFormName(page.name);
    setFormVariants(
      page.product.variants.map(v => ({
        id: v.id,
        label: v.label,
        quantity: v.quantity,
        price: String(v.price),
        delivery_fee: String(v.delivery_fee),
      })),
    );
    setFormHasSizes(page.product.has_sizes);
    const sizesData = page.product.sizes;
    setFormOptionLabel(sizesData?.label || 'Size');
    setFormSizes(Array.isArray(sizesData?.options) ? sizesData.options : []);
    setNewSizeInput('');
    setShowForm(true);
  };

  const updateVariant = (idx: number, field: keyof FormVariant, value: string | number) => {
    setFormVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeVariant = (idx: number) => setFormVariants(prev => prev.filter((_, i) => i !== idx));

  const addSize = () => {
    const s = newSizeInput.trim();
    if (s && !formSizes.includes(s)) {
      setFormSizes(prev => [...prev, s]);
      setNewSizeInput('');
    }
  };

  const removeSize = (idx: number) => setFormSizes(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const variants: Variant[] = formVariants.map(v => ({
      id: v.id,
      label: v.label,
      quantity: v.quantity || 1,
      price: Number(v.price),
      delivery_fee: Number(v.delivery_fee || 0),
      size: null,
    }));

    const payload = {
      name: formName,
      variants,
      has_sizes: formHasSizes,
      option_label: formHasSizes ? formOptionLabel : undefined,
      sizes: formHasSizes ? formSizes : [],
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isFormValid = formName.trim() && formVariants.length > 0 && formVariants.every(v => v.label.trim() && Number(v.price) >= 0)
    && (!formHasSizes || formSizes.length > 0);

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã copy!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWebhookUrl = (apiKey: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain';
    return `${baseUrl}/api/webhook/ladipage?api_key=${apiKey}`;
  };

  const btnBase = 'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Quản lý Landing Page</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Đăng ký trang LadiPage, cấu hình sản phẩm & gói giá ({pages.length} trang)
          </p>
        </div>
        <button onClick={openCreateForm} className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl'}>
          <Plus className="h-4 w-4" /> Thêm Landing Page
        </button>
      </div>

      {/* Search */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input placeholder="Tìm theo tên, API Key..." className="h-10 flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--foreground)' }}
              value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            {searchInput && <button onClick={() => { setSearchInput(''); setSearch(''); }}><X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /></button>}
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['landing-pages'] })} className={btnBase + ' border'} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="h-5 w-3/4 animate-pulse rounded" style={{ background: 'var(--muted)' }} />
              <div className="h-4 w-1/2 animate-pulse rounded" style={{ background: 'var(--muted)' }} />
              <div className="h-20 w-full animate-pulse rounded" style={{ background: 'var(--muted)' }} />
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-xl border p-16 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Globe className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Chưa có Landing Page nào</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>Thêm trang đầu tiên để bắt đầu nhận đơn hàng</p>
          <button onClick={openCreateForm} className={btnBase + ' mx-auto mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white'}>
            <Plus className="h-4 w-4" /> Thêm Landing Page
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map(page => (
            <div key={page.id} className="group relative rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{page.name}</h3>
                    {page.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditForm(page)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors" style={{ color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} title="Sửa">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setShowDeleteConfirm(page.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} title="Xóa">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Variants */}
              <div className="mb-2.5 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <Package className="h-3 w-3" /> Gói sản phẩm ({page.product.variants.length})
                </label>
                <div className="space-y-1">
                  {page.product.variants.map((v, i) => (
                    <div key={v.id || i} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                      <span className="truncate font-medium" style={{ color: 'var(--foreground)' }}>{v.label}</span>
                      <span className="ml-2 shrink-0 font-semibold tabular-nums whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                        {formatUZS(Number(v.price))}
                        {Number(v.delivery_fee) > 0 && (
                          <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--muted-foreground)' }}>
                            +{formatUZS(Number(v.delivery_fee))} ship
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra options (sizes, weights, colors, etc.) */}
              {page.product.has_sizes && page.product.sizes && Array.isArray(page.product.sizes.options) && page.product.sizes.options.length > 0 && (
                <div className="mb-2.5 space-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                    <Ruler className="h-3 w-3" /> {page.product.sizes.label} ({page.product.sizes.options.length})
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {page.product.sizes.options.map((s: string, i: number) => (
                      <span key={i} className="inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <Key className="h-3 w-3" /> API Key
                </label>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 truncate rounded-lg border px-2.5 py-1.5 text-xs font-mono"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>{page.api_key}</code>
                  <button onClick={() => copyToClipboard(page.api_key, page.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
                    style={{ borderColor: 'var(--border)', color: copiedId === page.id ? '#10b981' : 'var(--muted-foreground)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} title="Copy">
                    {copiedId === page.id ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => { if (confirm('Tạo lại API Key mới?')) regenMutation.mutate(page.id); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors text-amber-500"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} title="Tạo lại API Key">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="mt-2.5 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <ExternalLink className="h-3 w-3" /> Webhook URL
                </label>
                <button onClick={() => copyToClipboard(getWebhookUrl(page.api_key), page.id + 10000)}
                  className="w-full text-left rounded-lg border px-2.5 py-1.5 text-[11px] font-mono truncate transition-colors"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} title="Click để copy">
                  {getWebhookUrl(page.api_key)}
                </button>
              </div>

              <p className="mt-2.5 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                Tạo lúc: {new Date(page.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>

              {/* Delete overlay */}
              {showDeleteConfirm === page.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm animate-fade-in z-10">
                  <p className="text-sm font-semibold text-white mb-1">Xóa Landing Page này?</p>
                  <p className="text-xs text-white/70 mb-4">Sản phẩm & gói giá cũng sẽ bị xóa</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConfirm(null)} className="rounded-lg border border-white/30 px-4 py-1.5 text-sm text-white hover:bg-white/10">Hủy</button>
                    <button onClick={() => deleteMutation.mutate(page.id)} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700" disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal (Portal to body) ──────────────────── */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={closeForm}>
          <div className="w-full max-w-2xl flex flex-col rounded-2xl border shadow-2xl animate-fade-in"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', maxHeight: 'calc(100vh - 2rem)' }}
            onClick={e => e.stopPropagation()}>

            {/* ── Header (fixed) ── */}
            <div className="shrink-0 px-7 pt-7 pb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                {editItem ? 'Sửa Landing Page' : 'Thêm Landing Page mới'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Cấu hình trang, gói sản phẩm & giá. API Key tạo tự động.
              </p>
            </div>

            {/* ── Content (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-7 space-y-6">
              {/* Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tên trang / Sản phẩm <span className="text-red-500">*</span></label>
                <input className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="VD: Đai lưng, Kem tẩy lông..."
                  value={formName} onChange={e => setFormName(e.target.value)} />
              </div>

              {/* ── Variants ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                    <Package className="inline h-3.5 w-3.5 mr-1" /> Gói sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <button onClick={() => setFormVariants(prev => [...prev, emptyVariant()])}
                    className="flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-400 transition-colors">
                    <Plus className="h-3 w-3" /> Thêm gói
                  </button>
                </div>
                <div className="space-y-3">
                  {formVariants.map((v, idx) => (
                    <div key={idx} className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Gói {idx + 1}</span>
                        {formVariants.length > 1 && (
                          <button onClick={() => removeVariant(idx)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                      <input className="w-full rounded-lg border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        placeholder="Tên gói (VD: 1 dona xarid + 1 sovga – 299.000 UZS)"
                        value={v.label} onChange={e => updateVariant(idx, 'label', e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Giá (UZS)</label>
                          <input type="number" className="w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            placeholder="299" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Phí ship (UZS)</label>
                          <input type="number" className="w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            placeholder="50" value={v.delivery_fee} onChange={e => updateVariant(idx, 'delivery_fee', e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Số lượng</label>
                          <input type="number" min="1" className="w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            placeholder="1" value={v.quantity} onChange={e => updateVariant(idx, 'quantity', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Extra option toggle ── */}
              <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                      <Ruler className="h-3.5 w-3.5" /> Có tùy chọn phụ?
                    </label>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Bật nếu LadiPage có thêm trường chọn (VD: size, kg, màu sắc...)
                    </p>
                  </div>
                  <button type="button" onClick={() => setFormHasSizes(!formHasSizes)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formHasSizes ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formHasSizes ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {formHasSizes && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tên tùy chọn</label>
                      <input className="w-full rounded-lg border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                        style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        placeholder="VD: Size, Trọng lượng, Màu sắc..." value={formOptionLabel} onChange={e => setFormOptionLabel(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Các giá trị</label>
                      <div className="flex items-center gap-2">
                        <input className="flex-1 rounded-lg border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                          style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          placeholder={formOptionLabel === 'Size' ? "VD: S o'lcham: 55 kg dan kam" : `VD: ${formOptionLabel} 1`}
                          value={newSizeInput} onChange={e => setNewSizeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                        <button onClick={addSize} disabled={!newSizeInput.trim()}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white disabled:opacity-40 transition-colors hover:bg-indigo-600">
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    {formSizes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {formSizes.map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
                            style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                            {s}
                            <button onClick={() => removeSize(i)} className="ml-0.5 text-red-400 hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-center py-2" style={{ color: 'var(--muted-foreground)' }}>Thêm ít nhất 1 giá trị cho {formOptionLabel}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer (fixed) ── */}
            <div className="shrink-0 flex justify-end gap-3 px-7 py-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={closeForm} className={btnBase + ' border'} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Hủy</button>
              <button onClick={handleSubmit} disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
                className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg disabled:opacity-50'}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Đang lưu...' : editItem ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>

          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

