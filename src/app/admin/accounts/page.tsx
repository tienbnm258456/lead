'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AccountFormDialog } from '@/components/account-form-dialog';
interface Account { id: number; username: string; name: string; email: string | null; role: string; group_id: number | null; active: boolean }
interface Group { id: number; name: string }
const labels: Record<string, string> = { ADMIN: 'Quản trị viên', ADMIN2: 'Quản lý', USER: 'Người dùng' };
const blank = { username: '', name: '', email: '', password: '', role: 'USER', group_id: '', active: true };
export default function AccountsPage() {
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [users, setUsers] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users'); const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không tải được tài khoản');
      setUsers(body.data); setGroups(body.groups);
    } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi kết nối'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch('/api/auth/me').then(r => r.json()).then(user => { setMe(user); if (['ADMIN', 'ADMIN2'].includes(user.role)) load(); else setLoading(false); }).catch(() => { setError('Không xác thực được phiên'); setLoading(false); }); }, [load]);
  const edit = (user: Account | null) => {
    setEditing(user); setForm(user ? { username: user.username, name: user.name, email: user.email || '', password: '', role: user.role, group_id: String(user.group_id || ''), active: user.active } : { ...blank, role: me?.role === 'ADMIN' ? 'ADMIN2' : 'USER' }); setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      const response = await fetch('/api/admin/users', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editing?.id, group_id: form.group_id ? Number(form.group_id) : undefined }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      toast.success(editing ? 'Đã cập nhật và thu hồi phiên cũ' : 'Đã tạo tài khoản'); setOpen(false); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Lỗi kết nối'); }
    finally { setBusy(false); }
  };
  const remove = async (user: Account) => {
    if (!confirm('Khóa tài khoản ' + user.username + '? Lịch sử dữ liệu được giữ nguyên.')) return;
    try {
      const response = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); toast.success(body.message); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Lỗi kết nối'); }
  };
  if (!loading && !['ADMIN', 'ADMIN2'].includes(me?.role || '')) return <p>Không có quyền quản lý tài khoản.</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Quản lý tài khoản</h1>
      <button onClick={() => edit(null)} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Thêm tài khoản</button></div>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {loading ? <p>Đang tải...</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
      <thead><tr>{['Tài khoản', 'Họ tên', 'Email', 'Vai trò', 'Nhóm', 'Trạng thái', 'Thao tác'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody>{users.map(user => <tr className="border-t" key={user.id}>
        <td className="p-3">{user.username}</td><td className="p-3">{user.name}</td><td className="p-3">{user.email || '—'}</td>
        <td className="p-3">{labels[user.role]}</td><td className="p-3">{groups.find(group => group.id === user.group_id)?.name || 'Chưa gán nhóm'}</td>
        <td className="p-3">{user.active ? 'Hoạt động' : 'Đã khóa'}</td>
        <td className="p-3">{user.role !== 'ADMIN' && user.id !== me?.id && <div className="flex gap-3"><button onClick={() => edit(user)}>Sửa</button><button onClick={() => remove(user)} className="text-red-500" disabled={!user.active}>Xóa / khóa</button></div>}</td>
      </tr>)}</tbody></table></div>}
    {open && <AccountFormDialog
      editing={!!editing} canCreateManager={me?.role === 'ADMIN'} busy={busy}
      form={form} setForm={setForm} groups={groups}
      onClose={() => setOpen(false)} onSubmit={save}
    />}
  </div>;
}
