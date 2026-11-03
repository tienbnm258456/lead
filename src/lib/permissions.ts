import type { AuthUser } from './auth';
export function isTotalAdmin(user: Pick<AuthUser, 'role'>) { return user.role === 'ADMIN'; }
export function canManageUsers(user: Pick<AuthUser, 'role'>) { return user.role === 'ADMIN' || user.role === 'ADMIN2'; }
export function dataScope(user: Pick<AuthUser, 'role' | 'group_id'>): { group_id?: number } {
  return isTotalAdmin(user) ? {} : { group_id: user.group_id ?? -1 };
}
export function landingScope(user: Pick<AuthUser, 'role' | 'group_id'>) { return { ...dataScope(user), deleted_at: null }; }
export function canManageAccount(actor: Pick<AuthUser, 'id' | 'role' | 'group_id'>, target: { id: number; role: string; group_id: number | null }) {
  if (actor.id === target.id || target.role === 'ADMIN') return false;
  return isTotalAdmin(actor) || (actor.role === 'ADMIN2' && actor.group_id != null && target.role === 'USER' && target.group_id === actor.group_id);
}
