'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const endpoint = '/api/uz-products/stocker/settings';
const accountKey = ['stocker-account'];
const fieldClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm';
const buttonClass = 'inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50';

type Account = { login: string; hasPassword: boolean };

async function readAccount(response: Response): Promise<Account> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Không đọc được tài khoản Stocker');
  return data;
}

export function StockerAccountSettings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: accountKey,
    queryFn: ({ signal }) => fetch(endpoint, { signal }).then(readAccount),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const account = await readAccount(await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: form.get('login'), password: form.get('password') }),
      }));
      queryClient.setQueryData(accountKey, account);
      await queryClient.invalidateQueries({ queryKey: ['uz-products', 'stocker'] });
      setEditing(false);
      toast.success('Đã kiểm tra đăng nhập và lưu tài khoản Stocker');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được tài khoản Stocker');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elevated max-w-xl space-y-4 p-5" aria-labelledby="stocker-account-title">
      <h2 id="stocker-account-title" className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound size={18} /> Tài khoản Stocker
      </h2>
      {isPending ? <p role="status" className="text-sm">Đang tải tài khoản…</p>
        : error ? <div className="space-y-3">
          <p role="alert" className="text-sm">{error.message}</p>
          <button type="button" className={buttonClass} onClick={() => void refetch()}>Thử lại</button>
        </div>
        : editing ? (
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={saving} className="space-y-3">
              <label className="block space-y-1 text-sm font-medium">
                <span>Tài khoản</span>
                <input name="login" required maxLength={150} defaultValue={data?.login} autoComplete="off" className={fieldClass} />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Mật khẩu mới</span>
                <input name="password" type="password" required maxLength={250} autoComplete="new-password" className={fieldClass} />
              </label>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className={buttonClass + ' bg-indigo-600 text-white'}>
                {saving ? 'Đang kiểm tra đăng nhập…' : 'Kiểm tra và lưu'}
              </button>
              <button type="button" disabled={saving} className={buttonClass} onClick={() => setEditing(false)}>Hủy</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-[var(--muted-foreground)]">Tài khoản</dt>
              <dd className="break-all font-medium">{data?.login || 'Chưa cấu hình'}</dd>
              <dt className="text-[var(--muted-foreground)]">Mật khẩu</dt>
              <dd className="font-mono">{data?.hasPassword ? '********' : 'Chưa cấu hình'}</dd>
            </dl>
            <button type="button" className={buttonClass} onClick={() => setEditing(true)}>
              {data?.hasPassword ? 'Cập nhật tài khoản / mật khẩu' : 'Thiết lập tài khoản'}
            </button>
          </>
        )}
    </section>
  );
}
