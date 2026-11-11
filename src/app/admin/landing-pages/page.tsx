'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, X, RefreshCw, Trash2, Edit2, Copy, Key,
  Globe, CheckCircle, XCircle, ExternalLink, RotateCcw, Package, Ruler,
} from 'lucide-react';
import { toast } from 'sonner';
import { queryScope } from '@/lib/query-scope';
import { parseUZS } from '@/lib/money';
import { isLandingXmlId, landingTones, parseLandingTones, type LandingTone } from '@/lib/ladipage-order';

interface Variant {
  id?: number;
  label: string;
  quantity: number;
  price: number;
  delivery_fee: number;
  promotion?: string | null;
  size: string | null;
  xml_id?: string | null;
}

interface SizesConfig {
  label: string;
  options: string[];
}

interface Product {
  xml_id: string | null;
  tone_xml_ids: LandingTone[] | null;
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
  landing_url: string | null;
  product_id: number;
  product: Product;
  active: boolean;
  group_id?: number | null;
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
  promotion: string;
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

const emptyOption = (): LandingTone => ({ label: '', xmlId: '' });

const emptyVariant = (): FormVariant => ({ label: '', quantity: 1, price: '', delivery_fee: '0', promotion: '' });

export default function LandingPagesPage() {
  const queryClient = useQueryClient();
  const [currentRole, setCurrentRole] = useState('');
  const [viewerScope, setViewerScope] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: number; name: string; display_name: string; assignable: boolean }[]>([]);
  const [formGroup, setFormGroup] = useState('');
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(user => {
      setViewerScope(queryScope(user));
      setCurrentRole(user.role || '');
      if (user.role === 'ADMIN') fetch('/api/admin/users').then(r => r.json()).then(data => setGroups(data.groups || []));
    }).catch(() => {});
  }, []);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<LandingPage | null>(null);
  const [formName, setFormName] = useState('');
  const [formXmlId, setFormXmlId] = useState('');
  const [formUseOptionXmlIds, setFormUseOptionXmlIds] = useState(false);
  const [formOptions, setFormOptions] = useState<LandingTone[]>(() => [emptyOption()]);
  const [formLandingUrl, setFormLandingUrl] = useState('');
  const [formVariants, setFormVariants] = useState<FormVariant[]>([emptyVariant()]);
  const [formHasSizes, setFormHasSizes] = useState(false);
  const [formOptionLabel, setFormOptionLabel] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isPending: isLoading, isFetching } = useQuery({
    queryKey: ['landing-pages', viewerScope, search],
    enabled: viewerScope !== null,
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
    onSuccess: () => { toast.success('Tạo sản phẩm thành công!'); closeForm(); queryClient.invalidateQueries({ queryKey: ['landing-pages'] }); },
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
    setShowForm(false); setEditItem(null); setFormName(''); setFormXmlId(''); setFormUseOptionXmlIds(false); setFormOptions([emptyOption()]); setFormLandingUrl('');
    setFormVariants([emptyVariant()]); setFormHasSizes(false);
    setFormOptionLabel('');
  };

  const openCreateForm = () => {
    setFormGroup('');
    setEditItem(null); setFormName(''); setFormXmlId(''); setFormUseOptionXmlIds(false); setFormOptions([emptyOption()]); setFormLandingUrl('');
    setFormVariants([emptyVariant()]); setFormHasSizes(false);
    setFormOptionLabel('');
    setShowForm(true);
  };

  const openEditForm = (page: LandingPage) => {
    setFormGroup(String(page.group_id || ''));
    setEditItem(page);
    setFormName(page.name);
    setFormXmlId(page.product.xml_id || '');
    const tones = landingTones(page.product.tone_xml_ids);
    setFormUseOptionXmlIds(tones.length > 0);
    setFormLandingUrl(page.landing_url || '');
    setFormVariants(
      page.product.variants.map(v => ({
        id: v.id,
        label: v.label,
        quantity: v.quantity,
        price: String(v.price),
        delivery_fee: String(v.delivery_fee),
        promotion: v.promotion || '',
      })),
    );
    setFormHasSizes(page.product.has_sizes || tones.length > 0);
    const sizesData = page.product.sizes;
    const savedOptions = Array.isArray(sizesData?.options) ? sizesData.options : [];
    const hasMatchingOptions = tones.every(tone => savedOptions.includes(tone.label));
    setFormOptionLabel(tones.length && !hasMatchingOptions ? 'Tone' : sizesData?.label || 'Size');
    setFormOptions(tones.length ? tones : savedOptions.length
      ? savedOptions.map(label => ({ label, xmlId: '' }))
      : [emptyOption()]);
    setShowForm(true);
  };

  const updateVariant = (idx: number, field: keyof FormVariant, value: string | number) => {
    setFormVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeVariant = (idx: number) => setFormVariants(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const invalidPromotion = formVariants.findIndex(v => !v.promotion.trim() || v.promotion.trim().length > 100);
    if (invalidPromotion >= 0) { toast.error('Gói ' + (invalidPromotion + 1) + ': Vui lòng nhập mã khuyến mại, ví dụ 1+1, 2+2 hoặc 1PLUS1, 2PLUS2 (tối đa 100 ký tự)'); return; }
    const variants: Variant[] = formVariants.map(v => ({
      id: v.id,
      label: v.label,
      quantity: v.quantity || 1,
      price: parseUZS(v.price),
      delivery_fee: parseUZS(v.delivery_fee || '0'),
      size: null,
      promotion: v.promotion.trim() || null,
    }));

    const payload = {
      name: formName,
      xml_id: formUseOptionXmlIds ? null : formXmlId.trim(),
      tone_xml_ids: formUseOptionXmlIds ? formOptions : [],
      landing_url: formLandingUrl.trim(),
      ...(currentRole === 'ADMIN' ? { group_id: formGroup ? Number(formGroup) : null } : {}),
      variants,
      has_sizes: formHasSizes,
      option_label: formHasSizes ? formOptionLabel.trim() : undefined,
      sizes: formHasSizes ? formOptions.map(option => option.label.trim()) : [],
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  let validXmlIds = isLandingXmlId(formXmlId);
  if (formUseOptionXmlIds) {
    try {
      validXmlIds = parseLandingTones(formOptions).length > 0;
    } catch {
      validXmlIds = false;
    }
  }
  const isFormValid = formName.trim() && validXmlIds && formVariants.length > 0 && formVariants.every(v => v.promotion.trim() && v.promotion.trim().length <= 100 && v.label.trim() && v.price.trim() && Number.isFinite(parseUZS(v.price)) && parseUZS(v.price) >= 0 && Number.isFinite(parseUZS(v.delivery_fee)) && parseUZS(v.delivery_fee) >= 0)
    && (!formHasSizes || (formOptionLabel.trim() && formOptions.every(option => option.label.trim()) && new Set(formOptions.map(option => option.label.trim().toLowerCase())).size === formOptions.length));

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const copyToClipboard = async (text: string, id: number) => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // Try the fallback when browser permissions block Clipboard API.
    }

    if (!copied) {
      const previousFocus = document.activeElement;
      const field = document.createElement('textarea');
      field.value = text;
      field.readOnly = true;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      try {
        field.focus();
        field.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        field.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      }
    }

    if (!copied) {
      toast.error('Không thể copy tự động. Hãy chọn nội dung và copy thủ công.');
      return;
    }
    setCopiedId(id);
    toast.success('Đã copy!');
    setTimeout(() => setCopiedId(current => current === id ? null : current), 2000);
  };

  const getWebhookUrl = (apiKey: string) => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.bigboxfulfillment.vn').replace(/\/+$/, '');
    return `${baseUrl}/api/webhook/ladipage?api_key=${encodeURIComponent(apiKey)}`;
  };

  const btnBase = 'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Quản lý sản phẩm</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Cấu hình sản phẩm & gói giá ({pages.length} sản phẩm)
          </p>
        </div>
        <button onClick={openCreateForm} className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl'}>
          <Plus className="h-4 w-4" /> Thêm sản phẩm
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
          <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Chưa có sản phẩm nào</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>Thêm sản phẩm đầu tiên để bắt đầu nhận đơn hàng</p>
          <button onClick={openCreateForm} className={btnBase + ' mx-auto mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white'}>
            <Plus className="h-4 w-4" /> Thêm sản phẩm
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
                    <h3 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>
                      {page.landing_url ? (
                        <a href={page.landing_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 hover:text-indigo-500 focus-visible:underline after:absolute after:inset-0 after:z-[1] after:rounded-xl">
                          <span className="truncate">{page.name}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : page.name}
                    </h3>
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
                <div className="relative z-[2] flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
              <div className="relative z-[2] space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <Key className="h-3 w-3" /> API Key
                </label>
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 whitespace-pre-wrap break-all select-all rounded-lg border px-2.5 py-1.5 text-xs font-mono"
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
              <div className="relative z-[2] mt-2.5 space-y-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <ExternalLink className="h-3 w-3" /> Webhook URL
                </label>
                <div className="flex items-start gap-1.5">
                  <code className="min-w-0 flex-1 whitespace-pre-wrap break-all select-all rounded-lg border px-2.5 py-1.5 text-[11px] font-mono"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    {getWebhookUrl(page.api_key)}
                  </code>
                  <button onClick={() => copyToClipboard(getWebhookUrl(page.api_key), page.id + 10000)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
                    style={{ borderColor: 'var(--border)', color: copiedId === page.id + 10000 ? '#10b981' : 'var(--muted-foreground)' }}
                    title="Copy Webhook URL" aria-label="Copy Webhook URL">
                    {copiedId === page.id + 10000 ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <p className="mt-2.5 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                Tạo lúc: {new Date(page.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>

              {/* Delete overlay */}
              {showDeleteConfirm === page.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm animate-fade-in z-10">
                  <p className="text-sm font-semibold text-white mb-1">Xóa sản phẩm này?</p>
                  <p className="text-xs text-white/70 mb-4">Ngừng nhận webhook, giữ nguyên lịch sử đơn hàng</p>
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
                {editItem ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Cấu hình sản phẩm, gói mua & giá. API Key tạo tự động.
              </p>
            </div>

            {/* ── Content (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-7 space-y-6">
              <label className="grid gap-1.5 text-sm font-semibold">
                URL landing page
                <input type="url" maxLength={2048} value={formLandingUrl} onChange={e => setFormLandingUrl(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3"
                  placeholder="https://example.com/san-pham" />
              </label>
              {currentRole === 'ADMIN' && <label className="block text-sm font-semibold">Nhóm sở hữu
                <select className="mt-2 w-full rounded-lg border p-3" style={{ background: 'var(--card)', color: 'var(--foreground)' }} value={formGroup} onChange={e => setFormGroup(e.target.value)}>
                  <option value="">Chỉ Quản trị viên / chưa phân công</option>{groups.map(group => <option key={group.id} value={group.id} disabled={!group.assignable}>{group.display_name}{!group.assignable ? ' (không có Quản lý hoạt động)' : ''}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>Đổi nhóm sẽ chuyển sản phẩm và toàn bộ đơn hàng liên quan sang nhóm mới.</span>
              </label>}
              {/* Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tên sản phẩm <span className="text-red-500">*</span></label>
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
                      <label className="block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Thông tin khuyến mại <span className="text-red-500">*</span>
                        <input required aria-required="true" aria-describedby={`promotion-help-${idx}`} aria-label={`Thông tin khuyến mại gói ${idx + 1}`} maxLength={100} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          placeholder="VD: 1+1, 2+2 hoặc 1PLUS1, 2PLUS2" value={v.promotion} onChange={e => updateVariant(idx, 'promotion', e.target.value)} />
                        <span id={`promotion-help-${idx}`} className="mt-1.5 block text-xs font-normal leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                          Nhập đúng mã khuyến mại đã thống nhất với đối tác: <strong>1+1</strong>, <strong>2+2</strong> hoặc <strong>1PLUS1</strong>, <strong>2PLUS2</strong>. Chỉ nhập mã, không nhập phần giải thích hoặc giá tiền.
                          Mã này được ghép với XML ID sản phẩm và size/tùy chọn để CRM nhận diện đúng gói khách đặt.
                        </span>
                      </label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Mỗi gói chọn là 1 combo. Tất cả size khách chọn được ghi chung cho từng gói để sale gọi xác nhận. Giá/ship nhập UZS đầy đủ (299.000 → CRM 299).</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Giá (UZS)</label>
                          <input type="text" inputMode="numeric" pattern="[0-9., ]*" className="w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            placeholder="299.000" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Phí ship (UZS)</label>
                          <input type="text" inputMode="numeric" pattern="[0-9., ]*" className="w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500/30"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            placeholder="50.000" value={v.delivery_fee} onChange={e => updateVariant(idx, 'delivery_fee', e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Số lượng combo</label>
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
                  <button type="button" role="switch" aria-label="Có tùy chọn phụ" aria-checked={formHasSizes} disabled={formUseOptionXmlIds} onClick={() => setFormHasSizes(!formHasSizes)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formHasSizes ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formHasSizes ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={formUseOptionXmlIds} onChange={e => {
                      const checked = e.target.checked;
                      setFormUseOptionXmlIds(checked);
                      if (checked) {
                        setFormHasSizes(true);
                        setFormOptions(previous => previous.length < 2 ? [...previous, emptyOption()] : previous);
                      }
                    }} />
                    Sản phẩm có nhiều XML ID
                  </label>
                  {!formUseOptionXmlIds && (
                    <label className="grid gap-1.5 text-sm font-semibold">
                      XML ID dùng chung
                      <input maxLength={255} className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 font-mono"
                        placeholder="Nhập XML ID gốc" value={formXmlId} onChange={e => setFormXmlId(e.target.value)} />
                    </label>
                  )}
                </div>
                {formHasSizes && (
                  <div className="mt-4 space-y-3">
                    <label className="grid gap-1.5 text-sm font-semibold">
                      Tên tùy chọn
                      <input maxLength={100} className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2.5"
                        placeholder="Ví dụ: Tone, Size, Trọng lượng" value={formOptionLabel} onChange={e => setFormOptionLabel(e.target.value)} />
                    </label>
                    {formOptions.map((option, index) => (
                      <div key={index} className="flex flex-wrap items-end gap-2">
                        <label className="grid min-w-36 flex-1 gap-1 text-sm">
                          Giá trị {index + 1}
                          <input maxLength={100} value={option.label} placeholder="Ví dụ: Natural White"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2"
                            onChange={e => setFormOptions(previous => previous.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} />
                        </label>
                        {formUseOptionXmlIds && (
                          <label className="grid min-w-36 flex-1 gap-1 text-sm">
                            XML ID
                            <input maxLength={255} value={option.xmlId}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-mono"
                              onChange={e => setFormOptions(previous => previous.map((row, i) => i === index ? { ...row, xmlId: e.target.value } : row))} />
                          </label>
                        )}
                        {formOptions.length > (formUseOptionXmlIds ? 2 : 1) && (
                          <button type="button" className="p-2 text-red-500" aria-label={'Xóa giá trị ' + (index + 1)}
                            onClick={() => setFormOptions(previous => previous.filter((_, i) => i !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setFormOptions(previous => [...previous, emptyOption()])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-500">
                      <Plus className="h-4 w-4" /> Thêm giá trị
                    </button>
                    <p className="text-xs text-[var(--muted-foreground)]">Trên LadiPage, gửi giá trị đã chọn qua option và gói mua qua products.</p>
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

