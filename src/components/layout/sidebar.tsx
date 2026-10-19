'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Globe,
  ChevronLeft,
  ChevronRight,
  Database,
  Zap,
  LogOut,
  HardDrive,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Đơn hàng',
    href: '/admin/orders',
    icon: ShoppingCart,
  },
  {
    label: 'Landing Pages',
    href: '/admin/landing-pages',
    icon: Globe,
  },
  {
    label: 'Dung lượng',
    href: '/admin/storage',
    icon: HardDrive,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Đã đăng xuất');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Lỗi khi đăng xuất');
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r transition-sidebar h-screen sticky top-0',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
      style={{
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
              Admin
            </h1>
            <p className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Management System
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--sidebar-icon)' }}>
            Menu
          </p>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'shadow-sm'
                  : 'hover:translate-x-0.5'
              )}
              style={{
                background: isActive ? 'var(--sidebar-active)' : 'transparent',
                color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--sidebar-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isActive ? '' : 'group-hover:text-[var(--foreground)]'
                )}
                style={{
                  color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-icon)',
                }}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area: Logout & DB info */}
      <div className="border-t p-3 space-y-2" style={{ borderColor: 'var(--sidebar-border)' }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10',
            collapsed ? 'justify-center' : ''
          )}
          title="Đăng xuất"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--muted)' }}>
            <Database className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              PostgreSQL Connected
            </span>
            <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          color: 'var(--muted-foreground)',
        }}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
