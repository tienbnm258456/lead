import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-auth';
import { prisma } from '@/lib/prisma';
import { getStockerOrigin, getStockerSession, StockerError, stockerHeaders, stockerRequest } from '@/lib/stocker-client';
import { getStockerCredentials, type StockerCredentials } from '@/lib/stocker-credentials';
import { uzProductId, type StockerProductRow } from '@/lib/uz-product';

export const runtime = 'nodejs';

const responseHeaders = { 'Cache-Control': 'no-store' };

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: responseHeaders });
}

type StockerItem = { id: string; name: string; images?: { large?: string; thumb?: string }[] };

async function withLocalDetails(data: { items: StockerItem[] }, namesOnly: boolean) {
  const { items } = data;
  if (!namesOnly && items.some(item => !uzProductId.safeParse(item?.id).success || typeof item.name !== 'string')) {
    return failure('Stocker trả sản phẩm thiếu ID hoặc tên gốc', 502);
  }

  let mappingsUnavailable = false;
  const detailsById = new Map<string, { originalName: string | null; nameVi: string | null; xmlId: string | null }>();
  const sourceIds = items.flatMap(item => {
    const id = uzProductId.safeParse(item?.id);
    return id.success ? [id.data] : [];
  });
  if (sourceIds.length) {
    try {
      const details = await prisma.uzProduct.findMany({
        where: { sourceId: { in: sourceIds } },
        select: { sourceId: true, originalName: true, nameVi: true, xmlId: true },
      });
      for (const detail of details) detailsById.set(detail.sourceId, detail);
    } catch (error) {
      mappingsUnavailable = true;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      console.error('[Stocker] Không đọc được mapping Sản phẩm UZ', {
        name: error instanceof Error ? error.name : 'UnknownError',
        code,
      });
    }
  }

  if (namesOnly) {
    const rows = items.map(item => ({
      ...item,
      nameVi: detailsById.get(String(item?.id ?? '').toLowerCase())?.nameVi ?? null,
    }));
    return NextResponse.json({ ...data, items: rows, mappingsUnavailable }, { headers: responseHeaders });
  }

  const rows: StockerProductRow[] = items.map(item => {
    const sourceId = item.id.toLowerCase();
    const detail = detailsById.get(sourceId);
    const images = Array.isArray(item.images) ? item.images : [];
    const imageUrl = images.flatMap(image => [image?.large, image?.thumb])
      .find(url => typeof url === 'string' && /^https?:\/\//i.test(url) && URL.canParse(url));
    return {
      sourceId,
      originalName: item.name,
      savedOriginalName: detail?.originalName ?? null,
      nameVi: detail?.nameVi ?? null,
      xmlId: detail?.xmlId ?? null,
      imageUrl: imageUrl ?? null,
    };
  });
  return NextResponse.json({ ...data, items: rows, mappingsUnavailable }, { headers: responseHeaders });
}

type StockerPage = { items: StockerItem[]; total: number; nextOffset: number | null };
const pageCache = new Map<string, { data: StockerPage; expiresAt: number }>();
const pendingPages = new Map<string, Promise<StockerPage>>();
const cacheTtl = 10 * 60 * 1000;

async function fetchStockerPage(origin: string, credentials: StockerCredentials, limit: number, offset: number): Promise<StockerPage> {
  const signal = AbortSignal.timeout(15_000);
  const productsUrl = new URL('/papi/products', origin);
  productsUrl.searchParams.set('limit', String(limit));
  productsUrl.searchParams.set('offset', String(offset));

  function fetchProducts(cookie: string) {
    return fetch(productsUrl, { ...stockerRequest, signal, headers: { ...stockerHeaders, Cookie: cookie } });
  }

  try {
    const cookie = await getStockerSession(origin, credentials);
    let response = await fetchProducts(cookie);
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      response = await fetchProducts(await getStockerSession(origin, credentials, cookie));
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new StockerError('Không lấy được sản phẩm Stocker (HTTP ' + response.status + ')');
    }

    const data = await response.json();
    if (!Array.isArray(data?.items)) throw new StockerError('Stocker trả danh sách sản phẩm không hợp lệ');
    return data;
  } catch (error) {
    if (error instanceof StockerError) throw error;
    if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new StockerError('Stocker phản hồi quá thời gian chờ', 504);
    }
    throw new StockerError('Không thể đọc phản hồi từ Stocker');
  }
}

async function getStockerPage(origin: string, credentials: StockerCredentials, limit: number, offset: number, refresh: boolean) {
  const key = JSON.stringify([origin, credentials.revision, limit, offset]);
  if (!refresh) {
    const cached = pageCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const pending = pendingPages.get(key);
    if (pending) return pending;
  }

  const request = fetchStockerPage(origin, credentials, limit, offset);
  pendingPages.set(key, request);
  try {
    const data = await request;
    if (pendingPages.get(key) === request) {
      if (refresh) {
        pageCache.clear();
        pendingPages.clear();
      }
      pageCache.delete(key);
      pageCache.set(key, { data, expiresAt: Date.now() + cacheTtl });
      if (pageCache.size > 100) {
        const oldest = pageCache.keys().next().value;
        if (oldest !== undefined) pageCache.delete(oldest);
      }
    }
    return data;
  } finally {
    if (pendingPages.get(key) === request) pendingPages.delete(key);
  }
}

async function readCatalog(request: Request, refresh: boolean) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit') ?? '50');
  const offset = Number(params.get('offset') ?? '0');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      params.get('offset') === '' || !Number.isSafeInteger(offset) || offset < 0) {
    return failure('limit phải từ 1 đến 50 và offset phải là số nguyên không âm', 400);
  }

  let credentials: StockerCredentials | null;
  try {
    credentials = await getStockerCredentials();
  } catch {
    return failure('Không đọc được tài khoản Stocker. Kiểm tra cấu hình và khóa mã hóa trên máy chủ.', 500);
  }
  if (!credentials) return failure('Chưa cấu hình tài khoản Stocker. Vào tab Tài khoản Stocker để thiết lập.', 503);

  let data: StockerPage;
  try {
    data = await getStockerPage(getStockerOrigin(), credentials, limit, offset, refresh);
  } catch (error) {
    if (error instanceof StockerError) return failure(error.message, error.status);
    throw error;
  }

  if (params.get('localDetails') === '1') return withLocalDetails(data, false);
  if (params.get('includeNameVi') === '1') return withLocalDetails(data, true);
  return NextResponse.json(data, { headers: responseHeaders });
}

export async function GET(request: Request) {
  return readCatalog(request, false);
}

export async function POST(request: Request) {
  return readCatalog(request, true);
}
