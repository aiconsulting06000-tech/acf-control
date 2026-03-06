import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const result: any = {
    url_exact: JSON.stringify(url),
    url_length: url.length,
    svc_length: svc.length,
  };

  try {
    const resp = await fetch(url + '/rest/v1/organizations?select=id&limit=1', {
      headers: {
        'apikey': svc,
        'Authorization': 'Bearer ' + svc,
      },
    });
    result.status = resp.status;
    result.body = await resp.text();
  } catch (err: any) {
    result.error = err.message;
    result.cause = err.cause ? String(err.cause) : 'none';
  }

  return NextResponse.json(result);
}
