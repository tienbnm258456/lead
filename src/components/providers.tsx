'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      // next-themes 0.4 renders its bootstrap script even on client mounts.
      // Keep it executable in server HTML (prevents theme flash), but inert on
      // client renders: the provider's effects already apply theme changes.
      scriptProps={{ type: typeof window === 'undefined' ? undefined : 'application/x-next-themes' }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
