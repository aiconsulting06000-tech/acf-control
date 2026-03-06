import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    
    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error } = await createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: 'Bearer ' + token } },
    }).auth.getUser();

    if (error || !userData.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    const { data: memberships } = await sb
      .from('org_members')
      .select('*, organizations(*)')
      .eq('user_id', userData.user.id);

    return NextResponse.json({
      user: {
        id: userData.user.id,
        email: userData.user.email,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
        preferred_language: profile?.preferred_language || 'en',
        preferred_theme: profile?.preferred_theme || 'dark',
        mfa_enabled: profile?.mfa_enabled || false,
      },
      memberships: (memberships || []).map(function(m: any) {
        return {
          org_id: m.org_id,
          role: m.role,
          org_name: m.organizations?.name,
          org_slug: m.organizations?.slug,
          org_plan: m.organizations?.plan,
          org_max_agents: m.organizations?.max_agents,
        };
      }),
    });

  } catch (error: any) {
    console.error('Auth/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
