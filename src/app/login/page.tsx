'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Zap,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowRight,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng nhập không thành công');
        toast.error(data.error || 'Đăng nhập thất bại');
        setLoading(false);
        return;
      }

      toast.success('Đăng nhập thành công! Đang chuyển hướng...');
      
      // Get callback URL from search params
      const searchParams = new URLSearchParams(window.location.search);
      const callbackUrl = searchParams.get('callbackUrl') || '/admin';

      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 500);
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      toast.error('Lỗi kết nối máy chủ');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Decorative Ambient Glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[150px]"
        aria-hidden="true"
      />

      {/* Top Bar with Theme Toggle & DB Status */}
      <header className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Database className="h-3.5 w-3.5 text-emerald-500" />
          <span style={{ color: 'var(--muted-foreground)' }}>PostgreSQL</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
        </div>

        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            title="Đổi giao diện Sáng / Tối"
            id="theme-toggle-login"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </button>
        )}
      </header>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-md animate-fade-in">
        <div
          className="overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl transition-all"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Card Top Banner Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="p-7 sm:p-9 space-y-6">
            {/* Logo & Heading */}
            <div className="text-center space-y-2">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/30 text-white transition-transform hover:scale-105">
                <Zap className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight pt-2" style={{ color: 'var(--foreground)' }}>
                Lead Admin Portal
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Đăng nhập để quản lý dữ liệu Lead & Landing Page
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-500 dark:text-red-400 animate-slide-in flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="admin hoặc postgres"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    style={{
                      background: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••"
                    className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    style={{
                      background: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors hover:text-[var(--foreground)]"
                    style={{ color: 'var(--muted-foreground)' }}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me + Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-indigo-500 cursor-pointer"
                  />
                  <span style={{ color: 'var(--muted-foreground)' }}>Ghi nhớ đăng nhập</span>
                </label>
                <a href="/forgot-password" className="font-medium text-indigo-500 hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-login"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 p-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none mt-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập hệ thống</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Register Link */}
            <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Chưa có tài khoản?{' '}
              <a href="/register" className="font-semibold text-indigo-500 hover:underline">
                Đăng ký ngay
              </a>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-5 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Lead Admin Management System · Next.js & PostgreSQL
        </p>
      </main>
    </div>
  );
}
