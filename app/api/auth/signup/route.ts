import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;
    const password = body.password;
    const fullName = body.full_name;
    const orgName = body.org_name;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authResult = await sb.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error.message },
        { status: 400 }
      );
    }

    const userId = authResult.data.user.id;

    await sb.from('profiles').update({
      full_name: fullName,
    }).eq('id', userId);

    if (orgName) {
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+$/, '');

      const orgResult = await sb
        .from('organizations')
        .insert({
          name: orgName,
          slug: slug,
          plan: 'professional',
          max_agents: 10,
        })
        .select()
        .single();

      if (orgResult.error) {
        return NextResponse.json(
          { error: 'Org failed: ' + orgResult.error.message },
          { status: 500 }
        );
      }

      const orgId = orgResult.data.id;

      await sb.from('org_members').insert({
        org_id: orgId,
        user_id: userId,
        role: 'admin',
      });

      const objectives = [
        'Maintain sovereignty score above 70',
        'Zero untraced autonomous decisions',
        'Human override available within 60 seconds',
      ];

      const nonDelegable = [
        'Customer account termination',
        'Refunds above 500 EUR',
        'Data deletion requests',
      ];

      const thresholds = {
        minSovereigntyScore: 70,
        maxDriftPercent: 15,
        killSwitchResponseTime: 60,
        maxAgentAutonomyLevel: 3,
      };

      await sb.from('constitutions').insert({
        org_id: orgId,
        version: '1.0',
        signed_by: fullName,
        signed_at: new Date().toISOString(),
        objectives: objectives,
        non_delegable: nonDelegable,
        thresholds: thresholds,
      });

      await sb.from('kill_switch_state').insert({
        org_id: orgId,
        level: 'none',
      });

      await sb.from('audit_log').insert({
        org_id: orgId,
        user_id: userId,
        user_name: fullName,
        action: 'account_created',
        details: 'Account and org created: ' + orgName,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: email,
        full_name: fullName,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
