'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { level: 1, label: 'Yếu', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Trung bình', color: 'bg-amber-500' };
    if (score <= 3) return { level: 3, label: 'Khá', color: 'bg-blue-500' };
    return { level: 4, label: 'Mạnh', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đổi mật khẩu không thành công');
        toast.error(data.error || 'Đổi mật khẩu thất bại');
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success('Đổi mật khẩu thành công!');
    } catch {
      setError('Không thể kết nối đến máy chủ');
      toast.error('Lỗi kết nối');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          }}
          title="Quay lại"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Đổi mật khẩu
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Thay đổi mật khẩu đăng nhập của bạn
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div
        className="overflow-hidden rounded-2xl border shadow-lg"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="p-6 sm:p-8">
          {success ? (
            /* Success State */
            <div className="text-center space-y-4 py-4 animate-fade-in">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Đổi mật khẩu thành công!
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Mật khẩu mới đã được cập nhật. Phiên đăng nhập hiện tại vẫn hoạt động.
                </p>
              </div>
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Về trang chủ
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Icon header */}
              <div className="flex items-center gap-3 pb-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                    Bảo mật tài khoản
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Nhập mật khẩu hiện tại để xác thực
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-500 dark:text-red-400 flex items-center gap-2 animate-slide-in">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cp-current"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Mật khẩu hiện tại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input
                    id="cp-current"
                    type={showCurrent ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    style={{
                      background: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                  Mật khẩu mới
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cp-new"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input
                    id="cp-new"
                    type={showNew ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    style={{
                      background: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password strength indicator */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.level ? strength.color : ''
                          }`}
                          style={{
                            background: i <= strength.level ? undefined : 'var(--border)',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      Độ mạnh: <span className={strength.level >= 3 ? 'text-emerald-500' : strength.level >= 2 ? 'text-amber-500' : 'text-red-500'}>{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cp-confirm"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input
                    id="cp-confirm"
                    type={showNew ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    style={{
                      background: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {/* Match indicator */}
                  {confirmPassword && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                      {confirmPassword === newPassword ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[10px] font-medium text-red-500">Mật khẩu không khớp</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 p-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none mt-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Đổi mật khẩu</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Tips */}
      {!success && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            💡 Gợi ý mật khẩu an toàn
          </h3>
          <ul className="text-[11px] space-y-1" style={{ color: 'var(--muted-foreground)' }}>
            <li>• Sử dụng ít nhất 8 ký tự</li>
            <li>• Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
            <li>• Không sử dụng thông tin cá nhân (tên, ngày sinh)</li>
            <li>• Không dùng lại mật khẩu từ các tài khoản khác</li>
          </ul>
        </div>
      )}
    </div>
  );
}
