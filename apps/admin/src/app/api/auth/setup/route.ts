import dns from 'node:dns';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE } from '@/lib/session';

dns.setDefaultResultOrder('ipv4first');

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.setupToken) {
    return NextResponse.json({ message: 'Email, password, and setup token are required' }, { status: 400 });
  }

  const apiUrl = process.env.KUDI_API_URL ?? 'http://localhost:4000';
  try {
    const response = await fetch(apiUrl + '/api/v1/auth/setup-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.data) {
      return NextResponse.json({ message: payload?.message || 'Admin setup failed' }, { status: response.status || 500 });
    }

    const data = payload.data;
    const token = data?.tokens?.accessToken;
    const user = {
      id: data?.user?.id ?? 'admin',
      email: data?.user?.email ?? body.email,
      name: data?.user?.fullName || body.email.split('@')[0],
      role: data?.user?.role ?? 'ADMIN',
    };

    const res = NextResponse.json({ success: true, user });
    if (token) {
      res.cookies.set(SESSION_COOKIE, token, {
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
    }
    return res;
  } catch (error) {
    return NextResponse.json({ message: 'Admin API is unreachable. Check KUDI_API_URL on the admin app.' }, { status: 502 });
  }
}
