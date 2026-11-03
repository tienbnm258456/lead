/** Never reuse cached private data across users, roles or group assignments. */
export function queryScope(user: { id: number; role: string; group_id?: number | null }): string {
  return JSON.stringify([user.id, user.role, user.group_id ?? null]);
}
