import { NextResponse } from 'next/server';
import { getApiBaseUrl, getApiReachabilityMessage } from '@/lib/server-api';

const apiUrl = getApiBaseUrl();

function getAdminKey(): string {
  return process.env.ADMIN_API_KEY || 'kudi_admin_secret_dev';
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({ success: false, message: 'Invalid API response' }));
}

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const authHeader = request.headers.get('authorization');
  const adminKey = getAdminKey();

  if (!adminKey) {
    return NextResponse.json({ success: false, message: 'ADMIN_API_KEY is not configured on the admin app' }, { status: 503 });
  }

  try {
    const res = await fetch(apiUrl + '/api/v1/admin/' + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-admin-key': adminKey,
      },
      cache: 'no-store',
    });
    return NextResponse.json(await parseJson(res), { status: res.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: getApiReachabilityMessage(error) }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const body = await request.json().catch(() => ({}));
  const authHeader = request.headers.get('authorization');
  const adminKey = getAdminKey();

  if (!adminKey) {
    return NextResponse.json({ success: false, message: 'ADMIN_API_KEY is not configured on the admin app' }, { status: 503 });
  }

  try {
    const res = await fetch(apiUrl + '/api/v1/admin/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await parseJson(res), { status: res.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: getApiReachabilityMessage(error) }, { status: 502 });
  }
}
