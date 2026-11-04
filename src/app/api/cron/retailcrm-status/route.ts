import { NextResponse } from 'next/server';
import { processRetailCrmEvents } from '@/lib/retailcrm-status-worker';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    let processed = 0;
    for (let i = 0; i < 10; i++) { const result = await processRetailCrmEvents(); processed += result.processed; if (!result.processed) break; }
    return NextResponse.json({ success: true, processed });
  } catch { return NextResponse.json({ error: 'Status worker failed' }, { status: 503 }); }
}
