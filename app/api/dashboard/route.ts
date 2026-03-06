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

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: membership } = await sb
      .from('org_members')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const orgId = membership.org_id;

    // Parallel fetches for performance
    const [
      agentsRes,
      decisionsRes,
      incidentsRes,
      sovHistRes,
      ksRes,
      profileRes,
      logsRes,
    ] = await Promise.all([
      sb.from('agents').select('*').eq('org_id', orgId).order('created_at'),
      sb.from('decisions').select('*').eq('org_id', orgId),
      sb.from('incidents').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20),
      sb.from('sovereignty_history').select('*').eq('org_id', orgId).order('calculated_at', { ascending: true }).limit(60),
      sb.from('kill_switch_state').select('*').eq('org_id', orgId).single(),
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('decision_logs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20),
    ]);

    const agents = agentsRes.data || [];
    const decisions = decisionsRes.data || [];
    const incidents = incidentsRes.data || [];
    const sovHistory = sovHistRes.data || [];
    const killSwitch = ksRes.data || { level: 'none', reason: null };
    const profile = profileRes.data;
    const decisionLogs = logsRes.data || [];

    // Calculate sovereignty score
    const agentCount = agents.length || 1;
    const govRatio = agents.filter(function(a: any) { return a.status === 'active' && (a.governance_level === 'level_2' || a.governance_level === 'level_3'); }).length / agentCount;
    const critDec = decisions.filter(function(d: any) { return d.criticality === 'high' || d.criticality === 'critical'; }).length;
    const humanOnly = decisions.filter(function(d: any) { return d.authority === 'human_only'; }).length;
    const humanCoverage = critDec > 0 ? Math.min(humanOnly / critDec, 1) : 1;
    const avgHealth = agents.reduce(function(s: number, a: any) { return s + a.health_score; }, 0) / agentCount;
    const recentIncidents = incidents.filter(function(i: any) { return Date.now() - new Date(i.created_at).getTime() < 30 * 86400000; }).length;
    const incidentPenalty = Math.min(recentIncidents * 5, 30);
    const sovereigntyScore = Math.max(0, Math.min(100, Math.round(
      govRatio * 25 + humanCoverage * 25 + (avgHealth / 100) * 25 + ((100 - incidentPenalty) / 100) * 25
    )));

    // Store sovereignty score
    await sb.from('sovereignty_history').insert({
      org_id: orgId,
      score: sovereigntyScore,
      components: { governance: govRatio, human_coverage: humanCoverage, health: avgHealth / 100, incident_penalty: incidentPenalty },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.email,
        role: membership.role,
        preferred_language: profile?.preferred_language || 'en',
        preferred_theme: profile?.preferred_theme || 'dark',
      },
      organization: membership.organizations,
      sovereignty_score: sovereigntyScore,
      agents,
      decisions,
      incidents,
      sovereignty_history: sovHistory,
      kill_switch: killSwitch,
      decision_logs: decisionLogs,
    });

  } catch (e: any) {
    console.error('Dashboard error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
