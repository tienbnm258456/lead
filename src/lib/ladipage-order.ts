/** Stable per-variant temporary offer ID; does not change when its label/price changes. */
export function generateOfferXmlId(variantId: number): string {
  return 'XML' + String(variantId).padStart(4, '0') + '_OFFER';
}
export async function ensureOfferXmlIds<T extends { id: number; xml_id: string | null }>(
  client: { productVariant: { updateMany: (args: { where: { id: number; OR: Array<{ xml_id: null | string }> }; data: { xml_id: string } }) => Promise<unknown> } },
  variants: T[],
): Promise<T[]> {
  return Promise.all(variants.map(async variant => {
    if (variant.xml_id?.trim()) return variant;
    const xmlId = generateOfferXmlId(variant.id);
    await client.productVariant.updateMany({
      where: { id: variant.id, OR: [{ xml_id: null }, { xml_id: '' }] }, data: { xml_id: xmlId },
    });
    return { ...variant, xml_id: xmlId };
  }));
}

/** Internal money is always full UZS; conversion happens only at the CRM boundary. */
export interface LandingVariant {
  id: number; label: string; quantity: number; price: number;
  promotion?: string | null; delivery_fee: number; size: string | null; xml_id: string | null;
}
export class SelectionError extends Error {}
export function selections(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  if (values.some(v => typeof v !== 'string')) throw new SelectionError('Lựa chọn phải là chuỗi hoặc mảng chuỗi');
  return [...new Set((values as string[]).map(v => v.trim()).filter(Boolean))];
}
export function scalar(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new SelectionError('Thông tin khách hàng phải là chuỗi');
  return value.trim();
}
export async function readLandingBody(request: Request): Promise<Record<string, unknown>> {
  if (/application\/x-www-form-urlencoded|multipart\/form-data/.test(request.headers.get('content-type') || '')) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const key of new Set(form.keys())) {
      const values = form.getAll(key);
      if (values.some(v => typeof v !== 'string')) throw new SelectionError('Không hỗ trợ file trong webhook');
      body[key] = values.length === 1 ? values[0] : values;
    }
    return body;
  }
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SelectionError('Body phải là JSON object');
  return body as Record<string, unknown>;
}
const normalize = (value: string) => value.toLowerCase().normalize('NFKC')
  .replace(/[‘’ʻʼ՚ʻʼ']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export function resolveLandingItems(variants: LandingVariant[], packageValue: unknown, sizeValue: unknown, product: { name: string; xml_id: string | null }) {
  if (!variants.length || variants.some(v => !Number.isFinite(v.price) || v.price < 0 || !Number.isFinite(v.delivery_fee) || v.delivery_fee < 0)) {
    throw new SelectionError('Giá hoặc phí ship cấu hình không hợp lệ');
  }
  const packages = selections(packageValue);
  const sizes = selections(sizeValue);
  const selected = packages.length ? packages : [''];
  const matches = selected.map(label => {
    let candidates = variants;
    if (label) {
      const exact = candidates.filter(v => normalize(v.label) === normalize(label));
      if (!exact.length) throw new SelectionError('Không tìm thấy gói đã cấu hình: ' + label);
      candidates = exact;
    }
    if (candidates.length !== 1) throw new SelectionError('Gói chưa được cấu hình duy nhất: ' + label);
    const variant = candidates[0];
    const xmlId = product.xml_id?.trim() || variant.xml_id?.trim() || generateOfferXmlId(variant.id);
    return { variant, xmlId };
  });
  const deliveryFee = Math.max(0, ...matches.map(m => m.variant.delivery_fee));
  const items = matches.map(({ variant, xmlId }, index) => ({
    xmlId, quantity: 1, initialPrice: variant.price, productName: product.name,
    variantLabel: variant.label, promotion: variant.promotion || undefined,
    size: sizes.join(' + ') || undefined,
    deliveryFee: index === 0 ? deliveryFee : 0,
  }));
  return { items, deliveryFee, totalPrice: items.reduce((sum, item) => sum + item.initialPrice * item.quantity, deliveryFee) };
}
