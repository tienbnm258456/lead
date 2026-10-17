'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Edit3, User, Phone, Mail, FileText, Globe, Tag } from 'lucide-react';
import type { Lead } from '@/lib/types';

interface LeadFormProps {
  lead?: Lead | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => void;
  loading?: boolean;
}

const statusOptions = [
  { value: 'NEW', label: 'Mới' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'FAILED', label: 'Lỗi' },
];

export function LeadForm({ lead, open, onClose, onSubmit, loading }: LeadFormProps) {
  const [form, setForm] = useState({
    fullname: '',
    phone: '',
    email: '',
    note: '',
    source: 'Landing Page',
    utm_source: '',
    utm_medium: '',
    status: 'NEW',
  });

  const fullnameInputRef = useRef<HTMLInputElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Set portal root after mount
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (lead) {
      setForm({
        fullname: lead.fullname,
        phone: lead.phone,
        email: lead.email || '',
        note: lead.note || '',
        source: lead.source,
        utm_source: lead.utm_source || '',
        utm_medium: lead.utm_medium || '',
        status: lead.status,
      });
    } else {
      setForm({
        fullname: '',
        phone: '',
        email: '',
        note: '',
        source: 'Landing Page',
        utm_source: '',
        utm_medium: '',
        status: 'NEW',
      });
    }
  }, [lead, open]);

  // Auto focus fullname input when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        fullnameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape key & lock body scroll
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent background scrolling while modal is open
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !portalRoot) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const inputCls =
    'w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 placeholder:text-muted-foreground/60';

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ isolation: 'isolate' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - scrollable within viewport */}
      <div
        className="relative z-10 m-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl animate-fade-in"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — always visible */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
              {lead ? <Edit3 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                {lead ? 'Chỉnh sửa Lead' : 'Thêm Lead mới'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {lead ? 'Cập nhật thông tin khách hàng' : 'Nhập thông tin khách hàng từ Landing Page'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--muted)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            title="Đóng (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Row 1: Fullname & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lead-fullname"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  <User className="h-3.5 w-3.5 text-indigo-500" />
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input
                  id="lead-fullname"
                  ref={fullnameInputRef}
                  name="fullname"
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A"
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.fullname}
                  onChange={(e) => setForm((p) => ({ ...p, fullname: e.target.value }))}
                />
              </div>
              <div>
                <label
                  htmlFor="lead-phone"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-500" />
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  id="lead-phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="VD: 0912345678"
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 2: Email */}
            <div>
              <label
                htmlFor="lead-email"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                Email
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                placeholder="VD: nguyenvana@gmail.com"
                className={inputCls}
                style={{
                  background: 'var(--muted)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            {/* Row 3: Note */}
            <div>
              <label
                htmlFor="lead-note"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                Ghi chú
              </label>
              <textarea
                id="lead-note"
                name="note"
                rows={3}
                placeholder="Thông tin yêu cầu, dịch vụ khách hàng quan tâm..."
                className={inputCls + ' resize-none'}
                style={{
                  background: 'var(--muted)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>

            {/* Row 4: Source & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lead-source"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  <Globe className="h-3.5 w-3.5 text-cyan-500" />
                  Nguồn Lead
                </label>
                <input
                  id="lead-source"
                  name="source"
                  type="text"
                  placeholder="VD: Facebook Ads, Google Ads..."
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.source}
                  onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                />
              </div>
              <div>
                <label
                  htmlFor="lead-status"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  <Tag className="h-3.5 w-3.5 text-purple-500" />
                  Trạng thái
                </label>
                <select
                  id="lead-status"
                  name="status"
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 5: UTM Source & Medium */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lead-utm-source"
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  UTM Source
                </label>
                <input
                  id="lead-utm-source"
                  name="utm_source"
                  type="text"
                  placeholder="VD: facebook, tiktok, google"
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.utm_source}
                  onChange={(e) => setForm((p) => ({ ...p, utm_source: e.target.value }))}
                />
              </div>
              <div>
                <label
                  htmlFor="lead-utm-medium"
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  UTM Medium
                </label>
                <input
                  id="lead-utm-medium"
                  name="utm_medium"
                  type="text"
                  placeholder="VD: cpc, banner, bio"
                  className={inputCls}
                  style={{
                    background: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  value={form.utm_medium}
                  onChange={(e) => setForm((p) => ({ ...p, utm_medium: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Footer — always pinned at bottom */}
          <div
            className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border px-5 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang lưu...
                </>
              ) : lead ? (
                'Cập nhật Lead'
              ) : (
                'Thêm Lead mới'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render via portal to escape overflow-hidden from admin layout
  return createPortal(modalContent, portalRoot);
}
