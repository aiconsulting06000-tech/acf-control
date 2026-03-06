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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserOrg(user.id);
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const allowed = ['admin', 'cto', 'operator'];
    if (!allowed.includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    // Only allow updating specific fields
    const updates: Record<string, any> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.health_score !== undefined) updates.health_score = body.health_score;
    if (body.governance_level !== undefined) updates.governance_level = body.governance_level;
    if (body.description !== undefined) updates.description = body.description;
    if (body.config !== undefined) updates.config = body.config;
    if (body.kpis !== undefined) updates.kpis = body.kpis;

    const { data, error } = await sb
      .from('agents')
      .update(updates)
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    // Audit
    await sb.from('audit_log').insert({
      org_id: membership.org_id,
      user_id: user.id,
      user_name: user.email || 'Unknown',
      action: 'agent_updated',
      details: 'Agent ' + data.name + ' updated: ' + Object.keys(updates).join(', '),
      resource_type: 'agent',
      resource_id: id,
    });

    return NextResponse.json({ agent: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserOrg(user.id);
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    if (!['admin', 'cto'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admin/cto can delete agents' }, { status: 403 });
    }

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data } = await sb.from('agents').select('name').eq('id', id).eq('org_id', membership.org_id).single();
    if (!data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    await sb.from('agents').delete().eq('id', id).eq('org_id', membership.org_id);

    await sb.from('audit_log').insert({
      org_id: membership.org_id,
      user_id: user.id,
      user_name: user.email || 'Unknown',
      action: 'agent_deleted',
      details: 'Agent ' + data.name + ' deleted',
      resource_type: 'agent',
      resource_id: id,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
