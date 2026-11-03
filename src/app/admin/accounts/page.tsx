'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AccountFormDialog } from '@/components/account-form-dialog';
import { AlertCircle, ChevronLeft, ChevronRight, ChevronDown, CircleCheck, LockKeyhole, Mail, Pencil, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, UserRound, Users, X } from 'lucide-react';
interface Account { id: number; username: string; name: string; email: string | null; role: string; group_id: number | null; active: boolean }
interface Group { id: number; name: string; display_name: string; assignable: boolean }
const labels: Record<string, string> = { ADMIN: 'Quản trị viên', ADMIN2: 'Quản lý', USER: 'Người dùng' };
const roleStyles = {
  ADMIN: { icon: ShieldCheck, badge: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400', accent: 'text-violet-500', background: 'bg-violet-500/10', description: 'Toàn quyền hệ thống' },
  ADMIN2: { icon: Users, badge: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400', accent: 'text-sky-500', background: 'bg-sky-500/10', description: 'Phụ trách nhóm làm việc' },
  USER: { icon: UserRound, badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', accent: 'text-emerald-500', background: 'bg-emerald-500/10', description: 'Thành viên trong nhóm' },
};
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
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const response = await fetch('/api/admin/users'); const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không tải được tài khoản');
      setUsers(body.data); setGroups(body.groups);
    } catch (err) { setError(err instanceof Error ? err.message : 'Lỗi kết nối'); }
    finally { setLoading(false); setRefreshing(false); }
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
    setRemovingId(user.id);
    try {
      const response = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); toast.success(body.message); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Lỗi kết nối'); }
    finally { setRemovingId(null); }
  };
  if (!loading && !['ADMIN', 'ADMIN2'].includes(me?.role || '')) return <p>Không có quyền quản lý tài khoản.</p>;
  const totalAdmin = me?.role === 'ADMIN';
  const activeCount = users.filter(user => user.active).length;
  const matches = users.filter(user => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    const group = groups.find(group => group.id === user.group_id)?.display_name || '';
    return (!roleFilter || user.role === roleFilter) && (!statusFilter || (statusFilter === 'active' ? user.active : !user.active)) &&
      (!query || [user.username, user.name, user.email || '', group].some(text => text.toLocaleLowerCase('vi-VN').includes(query)));
  });
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const stats = [
    { label: 'Tổng tài khoản', count: users.length, icon: Users, accent: 'text-indigo-500', background: 'bg-indigo-500/10', description: totalAdmin ? 'Trong toàn hệ thống' : 'Thành viên bạn quản lý', filter: '' },
    ...(totalAdmin ? Object.entries(roleStyles).map(([key, style]) => ({ label: labels[key], count: users.filter(user => user.role === key).length, ...style, filter: key })) : [
      { label: 'Người dùng', count: users.length, ...roleStyles.USER, filter: 'USER' },
      { label: 'Đang hoạt động', count: activeCount, icon: CircleCheck, accent: 'text-sky-500', background: 'bg-sky-500/10', description: 'Có thể đăng nhập', filter: 'active' },
      { label: 'Đã khóa', count: users.length - activeCount, icon: LockKeyhole, accent: 'text-amber-500', background: 'bg-amber-500/10', description: 'Tạm ngừng truy cập', filter: 'locked' },
    ]),
  ];
  const resetFilters = () => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); };
  return <div className="space-y-6 animate-fade-in" style={{ color: 'var(--foreground)' }}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}><ShieldCheck className="h-3.5 w-3.5" />Quản trị truy cập</div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý tài khoản</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{totalAdmin ? 'Quản lý thành viên, vai trò và nhóm làm việc trong hệ thống.' : 'Quản lý các thành viên và quyền truy cập trong nhóm của bạn.'}</p>
      </div>
      <button onClick={() => edit(null)} disabled={!me || loading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/15 transition hover:bg-indigo-500 disabled:opacity-50"><Plus className="h-4 w-4" />Thêm tài khoản</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(stat => { const Icon = stat.icon; const selected = stat.filter ? stat.filter === roleFilter || stat.filter === statusFilter : !roleFilter && !statusFilter;
        return <button key={stat.label} type="button" disabled={loading} aria-pressed={selected} onClick={() => {
          setPage(1);
          if (['active', 'locked'].includes(stat.filter)) { setStatusFilter(stat.filter); setRoleFilter(''); }
          else { setRoleFilter(stat.filter); setStatusFilter(''); }
        }} className="group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0" style={{ background: 'var(--card)', borderColor: selected ? 'rgba(99,102,241,0.45)' : 'var(--border)' }}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</span><span className={'flex h-9 w-9 items-center justify-center rounded-xl ' + stat.background + ' ' + stat.accent}><Icon className="h-4 w-4" /></span></div>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{loading ? <span className="inline-block h-8 w-12 animate-pulse rounded-lg" style={{ background: 'var(--muted)' }} /> : stat.count}</div>
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{stat.description}</p>
        </button>;
      })}
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span><button type="button" onClick={load} className="shrink-0 font-semibold underline">Thử lại</button></div>}
    <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} aria-label="Danh sách tài khoản">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5"><h2 className="text-sm font-bold">Danh sách thành viên</h2><span className="rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{loading ? '…' : users.length}</span></div>
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{activeCount} đang hoạt động</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /><input aria-label="Tìm kiếm tài khoản" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tên, tài khoản, email hoặc nhóm..." className="h-10 w-full rounded-xl border bg-transparent pl-9 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20" style={{ borderColor: 'var(--border)' }} />
          {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md hover:bg-indigo-500/10"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totalAdmin && <div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} /><select aria-label="Lọc vai trò" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="h-10 appearance-none rounded-xl border pl-9 pr-8 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}><option value="">Tất cả vai trò</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 h-3 w-3" /></div>}
          <select aria-label="Lọc trạng thái" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 rounded-xl border px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select>
          <button type="button" onClick={load} disabled={refreshing} title="Làm mới danh sách" aria-label="Làm mới danh sách" className="flex h-10 w-10 items-center justify-center rounded-xl border transition hover:bg-indigo-500/5 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} /></button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}><tr>{['Thành viên', 'Email', 'Vai trò', 'Nhóm làm việc', 'Trạng thái', 'Thao tác'].map(label => <th scope="col" className={'px-5 py-3 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ' + (label === 'Thao tác' ? 'text-right' : '')} key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {loading ? Array.from({ length: 4 }, (_, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>{Array.from({ length: 6 }, (_, j) => <td key={j} className="px-5 py-5"><div className="h-5 w-24 animate-pulse rounded" style={{ background: 'var(--muted)' }} /></td>)}</tr>) : !visible.length ? <tr><td colSpan={6} className="px-5 py-14 text-center"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--muted)' }}><Users className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} /></span><p className="text-sm font-semibold">{users.length ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có thành viên nào'}</p><p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>{users.length ? 'Thử thay đổi từ khóa hoặc bộ lọc của bạn.' : 'Thêm tài khoản để bắt đầu làm việc cùng nhóm.'}</p>{users.length > 0 && <button type="button" onClick={resetFilters} className="mt-4 text-xs font-semibold text-indigo-500">Xóa bộ lọc</button>}</td></tr> : visible.map(user => {
            const style = roleStyles[user.role as keyof typeof roleStyles] || roleStyles.USER; const Icon = style.icon;
            const group = groups.find(group => group.id === user.group_id);
            const editable = user.role !== 'ADMIN' && user.id !== me?.id;
            return <tr className="border-t transition-colors hover:bg-indigo-500/[0.025]" style={{ borderColor: 'var(--border)' }} key={user.id}>
              <td className="px-5 py-4"><div className="flex items-center gap-3"><span aria-hidden="true" className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ' + style.background + ' ' + style.accent}>{(user.name || user.username).trim().charAt(0).toUpperCase()}</span><div className="min-w-[110px]"><div className="flex items-center gap-2"><span className="font-semibold">{user.name}</span>{user.id === me?.id && <span className="rounded border border-indigo-500/20 bg-indigo-500/5 px-1.5 py-0.5 text-[9px] text-indigo-500">Bạn</span>}</div><p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>@{user.username}</p></div></div></td>
              <td className="px-5 py-4"><span className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{user.email && <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />}{user.email || 'Chưa cập nhật'}</span></td>
              <td className="px-5 py-4"><span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ' + style.badge}><Icon className="h-3.5 w-3.5" />{labels[user.role] || user.role}</span></td>
              <td className="px-5 py-4"><span className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}><Users className="h-3.5 w-3.5 shrink-0 opacity-60" />{user.role === 'ADMIN' ? 'Toàn hệ thống' : group?.display_name || 'Chưa gán nhóm'}</span></td>
              <td className="px-5 py-4"><span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ' + (user.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500 dark:text-slate-400')}><span className={'h-1.5 w-1.5 rounded-full ' + (user.active ? 'bg-emerald-500' : 'bg-slate-400')} />{user.active ? 'Hoạt động' : 'Đã khóa'}</span></td>
              <td className="px-5 py-4"><div className="flex justify-end gap-1">{editable ? <><button type="button" title="Sửa tài khoản" aria-label={'Sửa tài khoản ' + user.username} onClick={() => edit(user)} disabled={removingId !== null} className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-indigo-500/10 hover:text-indigo-500 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button><button type="button" title={user.active ? 'Khóa tài khoản' : 'Tài khoản đã khóa'} aria-label={'Khóa tài khoản ' + user.username} onClick={() => remove(user)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-25" disabled={!user.active || removingId !== null}>{removingId === user.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}</button></> : <span title="Tài khoản được bảo vệ" className="flex h-8 w-8 items-center justify-center" style={{ color: 'var(--muted-foreground)' }}><ShieldCheck className="h-4 w-4 opacity-40" /></span>}</div></td>
            </tr>;
          })}
        </tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Hiển thị <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{matches.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, matches.length)}</span> / {matches.length} tài khoản{(search || roleFilter || statusFilter) ? ' phù hợp' : ''}</p>
        <div className="flex items-center gap-2"><button type="button" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronLeft className="h-3.5 w-3.5" /></button><span className="text-[11px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>Trang {currentPage} / {pageCount}</span><button type="button" aria-label="Trang sau" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronRight className="h-3.5 w-3.5" /></button></div>
      </div>
    </section>
    {open && <AccountFormDialog
      editing={!!editing} canCreateManager={me?.role === 'ADMIN'} busy={busy}
      form={form} setForm={setForm} groups={groups}
      onClose={() => setOpen(false)} onSubmit={save}
    />}
  </div>;
}
