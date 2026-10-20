import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// API Logger — Wrap any API handler to log request/response details
//
// Usage:
//   import { withLogger } from '@/lib/api-logger';
//   export const POST = withLogger(async (request) => { ... });
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return COLORS.green;
  if (status >= 300 && status < 400) return COLORS.yellow;
  if (status >= 400 && status < 500) return COLORS.yellow;
  return COLORS.red;
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return COLORS.blue;
    case 'POST': return COLORS.green;
    case 'PUT': return COLORS.yellow;
    case 'PATCH': return COLORS.magenta;
    case 'DELETE': return COLORS.red;
    default: return COLORS.white;
  }
}

function formatHeaders(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Skip noisy headers
    const skip = ['accept-encoding', 'connection', 'host', 'sec-', 'upgrade-insecure', 'cache-control'];
    if (!skip.some(s => key.toLowerCase().startsWith(s))) {
      obj[key] = value;
    }
  });
  return obj;
}

function truncate(str: string, maxLen: number = 2000): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, total ${str.length} chars)`;
}

type ApiHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap an API route handler to log detailed request/response info.
 *
 * ```ts
 * export const POST = withLogger(async (request) => {
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withLogger(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const startTime = Date.now();
    const method = request.method;
    const url = request.nextUrl.pathname + request.nextUrl.search;
    const requestId = Math.random().toString(36).slice(2, 8).toUpperCase();

    // ── Log Request ─────────────────────────────────────────────
    const separator = '─'.repeat(70);
    console.log(`\n${COLORS.cyan}${separator}${COLORS.reset}`);
    console.log(`${COLORS.bright}📥 REQUEST${COLORS.reset}  [${requestId}]  ${getMethodColor(method)}${method}${COLORS.reset} ${url}`);
    console.log(`${COLORS.dim}   Timestamp: ${new Date().toISOString()}${COLORS.reset}`);

    // Headers
    const headers = formatHeaders(request.headers);
    if (Object.keys(headers).length > 0) {
      console.log(`${COLORS.dim}   Headers:${COLORS.reset}`, JSON.stringify(headers, null, 2));
    }

    // Query params
    const params: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((v, k) => { params[k] = v; });
    if (Object.keys(params).length > 0) {
      console.log(`${COLORS.dim}   Query:${COLORS.reset}`, JSON.stringify(params));
    }

    // Body (clone request to read body without consuming it)
    let requestBody: string | null = null;
    try {
      const cloned = request.clone();
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const json = await cloned.json();
        requestBody = JSON.stringify(json, null, 2);
      } else if (contentType.includes('form')) {
        const formData = await cloned.formData();
        const formObj: Record<string, string> = {};
        formData.forEach((v, k) => { formObj[k] = String(v); });
        requestBody = JSON.stringify(formObj, null, 2);
      } else {
        const text = await cloned.text();
        if (text) requestBody = text;
      }
    } catch {
      // Body may not be readable
    }

    if (requestBody) {
      console.log(`${COLORS.bright}   Body:${COLORS.reset}`);
      console.log(truncate(requestBody).split('\n').map(l => `     ${l}`).join('\n'));
    }

    // ── Execute Handler ─────────────────────────────────────────
    let response: NextResponse;
    try {
      response = await handler(request, context);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`${COLORS.red}📤 RESPONSE${COLORS.reset} [${requestId}]  ${COLORS.red}500 ERROR${COLORS.reset}  (${duration}ms)`);
      console.log(`${COLORS.red}   Error:${COLORS.reset}`, error instanceof Error ? error.message : error);
      console.log(`${COLORS.cyan}${separator}${COLORS.reset}\n`);
      throw error;
    }

    // ── Log Response ────────────────────────────────────────────
    const duration = Date.now() - startTime;
    const status = response.status;
    const statusColor = getStatusColor(status);

    console.log(`${COLORS.bright}📤 RESPONSE${COLORS.reset} [${requestId}]  ${statusColor}${status}${COLORS.reset}  (${duration}ms)`);

    // Response body
    try {
      const clonedRes = response.clone();
      const resText = await clonedRes.text();
      if (resText) {
        try {
          const json = JSON.parse(resText);
          console.log(`${COLORS.bright}   Body:${COLORS.reset}`);
          console.log(truncate(JSON.stringify(json, null, 2)).split('\n').map(l => `     ${l}`).join('\n'));
        } catch {
          console.log(`${COLORS.bright}   Body:${COLORS.reset}`, truncate(resText));
        }
      }
    } catch {
      // Response may not be readable
    }

    console.log(`${COLORS.cyan}${separator}${COLORS.reset}\n`);

    return response;
  };
}
