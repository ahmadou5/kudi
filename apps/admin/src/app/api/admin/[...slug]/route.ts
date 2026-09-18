import { NextResponse } from 'next/server';

const apiUrl = process.env.KUDI_API_URL ?? 'http://localhost:4000';

function getAdminKey(): string | undefined {
  return process.env.ADMIN_API_KEY;
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
  } catch {
    return NextResponse.json({ success: false, message: 'Admin API is unreachable' }, { status: 502 });
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
  } catch {
    return NextResponse.json({ success: false, message: 'Admin API is unreachable' }, { status: 502 });
  }
}
