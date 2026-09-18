import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE } from '@/lib/session';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;

  if (!body?.email || !body.password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (!adminPassword) {
    return NextResponse.json({ message: 'Admin login is not configured. Set ADMIN_PASSWORD or ADMIN_API_KEY.' }, { status: 503 });
  }

  if (body.password !== adminPassword) {
    return NextResponse.json({ message: 'Invalid administrator credentials' }, { status: 401 });
  }

  const user = {
    id: 'admin',
    email: body.email,
    name: body.email.includes('admin') ? 'Super Administrator' : 'Operations Lead',
    role: 'ADMIN',
  };

  const res = NextResponse.json({ success: true, user });

  res.cookies.set(SESSION_COOKIE, 'admin-session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  res.cookies.set(SESSION_USER_COOKIE, JSON.stringify(user), {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  return res;
}
