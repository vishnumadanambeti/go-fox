import { useState } from 'react'
import {
  ArrowLeft,
  GitBranch,
  Pause,
  Play,
  Plus,
  Workflow as WorkflowIcon,
  Zap,
} from 'lucide-react'
import { post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDateTime } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  FormRow,
  IconButton,
  Modal,
  PageHeader,
  StatusBadge,
  TableSkeleton,
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
  { value: 'contact.created', label: 'Contact created' },
  { value: 'contact.updated', label: 'Contact updated' },
  { value: 'lead.created', label: 'Lead created' },
  { value: 'lead.status_changed', label: 'Lead status changed' },
  { value: 'deal.created', label: 'Deal created' },
  { value: 'deal.stage_changed', label: 'Deal stage changed' },
  { value: 'task.created', label: 'Task created' },
  { value: 'task.updated', label: 'Task updated' },
  { value: 'ticket.created', label: 'Ticket created' },
  { value: 'ticket.updated', label: 'Ticket updated' },
  { value: 'form.submitted', label: 'Form submitted' },
]


export function WorkflowsPage({ module }: { module?: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>(
    `/api/resources/workflows?limit=100${module ? `&module=${module}` : ''}`,
  )
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('contact.created')

  const create = async () => {
    if (!name.trim()) {
      toast('Name the workflow first.', 'bad')
      return
    }
    try {
      const label = TRIGGERS.find((item) => item.value === trigger)?.label ?? 'Trigger'
      const nodes = [{ id: `n${Date.now().toString(36)}`, type: 'trigger', label, config: { trigger }, x: 120, y: 40 }]
      const created = await post<{ record: Row }>('/api/resources/workflows', {
        name,
        trigger_type: trigger,
        module: module ?? 'marketing',
        nodes: JSON.stringify(nodes),
      })
      toast('Workflow created as a draft.', 'good')
      setCreating(false)
      navigate(`/marketing/workflows/${created.record.id}`)
    } catch (err: any) {
      toast(err?.message ?? 'Could not create the workflow.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={module === 'sales' ? 'Sales automations' : module === 'support' ? 'Support automations' : 'Workflows'}
        subtitle="Event-driven automations with conditions, waits and logged runs"
      >
        <Button size="sm" variant="primary" onClick={() => { setName(''); setCreating(true) }}>
          <Plus size={14} /> New workflow
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : (data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<WorkflowIcon size={18} />}
            title="No workflows here yet"
            description="Start from a trigger such as “Contact created”, then add actions. Go Live validates the graph before saving."
            action={<Button size="sm" variant="primary" onClick={() => setCreating(true)}>New workflow</Button>}
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.data ?? []).map((workflow) => {
              const nodes = JSON.parse(String(workflow.nodes ?? '[]')) as FlowNode[]
              return (
                <Card key={workflow.id} className="flex flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/marketing/workflows/${workflow.id}`} className="line-clamp-2 text-[13px] font-semibold hover:text-accent">
                        {workflow.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge value={workflow.status} />
                        <Badge>{workflow.module}</Badge>
                      </div>
                    </div>
                    <Zap size={15} className="text-faint" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11.5px] text-muted">{workflow.description ?? 'No description'}</p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted">
                    <GitBranch size={12} /> {TRIGGERS.find((t) => t.value === workflow.trigger_type)?.label ?? workflow.trigger_type}
                    <span className="ml-auto">{nodes.length} nodes</span>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 pt-3">
                    <Link to={`/marketing/workflows/${workflow.id}`} className="gx-btn gx-btn-sm">Open builder</Link>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await post(`/api/workflows/${workflow.id}/status`, { status: workflow.status === 'live' ? 'paused' : 'live' })
                          toast(workflow.status === 'live' ? 'Workflow paused.' : 'Workflow resumed.', 'good')
                          reload()
                        } catch (err: any) {
                          toast(err?.message ?? 'Could not update the workflow.', 'bad')
                        }
                      }}
                    >
                      {workflow.status === 'live' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Go live</>}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New workflow"
        footer={
          <>
            <Button size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void create()}>Create draft</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Name">
            <input className="gx-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="New contact → welcome task" />
          </FormRow>
          <FormRow label="Start trigger" hint="Exactly one per workflow">
            <select className="gx-select" value={trigger} onChange={(event) => setTrigger(event.target.value)}>
              {TRIGGERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormRow>
          <p className="text-[11.5px] text-muted">The trigger node is created for you. Add conditions and actions in the builder, then publish.</p>
        </div>
      </Modal>
    </div>
  )
}


export function WorkflowRunsPage({ module }: { module?: string }) {
  const { data, loading, error, reload } = useFetch<{ data: Row[] }>(`/api/workflow-runs${module ? `?module=${module}` : ''}`)
  const [detail, setDetail] = useState<Row | null>(null)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Automation runs" subtitle="Every trigger delivery, node result and retry status" />
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={reload} /> : (data?.data ?? []).length === 0 ? (
          <EmptyState icon={<WorkflowIcon size={18} />} title="No automation runs yet" description="Runs appear when a live workflow's trigger fires, including scheduled campaign and sequence work." />
        ) : (
          <table className="gx-table">
            <thead><tr><th>When</th><th>Workflow</th><th>Module</th><th>Trigger</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(data?.data ?? []).map((run) => (
                <tr key={run.id}>
                  <td className="text-[11.5px] text-muted">{formatDateTime(run.created_at)}</td>
                  <td className="font-medium">{run.workflow_name}</td>
                  <td className="capitalize">{run.module}</td>
                  <td><Badge>{run.trigger_event}</Badge></td>
                  <td><StatusBadge value={run.status} /></td>
                  <td><button className="text-[11.5px] text-accent hover:underline" onClick={() => setDetail(run)}>Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Run detail" wide>
        {detail ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px]"><StatusBadge value={detail.status} /> <Badge>{detail.trigger_event}</Badge></div>
            <ol className="space-y-1.5">
              {(JSON.parse(String(detail.log ?? '[]')) as Row[]).map((entry, index) => (
                <li key={index} className="rounded-lg border border-line p-2 text-[11.5px]">
                  <div className="font-medium">{entry.label} · <span className="font-normal text-muted">{entry.status}</span></div>
                  <div className="text-muted">{entry.detail}</div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export function AutomationHealthCard() {
  const { data } = useFetch<{ data: Row[] }>('/api/workflow-runs')
  const failed = (data?.data ?? []).filter((run) => run.status === 'failed').length
  return (
    <Card>
      <CardHeader title="Automation health" subtitle="Runs in the last 100" action={<Link to="/marketing/automations" className="text-[11.5px] text-accent hover:underline">Open</Link>} />
      <div className="flex items-center gap-3 p-4 text-[12.5px]">
        <span className={failed ? 'text-danger' : 'text-good'}>{failed ? `${failed} failed runs` : 'No failed runs'}</span>
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
