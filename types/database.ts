export type UserRole = 'admin' | 'ceo' | 'cto' | 'operator' | 'consultant' | 'partner' | 'viewer';
export type AgentStatus = 'active' | 'paused' | 'killed' | 'inactive';
export type GovernanceLevel = 'level_1' | 'level_2' | 'level_3';
export type DecisionAuthority = 'autonomous' | 'governed' | 'assisted' | 'human_only';
export type DecisionCriticality = 'low' | 'medium' | 'high' | 'critical';
export type IncidentSeverity = 'info' | 'warning' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'configuring';
export type KillSwitchLevel = 'none' | 'pause' | 'containment' | 'kill';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type PlanType = 'essential' | 'professional' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  max_agents: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  preferred_language: 'en' | 'fr' | 'es' | 'de';
  preferred_theme: 'dark' | 'light';
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  invited_by: string | null;
  joined_at: string;
}

export interface Agent {
  id: string;
  org_id: string;
  name: string;
  type: string;
  description: string | null;
  connector_type: string;
  status: AgentStatus;
  governance_level: GovernanceLevel;
  health_score: number;
  config: Record<string, any>;
  kpis: Record<string, number[]>;
  last_decision_at: string | null;
  total_decisions: number;
  total_errors: number;
  total_cost_cents: number;
  auto_pause_threshold: number;
  alert_threshold: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Decision {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  description: string | null;
  authority: DecisionAuthority;
  criticality: DecisionCriticality;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DecisionLog {
  id: string;
  org_id: string;
  agent_id: string | null;
  agent_name: string;
  action: string;
  outcome: string;
  impact: string | null;
  metadata: Record<string, any>;
  latency_ms: number | null;
  cost_cents: number;
  created_at: string;
}

export interface Incident {
  id: string;
  org_id: string;
  agent_id: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  assignee_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Connector {
  id: string;
  org_id: string;
  name: string;
  connector_type: string;
  status: ConnectorStatus;
  config: Record<string, any>;
  last_ping_at: string | null;
  last_ping_latency_ms: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Webhook {
  id: string;
  org_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  last_latency_ms: number | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Constitution {
  id: string;
  org_id: string;
  version: string;
  signed_by: string | null;
  signed_at: string | null;
  objectives: string[];
  non_delegable: string[];
  thresholds: Record<string, number>;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface EscalationRule {
  id: string;
  org_id: string;
  constitution_id: string;
  trigger_condition: string;
  action: string;
  response_time: string | null;
  priority: number;
  active: boolean;
  created_at: string;
}

export interface KillSwitchState {
  id: string;
  org_id: string;
  level: KillSwitchLevel;
  reason: string | null;
  activated_by: string | null;
  activated_at: string | null;
  recovered_by: string | null;
  recovered_at: string | null;
}

export interface AuditEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  details: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  org_id: string;
  ticket_number: string;
  category: string;
  subject: string;
  message: string;
  status: TicketStatus;
  response: string | null;
  submitted_by: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SovereigntyHistory {
  id: string;
  org_id: string;
  score: number;
  components: Record<string, number>;
  calculated_at: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  ceo: ['dashboard', 'agents.view', 'decisions.view', 'drift.view', 'incidents.view', 'killswitch.arm', 'killswitch.fire', 'constitution.view', 'connectors.view', 'audit.view', 'settings.view', 'export'],
  cto: ['dashboard', 'agents.view', 'agents.edit', 'decisions.view', 'decisions.edit', 'drift.view', 'incidents.view', 'incidents.manage', 'killswitch.arm', 'killswitch.fire', 'constitution.view', 'constitution.edit', 'connectors.view', 'connectors.edit', 'audit.view', 'settings.view', 'export'],
  operator: ['dashboard', 'agents.view', 'agents.edit', 'decisions.view', 'decisions.edit', 'drift.view', 'incidents.view', 'incidents.manage', 'killswitch.arm', 'connectors.view', 'connectors.edit', 'audit.view', 'export'],
  consultant: ['dashboard', 'agents.view', 'decisions.view', 'drift.view', 'incidents.view', 'connectors.view', 'audit.view', 'export'],
  partner: ['dashboard', 'agents.view', 'decisions.view', 'drift.view', 'connectors.view', 'export'],
  viewer: ['dashboard', 'agents.view', 'drift.view'],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export const PLAN_LIMITS: Record<PlanType, { maxAgents: number; maxConnectors: number; maxWebhooks: number; auditRetentionDays: number }> = {
  essential: { maxAgents: 3, maxConnectors: 5, maxWebhooks: 2, auditRetentionDays: 30 },
  professional: { maxAgents: 10, maxConnectors: 20, maxWebhooks: 10, auditRetentionDays: 90 },
  enterprise: { maxAgents: 999, maxConnectors: 999, maxWebhooks: 999, auditRetentionDays: 365 },
};
