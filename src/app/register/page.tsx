'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Trang đăng ký công khai đã bị đóng.
 * Chuyển hướng về trang đăng nhập.
 * Tạo tài khoản mới: Admin → Tài khoản → Thêm tài khoản.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Đang chuyển hướng...
      </p>
    </div>
  );
}
