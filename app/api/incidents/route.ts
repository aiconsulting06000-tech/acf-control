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

    const { data: incidents } = await sb
      .from('incidents')
      .select('*, incident_notes(*), incident_interventions(*)')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({ incidents: incidents || [] });
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
    const { title, severity, description, agent_id } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: profile } = await sb.from('profiles').select('full_name').eq('id', user.id).single();

    const { data, error } = await sb.from('incidents').insert({
      org_id: membership.org_id,
      agent_id: agent_id || null,
      severity: severity || 'warning',
      status: 'open',
      title,
      description: description || null,
      assignee_id: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add initial intervention
    await sb.from('incident_interventions').insert({
      incident_id: data.id,
      org_id: membership.org_id,
      actor_id: user.id,
      actor_name: profile?.full_name || user.email || 'Unknown',
      action: 'Incident created',
    });

    // Audit
    await sb.from('audit_log').insert({
      org_id: membership.org_id,
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Unknown',
      action: 'incident_created',
      details: title,
      resource_type: 'incident',
      resource_id: data.id,
    });

    return NextResponse.json({ incident: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
