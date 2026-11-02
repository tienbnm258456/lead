'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface OrderDetailData {
  id: number;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_price: string;
  product_price: string;
  delivery_fee: string;
  selected_package: string | null;
  selected_size: string | null;
  sync_status: string;
  landing_slug: string | null;
  created_at: string;
  exported_at: string | null;
  items_json?: string;
  sync_message?: string | null;
  retailcrm_id?: number | null;
  synced_at?: string | null;
  source?: string;
}

const statuses: Record<string, string> = {
  PENDING: 'Chờ xử lý', SUCCESS: 'Thành công', FAILED: 'Thất bại', TIMEOUT: 'Hết thời gian chờ',
};
const money = (value: unknown) => {
  const amount = Number(value);
  return value == null || !Number.isFinite(amount) ? '—' : new Intl.NumberFormat('vi-VN').format(amount) + ' UZS';
};
const date = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—';
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="min-w-0">
    <dt className="mb-1 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</dt>
    <dd className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm select-text">{value === null || value === undefined || value === '' ? '—' : value}</dd>
  </div>;
}

export function OrderDetailsDialog({ order, landingPageName, onClose }: {
  order: OrderDetailData; landingPageName?: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  let items: Record<string, unknown>[] = [];
  let invalidItems = false;
  try {
    const parsed: unknown = JSON.parse(order.items_json || '[]');
    if (Array.isArray(parsed)) items = parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
    else invalidItems = true;
  } catch { invalidItems = true; }
  const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? value : undefined;
  const needsReview = items.some(item => item.selectionError);

  return <dialog ref={dialog} aria-labelledby="order-details-title"
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="min-w-0">
        <h2 id="order-details-title" className="text-lg font-bold">Chi tiết đơn hàng</h2>
        <p className="mt-1 font-mono text-sm [overflow-wrap:anywhere]">{order.external_id}</p>
      </div>
      <button type="button" autoFocus onClick={onClose} aria-label="Đóng chi tiết đơn hàng" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)' }}><X className="h-4 w-4" /></button>
    </header>
    <div className="space-y-6 p-5 sm:p-6">
      <section>
        <h3 className="mb-3 font-semibold">Khách hàng và giao hàng</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên" value={order.customer_name} />
          <Field label="Số điện thoại" value={order.customer_phone} />
          <div className="sm:col-span-2"><Field label="Địa chỉ giao hàng" value={order.delivery_address} /></div>
        </dl>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">Thông tin đơn hàng</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Landing Page" value={landingPageName || order.landing_slug} />
          <Field label="Nguồn đơn" value={order.source} />
          <div className="sm:col-span-2"><Field label="Gói sản phẩm đã chọn" value={order.selected_package} /></div>
          <div className="sm:col-span-2"><Field label="Size / tùy chọn đã chọn" value={order.selected_size} /></div>
          <Field label="Giá sản phẩm" value={needsReview ? 'Chưa xác định' : money(order.product_price)} />
          <Field label="Phí vận chuyển" value={needsReview ? 'Chưa xác định' : money(order.delivery_fee)} />
          <Field label="Tổng tiền" value={needsReview ? 'Chưa xác định — cần kiểm tra lựa chọn' : money(order.total_price)} />
          <Field label="Ngày tạo" value={date(order.created_at)} />
          <Field label="Ngày xuất Excel" value={date(order.exported_at)} />
        </dl>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">Các dòng sản phẩm ({items.length})</h3>
        {invalidItems ? <p className="text-sm">Không đọc được chi tiết dòng hàng. Các lựa chọn gốc vẫn hiển thị ở trên.</p> : items.length === 0 ? <p className="text-sm">Chưa có chi tiết dòng hàng.</p> : <div className="space-y-3">
          {items.map((item, index) => <div key={index} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label={'Dòng ' + (index + 1)} value={text(item.variantLabel) || text(item.productName)} /></div>
              <Field label="Thông tin khuyến mại" value={text(item.promotion)} />
              <Field label="Size / tùy chọn" value={text(item.size)} />
              <Field label="XML ID offer" value={text(item.xmlId)} />
              <Field label="Số lượng" value={text(item.quantity)} />
              <Field label="Đơn giá" value={item.selectionError ? 'Chưa xác định' : money(item.initialPrice)} />
              {!!item.selectionError && <div className="sm:col-span-2"><Field label="Cần kiểm tra" value={text(item.selectionError)} /></div>}
            </dl>
          </div>)}
        </div>}
      </section>
      <section>
        <h3 className="mb-3 font-semibold">Đồng bộ RetailCRM</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Trạng thái" value={statuses[order.sync_status] || order.sync_status} />
          <Field label="Mã đơn RetailCRM" value={order.retailcrm_id} />
          <Field label="Thời điểm đồng bộ gần nhất" value={date(order.synced_at)} />
          <div className="sm:col-span-2"><Field label="Thông báo / lý do lỗi" value={order.sync_message} /></div>
        </dl>
      </section>
    </div>
    <footer className="flex justify-end border-t p-4" style={{ borderColor: 'var(--border)' }}>
      <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)' }}>Đóng</button>
    </footer>
  </dialog>;
}
