'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus, Trash2, Shield, ShieldCheck, User, RefreshCw,
  Eye, EyeOff, Mail, X, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

const roleConfig: Record<string, { label: string; icon: typeof Shield; classes: string }> = {
  ADMIN: { label: 'Admin', icon: ShieldCheck, classes: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  USER: { label: 'User', icon: User, classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  VIEWER: { label: 'Viewer', icon: Eye, classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
};

export default function AccountsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch {
      toast.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentRole = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.role) setCurrentRole(json.role);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchCurrentRole();
  }, [fetchUsers, fetchCurrentRole]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showForm || deleteConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showForm, deleteConfirm]);

  const resetForm = () => {
    setFormUsername('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormConfirm('');
    setShowPassword(false);
  };

  const handleCreate = async () => {
    if (!formUsername.trim() || !formName.trim() || !formPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (formPassword !== formConfirm) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (formPassword.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          name: formName,
          email: formEmail || undefined,
          password: formPassword,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || 'Tạo tài khoản thất bại');
        setSubmitting(false);
        return;
      }

      toast.success('Tạo tài khoản thành công!');
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || 'Xóa thất bại');
        setDeleting(false);
        return;
      }

      toast.success(json.message);
      setDeleteConfirm(null);
      fetchUsers();
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setDeleting(false);
    }
  };

  // Only ADMIN can access
  if (currentRole && currentRole !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 mb-4" style={{ color: 'var(--muted-foreground)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Không có quyền truy cập</h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Chỉ tài khoản Admin mới có thể quản lý tài khoản.</p>
      </div>
    );
  }

  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const userCount = users.filter(u => u.role === 'USER').length;

  const btnBase = 'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Quản lý Tài khoản
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Quản lý tài khoản quản trị viên ({users.length} tài khoản)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers()}
            className={btnBase + ' border'}
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl'}
          >
            <UserPlus className="h-4 w-4" /> Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{adminCount}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Admin</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <User className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{userCount}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>User</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--muted)' }}>
              <Shield className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{users.length}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Tổng cộng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card-elevated overflow-hidden !rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                {['#', 'Tên đăng nhập', 'Họ tên', 'Email', 'Quyền', 'Ngày tạo', ''].map(col => (
                  <th key={col} className="px-4 py-3.5 text-left">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.55 }}>{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 w-20 animate-pulse rounded" style={{ background: 'var(--muted)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <User className="mx-auto h-10 w-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Chưa có tài khoản nào</p>
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => {
                  const role = roleConfig[user.role] || roleConfig.USER;
                  const RoleIcon = role.icon;
                  return (
                    <tr
                      key={user.id}
                      className="border-t transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{user.username}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm" style={{ color: 'var(--foreground)' }}>{user.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.email ? (
                          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{user.email}</span>
                        ) : (
                          <span className="text-xs italic" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${role.classes}`}>
                          <RoleIcon className="h-3.5 w-3.5" />
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {new Date(user.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {user.role !== 'ADMIN' && (
                          <button
                            onClick={() => setDeleteConfirm(user)}
                            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 shrink-0 mt-0.5 text-indigo-500" />
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Phân quyền</p>
            <ul className="space-y-1 text-xs">
              <li><strong className="text-indigo-500">Admin:</strong> Toàn quyền — bao gồm quản lý tài khoản người dùng</li>
              <li><strong className="text-emerald-500">User:</strong> Full quyền sử dụng hệ thống (đơn hàng, landing page, dung lượng,...) — trừ quản lý tài khoản</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ───── Create Modal ───── */}
      {showForm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl animate-fade-in"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <UserPlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Thêm tài khoản</h2>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tài khoản mới sẽ có quyền User</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg p-1.5 transition-colors hover:bg-red-500/10">
                <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 px-6 py-5">
              {/* Username */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <User className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="vd: nguyenvana"
                    className="h-10 flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={50}
                  />
                </div>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Chỉ chữ thường, số và dấu gạch dưới (3-50 ký tự)</p>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="vd: Nguyễn Văn A"
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Email <span className="text-[10px] font-normal" style={{ color: 'var(--muted-foreground)' }}>(không bắt buộc)</span>
                </label>
                <div className="flex items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    type="email"
                    placeholder="vd: admin@example.com"
                    className="h-10 flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 rounded-lg border px-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tối thiểu 8 ký tự"
                    className="h-10 flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="shrink-0 p-1">
                    {showPassword ? <EyeOff className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} /> : <Eye className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Xác nhận mật khẩu <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu"
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={formConfirm}
                  onChange={e => setFormConfirm(e.target.value)}
                />
                {formConfirm && formPassword !== formConfirm && (
                  <p className="mt-1 text-[10px] text-red-500">Mật khẩu không khớp</p>
                )}
              </div>

              {/* Role badge */}
              <div className="flex items-center gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                <User className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                  Tài khoản mới sẽ được gán quyền <strong className="text-emerald-500">User</strong>
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className={btnBase + ' border'}
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !formUsername.trim() || !formName.trim() || !formPassword || formPassword !== formConfirm}
                className={btnBase + ' bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed'}
              >
                {submitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Đang tạo...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Tạo tài khoản</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ───── Delete Confirm Modal ───── */}
      {deleteConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl animate-fade-in"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="px-6 py-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                Xóa tài khoản?
              </h3>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
                Bạn có chắc muốn xóa tài khoản:
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                {deleteConfirm.name} ({deleteConfirm.username})
              </p>
              <p className="text-xs mt-2 text-red-500">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex items-center justify-center gap-3 border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className={btnBase + ' border flex-1 justify-center'}
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={btnBase + ' bg-red-600 text-white flex-1 justify-center hover:bg-red-700 disabled:opacity-50'}
              >
                {deleting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Đang xóa...</> : <><Trash2 className="h-4 w-4" /> Xóa</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
