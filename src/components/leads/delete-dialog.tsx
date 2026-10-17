'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteDialogProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteDialog({ count, onConfirm, onCancel, loading }: DeleteDialogProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  if (!portalRoot) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ isolation: 'isolate' }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div
        className="relative z-10 m-4 w-full max-w-md rounded-xl border p-6 shadow-2xl animate-fade-in"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>

          <h3 className="mb-2 text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            Xác nhận xóa
          </h3>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Bạn có chắc chắn muốn xóa{' '}
            <span className="font-semibold text-red-600 dark:text-red-400">{count}</span>{' '}
            lead? Hành động này không thể hoàn tác.
          </p>

          <div className="flex w-full gap-3">
            <button
              onClick={onCancel}
              className="flex-1 h-10 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--muted)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Hủy bỏ
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-10 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalRoot);
}
