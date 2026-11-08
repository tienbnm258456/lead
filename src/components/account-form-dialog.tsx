'use client';

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AtSign, Check, ChevronDown, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserRound, Users, X } from 'lucide-react';

export interface AccountFormValues {
  username: string; name: string; email: string; password: string;
  role: string; group_id: string; active: boolean;
}
interface Props {
  editing: boolean; canCreateManager: boolean; busy: boolean;
  form: AccountFormValues; setForm: Dispatch<SetStateAction<AccountFormValues>>;
  groups: { id: number; name: string; display_name: string; assignable: boolean }[];
  onClose: () => void; onSubmit: (event: FormEvent) => void;
}
const fieldClass = 'h-11 w-full rounded-xl border bg-transparent pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60';
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' };
const labelClass = 'mb-2 block text-xs font-semibold';

export function AccountFormDialog({ editing, canCreateManager, busy, form, setForm, groups, onClose, onSubmit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  const close = () => { if (!busy) onClose(); };
  const roles = [
    ...(canCreateManager ? [{ value: 'ADMIN2', title: 'Quản lý', description: 'Quản lý sản phẩm, đơn hàng và người dùng trong nhóm.', icon: ShieldCheck }] : []),
    { value: 'USER', title: 'Người dùng', description: 'Làm việc với Sản phẩm và đơn hàng trong nhóm.', icon: UserRound },
  ];
  return <dialog ref={dialog} aria-labelledby="account-form-title" aria-describedby="account-form-description"
    className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-3xl border p-0 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
    <form onSubmit={onSubmit}>
      <header className="relative overflow-hidden border-b px-6 py-6 sm:px-8" style={{ borderColor: 'var(--border)' }}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20"><UserRound className="h-6 w-6" /></div>
            <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-foreground)' }}>Quản lý truy cập</p>
              <h2 id="account-form-title" className="text-xl font-bold tracking-tight">{editing ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</h2></div>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label="Đóng form tài khoản" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-indigo-500/10 disabled:opacity-40" style={{ color: 'var(--muted-foreground)' }}><X className="h-4 w-4" /></button>
        </div>
        <p id="account-form-description" className="relative mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {editing ? 'Cập nhật thông tin và quyền truy cập của tài khoản.' : 'Thiết lập thông tin đăng nhập và chọn quyền phù hợp cho thành viên.'}
        </p>
      </header>
      <fieldset disabled={busy} className="grid min-w-0 gap-7 px-6 py-6 sm:px-8 md:grid-cols-[1.1fr_1fr]">
        <section className="min-w-0 space-y-4" aria-labelledby="account-info-title">
          <div className="mb-5"><h3 id="account-info-title" className="text-sm font-bold">Thông tin tài khoản</h3><p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Các mục có dấu <span className="text-indigo-500">*</span> là bắt buộc.</p></div>
          <label className="block"><span className={labelClass}>Họ và tên <span className="text-indigo-500">*</span></span>
            <div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-indigo-400" /><input autoFocus={editing} className={fieldClass} style={fieldStyle} autoComplete="name" placeholder="Nhập họ và tên" maxLength={100} required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          </label>
          <label className="block"><span className={labelClass}>Tên đăng nhập <span className="text-indigo-500">*</span></span>
            <div className="relative"><AtSign aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-indigo-400" /><input autoFocus={!editing} className={fieldClass} style={fieldStyle} autoComplete="off" placeholder="Ví dụ: nguyen_van_a" required disabled={editing} minLength={3} maxLength={50} pattern="[a-z0-9_]+" title="Chữ thường, số và dấu gạch dưới; từ 3 đến 50 ký tự" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} /></div>
            <span className="mt-1.5 block text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{editing ? 'Tên đăng nhập được giữ cố định.' : 'Dùng chữ thường, số và dấu gạch dưới.'}</span>
          </label>
          <label className="block"><span className={labelClass}>Email <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(không bắt buộc)</span></span>
            <div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-indigo-400" /><input className={fieldClass} style={fieldStyle} type="email" autoComplete="email" placeholder="ten@congty.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          </label>
          <label className="block"><span className={labelClass}>{editing ? 'Mật khẩu mới' : 'Mật khẩu'} {!editing && <span className="text-indigo-500">*</span>}</span>
            <div className="relative"><KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-indigo-400" /><input className={fieldClass + ' pr-11'} style={fieldStyle} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={editing ? 'Để trống để giữ mật khẩu hiện tại' : 'Tạo mật khẩu cho tài khoản'} minLength={8} required={!editing} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-indigo-500/10" style={{ color: 'var(--muted-foreground)' }}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            <span className="mt-1.5 block text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Ít nhất 8 ký tự, có chữ cái và số.</span>
          </label>
        </section>
        <section className="min-w-0" aria-labelledby="account-access-title">
          <h3 id="account-access-title" className="text-sm font-bold">Vai trò & phạm vi</h3>
          <p className="mb-4 mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Chọn cách tài khoản làm việc trong hệ thống.</p>
          <div className="space-y-3">
            {roles.map(role => { const selected = form.role === role.value; const Icon = role.icon;
              return <label key={role.value} className="relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:shadow-sm" style={{ borderColor: selected ? '#6366f1' : 'var(--border)', background: selected ? 'rgba(99, 102, 241, 0.06)' : 'transparent' }}>
                <input className="peer sr-only" type="radio" name="account-role" value={role.value} checked={selected} onChange={() => setForm(p => ({ ...p, role: role.value }))} />
                <span className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
                <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: selected ? '#6366f1' : 'var(--muted-foreground)' }} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role.title}</span><span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{role.description}</span></span>
                <span className={'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ' + (selected ? 'border-indigo-500 bg-indigo-500 text-white' : '')} style={!selected ? { borderColor: 'var(--border)' } : {}}>{selected && <Check className="h-3 w-3" />}</span>
              </label>;
            })}
          </div>
          {canCreateManager && form.role === 'USER' ? <label className="mt-5 block"><span className={labelClass}>Nhóm làm việc <span className="text-indigo-500">*</span></span>
            <div className="relative"><Users aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-indigo-400" /><select className={fieldClass + ' appearance-none pr-8'} style={fieldStyle} required value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}><option value="">Chọn nhóm cho thành viên</option>{groups.map(group => <option key={group.id} value={group.id} disabled={!group.assignable}>{group.display_name}{!group.assignable ? ' (không có Quản lý hoạt động)' : ''}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-4 h-3 w-3" /></div>
          </label> : <div className="mt-4 flex items-start gap-2.5 rounded-xl p-3.5 text-xs leading-relaxed" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}><Users className="mt-0.5 h-4 w-4 shrink-0" /><span>{form.role === 'ADMIN2' ? editing ? 'Quyền truy cập dữ liệu áp dụng theo nhóm của tài khoản quản lý.' : 'Một nhóm riêng sẽ được tạo tự động cho tài khoản quản lý.' : 'Thành viên được thêm vào cùng nhóm với bạn.'}</span></div>}
          {editing && <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <span><span className="block text-sm font-semibold">Cho phép đăng nhập</span><span className="mt-1 block text-xs" style={{ color: 'var(--muted-foreground)' }}>{form.active ? 'Tài khoản đang hoạt động' : 'Tài khoản đang bị khóa'}</span></span>
            <input type="checkbox" className="h-5 w-5 accent-indigo-500" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
          </label>}
        </section>
      </fieldset>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:px-8" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="max-w-[220px] text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{editing ? 'Lưu thay đổi sẽ yêu cầu tài khoản đăng nhập lại.' : 'Bạn có thể điều chỉnh thông tin sau khi tạo.'}</p>
        <div className="ml-auto flex items-center gap-2"><button type="button" disabled={busy} onClick={close} className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-indigo-500/5 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Hủy</button>
          <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/15 transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
      </footer>
    </form>
  </dialog>;
}
