import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { email, password, full_name, org_name } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, password, and full name required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    await sb.from('profiles').update({ full_name }).eq('id', userId);

    if (org_name) {
      const slug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      
      const { data: org, error: orgError } = await sb
        .from('organizations')
        .insert({ name: org_name, slug, plan: 'professional', max_agents: 10 })
        .select()
        .single();

      if (orgError) {
        return NextResponse.json({ error: 'Failed to create organization: ' + orgError.message }, { status: 500 });
      }

      await sb.from('org_members').insert({
        org_id: org.id,
        user_id: userId,
        role: 'admin',
      });

      await sb.from('constitutions').insert({
        org_id: org.id,
        version: '1.0',
        signed_by: full_name,
        signed_at: new Date().toISOString(),
        objectives: [
          'Maintain sovereignty score above 70',
          'Zero untraced autonomous decisions',
          'Human override available within 60 seconds',
        ],
        non_delegable: [
          'Customer account termination',
          'Ref
