import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { filterGroupScope } from '@/lib/order-filters';

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const groups = await prisma.accessGroup.findMany({
    where: filterGroupScope(auth.user),
    select: { id: true, name: true, users: {
      where: { role: 'ADMIN2' }, select: { id: true, name: true, username: true }, orderBy: { username: 'asc' },
    } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ groups: groups.map(group => ({ id: group.id, name: group.name,
    display_name: group.name + (group.users.length ? ' — ' + group.users.map(user => '@' + user.username).join(', ') : ''),
  })),
    managers: groups.flatMap(group => group.users.map(user => ({ ...user, group_id: group.id }))),
  });
}
