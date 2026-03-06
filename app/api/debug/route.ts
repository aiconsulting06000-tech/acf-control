import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NOT SET';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || 'NOT SET';

  return NextResponse.json({
    url_set: url !== 'NOT SET',
    url_starts: url.substring(0, 20),
    anon_set: anon !== 'NOT SET',
    anon_length: anon.length,
    svc_set: svc !== 'NOT SET',
    svc_length: svc.length,
  });
}
```

Commit, attends le build, puis dans la console F12 :
```
fetch('/api/debug').then(function(r){return r.text()}).then(function(d){console.log(d)})
