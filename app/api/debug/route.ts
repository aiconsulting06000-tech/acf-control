import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const result: any = {
    url_starts: url.substring(0, 30),
    svc_length: svc.length,
  };

  try {
    const sb = createClient(url, svc, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await sb.from('organizations').select('id').limit(1);

    if (error) {
      result.supabase_error = error.message;
      result.supabase_code = error.code;
    } else {
      result.supabase_connected = true;
      result.org_count = data ? data.length : 0;
    }
  } catch (err: any) {
    result.catch_error = err.message;
  }

  return NextResponse.json(result);
}
