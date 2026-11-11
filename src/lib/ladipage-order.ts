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
export type LandingTone = { label: string; xmlId: string };
type LandingProduct = { name: string; xml_id: string | null; tone_xml_ids?: unknown };

export function landingTones(value: unknown): LandingTone[] {
  return Array.isArray(value) ? value.filter((tone): tone is LandingTone =>
    Boolean(tone && typeof tone.label === 'string' && typeof tone.xmlId === 'string')) : [];
}

export function isLandingXmlId(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.trim().length <= 255 && !/[,\r\n]/.test(value);
}

export function parseLandingTones(value: unknown): LandingTone[] {
  if (value === undefined || (Array.isArray(value) && !value.length)) return [];
  const tones = landingTones(value).map(tone => ({ label: tone.label.trim(), xmlId: tone.xmlId.trim() }));
  if (tones.length < 2 || !Array.isArray(value) || value.length !== tones.length ||
    tones.some(tone => !normalize(tone.label) || tone.label.length > 100 || !isLandingXmlId(tone.xmlId)) ||
    new Set(tones.map(tone => normalize(tone.label))).size !== tones.length ||
    new Set(tones.map(tone => tone.xmlId)).size !== tones.length) {
    throw new SelectionError('Nhập ít nhất hai dòng. Mỗi dòng cần một tên và XML ID riêng, đúng với cấu hình trên landing page.');
  }
  return tones;
}

export function parseLandingUrl(value: unknown): string | null {
  const text = scalar(value);
  if (!text) return null;
  const url = URL.canParse(text) ? new URL(text) : null;
  if (!url || !/^https?:\/\//i.test(text) || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) {
    throw new SelectionError('URL landing page phải là địa chỉ http:// hoặc https:// hợp lệ.');
  }
  return url.href;
}

export function readLandingSelections(body: Record<string, unknown>, product: LandingProduct) {
  const packageValue = body.package || body.goi || body.variant || body.to_plam || body["to'plam"] || body.combo;
  const usesTones = landingTones(product.tone_xml_ids).length > 0;
  return {
    packages: selections(body.products || packageValue),
    sizes: selections(body.size || body.o_lcham || body["o'lcham"] || body.olcham || body.kich_thuoc),
    tone: usesTones ? body.tone : undefined,
  };
}

export function resolveLandingItems(variants: LandingVariant[], packageValue: unknown, sizeValue: unknown, product: LandingProduct, toneValue?: unknown) {
  if (!variants.length || variants.some(v => !Number.isFinite(v.price) || v.price < 0 || !Number.isFinite(v.delivery_fee) || v.delivery_fee < 0)) {
    throw new SelectionError('Giá hoặc phí ship cấu hình không hợp lệ');
  }
  const packages = selections(packageValue);
  const sizes = selections(sizeValue);
  const tones = landingTones(product.tone_xml_ids);
  let tone: LandingTone | undefined;
  if (tones.length) {
    const chosen = selections(toneValue);
    if (chosen.length !== 1) throw new SelectionError('Vui lòng chọn đúng một tone màu.');
    tone = tones.find(option => normalize(option.label) === normalize(chosen[0]));
    if (!tone) throw new SelectionError('Không tìm thấy tone màu đã cấu hình: ' + chosen[0]);
  }
  if (tone && !packages.length && variants.length > 1) throw new SelectionError('Thiếu gói mua. Cấu hình LadiPage gửi gói qua trường products.');
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
    const xmlId = tone?.xmlId || product.xml_id?.trim() || variant.xml_id?.trim() || generateOfferXmlId(variant.id);
    return { variant, xmlId };
  });
  const deliveryFee = Math.max(0, ...matches.map(m => m.variant.delivery_fee));
  const items = matches.map(({ variant, xmlId }, index) => ({
    xmlId, quantity: 1, initialPrice: variant.price, productName: product.name,
    variantLabel: variant.label, promotion: variant.promotion || undefined,
    size: sizes.join(' + ') || undefined,
    ...(tone && { tone: tone.label }),
    deliveryFee: index === 0 ? deliveryFee : 0,
  }));
  return { items, deliveryFee, selectedOption: [tone?.label, ...sizes].filter(Boolean).join(' | ') || null, totalPrice: items.reduce((sum, item) => sum + item.initialPrice * item.quantity, deliveryFee) };
}
