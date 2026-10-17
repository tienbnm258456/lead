import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Admin - Lead Management',
  description: 'Quản lý Lead từ Landing Page',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
