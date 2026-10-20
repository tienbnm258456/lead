'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Zap, Lock, User, Eye, EyeOff, Sun, Moon, ArrowRight,
  UserPlus, Mail, Database,
} from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password || !name.trim()) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, email: email || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng ký không thành công');
        toast.error(data.error || 'Đăng ký thất bại');
        setLoading(false);
        return;
      }

      toast.success('Đăng ký thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      setError('Không thể kết nối đến máy chủ');
      toast.error('Lỗi kết nối');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/15 blur-[120px]" aria-hidden="true" />

      {/* Top Bar */}
      <header className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Database className="h-3.5 w-3.5 text-emerald-500" />
          <span style={{ color: 'var(--muted-foreground)' }}>PostgreSQL</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
        </div>
        {mounted && (
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all hover:scale-105"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>
        )}
      </header>

      {/* Register Card */}
      <main className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

          <div className="p-7 sm:p-9 space-y-5">
            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 text-white">
                <UserPlus className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight pt-2" style={{ color: 'var(--foreground)' }}>
                Tạo tài khoản
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Đăng ký tài khoản quản trị viên mới
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-500 dark:text-red-400 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input id="reg-name" type="text" required placeholder="Nguyễn Văn A"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label htmlFor="reg-username" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Zap className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input id="reg-username" type="text" required placeholder="admin123"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Chỉ chữ thường, số và dấu gạch dưới</p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="reg-email" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Email <span className="text-[11px] font-normal" style={{ color: 'var(--muted-foreground)' }}>(dùng để khôi phục mật khẩu)</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Mail className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input id="reg-email" type="email" placeholder="email@example.com"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="reg-password" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input id="reg-password" type={showPassword ? 'text' : 'password'} required placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5"
                    style={{ color: 'var(--muted-foreground)' }}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="reg-confirm" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Xác nhận mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input id="reg-confirm" type={showPassword ? 'text' : 'password'} required placeholder="Nhập lại mật khẩu"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 p-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none mt-1">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng ký</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Link to login */}
            <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Đã có tài khoản?{' '}
              <a href="/login" className="font-semibold text-emerald-500 hover:underline">
                Đăng nhập
              </a>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Lead Admin Management System · Next.js & PostgreSQL
        </p>
      </main>
    </div>
  );
}
