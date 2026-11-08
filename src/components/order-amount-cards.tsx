import type { OrderAmounts } from '@/lib/order-amounts';

export function OrderAmountCards({ amounts, caption, loading = false }: {
  amounts?: OrderAmounts; caption: string; loading?: boolean;
}) {
  const cards = [
    { title: 'Tổng tiền tất cả đơn hàng', value: amounts?.total },
    { title: 'Tổng tiền đơn hoàn thành', value: amounts?.completed },
    { title: 'Tổng tiền đơn khác hoàn thành', value: amounts?.other },
    { title: 'Tổng tiền đơn hủy / hoàn hàng', value: amounts?.cancelled },
  ];
  return <section aria-label="Tổng tiền đơn hàng" aria-busy={loading} className="space-y-3">
    <p className="text-caption">{caption} · gồm phí vận chuyển · UZS</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(card => <div key={card.title} className="card-elevated min-w-0 p-5">
        <p className="text-caption">{card.title}</p>
        <p className="mt-2 break-words text-xl font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
          {loading ? 'Đang tính…' : card.value === undefined ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(card.value as `${number}`)}
          {!loading && card.value !== undefined && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>UZS</span>}
        </p>
      </div>)}
    </div>
    <p className="text-caption">Khác hoàn thành gồm hủy / hoàn hàng và đơn chưa có trạng thái CRM.</p>
  </section>;
}
