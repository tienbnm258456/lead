import type { Prisma } from '@prisma/client';
import type { AuthUser } from './auth';
import { getCrmStatusCodesForGroup } from './crm-status-display';

export class OrderFilterError extends Error {}

/** Extra filters are ANDed with the caller's scope, including for exports. */
export function orderFilterWhere(params: URLSearchParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const group = params.get('crmStatusGroup');
  if (group) {
    const codes = getCrmStatusCodesForGroup(group);
    if (!codes) throw new OrderFilterError('Nhóm trạng thái CRM không hợp lệ');
    where.crm_status = { in: codes };
  }
  const groupId = params.get('groupId');
  if (groupId) {
    if (!/^[1-9]\d*$/.test(groupId) || !Number.isSafeInteger(Number(groupId))) throw new OrderFilterError('Nhóm không hợp lệ');
    where.group_id = Number(groupId);
  }
  const managerId = params.get('managerId');
  if (managerId) {
    if (!/^[1-9]\d*$/.test(managerId) || !Number.isSafeInteger(Number(managerId))) throw new OrderFilterError('Tài khoản quản lý không hợp lệ');
    where.group = { users: { some: { id: Number(managerId), role: 'ADMIN2' } } };
  }
  return where;
}

export function orderXmlId(params: URLSearchParams): string {
  const xmlId = (params.get('xmlId') || '').trim();
  if (xmlId.length > 255) throw new OrderFilterError('XML ID tối đa 255 ký tự');
  return xmlId;
}

export function filterGroupScope(user: Pick<AuthUser, 'role' | 'group_id'>) {
  return user.role === 'ADMIN' ? {} : { id: user.group_id ?? -1 };
}
