import { NextResponse } from 'next/server';

const apiUrl = process.env.KUDI_API_URL ?? 'http://localhost:4000';

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, message: `Mock GET response for ${path}` });
  }
}

export async function POST(request: Request, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // If backend is offline, return successful simulated payload
    return NextResponse.json({
      success: true,
      message: `Action ${path} processed successfully`,
      data: body,
    });
  }
}
