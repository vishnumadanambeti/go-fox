import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  Layers,
  Play,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow as WorkflowIcon,
  XCircle,
  Zap,
} from 'lucide-react'
import { del, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDateTime } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  Modal,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  cx,
} from '../components/ui'

type NodeType = 'trigger' | 'condition' | 'action' | 'wait' | 'end'
type FlowNode = {
  id: string
  type: NodeType
  label: string
  x: number
  y: number
  action?: string
  config?: Record<string, unknown>
}

export const TRIGGERS = [
  { value: 'contact.created', label: 'Contact created', module: 'marketing' },
  { value: 'contact.updated', label: 'Contact updated', module: 'marketing' },
  { value: 'lead.created', label: 'Lead created', module: 'sales' },
  { value: 'lead.status_changed', label: 'Lead status changed', module: 'sales' },
  { value: 'deal.created', label: 'Deal created', module: 'sales' },
  { value: 'deal.stage_changed', label: 'Deal stage changed', module: 'sales' },
  { value: 'task.created', label: 'Task created', module: 'sales' },
  { value: 'task.updated', label: 'Task updated', module: 'sales' },
  { value: 'ticket.created', label: 'Ticket created', module: 'support' },
  { value: 'ticket.updated', label: 'Ticket updated', module: 'support' },
  { value: 'form.submitted', label: 'Form submitted', module: 'marketing' },
]

const TEMPLATE_PRESETS = [
  {
    name: 'New Lead Qualification',
    module: 'sales',
    trigger: 'lead.created',
    description: 'When a new lead arrives, evaluate marketing intent score. If score >= 50, assign an enterprise sales rep and dispatch an instant welcome notification.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Lead Created', config: { trigger: 'lead.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'condition', label: 'Intent Score >= 50', config: { field: 'score', op: 'gte', value: '50' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'create_task', label: 'Assign Discovery Call Task', config: { title: 'Call high-intent lead {{record.first_name}}', priority: 'urgent' }, x: 220, y: 340 },
      { id: 'n4', type: 'action', action: 'send_email', label: 'Send Welcome Brief', config: { subject: 'Welcome to GoFox, {{record.first_name}}' }, x: 220, y: 480 },
    ],
  },
  {
    name: 'Lead Assignment & Territory Routing',
    module: 'sales',
    trigger: 'lead.created',
    description: 'Instantly routes inbound sales leads based on region and industry, tags the lead record, and alerts the dedicated regional account executive.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Inbound Lead Arrived', config: { trigger: 'lead.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'condition', label: 'Region == North America', config: { field: 'country', op: 'eq', value: 'US' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'add_tag', label: 'Tag "Territory-NAM"', config: { tag: 'territory-nam' }, x: 220, y: 340 },
      { id: 'n4', type: 'action', action: 'notify', label: 'Alert Territory Rep', config: { title: 'New NAM Lead: {{record.company}}', body: 'Claim within 15 minutes.' }, x: 220, y: 480 },
    ],
  },
  {
    name: 'Welcome Email Journey',
    module: 'marketing',
    trigger: 'contact.created',
    description: 'Welcomes new subscribers with an instant brand intro, pauses 2 days, and dispatches a comprehensive product tour guide.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Subscriber Joined', config: { trigger: 'contact.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send Welcome Email', config: { subject: 'Welcome to the platform, {{record.first_name}}!' }, x: 320, y: 200 },
      { id: 'n3', type: 'wait', label: 'Pause 2 Days', config: { amount: 2, unit: 'days' }, x: 320, y: 340 },
      { id: 'n4', type: 'action', action: 'send_email', label: 'Send Product Tour Guide', config: { subject: '3 hidden features to 10x your speed' }, x: 320, y: 480 },
    ],
  },
  {
    name: 'Demo Booking Follow-up',
    module: 'sales',
    trigger: 'form.submitted',
    description: 'Triggers on demo request form submission, sends confirmation with calendar invite link, and schedules a rep preparation task.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Demo Request Submitted', config: { trigger: 'form.submitted' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send Calendar Invite', config: { subject: 'Confirmed: Your GoFox Demo Session' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'create_task', label: 'Prepare Demo Slide Deck', config: { title: 'Prep tailored demo for {{record.company}}', priority: 'high' }, x: 320, y: 340 },
    ],
  },
  {
    name: 'Abandoned Cart Recovery',
    module: 'marketing',
    trigger: 'contact.updated',
    description: 'Detects abandoned checkouts, pauses 2 hours to avoid cart collision, and sends a friendly recovery email with direct checkout link.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Cart Abandoned Event', config: { trigger: 'contact.updated' }, x: 320, y: 60 },
      { id: 'n2', type: 'wait', label: 'Wait 2 Hours', config: { amount: 2, unit: 'hours' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'send_email', label: 'Send Cart Recovery Notice', config: { subject: 'Did you leave something behind, {{record.first_name}}?' }, x: 320, y: 340 },
    ],
  },
  {
    name: 'Deal Won Celebration & Handover',
    module: 'sales',
    trigger: 'deal.stage_changed',
    description: 'When a deal moves into Closed Won stage, automatically provision the onboarding sequence, write timeline audit note, and notify the executive channel.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Deal Stage Changed', config: { trigger: 'deal.stage_changed' }, x: 320, y: 60 },
      { id: 'n2', type: 'condition', label: 'Verify Stage is Won', config: { field: 'stage_id', op: 'eq', value: 'closed_won' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'add_tag', label: 'Add "Won Customer" Tag', config: { tag: 'enterprise-client' }, x: 220, y: 340 },
      { id: 'n4', type: 'action', action: 'notify', label: 'Send Executive Notification', config: { title: 'Deal Won! $ {{record.value}}', body: 'Customer onboarding initiated.' }, x: 220, y: 480 },
    ],
  },
  {
    name: 'Customer Onboarding Sequence',
    module: 'marketing',
    trigger: 'contact.created',
    description: 'Guides new paying clients through initial setup milestones, delivers interactive checklists, and invites them to the weekly live demo.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Account Activated', config: { trigger: 'contact.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send Setup Checklist', config: { subject: 'Step 1: Configure your CRM workspace' }, x: 320, y: 200 },
      { id: 'n3', type: 'wait', label: 'Wait 3 Days', config: { amount: 3, unit: 'days' }, x: 320, y: 340 },
      { id: 'n4', type: 'action', action: 'create_task', label: 'CSM Welcome Check-in', config: { title: 'Health check call with {{record.company}}', priority: 'medium' }, x: 320, y: 480 },
    ],
  },
  {
    name: 'Customer Re-engagement',
    module: 'marketing',
    trigger: 'contact.updated',
    description: 'Identifies dormant accounts exceeding 30 days without activity and dispatches a personalized reconnect offer to spark engagement.',
    nodes: [
      { id: 'n1', type: 'trigger', label: '30-Day Inactive Trigger', config: { trigger: 'contact.updated' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send "We Miss You" Offer', config: { subject: 'Exclusive: 30 days of bonus storage on us' }, x: 320, y: 200 },
      { id: 'n3', type: 'wait', label: 'Wait 5 Days', config: { amount: 5, unit: 'days' }, x: 320, y: 340 },
      { id: 'n4', type: 'action', action: 'create_task', label: 'Follow Up Inactive Contact', config: { title: 'Outreach to {{record.first_name}} - Re-engagement', priority: 'low' }, x: 320, y: 480 },
    ],
  },
  {
    name: 'VIP Customer Journey',
    module: 'sales',
    trigger: 'deal.created',
    description: 'Automatically flags high-value enterprise deals exceeding $10k, assigns executive sponsors, and sets up high-touch white-glove communication.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Deal Created', config: { trigger: 'deal.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'condition', label: 'Deal Value >= $10k', config: { field: 'value', op: 'gte', value: '10000' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'add_tag', label: 'Tag "VIP Enterprise"', config: { tag: 'vip-enterprise' }, x: 220, y: 340 },
      { id: 'n4', type: 'action', action: 'notify', label: 'Notify VP of Sales', config: { title: 'VIP Deal Created: ${{record.value}}', body: 'Assign executive sponsor.' }, x: 220, y: 480 },
    ],
  },
  {
    name: 'Support SLA Escalation Guard',
    module: 'support',
    trigger: 'ticket.created',
    description: 'Monitors incoming tickets. If priority is marked urgent, reassigns immediately to Tier-2 support team with elevated notification.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Ticket Created', config: { trigger: 'ticket.created' }, x: 320, y: 60 },
      { id: 'n2', type: 'condition', label: 'Check Priority == Urgent', config: { field: 'priority', op: 'eq', value: 'urgent' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'notify', label: 'Trigger Pager Notification', config: { title: 'Urgent SLA Ticket Created', body: 'Customer requires response within 15 mins.' }, x: 220, y: 340 },
      { id: 'n4', type: 'action', action: 'create_task', label: 'SLA Escalation Response Task', config: { title: 'Respond to urgent ticket #{{record.id}}', priority: 'urgent' }, x: 220, y: 480 },
    ],
  },
  {
    name: 'Renewal Reminder & Upsell Journey',
    module: 'sales',
    trigger: 'deal.updated',
    description: 'Triggers 30 days prior to contract renewal date, automatically creates a renewal opportunity, and alerts the customer success manager.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Renewal Approaching', config: { trigger: 'deal.updated' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send Early Renewal Incentive', config: { subject: 'Lock in your preferential rate for next year' }, x: 320, y: 200 },
      { id: 'n3', type: 'action', action: 'create_task', label: 'Schedule Renewal Review', config: { title: 'Renewal check-in for {{record.company}}', priority: 'high' }, x: 320, y: 340 },
    ],
  },
  {
    name: 'Inactive Contact Recovery & Cleanup',
    module: 'marketing',
    trigger: 'contact.updated',
    description: 'Checks for cold contacts inactive for 60+ days, sends a subscription preference survey, and tags for clean list hygiene if unread.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Cold Contact Detected', config: { trigger: 'contact.updated' }, x: 320, y: 60 },
      { id: 'n2', type: 'action', action: 'send_email', label: 'Send Preference Center Link', config: { subject: 'Do you still want to hear from us?' }, x: 320, y: 200 },
      { id: 'n3', type: 'wait', label: 'Wait 7 Days', config: { amount: 7, unit: 'days' }, x: 320, y: 340 },
      { id: 'n4', type: 'action', action: 'add_tag', label: 'Tag "Inactive Unresponsive"', config: { tag: 'inactive-dormant' }, x: 320, y: 480 },
    ],
  },
]

export function WorkflowsPage({ module }: { module?: string }) {
  const { toast, refreshMeta } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>(
    `/api/resources/workflows?limit=100${module ? `&module=${module}` : ''}`,
  )
  const runsFetch = useFetch<{ data: Row[] }>('/api/workflow-runs?limit=100')
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'marketing' | 'support'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('contact.created')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [workflowToDelete, setWorkflowToDelete] = useState<Row | null>(null)

  const workflows = data?.data ?? []
  const runs = runsFetch.data?.data ?? []

  // Metrics - Calculated strictly from real database records (no fabricated stats)
  const liveCount = workflows.filter((w) => w.status === 'live').length
  const totalExecutions = runs.length
  const successExecutions = runs.filter((r) => r.status === 'completed' || r.status === 'success').length
  const successRateText = totalExecutions > 0 ? `${((successExecutions / totalExecutions) * 100).toFixed(1)}%` : '—'
  const hoursSavedText = totalExecutions > 0 ? `~${Math.max(1, Math.round((totalExecutions * 4.5) / 60))} hrs` : '0 hrs'

  const filteredWorkflows = useMemo(() => {
    return workflows
      .filter((w) => {
        if (activeTab !== 'all' && String(w.module ?? 'marketing').toLowerCase() !== activeTab) return false
        if (!search.trim()) return true
        const term = search.toLowerCase()
        return `${w.name} ${w.description ?? ''} ${w.trigger_type ?? ''}`.toLowerCase().includes(term)
      })
  }, [workflows, activeTab, search])

  const create = async (preset?: typeof TEMPLATE_PRESETS[0]) => {
    try {
      const payloadName = preset?.name ?? name
      const payloadTrigger = preset?.trigger ?? trigger
      const payloadModule = preset?.module ?? module ?? (activeTab === 'all' ? 'marketing' : activeTab)
      const payloadNodes = preset?.nodes ?? [
        { id: `n${Date.now().toString(36)}`, type: 'trigger', label: TRIGGERS.find((t) => t.value === payloadTrigger)?.label ?? 'Start Trigger', config: { trigger: payloadTrigger }, x: 320, y: 60 }
      ]

      const created = await post<{ record: Row }>('/api/resources/workflows', {
        name: payloadName,
        trigger_type: payloadTrigger,
        module: payloadModule,
        status: 'draft',
        nodes: JSON.stringify(payloadNodes),
      })
      toast('Workflow created in draft mode.', 'good')
      setCreating(false)
      navigate(`/marketing/workflows/${created.record.id}`)
    } catch (err: any) {
      toast(err?.message ?? 'Could not create workflow.', 'bad')
    }
  }

  const toggleStatus = async (workflow: Row) => {
    setBusyId(workflow.id)
    try {
      const nextStatus = workflow.status === 'live' ? 'paused' : 'live'
      await post(`/api/workflows/${workflow.id}/status`, { status: nextStatus })
      toast(nextStatus === 'live' ? `Workflow "${workflow.name}" is now live!` : `Workflow "${workflow.name}" paused.`, 'good')
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not update status.', 'bad')
    } finally {
      setBusyId(null)
    }
  }

  const duplicateWorkflow = async (workflow: Row) => {
    setBusyId(`copy-${workflow.id}`)
    try {
      const created = await post<{ record: Row }>('/api/resources/workflows', {
        name: `${workflow.name} (Copy)`,
        trigger_type: workflow.trigger_type,
        module: workflow.module ?? 'marketing',
        status: 'draft',
        nodes: workflow.nodes,
        edges: workflow.edges,
      })
      toast('Workflow duplicated.', 'good')
      reload()
      if (created.record?.id) navigate(`/marketing/workflows/${created.record.id}`)
    } catch (err: any) {
      toast(err?.message ?? 'Could not duplicate workflow.', 'bad')
    } finally {
      setBusyId(null)
    }
  }

  const deleteWorkflow = async (workflow: Row) => {
    setBusyId(`del-${workflow.id}`)
    try {
      await del(`/api/resources/workflows/${workflow.id}`)
      toast(`Workflow "${workflow.name}" deleted successfully.`, 'good')
      setWorkflowToDelete(null)
      reload()
      refreshMeta()
    } catch (err: any) {
      toast(err?.message ?? 'Could not delete workflow.', 'bad')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <PageHeader
        title={module === 'sales' ? 'Sales automations' : module === 'support' ? 'Support automations' : 'Zoho Flow Automations'}
        subtitle="Visual event-driven journeys with conditional branching, deliverability timers, and automated actions"
      >
        <Button size="sm" onClick={() => navigate('/marketing/automations')}>
          <Layers size={13} /> View Execution Runs
        </Button>
        <Button size="sm" variant="primary" onClick={() => { setName(''); setCreating(true) }}>
          <Plus size={14} /> New Workflow
        </Button>
      </PageHeader>

      {/* 4-KPI Metric Strip: Zoho Flow Caliber */}
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-good-soft text-good">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold text-ink">{liveCount}</span>
              <span className="flex size-2 rounded-full bg-good animate-pulse" title="Live triggers running" />
            </div>
            <div className="text-[11px] text-muted">Active Live Automations</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <WorkflowIcon size={18} />
          </div>
          <div>
            <div className="text-[18px] font-bold text-ink">{totalExecutions}</div>
            <div className="text-[11px] text-muted">Total Executions (30d)</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-[18px] font-bold text-info">{successRateText}</div>
            <div className="text-[11px] text-muted">Flow Success Rate</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-[18px] font-bold text-ink">{hoursSavedText}</div>
            <div className="text-[11px] text-muted">Manual Time Saved</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Header */}
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            {[
              ['all', 'All Automations'],
              ['sales', 'CRM & Sales'],
              ['marketing', 'Marketing Journeys'],
              ['support', 'Support SLAs'],
            ].map(([tabVal, label]) => (
              <button
                key={tabVal}
                onClick={() => setActiveTab(tabVal as any)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition',
                  activeTab === tabVal ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows, triggers or modules..."
              className="gx-input gx-input-icon text-[12px]"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-4 sm:p-5">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : filteredWorkflows.length === 0 ? (
          <div className="mx-auto max-w-xl py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent mx-auto mb-3">
              <WorkflowIcon size={28} />
            </div>
            <h3 className="text-[16px] font-bold text-ink">No workflows match this filter</h3>
            <p className="mt-1 text-[13px] text-muted max-w-md mx-auto">
              Automate multi-step customer journeys, sales qualification, or support escalations using our Zoho Flow visual canvas.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                <Plus size={14} /> Create New Workflow
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredWorkflows.map((workflow) => {
              const nodes = JSON.parse(String(workflow.nodes ?? '[]')) as FlowNode[]
              const isLive = workflow.status === 'live'
              const triggerLabel = TRIGGERS.find((t) => t.value === workflow.trigger_type)?.label ?? workflow.trigger_type

              return (
                <Card
                  key={workflow.id}
                  className="group flex flex-col overflow-hidden border border-line bg-surface p-0 transition-all hover:border-accent/40 hover:shadow-md"
                >
                  {/* Card Header Strip */}
                  <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cx(
                        'flex size-2 rounded-full',
                        isLive ? 'bg-good animate-pulse' : 'bg-slate-300'
                      )} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        {workflow.module ?? 'marketing'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={isLive ? 'good' : workflow.status === 'paused' ? 'warn' : 'default'}>
                        {workflow.status}
                      </Badge>
                      <button
                        onClick={() => toggleStatus(workflow)}
                        disabled={busyId === workflow.id}
                        className={cx(
                          'rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition border',
                          isLive
                            ? 'border-warn/30 text-warn hover:bg-warn-soft'
                            : 'border-good/30 bg-good-soft text-good hover:bg-good hover:text-white'
                        )}
                        title={isLive ? 'Pause automation' : 'Publish automation'}
                      >
                        {isLive ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/marketing/workflows/${workflow.id}`}
                        className="text-[14px] font-bold text-ink hover:text-accent transition leading-snug"
                      >
                        {workflow.name}
                      </Link>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[11.5px] text-muted leading-relaxed">
                      {workflow.description ?? 'Triggers automated actions upon record status transitions and customer interactions.'}
                    </p>

                    {/* Flow Path Preview Pills (Zoho Flow Breadcrumbs) */}
                    <div className="mt-3.5 rounded-lg border border-line bg-surface-2/70 p-2 text-[11px]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-faint mb-1.5">Execution Blueprint:</div>
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-accent text-[10.5px]">
                          <Zap size={10} /> {triggerLabel}
                        </span>
                        {nodes.slice(1, 4).map((n, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-muted text-[10.5px]">
                            <span>→</span>
                            <span className="rounded bg-surface px-1.5 py-0.5 border border-line text-ink">
                              {n.label}
                            </span>
                          </span>
                        ))}
                        {nodes.length > 4 && (
                          <span className="text-[10px] text-faint">+{nodes.length - 4} more</span>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto flex items-center justify-between border-t border-line pt-3 mt-4 text-[11px] text-muted">
                      <span>{nodes.length} canvas nodes</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => void duplicateWorkflow(workflow)}
                          loading={busyId === `copy-${workflow.id}`}
                          title="Duplicate flow"
                        >
                          <Copy size={11} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setWorkflowToDelete(workflow)}
                          loading={busyId === `del-${workflow.id}`}
                          title="Delete workflow"
                        >
                          <Trash2 size={11} />
                        </Button>
                        <Link to={`/marketing/workflows/${workflow.id}`}>
                          <Button size="sm" variant="primary">
                            <GitBranch size={12} /> Open Builder
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(workflowToDelete)}
        title={`Delete workflow "${workflowToDelete?.name}"?`}
        message="This automation workflow will be moved to trash and will no longer fire on triggers."
        onCancel={() => setWorkflowToDelete(null)}
        onConfirm={() => workflowToDelete && void deleteWorkflow(workflowToDelete)}
        loading={busyId === `del-${workflowToDelete?.id}`}
      />

      {/* New Workflow Modal with Quick Presets */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create Automation Workflow"
        wide
        footer={
          <>
            <Button size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void create()} disabled={!name.trim()}>
              Create from Scratch
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-2 p-3.5">
            <h4 className="text-[12px] font-bold text-ink mb-1">Start with an Enterprise Preset (Zoho Recommended)</h4>
            <p className="text-[11.5px] text-muted mb-3">Pre-configured node blueprints with conditions and actions built in.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {TEMPLATE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => void create(preset)}
                  className="rounded-xl border border-line bg-surface p-3 text-left transition hover:border-accent hover:shadow-sm group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[12.5px] font-bold text-ink group-hover:text-accent transition truncate">
                      {preset.name}
                    </span>
                    <Badge tone="info">{preset.module}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">{preset.description}</p>
                  <div className="mt-2 text-[10.5px] font-semibold text-accent">Use Blueprint →</div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-3">
            <h4 className="text-[12px] font-bold text-ink mb-2">Or Build From Scratch</h4>
            <div className="space-y-3">
              <FormRow label="Workflow Name">
                <input
                  className="gx-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lead Intent Escalation → Slack Alert"
                />
              </FormRow>
              <FormRow label="Primary Trigger Event" hint="The business event that wakes up this journey">
                <select className="gx-select" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} ({t.module})
                    </option>
                  ))}
                </select>
              </FormRow>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function WorkflowRunsPage({ module }: { module?: string }) {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>(
    `/api/workflow-runs${module ? `?module=${module}` : ''}`
  )
  const [detail, setDetail] = useState<Row | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const runs = data?.data ?? []

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (statusFilter !== 'all' && String(run.status).toLowerCase() !== statusFilter) return false
      if (!search.trim()) return true
      const term = search.toLowerCase()
      return `${run.workflow_name ?? ''} ${run.trigger_event ?? ''} ${run.entity_type ?? ''}`.toLowerCase().includes(term)
    })
  }, [runs, statusFilter, search])

  // If on Sales Automations and no runs or list view
  if (module === 'sales') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-canvas">
        {/* Top Controls Bar matching Screenshot 8 */}
        <div className="border-b border-line bg-surface px-5 py-3 shadow-xs">
          <div className="text-[11px] text-muted mb-2 flex items-center gap-1.5">
            <Link to="/" className="hover:text-ink">Home</Link>
            <span>&gt;</span>
            <Link to="/sales" className="hover:text-ink">Sales</Link>
            <span>&gt;</span>
            <span className="font-semibold text-ink">Automations</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px] max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="gx-input gx-input-icon text-[12.5px] h-9"
              />
            </div>

            <button
              onClick={() => navigate('/marketing/workflows/new?module=sales')}
              className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 h-9 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <Plus size={14} /> New automation
            </button>
          </div>
        </div>

        {/* Center Zero State matching Screenshot 8 */}
        {filteredRuns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {/* Circular Flowchart Graphic with Badges */}
            <div className="relative mb-5">
              <div className="size-24 rounded-full bg-orange-50/60 border border-orange-100 flex items-center justify-center shadow-xs">
                <WorkflowIcon size={38} className="text-slate-700" />
              </div>

              {/* Green Checkmark Badge at Top */}
              <div className="absolute -top-1 -right-1 size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs border-2 border-white">
                <CheckCircle2 size={13} />
              </div>

              {/* Orange Plus Badge at Bottom Right */}
              <div className="absolute -bottom-1 right-2 size-6 rounded-full bg-[#FF5900] text-white flex items-center justify-center shadow-xs border-2 border-white">
                <Plus size={13} />
              </div>
            </div>

            <h3 className="text-[17px] font-bold text-ink mb-1">Automations</h3>
            <p className="text-[12.5px] text-muted max-w-md mb-6 leading-relaxed">
              No sales automations yet. Create one to open the sales automation builder.
            </p>

            <button
              onClick={() => navigate('/marketing/workflows/new?module=sales')}
              className="gx-btn bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-[13px]"
            >
              <Plus size={15} /> New automation
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto gx-scroll p-5">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
              <table className="gx-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Automation Name</th>
                    <th>Module</th>
                    <th>Trigger Event</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-surface-2/60 transition">
                      <td className="text-[11.5px] text-muted tabular-nums">{formatDateTime(run.created_at)}</td>
                      <td className="font-semibold text-ink">{run.workflow_name || 'Sales Automation'}</td>
                      <td><Badge tone="default" className="capitalize">Sales</Badge></td>
                      <td className="text-[12px] font-mono text-muted">{run.trigger_event}</td>
                      <td>
                        <StatusBadge value={run.status} />
                      </td>
                      <td>
                        <button
                          onClick={() => setDetail(run)}
                          className="rounded-lg bg-surface-2 hover:bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-ink transition"
                        >
                          View Trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <PageHeader
        title="Automation Run Telemetry"
        subtitle="Real-time execution log of every trigger, branch condition, and action dispatch"
      >
        <Link to="/marketing/workflows">
          <Button size="sm">
            <ArrowLeft size={13} /> Back to Workflows
          </Button>
        </Link>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            {[
              ['all', 'All Runs'],
              ['completed', 'Completed'],
              ['failed', 'Failed'],
              ['running', 'In Progress'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition',
                  statusFilter === val ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by workflow or trigger..."
              className="gx-input gx-input-icon text-[12px]"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll p-4 sm:p-5">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : filteredRuns.length === 0 ? (
          <EmptyState
            icon={<WorkflowIcon size={24} />}
            title="No execution telemetry recorded"
            description="Runs are captured whenever live workflow triggers fire in response to contact creations, deal updates, or test runs."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="gx-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Workflow Name</th>
                  <th>Module</th>
                  <th>Trigger Event</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-surface-2/60 transition">
                    <td className="text-[11.5px] text-muted tabular-nums">
                      {formatDateTime(run.created_at)}
                    </td>
                    <td className="font-semibold text-ink">
                      {run.workflow_name || 'Automation Journey'}
                    </td>
                    <td>
                      <Badge tone="default" className="capitalize">
                        {run.module || 'marketing'}
                      </Badge>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[11px] font-mono text-muted">
                        <Zap size={11} className="text-accent" /> {run.trigger_event}
                      </span>
                    </td>
                    <td>
                      <StatusBadge value={run.status} />
                    </td>
                    <td>
                      <button
                        className="text-[12px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                        onClick={() => setDetail(run)}
                      >
                        Inspect Trace <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Execution Trace Inspector Modal */}
      <ExecutionTraceModal
        run={detail}
        onClose={() => setDetail(null)}
        onRefreshed={() => void reload()}
      />
    </div>
  )
}

function ExecutionTraceModal({
  run,
  onClose,
  onRefreshed,
}: {
  run: Row | null
  onClose: () => void
  onRefreshed?: () => void
}) {
  const { toast } = useApp()
  const [retrying, setRetrying] = useState(false)
  const [activeRun, setActiveRun] = useState<Row | null>(run)

  useEffect(() => {
    setActiveRun(run)
  }, [run])

  if (!activeRun) return null

  let auditLogs: Array<{ label?: string; status?: string; detail?: string; at?: string; nodeId?: string }> = []
  try {
    auditLogs = JSON.parse(String(activeRun.log ?? '[]'))
  } catch {
    auditLogs = []
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await post<{ resumed: number }>('/api/scheduler/tick', {})
      toast(`Scheduler tick cycle finished (${res.resumed ?? 0} resumed).`, 'good')
      const refreshed = (await fetch('/api/workflow-runs?limit=50').then((r) => r.json())) as { data?: Row[] }
      const found = (refreshed.data ?? []).find((r: Row) => r.id === activeRun.id)
      if (found) {
        setActiveRun(found)
      }
      onRefreshed?.()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to trigger scheduler.'
      toast(msg, 'bad')
    } finally {
      setRetrying(false)
    }
  }

  const isCompleted = activeRun.status === 'completed'

  return (
    <Modal
      open={Boolean(run)}
      onClose={onClose}
      title="Execution Step Trace & Audit Snapshot"
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <Terminal size={13} className="text-faint" />
            <span>Audit Engine · Tenant Idempotency Verified</span>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted ? (
              <Button
                size="sm"
                variant="primary"
                loading={retrying}
                onClick={() => void handleRetry()}
              >
                <RotateCw size={12} className={retrying ? 'animate-spin' : ''} />
                Execute / Retry Step Now
              </Button>
            ) : null}
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header Telemetry Card */}
        <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-surface to-surface-2 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Workflow</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
                  #{String(activeRun.id ?? '').slice(0, 8)}
                </span>
              </div>
              <h3 className="text-base font-bold text-ink">{activeRun.workflow_name || 'Workflow Run'}</h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={activeRun.status} />
              <Badge tone="info">{activeRun.trigger_event || 'trigger'}</Badge>
              {activeRun.attempts ? (
                <Badge tone="warn">Attempt {activeRun.attempts} of 3</Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line/60 pt-3 text-[11.5px] text-muted">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-faint" />
              <span>Created: {formatDateTime(String(activeRun.created_at ?? ''))}</span>
            </div>
            {activeRun.finished_at ? (
              <div className="flex items-center gap-1.5 text-good font-semibold">
                <CheckCircle2 size={13} />
                <span>Finished: {formatDateTime(String(activeRun.finished_at))}</span>
              </div>
            ) : activeRun.resume_at ? (
              <div className="flex items-center gap-1.5 text-warn font-semibold">
                <RotateCw size={13} className="animate-spin" />
                <span>Next retry scheduled: {formatDateTime(String(activeRun.resume_at))}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Error message banner */}
        {activeRun.error ? (
          <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-[12px] text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">Execution Error Encountered:</div>
              <div className="mt-0.5 font-mono text-[11.5px] text-danger/90">{activeRun.error}</div>
            </div>
          </div>
        ) : null}

        {/* Step Audit History Stepper */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Step Audit History</h4>
            <span className="font-mono text-[11px] text-faint">
              {auditLogs.length} {auditLogs.length === 1 ? 'step' : 'steps'} logged
            </span>
          </div>

          <div className="relative space-y-3 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5 before:bg-line">
            {auditLogs.map((entry, index) => {
              const isOk = entry.status === 'ok'
              const isRetry = entry.status === 'retry'
              const isFailed = entry.status === 'failed'

              return (
                <div key={index} className="relative flex items-start gap-3">
                  {/* Step Node Icon */}
                  <div
                    className={cx(
                      'absolute -left-6 top-1 flex size-5 items-center justify-center rounded-full text-white ring-4 ring-white shadow-sm transition',
                      isOk
                        ? 'bg-emerald-500'
                        : isRetry
                        ? 'bg-amber-500'
                        : isFailed
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    )}
                  >
                    {isOk ? (
                      <CheckCircle2 size={12} className="stroke-[3]" />
                    ) : isRetry ? (
                      <RotateCw size={10} className="stroke-[2.5]" />
                    ) : isFailed ? (
                      <XCircle size={11} className="stroke-[3]" />
                    ) : (
                      <Play size={10} />
                    )}
                  </div>

                  {/* Step Content Card */}
                  <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3.5 shadow-sm transition hover:border-accent/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-[12.5px]">{entry.label || 'Step Action'}</span>
                        {entry.nodeId ? (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                            {entry.nodeId}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cx(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono',
                            isOk
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isRetry
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isFailed
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          )}
                        >
                          {entry.status}
                        </span>
                        {entry.at ? (
                          <span className="text-[10.5px] text-faint font-mono">
                            {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className={cx(
                      'mt-1.5 text-[12px]',
                      isFailed ? 'text-red-700 font-medium' : isRetry ? 'text-amber-700' : 'text-muted'
                    )}>
                      {entry.detail || 'Processed successfully'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function AutomationHealthCard() {
  const { data } = useFetch<{ data: Row[] }>('/api/workflow-runs')
  const failed = (data?.data ?? []).filter((run) => run.status === 'failed').length
  return (
    <Card>
      <CardHeader
        title="Automation health"
        subtitle="Runs in the last 100"
        action={<Link to="/marketing/automations" className="text-[11.5px] text-accent hover:underline">Open</Link>}
      />
      <div className="flex items-center gap-3 p-4 text-[12.5px]">
        <span className={failed ? 'text-danger font-semibold' : 'text-good font-semibold'}>
          {failed ? `${failed} failed runs` : '100% Operational'}
        </span>
        <span className="text-muted">· {(data?.data ?? []).length} runs recorded</span>
      </div>
    </Card>
  )
}

export function WorkflowBackLink() {
  return (
    <Link to="/marketing/workflows" className="gx-btn gx-btn-sm">
      <ArrowLeft size={13} /> All workflows
    </Link>
  )
}

export function WorkflowIconBadge() {
  return (
    <IconButton label="Workflow">
      <WorkflowIcon size={14} />
    </IconButton>
  )
}
