'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  User,
  LogOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbMap: Record<string, string> = {
  admin: 'Trang chủ',
  orders: 'Đơn hàng',
  'landing-pages': 'Landing Pages',
  leads: 'Quản lý Lead',
  storage: 'Dung lượng',
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('Admin');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.username) {
          setUsername(data.user.name || data.user.username);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Đã đăng xuất thành công');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Lỗi khi đăng xuất');
      setLoggingOut(false);
    }
  };

  const segments = pathname?.split('/').filter(Boolean) || [];

  return (
    <header
      className="glass sticky top-0 z-40 flex h-16 items-center justify-between border-b px-6"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        {segments.map((segment, index) => (
          <span key={segment} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            )}
            <span
              className={index === segments.length - 1 ? 'font-semibold' : 'font-medium'}
              style={{
                color: index === segments.length - 1 ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {breadcrumbMap[segment] || segment}
            </span>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div
          className="hidden md:flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          style={{
            background: 'var(--muted)',
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Tìm kiếm...</span>
          <kbd
            className="ml-4 rounded border px-1.5 py-0.5 text-[10px] font-mono"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:scale-105"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Đổi giao diện"
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        )}

        {/* Notification */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title="Thông báo"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
        </button>

        {/* User profile & Logout */}
        <div className="ml-1 flex items-center gap-2">
          <div
            className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                {username}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                Hệ thống Quản trị
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/10 hover:border-red-500/30"
            style={{ borderColor: 'var(--border)' }}
            title="Đăng xuất khỏi hệ thống"
            id="btn-logout"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}
