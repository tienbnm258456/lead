import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/require-auth';
import { getStockerOrigin, loginStocker, StockerError } from '@/lib/stocker-client';
import { getStockerCredentials, prepareStockerCredentials, saveStockerCredentials } from '@/lib/stocker-credentials';

export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store' };
const credentialsSchema = z.object({
  login: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(250),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const credentials = await getStockerCredentials();
    return NextResponse.json({ login: credentials?.login ?? '', hasPassword: Boolean(credentials) }, { headers });
  } catch {
    return NextResponse.json({ error: 'Không đọc được cấu hình tài khoản Stocker. Kiểm tra khóa mã hóa trên máy chủ.' }, { status: 500, headers });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nhập tài khoản và mật khẩu Stocker hợp lệ.' }, { status: 400, headers });
  }

  try {
    const encrypted = prepareStockerCredentials(parsed.data);
    if (!encrypted) return NextResponse.json({ error: 'Thông tin đăng nhập vượt quá độ dài cho phép.' }, { status: 400, headers });

    const signal = AbortSignal.timeout(15_000);
    try {
      await loginStocker(getStockerOrigin(), parsed.data, signal);
    } catch (error) {
      const status = error instanceof StockerError ? error.status : signal.aborted ? 504 : 502;
      const message = error instanceof StockerError ? error.message : signal.aborted
        ? 'Stocker phản hồi quá thời gian chờ'
        : 'Không kết nối được Stocker để kiểm tra thông tin đăng nhập.';
      return NextResponse.json({ error: message }, { status, headers });
    }

    await saveStockerCredentials(encrypted);
    return NextResponse.json({ login: parsed.data.login, hasPassword: true }, { headers });
  } catch {
    return NextResponse.json({ error: 'Không lưu được cấu hình tài khoản Stocker. Kiểm tra khóa mã hóa và database.' }, { status: 500, headers });
  }
}
