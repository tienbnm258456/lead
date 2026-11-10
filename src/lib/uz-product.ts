import { z } from 'zod';

export const uzProductId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'ID phải có định dạng UUID')
  .transform(id => id.toLowerCase());

const optionalText = z.string().trim().max(500).transform(value => value || null);

export const uzProductMappingSchema = z.object({
  sourceId: uzProductId,
  originalName: z.string().max(1000).refine(name => Boolean(name.trim()), 'Thiếu tên gốc từ Stocker'),
  nameVi: optionalText,
  xmlId: optionalText,
}).refine(mapping => mapping.nameVi || mapping.xmlId, 'Nhập tên tiếng Việt hoặc XML ID');

export type StockerProductRow = {
  sourceId: string;
  originalName: string;
  savedOriginalName: string | null;
  nameVi: string | null;
  xmlId: string | null;
  imageUrl: string | null;
};
