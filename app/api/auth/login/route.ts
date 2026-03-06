import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rateLimitKey = 'login:' + email.toLowerCase();
    const { data: rl } = await sb
      .from('rate_limits')
      .select('*')
      .eq('key', rateLimitKey)
      .single();

    if (rl && rl.locked_until && new Date(rl.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(rl.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json({ 
        error: 'Account locked. Try again in ' + minutesLeft + ' minutes.' 
      }, { status: 429 });
    }

    const clientSb = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await clientSb.auth.signInWithPassword({ email, password });

    if (error) {
      if (rl) {
        const newAttempts = rl.attempts + 1;
        const lockout = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await sb.from('rate_limits').update({ 
          attempts: newAttempts, 
          locked_until: lockout 
        }).eq('key', rateLimitKey);
        
        const remaining = Math.max(0, 5 - newAttempts);
        return NextResponse.json({ 
          error: 'Invalid credentials. ' + remaining + ' attempts remaining.' 
        }, { status: 401 });
      } else {
        await sb.from('rate_limits').insert({ key: rateLimitKey, attempts: 1 });
        return NextResponse.json({ 
          error: 'Invalid credentials. 4 attempts remaining.' 
        }, { status: 401 });
      }
    }

    if (rl) {
      await sb.from('rate_limits').delete().eq('key', rateLimitKey);
    }

    await sb.from('profiles').update({ 
      last_login_at: new Date().toISOString() 
    }).eq('id', data.user.id);

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const { data: memberships } = await sb
      .from('org_members')
      .select('*, organizations(*)')
      .eq('user_id', data.user.id);

    if (memberships && memberships.length > 0) {
      await sb.from('audit_log').insert({
        org_id: memberships[0].org_id,
        user_id: data.user.id,
        user_name: profile?.full_name || email,
        action: 'login',
        details: (profile?.full_name || email) + ' logged in',
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 256),
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name,
        preferred_language: profile?.preferred_language || 'en',
        preferred_theme: profile?.preferred_theme || 'dark',
      },
      memberships: (memberships || []).map(function(m: any) {
        return {
          org_id: m.org_id,
          role: m.role,
          org_name: m.organizations?.name,
          org_plan: m.organizations?.plan,
        };
      }),
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
