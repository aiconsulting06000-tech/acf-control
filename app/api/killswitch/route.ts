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

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserOrg(user.id);
    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const allowed = ['admin', 'ceo', 'cto', 'operator'];
    if (!allowed.includes(membership.role)) {
      return NextResponse.json({ error: 'Kill switch requires admin/ceo/cto/operator role' }, { status: 403 });
    }

    const body = await request.json();
    const { action, level, reason } = body;

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profile } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
    const userName = profile?.full_name || user.email || 'Unknown';

    if (action === 'fire') {
      if (!level || !['pause', 'containment', 'kill'].includes(level)) {
        return NextResponse.json({ error: 'Invalid level. Must be pause, containment, or kill.' }, { status: 400 });
      }

      if ((level === 'containment' || level === 'kill') && !reason) {
        return NextResponse.json({ error: 'Reason required for containment and kill levels' }, { status: 400 });
      }

      // Update kill switch state
      await sb.from('kill_switch_state').update({
        level,
        reason: reason || 'Activated by ' + userName,
        activated_by: user.id,
        activated_at: new Date().toISOString(),
        recovered_by: null,
        recovered_at: null,
      }).eq('org_id', membership.org_id);

      // Update agents based on level
      if (level === 'kill') {
        await sb.from('agents').update({ status: 'killed', health_score: 0 }).eq('org_id', membership.org_id).in('status', ['active', 'paused']);
      } else if (level === 'pause') {
        await sb.from('agents').update({ status: 'paused' }).eq('org_id', membership.org_id).eq('status', 'active');
      }

      // Create incident
      await sb.from('incidents').insert({
        org_id: membership.org_id,
        severity: 'critical',
        status: 'open',
        title: 'KILL SWITCH LEVEL ' + level.toUpperCase() + ' ACTIVATED',
        description: reason || 'Activated by ' + userName,
        assignee_id: user.id,
      });

      // History
      await sb.from('kill_switch_history').insert({
        org_id: membership.org_id,
        level,
        action: 'activated',
        reason: reason || null,
        actor_id: user.id,
      });

      // Audit
      await sb.from('audit_log').insert({
        org_id: membership.org_id,
        user_id: user.id,
        user_name: userName,
        action: 'kill_switch_fired',
        details: 'Level ' + level + ': ' + (reason || 'No reason provided'),
      });

      return NextResponse.json({ success: true, level });

    } else if (action === 'recover') {
      // Recover all agents
      await sb.from('kill_switch_state').update({
        level: 'none',
        reason: null,
        recovered_by: user.id,
        recovered_at: new Date().toISOString(),
      }).eq('org_id', membership.org_id);

      // Restore killed/paused agents
      await sb.from('agents').update({ status: 'active', health_score: 50 }).eq('org_id', membership.org_id).in('status', ['killed', 'paused']);

      // History
      await sb.from('kill_switch_history').insert({
        org_id: membership.org_id,
        level: 'none',
        action: 'recovered',
        reason: 'Recovered by ' + userName,
        actor_id: user.id,
      });

      // Audit
      await sb.from('audit_log').insert({
        org_id: membership.org_id,
        user_id: user.id,
        user_name: userName,
        action: 'kill_switch_recovered',
        details: 'All agents restored by ' + userName,
      });

      return NextResponse.json({ success: true, level: 'none' });

    } else {
      return NextResponse.json({ error: 'Invalid action. Must be fire or recover.' }, { status: 400 });
    }

  } catch (e: any) {
    console.error('Kill switch error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
