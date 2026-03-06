import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUser(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data } = await createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  }).auth.getUser();
  return data.user;
}

async function getUserOrg(userId: string) {
  const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await sb.from('org_members').select('org_id, role').eq('user_id', userId).limit(1).single();
  return data;
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserOrg(user.id);
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await sb
      .from('agents')
      .select('*')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agents: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserOrg(user.id);
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const allowed = ['admin', 'cto', 'operator'];
    if (!allowed.includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, connector_type, governance_level, description } = body;

    if (!name || !type || !connector_type) {
      return NextResponse.json({ error: 'Name, type, and connector_type required' }, { status: 400 });
    }

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    // Check plan limits
    const { count } = await sb.from('agents').select('id', { count: 'exact' }).eq('org_id', membership.org_id);
    const { data: org } = await sb.from('organizations').select('max_agents').eq('id', membership.org_id).single();
    
    if (org && count !== null && count >= org.max_agents) {
      return NextResponse.json({ error: 'Agent limit reached for your plan' }, { status: 403 });
    }

    const { data, error } = await sb.from('agents').insert({
      org_id: membership.org_id,
      name: name.toUpperCase().replace(/\s+/g, '-'),
      type,
      description: description || null,
      connector_type,
      governance_level: governance_level || 'level_2',
      status: 'inactive',
      health_score: 100,
      created_by: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit
    await sb.from('audit_log').insert({
      org_id: membership.org_id,
      user_id: user.id,
      user_name: user.email || 'Unknown',
      action: 'agent_created',
      details: 'Agent ' + data.name + ' created',
      resource_type: 'agent',
      resource_id: data.id,
    });

    return NextResponse.json({ agent: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
