'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { StockerProductRow } from '@/lib/uz-product';
import { StockerAccountSettings } from '@/components/stocker-account-settings';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50';

async function requestMapping(method: 'POST' | 'PUT' | 'DELETE', payload: object) {
  const response = await fetch('/api/uz-products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || (method === 'DELETE' ? 'Không xóa được mapping' : 'Không lưu được mapping'));
  }
}

function MappingForm({ item, onClose, onSaved }: {
  item: StockerProductRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const hasMapping = Boolean(item.nameVi || item.xmlId);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function writeMapping(method: 'POST' | 'PUT', fields: object) {
    setSaving(true);
    try {
      await requestMapping(method, { sourceId: item.sourceId, ...fields });
      toast.success('Đã lưu thông tin sản phẩm');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void writeMapping(hasMapping ? 'PUT' : 'POST', {
      originalName: item.originalName,
      nameVi: form.get('nameVi'),
      xmlId: form.get('xmlId'),
    });
  }

  return (
    <dialog ref={dialog} aria-labelledby="uz-mapping-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto w-[min(520px,94vw)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] backdrop:bg-black/50">
      <h2 id="uz-mapping-title" className="text-lg font-semibold">{hasMapping ? 'Sửa mapping sản phẩm' : 'Thêm mapping sản phẩm'}</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.originalName}</p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <fieldset disabled={saving} className="space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Tên tiếng Việt
            <input name="nameVi" maxLength={500} defaultValue={item.nameVi ?? ''} className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            XML ID
            <input name="xmlId" maxLength={500} defaultValue={item.xmlId ?? ''} className={inputClass} />
          </label>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonClass} disabled={saving} onClick={onClose}>Hủy</button>
          <button type="submit" className={buttonClass + ' bg-indigo-600 text-white'} disabled={saving}>Lưu</button>
        </div>
      </form>
    </dialog>
  );
}

function ProductThumbnail({ url }: { url?: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- Stocker supplies the image URL.
    <img src={url} alt="" width={52} height={52} loading="lazy" referrerPolicy="no-referrer"
      className="h-13 w-13 shrink-0 rounded-lg bg-[var(--muted)] object-cover" />
  ) : (
    <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]"><Package size={20} /></span>
  );
}

function MappingTable({ items, onEdit, onDelete, deleting }: {
  items: StockerProductRow[];
  onEdit?: (item: StockerProductRow) => void;
  onDelete?: (item: StockerProductRow) => void;
  deleting: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--muted)]">
          <tr>{['Ảnh', 'ID Stocker', 'Tên gốc', 'Tên tiếng Việt', 'Sửa', 'Xóa'].map(label => (
            <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.sourceId} className="border-t border-[var(--border)]">
              <td className="whitespace-nowrap px-4 py-3">
                <ProductThumbnail url={item.imageUrl} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{item.sourceId}</td>
              <td className="min-w-52 px-4 py-3">
                {item.originalName}
                {item.nameVi && item.savedOriginalName && item.savedOriginalName !== item.originalName &&
                  <p className="mt-1 text-xs text-amber-600">Tên gốc đã đổi · Cần xem lại bản dịch</p>}
              </td>
              <td className="min-w-48 px-4 py-3">{item.nameVi ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {onEdit && <button type="button" className={buttonClass} disabled={deleting} onClick={() => onEdit(item)}
                  aria-label={'Sửa mapping cho ' + item.originalName}>
                  <Pencil size={14} /> Sửa
                </button>}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {onDelete && <button type="button" className={buttonClass + ' text-red-500'} disabled={deleting}
                  onClick={() => onDelete(item)} aria-label={'Xóa mapping cho ' + item.originalName}>
                  <Trash2 size={14} /> Xóa
                </button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type StockItem = {
  id: string;
  name: string;
  nameVi?: string | null;
  type: string;
  article?: string | null;
  code?: string | null;
  xmlId?: string | null;
  barcodes?: string[];
  images?: { thumb?: string; large?: string }[];
  stock?: { quantity?: number | null };
  cost?: number | null;
  salePrice?: number | null;
};

function StockTable({ items }: { items: StockItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--muted)]">
          <tr>{['Sản phẩm', 'ID Stocker', 'Mã vạch', 'Tồn kho', 'Giá vốn', 'Giá bán'].map(label => (
            <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {items.map(item => {
            const image = item.images?.[0]?.thumb || item.images?.[0]?.large;
            return (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="min-w-72 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProductThumbnail url={image} />
                    <div>
                      <p lang={item.nameVi ? 'vi' : undefined} className="font-semibold">{item.nameVi || item.name}</p>
                      {item.nameVi && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{item.name}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        {item.type === 'variant' && <span className="rounded-full border border-violet-500/30 px-2 py-0.5 text-violet-500">Biến thể</span>}
                        {item.article && <span>{item.article}</span>}
                        {item.code && <span>#{item.code}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{item.id}</td>
                <td className="px-4 py-3">
                  {item.barcodes?.length ? <div className="flex flex-wrap gap-1">{item.barcodes.map((barcode, index) => (
                    <span key={index} className="rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">{barcode}</span>
                  ))}</div> : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{item.stock?.quantity ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{item.cost ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{item.salePrice ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type CatalogView = 'stock' | 'internal';
type CatalogPage = {
  total: number;
  nextOffset: number | null;
  mappingsUnavailable: boolean;
} & (
  { view: 'stock'; items: StockItem[] } |
  { view: 'internal'; items: StockerProductRow[] }
);

async function fetchCatalogPage(view: CatalogView, page: number, pageSize: number, signal?: AbortSignal, refresh = false): Promise<CatalogPage> {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  });
  params.set(view === 'internal' ? 'localDetails' : 'includeNameVi', '1');
  const response = await fetch('/api/uz-products/stocker?' + params, { signal, method: refresh ? 'POST' : 'GET' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Không tải được danh mục Stocker');
  return { ...body, view };
}

const pageButton = 'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium disabled:opacity-30';

function ProductPicker({ items, loading, page, canGoNext, onPage, onSelect, onClose }: {
  items: StockerProductRow[];
  loading: boolean;
  page: number;
  canGoNext: boolean;
  onPage: (page: number) => void;
  onSelect: (item: StockerProductRow) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLowerCase();
  const candidates = items.filter(item => !item.nameVi && !item.xmlId &&
    [item.sourceId, item.originalName].some(value => value.toLowerCase().includes(keyword)));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="uz-picker-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto w-[min(560px,94vw)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] backdrop:bg-black/50">
      <h2 id="uz-picker-title" className="text-lg font-semibold">Thêm mới mapping</h2>
      <p className="my-2 text-sm text-[var(--muted-foreground)]">Chọn sản phẩm hoặc biến thể từ kho đối tác để lưu tên tiếng Việt và XML ID.</p>
      <input aria-label="Tìm sản phẩm chưa có mapping trên trang" placeholder="Tìm theo tên gốc hoặc ID trên trang"
        className={inputClass} value={search} onChange={event => setSearch(event.target.value)} />
      <div className="my-3 max-h-[45vh] space-y-2 overflow-y-auto">
        {loading ? <p role="status" className="text-sm">Đang tải sản phẩm…</p>
          : candidates.length ? candidates.map(item => (
            <button key={item.sourceId} type="button" onClick={() => onSelect(item)}
              className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--muted)]">
              <span className="block font-medium">{item.originalName}</span>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{item.sourceId}</span>
            </button>
          )) : <p className="text-sm">Trang này không có sản phẩm chưa mapping phù hợp.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Trang trước" className={pageButton} disabled={page === 1 || loading} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button>
          <span className="text-sm">Trang {page}</span>
          <button type="button" aria-label="Trang sau" className={pageButton} disabled={!canGoNext || loading} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button>
        </div>
        <button type="button" className={buttonClass} onClick={onClose}>Đóng</button>
      </div>
    </dialog>
  );
}

function CatalogPanel({ view }: { view: CatalogView }) {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StockerProductRow | null>(null);
  const [picking, setPicking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { page, pageSize } = pagination;
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['uz-products', 'stocker', view, page, pageSize],
    queryFn: ({ signal }) => fetchCatalogPage(view, page, pageSize, signal),
    retry: false,
    staleTime: query => query.state.data?.mappingsUnavailable ? 0 : 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const keyword = search.trim().toLowerCase();
  const removeMapping = useMutation({
    mutationFn: (sourceId: string) => requestMapping('DELETE', { sourceId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['uz-products', 'stocker'] });
      toast.success('Đã xóa bản ghi nội bộ');
    },
    onError: error => toast.error(error.message),
  });

  function confirmDelete(item: StockerProductRow) {
    if (confirm('Xóa toàn bộ bản ghi nội bộ của "' + item.originalName + '"?')) {
      removeMapping.mutate(item.sourceId);
    }
  }

  const matches = (fields: (string | null | undefined)[]) => fields.some(value => value?.toLowerCase().includes(keyword));
  const stockItems = data?.view === 'stock' ? data.items.filter(item =>
    matches([item.id, item.name, item.nameVi, item.article, item.code, item.xmlId, ...(item.barcodes ?? [])])) : [];
  const mappingItems = data?.view === 'internal' ? data.items.filter(item =>
    (item.nameVi || item.xmlId) && matches([item.sourceId, item.originalName, item.nameVi, item.xmlId])) : [];
  const mappingsUnavailable = data?.mappingsUnavailable;
  const searchPlaceholder = view === 'stock'
    ? 'Tìm trong trang theo tên, ID Stocker, SKU, mã sản phẩm hoặc mã vạch'
    : 'Tìm trong trang theo tên, ID Stocker hoặc XML ID';
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const goToPage = (nextPage: number) => setPagination({ page: nextPage, pageSize });

  async function refreshCatalog() {
    setRefreshing(true);
    try {
      const updated = await fetchCatalogPage(view, page, pageSize, undefined, true);
      if (page > Math.max(1, Math.ceil(updated.total / pageSize))) goToPage(1);
      await queryClient.invalidateQueries({ queryKey: ['uz-products', 'stocker'] });
      if (updated.mappingsUnavailable) toast.error('Đã tải kho Stocker, nhưng chưa đọc được mapping.');
      else toast.success('Đã tải lại dữ liệu kho');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải lại được dữ liệu kho');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-4">
          <Search size={16} />
          <input aria-label="Tìm trong trang hiện tại" placeholder={searchPlaceholder}
            value={search} onChange={event => setSearch(event.target.value)} className={inputClass + ' min-w-48 flex-1'} />
          <button type="button" className={buttonClass} disabled={refreshing} onClick={() => void refreshCatalog()}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? 'Đang tải lại…' : 'Tải lại dữ liệu'}
          </button>
          {view === 'internal' && (
            <button type="button" className={buttonClass + ' bg-indigo-600 text-white'}
              disabled={!data || Boolean(error) || mappingsUnavailable || refreshing} onClick={() => setPicking(true)}>
              <Plus size={16} /> Thêm mới
            </button>
          )}
        </div>
        {mappingsUnavailable && (
          <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm">
            <p>Đã tải dữ liệu Stocker. Tạm thời chưa đọc được tên tiếng Việt và XML ID đã lưu.</p>
            <button type="button" className={buttonClass} onClick={() => refetch()}>Tải lại thông tin</button>
          </div>
        )}
        {isPending ? <p className="p-5 text-sm" role="status">Đang tải sản phẩm Stocker…</p>
          : error ? <div className="flex items-center gap-3 p-5 text-sm"><p role="alert">{error.message}</p><button type="button" className={buttonClass} onClick={() => refetch()}>Thử lại</button></div>
          : stockItems.length ? <StockTable items={stockItems} />
          : mappingItems.length ? <MappingTable items={mappingItems} deleting={removeMapping.isPending}
            onEdit={mappingsUnavailable ? undefined : setEditing} onDelete={mappingsUnavailable ? undefined : confirmDelete} />
          : mappingsUnavailable && view === 'internal' ? null
          : <p className="p-5 text-sm">{keyword
            ? 'Không tìm thấy sản phẩm phù hợp trên trang này.'
            : view === 'internal' ? 'Trang này chưa có bản ghi nội bộ đã lưu.' : 'Trang này chưa có sản phẩm.'}</p>}
        <nav aria-label="Phân trang kho đối tác" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3.5">
          <p className="text-sm text-[var(--muted-foreground)]">
            Trang <span className="font-semibold text-[var(--foreground)]">{page}</span>{data && <> / {totalPages} · {data.total} {view === 'internal' ? 'sản phẩm trong kho đối tác' : 'bản ghi'}</>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              Bản ghi/trang
              <select className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-sm text-[var(--foreground)]"
                value={pageSize} onChange={event => setPagination({ page: 1, pageSize: Number(event.target.value) })}>
                {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Trang trước" className={pageButton} disabled={page === 1} onClick={() => goToPage(page - 1)}>
                <ChevronLeft size={16} />
              </button>
              {data && Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                const number = firstPage + index;
                return <button type="button" key={number} aria-current={number === page ? 'page' : undefined}
                  className={pageButton + (number === page ? ' bg-indigo-500 text-white' : '')} onClick={() => goToPage(number)}>{number}</button>;
              })}
              <button type="button" aria-label="Trang sau" className={pageButton} disabled={data?.nextOffset == null || page >= totalPages} onClick={() => goToPage(page + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </nav>
      </div>
      {picking && !mappingsUnavailable && (
        <ProductPicker items={data?.view === 'internal' ? data.items : []} loading={isPending} page={page}
          canGoNext={data?.nextOffset != null && page < totalPages} onPage={goToPage}
          onClose={() => setPicking(false)} onSelect={item => { setPicking(false); setEditing(item); }} />
      )}
      {editing && !mappingsUnavailable && <MappingForm item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void queryClient.invalidateQueries({ queryKey: ['uz-products', 'stocker'] }); }} />}
    </>
  );
}

export function UzProductCatalog() {
  const [view, setView] = useState<CatalogView | 'account'>('stock');
  const tabs = [
    { value: 'stock', label: 'Dữ liệu kho đối tác' },
    { value: 'internal', label: 'Dữ liệu nội bộ' },
    { value: 'account', label: 'Tài khoản Stocker' },
  ] as const;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-page-title flex items-center gap-2">Kho đối tác</h1>
        <p className="text-caption mt-1">{view === 'stock'
          ? 'Xem sản phẩm, biến thể, tồn kho và giá từ Stocker.'
          : 'Quản lý các sản phẩm từ bên đối tác và mapping thông tin tên sang tiếng việt.'}</p>
      </header>
      <div role="group" aria-label="Nguồn dữ liệu sản phẩm" className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button key={tab.value} type="button" aria-pressed={tab.value === view} onClick={() => setView(tab.value)}
            className={buttonClass + (tab.value === view ? ' bg-indigo-600 text-white' : '')}>
            {tab.label}
          </button>
        ))}
      </div>
      {view === 'account' ? <StockerAccountSettings /> : <CatalogPanel key={view} view={view} />}
    </div>
  );
}
