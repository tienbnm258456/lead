import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserManager } from '@/lib/require-auth';
import { canManageAccount, dataScope, isTotalAdmin } from '@/lib/permissions';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import type { AdminRole } from '@prisma/client';

const select = { id: true, username: true, name: true, email: true, role: true, active: true, group_id: true, created_at: true };
export async function GET() {
  const auth = await requireUserManager(); if (auth.error) return auth.error;
  const [users, groups] = await Promise.all([
    prisma.adminUser.findMany({ where: isTotalAdmin(auth.user) ? {} : { role: 'USER', ...dataScope(auth.user) }, select, orderBy: { created_at: 'desc' } }),
    prisma.accessGroup.findMany({ where: { active: true, ...(isTotalAdmin(auth.user) ? {} : { id: auth.user.group_id ?? -1 }) }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ success: true, data: users, groups });
}
export async function POST(request: Request) {
  const auth = await requireUserManager(); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null;
    const role: AdminRole = body.role || 'USER';
    if (!/^[a-z0-9_]{3,50}$/.test(username) || !name || name.length > 100 || typeof body.password !== 'string') return NextResponse.json({ error: 'Tên đăng nhập, họ tên hoặc mật khẩu không hợp lệ' }, { status: 400 });
    const passwordError = validatePasswordStrength(body.password);
    if (passwordError || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: passwordError || 'Email không hợp lệ' }, { status: 400 });
    if (!['ADMIN2', 'USER'].includes(role) || (!isTotalAdmin(auth.user) && role !== 'USER')) return NextResponse.json({ error: 'Không được tạo tài khoản ngang hoặc trên cấp' }, { status: 403 });
    const requestedGroup = isTotalAdmin(auth.user) ? Number(body.group_id) : auth.user.group_id;
    if (role === 'USER' && (!requestedGroup || !await prisma.accessGroup.findFirst({ where: { id: requestedGroup, active: true } }))) return NextResponse.json({ error: 'Cần chọn nhóm hợp lệ cho Người dùng' }, { status: 400 });
    const password_hash = await hashPassword(body.password);
    const user = await prisma.$transaction(async tx => {
      const group_id = role === 'ADMIN2' ? (await tx.accessGroup.create({ data: { name: name + ' - Nhóm' } })).id : requestedGroup;
      return tx.adminUser.create({ data: { username, name, email, password_hash, role, group_id, created_by_id: auth.user.id }, select });
    });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Không tạo được tài khoản; kiểm tra trùng tên đăng nhập/email' }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  const auth = await requireUserManager(); if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const target = await prisma.adminUser.findUnique({ where: { id: Number(body.id) } });
    if (!target || !canManageAccount(auth.user, target)) return NextResponse.json({ error: 'Không có quyền quản lý tài khoản này' }, { status: 403 });
    const role: AdminRole = body.role || target.role;
    if (!['ADMIN2', 'USER'].includes(role) || (!isTotalAdmin(auth.user) && role !== 'USER')) return NextResponse.json({ error: 'Role không được phép' }, { status: 403 });
    const name = typeof body.name === 'string' ? body.name.trim() : target.name;
    const email = body.email === undefined ? target.email : (typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null);
    if (!name || name.length > 100 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: 'Họ tên/email không hợp lệ' }, { status: 400 });
    if (body.active !== undefined && typeof body.active !== 'boolean') return NextResponse.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 });
    let password_hash: string | undefined;
    if (body.password) {
      if (typeof body.password !== 'string' || validatePasswordStrength(body.password)) return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự, chữ và số' }, { status: 400 });
      password_hash = await hashPassword(body.password);
    }
    const group_id = isTotalAdmin(auth.user) ? (body.group_id === undefined ? target.group_id : Number(body.group_id)) : auth.user.group_id;
    if (role === 'USER' && (!group_id || !await prisma.accessGroup.findFirst({ where: { id: group_id, active: true } }))) return NextResponse.json({ error: 'Nhóm không hợp lệ' }, { status: 400 });
    await prisma.$transaction(async tx => {
      const assigned = role === 'ADMIN2' ? (target.role === 'ADMIN2' && target.group_id ? target.group_id : (await tx.accessGroup.create({ data: { name: name + ' - Nhóm' } })).id) : group_id;
      const result = await tx.adminUser.updateMany({ where: { id: target.id, role: isTotalAdmin(auth.user) ? { not: 'ADMIN' } : 'USER', ...(!isTotalAdmin(auth.user) ? dataScope(auth.user) : {}) },
        data: { name, email, role, group_id: assigned, active: body.active ?? target.active, ...(password_hash ? { password_hash, reset_token: null, reset_token_exp: null } : {}), session_version: { increment: 1 } } });
      if (!result.count) throw new Error('Quyền đã thay đổi');
    });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Không cập nhật được tài khoản' }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  const auth = await requireUserManager(); if (auth.error) return auth.error;
  try {
    const { id } = await request.json();
    const target = await prisma.adminUser.findUnique({ where: { id: Number(id) } });
    if (!target || !canManageAccount(auth.user, target)) return NextResponse.json({ error: 'Không có quyền xóa tài khoản này' }, { status: 403 });
    await prisma.adminUser.updateMany({ where: { id: target.id, role: isTotalAdmin(auth.user) ? { not: 'ADMIN' } : 'USER', ...(!isTotalAdmin(auth.user) ? dataScope(auth.user) : {}) }, data: { active: false, session_version: { increment: 1 } } });
    return NextResponse.json({ success: true, message: 'Đã khóa tài khoản, giữ nguyên lịch sử dữ liệu' });
  } catch { return NextResponse.json({ error: 'Không xử lý được tài khoản' }, { status: 400 }); }
}
