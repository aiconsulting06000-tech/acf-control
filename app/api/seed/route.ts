import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { org_id, user_id } = await request.json();
    if (!org_id || !user_id) {
      return NextResponse.json({ error: 'org_id and user_id required' }, { status: 400 });
    }

    const sb = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    // Check user is admin
    const { data: member } = await sb.from('org_members').select('role').eq('org_id', org_id).eq('user_id', user_id).single();
    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Seed agents
    const agents = [
      { org_id, name: 'PRICE-GOV', type: 'pricing', connector_type: 'openai', status: 'active', governance_level: 'level_2', health_score: 92, kpis: { margin: [31.2,31.5,31.8,32.1,32,31.9,32.3,32.1,31.8,32,32.2,32.4,32.1,32.3], escalations: [2,1,3,1,0,2,1,0,1,2,1,0,1,0] }, total_decisions: 1247, total_cost_cents: 4520, created_by: user_id },
      { org_id, name: 'STOCK-AI', type: 'inventory', connector_type: 'langchain', status: 'active', governance_level: 'level_2', health_score: 67, kpis: { coverage: [95,94,93,91,89,87,85,83,81,79,78,76,74,72], stockouts: [0,0,1,1,2,2,3,3,4,4,5,5,6,7] }, total_decisions: 832, total_errors: 23, total_cost_cents: 3100, created_by: user_id },
      { org_id, name: 'FRAUD-DET', type: 'security', connector_type: 'anthropic', status: 'active', governance_level: 'level_3', health_score: 88, kpis: { blocked: [12,15,11,14,13,16,12,11,14,15,13,12,14,13], accuracy: [98.2,98.5,98.1,98.6,98.7,98.3,98.8,98.9,98.6,98.4,98.7,98.8,98.6,98.7] }, total_decisions: 5420, total_cost_cents: 8900, created_by: user_id },
      { org_id, name: 'ADS-OPT', type: 'marketing', connector_type: 'openai', status: 'paused', governance_level: 'level_1', health_score: 45, kpis: { roas: [3.2,3.1,2.9,2.8,2.7,2.5,2.4,2.3,2.2,2.1,2,1.9,1.8,1.7] }, total_decisions: 328, total_errors: 41, total_cost_cents: 1200, created_by: user_id },
      { org_id, name: 'SUPPORT-AI', type: 'support', connector_type: 'anthropic', status: 'active', governance_level: 'level_2', health_score: 81, kpis: { resolution: [82,83,84,84,85,85,86,86,87,87,86,85,84,83], satisfaction: [4.2,4.2,4.3,4.3,4.3,4.4,4.4,4.4,4.3,4.3,4.2,4.2,4.1,4.1] }, total_decisions: 2103, total_cost_cents: 6200, created_by: user_id },
    ];
    const { data: insertedAgents } = await sb.from('agents').insert(agents).select();

    // Seed decisions
    const decisions = [
      { org_id, name: 'Price adjustment', category: 'pricing', authority: 'governed', criticality: 'high', agent_id: insertedAgents?.[0]?.id, description: 'Automated price adjustments within defined margins' },
      { org_id, name: 'Stock replenishment', category: 'inventory', authority: 'assisted', criticality: 'medium', agent_id: insertedAgents?.[1]?.id, description: 'Semi-automated stock reorders based on demand prediction' },
      { org_id, name: 'Fraud blocking', category: 'security', authority: 'governed', criticality: 'critical', agent_id: insertedAgents?.[2]?.id, description: 'Real-time transaction fraud detection and blocking' },
      { org_id, name: 'Customer account termination', category: 'crm', authority: 'human_only', criticality: 'critical', description: 'Permanent account closure requires human approval' },
      { org_id, name: 'Budget reallocation', category: 'marketing', authority: 'human_only', criticality: 'high', agent_id: insertedAgents?.[3]?.id, description: 'Marketing budget changes above 10% require approval' },
      { org_id, name: 'Ticket auto-resolve', category: 'support', authority: 'governed', criticality: 'low', agent_id: insertedAgents?.[4]?.id, description: 'Simple support tickets auto-resolved by AI' },
      { org_id, name: 'Refund approval', category: 'finance', authority: 'human_only', criticality: 'high', description: 'Refunds above 500 EUR require human approval' },
      { org_id, name: 'Ad bid adjustment', category: 'marketing', authority: 'governed', criticality: 'medium', agent_id: insertedAgents?.[3]?.id, description: 'Real-time bidding adjustments within daily budget' },
    ];
    await sb.from('decisions').insert(decisions);

    // Seed incidents
    const now = Date.now();
    const incidents = [
      { org_id, agent_id: insertedAgents?.[1]?.id, severity: 'warning', status: 'open', title: 'STOCK-AI drift: coverage declining', description: 'Coverage dropped from 95% to 72% over 14 days. Stockout risk increasing.' },
      { org_id, agent_id: insertedAgents?.[3]?.id, severity: 'critical', status: 'resolved', title: 'ADS-OPT ROAS below threshold', description: 'ROAS dropped below 2.0x minimum. Agent paused pending review.', resolved_at: new Date(now - 86400000).toISOString() },
      { org_id, agent_id: insertedAgents?.[0]?.id, severity: 'info', status: 'closed', title: 'PRICE-GOV quarterly kill switch test', description: 'Routine test completed successfully. Response: 0.8s.' },
    ];
    await sb.from('incidents').insert(incidents);

    // Seed decision logs
    const logs = [
      { org_id, agent_name: 'PRICE-GOV', action: 'Price adjusted +2.3% on SKU-4821', outcome: 'approved', impact: '+342 EUR', agent_id: insertedAgents?.[0]?.id },
      { org_id, agent_name: 'STOCK-AI', action: 'Reorder triggered: 500x Widget-A', outcome: 'approved', impact: '12400 EUR', agent_id: insertedAgents?.[1]?.id },
      { org_id, agent_name: 'FRAUD-DET', action: 'Transaction blocked: 2341 EUR suspicious', outcome: 'blocked', impact: 'Loss prevented', agent_id: insertedAgents?.[2]?.id },
      { org_id, agent_name: 'PRICE-GOV', action: 'Bulk reprice attempted (47 SKUs)', outcome: 'escalated', impact: 'Human review required', agent_id: insertedAgents?.[0]?.id },
      { org_id, agent_name: 'SUPPORT-AI', action: 'Ticket #4821 auto-resolved', outcome: 'resolved', impact: '2min response time', agent_id: insertedAgents?.[4]?.id },
      { org_id, agent_name: 'STOCK-AI', action: 'Stock transfer warehouse B to C', outcome: 'approved', impact: '48 units moved', agent_id: insertedAgents?.[1]?.id },
      { org_id, agent_name: 'FRAUD-DET', action: 'Account flagged: user-8472', outcome: 'flagged', impact: 'Under manual review', agent_id: insertedAgents?.[2]?.id },
      { org_id, agent_name: 'ADS-OPT', action: 'Budget shifted +200 EUR to Campaign C', outcome: 'approved', impact: 'ROAS 2.1x', agent_id: insertedAgents?.[3]?.id },
    ];
    await sb.from('decision_logs').insert(logs);

    // Seed connectors
    const connectors = [
      { org_id, name: 'OpenAI Production', connector_type: 'openai', status: 'connected', created_by: user_id },
      { org_id, name: 'Anthropic Production', connector_type: 'anthropic', status: 'connected', created_by: user_id },
      { org_id, name: 'LangChain Staging', connector_type: 'langchain', status: 'connected', created_by: user_id },
    ];
    await sb.from('connectors').insert(connectors);

    // Seed webhooks
    await sb.from('webhooks').insert({
      org_id, name: 'Slack #governance-alerts', url: 'https://hooks.slack.com/services/demo',
      events: ['incident.created', 'kill_switch.fired', 'agent.health_critical'],
      active: true, created_by: user_id,
    });

    // Seed sovereignty history (30 days)
    const sovData = [65,72,68,74,71,77,73,69,75,70,76,72,78,74,80,76,73,79,75,71,77,73,69,75,71,77,74,70,76,74];
    const sovEntries = sovData.map(function(score, i) {
      return {
        org_id,
        score,
        components: { governance: 0.7, human_coverage: 0.8, health: score / 100, incidents: 0.9 },
        calculated_at: new Date(now - (29 - i) * 86400000).toISOString(),
      };
    });
    await sb.from('sovereignty_history').insert(sovEntries);

    // Audit
    await sb.from('audit_log').insert({
      org_id, user_id, user_name: 'Admin',
      action: 'demo_data_seeded',
      details: 'Demo data populated: 5 agents, 8 decisions, 3 incidents, 8 decision logs, 3 connectors, 1 webhook, 30d sovereignty history',
    });

    return NextResponse.json({ 
      success: true, 
      seeded: { agents: 5, decisions: 8, incidents: 3, logs: 8, connectors: 3, webhooks: 1 } 
    });

  } catch (e: any) {
    console.error('Seed error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
