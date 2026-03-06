import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
