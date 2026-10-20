'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  KeyRound, Lock, User, Eye, EyeOff, Sun, Moon, ArrowRight,
  ArrowLeft, Database, CheckCircle, Mail,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');

  // Step 1: request token
  const [identifier, setIdentifier] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // Step 2: reset password
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Vui lòng nhập tên đăng nhập hoặc email');
      return;
    }

    setRequestLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        setRequestLoading(false);
        return;
      }

      if (data.resetToken) {
        setResetToken(data.resetToken);
        setToken(data.resetToken);
      }
      toast.success('Mã đặt lại mật khẩu đã được tạo!');
      setStep('reset');
    } catch {
      setError('Không thể kết nối máy chủ');
    }
    setRequestLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Vui lòng nhập mã xác nhận');
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

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        setResetLoading(false);
        return;
      }

      toast.success('Đặt lại mật khẩu thành công!');
      setStep('done');
    } catch {
      setError('Không thể kết nối máy chủ');
    }
    setResetLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/15 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-rose-500/15 blur-[120px]" aria-hidden="true" />

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

      {/* Main Card */}
      <main className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

          <div className="p-7 sm:p-9 space-y-5">
            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl shadow-amber-500/30 text-white">
                <KeyRound className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight pt-2" style={{ color: 'var(--foreground)' }}>
                {step === 'done' ? 'Hoàn tất!' : 'Quên mật khẩu'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {step === 'request' && 'Nhập tên đăng nhập hoặc email để nhận mã đặt lại'}
                {step === 'reset' && 'Nhập mã xác nhận và mật khẩu mới'}
                {step === 'done' && 'Mật khẩu đã được đặt lại thành công'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-medium text-red-500 dark:text-red-400 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Request Token */}
            {step === 'request' && (
              <form onSubmit={handleRequestToken} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="fp-identifier" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    Tên đăng nhập hoặc Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <Mail className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <input id="fp-identifier" type="text" required placeholder="admin hoặc email@example.com"
                      className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                      style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                  </div>
                </div>

                <button type="submit" disabled={requestLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 p-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:shadow-amber-500/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60">
                  {requestLoading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Đang xử lý...</span></>
                  ) : (
                    <><span>Gửi mã xác nhận</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Reset Password */}
            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                {/* Show token in dev mode */}
                {resetToken && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs space-y-1">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">🔑 Mã xác nhận (Dev Mode):</p>
                    <code className="block text-[10px] break-all font-mono" style={{ color: 'var(--foreground)' }}>{resetToken}</code>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="fp-token" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    Mã xác nhận
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <KeyRound className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <input id="fp-token" type="text" required placeholder="Nhập mã xác nhận"
                      className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40 font-mono text-xs"
                      style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      value={token} onChange={(e) => setToken(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="fp-newpass" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Mật khẩu mới</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <input id="fp-newpass" type={showPassword ? 'text' : 'password'} required placeholder="Tối thiểu 6 ký tự"
                      className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
                      style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5" style={{ color: 'var(--muted-foreground)' }}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="fp-confirm" className="block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Xác nhận mật khẩu</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <Lock className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <input id="fp-confirm" type={showPassword ? 'text' : 'password'} required placeholder="Nhập lại mật khẩu"
                      className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
                      style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>

                <button type="submit" disabled={resetLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 p-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:shadow-amber-500/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60">
                  {resetLoading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Đang xử lý...</span></>
                  ) : (
                    <><span>Đặt lại mật khẩu</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                  )}
                </button>

                <button type="button" onClick={() => { setStep('request'); setError(''); }}
                  className="flex w-full items-center justify-center gap-1 text-xs font-medium transition-colors hover:underline"
                  style={{ color: 'var(--muted-foreground)' }}>
                  <ArrowLeft className="h-3 w-3" /> Quay lại
                </button>
              </form>
            )}

            {/* Step 3: Done */}
            {step === 'done' && (
              <div className="text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập ngay.
                </p>
                <a href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.01]">
                  <span>Đăng nhập</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* Link to login */}
            {step !== 'done' && (
              <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Nhớ mật khẩu?{' '}
                <a href="/login" className="font-semibold text-amber-500 hover:underline">Đăng nhập</a>
              </p>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Lead Admin Management System · Next.js & PostgreSQL
        </p>
      </main>
    </div>
  );
}
