import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { AuthUser } from './auth';

/** Read the stored order items, preserving historical XML IDs after product edits. */
export async function orderIdsForXmlId(xmlId: string, user: Pick<AuthUser, 'role' | 'group_id'>): Promise<number[]> {
  const scope = user.role === 'ADMIN' ? Prisma.empty : Prisma.sql`AND group_id = ${user.group_id ?? -1}`;
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM orders
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(items_json::jsonb) = 'array' THEN items_json::jsonb ELSE '[]'::jsonb END
      ) AS item
      WHERE item->>'xmlId' = ${xmlId}
    ) ${scope}
  `);
  return rows.map(row => row.id);
}
