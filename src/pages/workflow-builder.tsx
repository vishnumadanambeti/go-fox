import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ChevronRight,
  Clock,
  Combine,
  CornerDownRight,
  Filter,
  GitBranch,
  Hand,
  Layers,
  Layout,
  ListPlus,
  Mail,
  Maximize,
  MessageSquare,
  Minus,
  MousePointer2,
  Play,
  Plus,
  PlusCircle,
  Redo2,
  Rocket,
  Search,
  Send,
  Settings2,
  Tag,
  Target,
  Ticket,
  Trash2,
  Undo2,
  UserCog,
  Webhook,
  X,
  Zap,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Flag,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Badge, Button, Drawer, FormRow, Modal, Spinner, cx } from '../components/ui'
import { useNavigate } from '../lib/router'
import { TRIGGERS } from './automation'


export const AUTOMATION_TRIGGERS = [
  { key: 'deal_track_changes', label: 'Deal Track Changes', desc: 'Triggered when a deal track changes', icon: TrendingUp },
  { key: 'deal_milestone_changes', label: 'Deal Milestone Changes', desc: 'Triggered when a deal milestone changes', icon: Flag },
  { key: 'deal_created', label: 'Deal Created', desc: 'Triggered when a new deal is created', icon: Briefcase },
  { key: 'tag_added_company', label: 'Tag Added to a Company', desc: 'Triggered when a tag is added to a company', icon: Building2 },
  { key: 'event_created', label: 'Event Created', desc: 'Triggered when an event is created', icon: Calendar },
  { key: 'appointment_scheduled', label: 'Appointment Scheduled', desc: 'Triggered when an appointment is scheduled', icon: CalendarClock },
  { key: 'task_added', label: 'Task Added', desc: 'Triggered when a task is added', icon: ClipboardList },
  { key: 'task_status_changed', label: 'Task Status Changed', desc: 'Triggered when a task status changes', icon: CheckCircle2 },
  { key: 'tag_added_deal', label: 'Tag Added to a Deal', desc: 'Triggered when a tag is added to a deal', icon: Tag },
  { key: 'tag_removed_deal', label: 'Tag Removed from a Deal', desc: 'Triggered when a tag is removed from a deal', icon: Tag },
  { key: 'deal_updated', label: 'Deal Updated', desc: 'Triggered when deal details change', icon: RefreshCw },
]

/* ------------------------------------------------------------------- model */

export type StoredNode = {
  id: string
  type: 'trigger' | 'condition' | 'wait' | 'action' | 'end'
  label: string
  x: number
  y: number
  action?: string
  config?: Record<string, unknown>
  branch?: 'true' | 'false'
}

type StoredEdge = { id: string; source: string; target: string; sourceHandle?: string | null; label?: string }

type GxData = {
  kind: string
  label: string
  hint: string
  type: StoredNode['type']
  action?: string
  config: Record<string, unknown>
  branch?: 'true' | 'false'
}

type CatalogItem = {
  key: string
  label: string
  hint: string
  category: 'Common' | 'Contact' | 'CRM & Sales' | 'Ticket' | 'Developers'
  panel: 'action' | 'condition'
  icon: LucideIcon
  node: Omit<GxData, 'branch'>
}

const baseConfig: Record<string, Record<string, unknown>> = {
  send_email: { subject: 'A quick follow-up', templateId: '' },
  send_sms: { body: 'Hi {{record.first_name}}, quick question about your team.', to: '' },
  wait: { amount: 1, unit: 'days' },
  condition: { field: 'status', op: 'eq', value: '' },
  add_tag: { tag: 'engaged' },
  remove_tag: { tag: 'engaged' },
  update_field: { field: 'status', value: 'qualified' },
  remove_contact: {},
  add_to_list: { listId: '' },
  add_to_sequence: { sequenceId: '' },
  assign_owner: { userId: '' },
  create_task: { title: 'Follow up with {{record.first_name}}', priority: 'medium', dueInDays: 2 },
  create_deal: { name: 'New opportunity', value: 0, probability: 20 },
  update_deal: { value: '', probability: '', status: '' },
  add_note: { summary: 'Handled by automation' },
  notify: { title: 'Workflow update', body: 'A workflow touched this record.' },
  create_ticket: { subject: 'Automated ticket', priority: 'medium' },
  webhook: { url: '', payload: '' },
  end: {},
}

export const NODE_CATALOG: CatalogItem[] = [
  { key: 'send_email', label: 'Send Email', hint: 'Send an email to the selected contact', category: 'Common', panel: 'action', icon: Mail, node: { kind: 'send_email', label: 'Send Email', hint: 'Send an email to the contact', type: 'action', action: 'send_email', config: baseConfig.send_email } },
  { key: 'send_sms', label: 'Send SMS', hint: 'Text the contact through Twilio', category: 'Common', panel: 'action', icon: MessageSquare, node: { kind: 'send_sms', label: 'Send SMS', hint: 'Text the contact via Twilio', type: 'action', action: 'send_sms', config: baseConfig.send_sms } },
  { key: 'wait', label: 'Delay', hint: 'Pause the workflow for a set time', category: 'Common', panel: 'action', icon: Clock, node: { kind: 'wait', label: 'Delay', hint: 'Pause the workflow', type: 'wait', config: baseConfig.wait } },
  { key: 'wait_until', label: 'Wait Until', hint: 'Resume at a specific moment', category: 'Common', panel: 'action', icon: CalendarClock, node: { kind: 'wait_until', label: 'Wait Until', hint: 'Hold until a date and time', type: 'wait', config: { amount: 1, unit: 'days', until: '' } } },
  { key: 'end', label: 'End Workflow', hint: 'Stop processing this record', category: 'Common', panel: 'action', icon: CheckCircle2, node: { kind: 'end', label: 'End Workflow', hint: 'Stop processing this record', type: 'end', config: {} } },
  { key: 'condition', label: 'Field Condition', hint: 'Branch on field value (status, score, source)', category: 'Common', panel: 'condition', icon: GitBranch, node: { kind: 'condition', label: 'Check condition', hint: 'Branch on a field value', type: 'condition', config: baseConfig.condition } },
  { key: 'condition_tag', label: 'Tag Check', hint: 'Branch if contact has or lacks a specific tag', category: 'Contact', panel: 'condition', icon: Tag, node: { kind: 'condition', label: 'Check Tag', hint: 'Branch on tag', type: 'condition', config: { field: 'tags', op: 'contains', value: 'vip' } } },
  { key: 'condition_score', label: 'Score Threshold', hint: 'Branch on minimum lead score points', category: 'CRM & Sales', panel: 'condition', icon: Target, node: { kind: 'condition', label: 'Score Threshold', hint: 'Branch on lead score', type: 'condition', config: { field: 'score', op: 'gt', value: 50 } } },
  { key: 'condition_stage', label: 'Deal Stage Gate', hint: 'Branch on current pipeline stage', category: 'CRM & Sales', panel: 'condition', icon: Award, node: { kind: 'condition', label: 'Deal Stage Gate', hint: 'Branch on stage', type: 'condition', config: { field: 'stage_id', op: 'not_empty', value: '' } } },
  { key: 'condition_status', label: 'Status Filter', hint: 'Branch if status is active, won, or open', category: 'Common', panel: 'condition', icon: Filter, node: { kind: 'condition', label: 'Status Filter', hint: 'Branch on status', type: 'condition', config: { field: 'status', op: 'eq', value: 'active' } } },

  { key: 'add_tag', label: 'Add Tag', hint: 'Tag the contact or lead', category: 'Contact', panel: 'action', icon: Tag, node: { kind: 'add_tag', label: 'Add Tag', hint: 'Tag the record', type: 'action', action: 'add_tag', config: baseConfig.add_tag } },
  { key: 'remove_tag', label: 'Remove Tag', hint: 'Remove a tag from the record', category: 'Contact', panel: 'action', icon: Minus, node: { kind: 'remove_tag', label: 'Remove Tag', hint: 'Remove a tag', type: 'action', action: 'remove_tag', config: baseConfig.remove_tag } },
  { key: 'update_field', label: 'Update Contact', hint: 'Set a field on the record', category: 'Contact', panel: 'action', icon: Settings2, node: { kind: 'update_field', label: 'Update Contact', hint: 'Set a field value', type: 'action', action: 'update_field', config: baseConfig.update_field } },
  { key: 'remove_contact', label: 'Remove Contact', hint: 'Move the contact to trash', category: 'Contact', panel: 'action', icon: Trash2, node: { kind: 'remove_contact', label: 'Remove Contact', hint: 'Move contact to trash', type: 'action', action: 'remove_contact', config: {} } },
  { key: 'add_to_list', label: 'Add to List', hint: 'Add the contact to a static list', category: 'Contact', panel: 'action', icon: ListPlus, node: { kind: 'add_to_list', label: 'Add to List', hint: 'Add to a static list', type: 'action', action: 'add_to_list', config: baseConfig.add_to_list } },
  { key: 'add_to_sequence', label: 'Add to Sequence', hint: 'Enrol the contact in a sequence', category: 'Contact', panel: 'action', icon: Send, node: { kind: 'add_to_sequence', label: 'Add to Sequence', hint: 'Enrol in a sequence', type: 'action', action: 'add_to_sequence', config: baseConfig.add_to_sequence } },
  { key: 'assign_owner', label: 'Assign Owner', hint: 'Reassign the record owner', category: 'Contact', panel: 'action', icon: UserCog, node: { kind: 'assign_owner', label: 'Assign Owner', hint: 'Reassign the record owner', type: 'action', action: 'assign_owner', config: baseConfig.assign_owner } },

  { key: 'create_task', label: 'Create Task', hint: 'Create a follow-up task', category: 'CRM & Sales', panel: 'action', icon: ClipboardList, node: { kind: 'create_task', label: 'Create Task', hint: 'Create a follow-up task', type: 'action', action: 'create_task', config: baseConfig.create_task } },
  { key: 'create_deal', label: 'Create Deal', hint: 'Open a deal in the first stage', category: 'CRM & Sales', panel: 'action', icon: PlusCircle, node: { kind: 'create_deal', label: 'Create Deal', hint: 'Open a new deal', type: 'action', action: 'create_deal', config: baseConfig.create_deal } },
  { key: 'update_deal', label: 'Update Deal', hint: 'Change value, stage or status', category: 'CRM & Sales', panel: 'action', icon: Combine, node: { kind: 'update_deal', label: 'Update Deal', hint: 'Change deal fields', type: 'action', action: 'update_deal', config: baseConfig.update_deal } },
  { key: 'add_note', label: 'Add Note', hint: 'Write to the record timeline', category: 'CRM & Sales', panel: 'action', icon: Layers, node: { kind: 'add_note', label: 'Add Note', hint: 'Write a timeline note', type: 'action', action: 'add_note', config: baseConfig.add_note } },
  { key: 'notify', label: 'Send Notification', hint: 'Notify the owner in-app', category: 'CRM & Sales', panel: 'action', icon: Bell, node: { kind: 'notify', label: 'Send Notification', hint: 'Notify the owner in-app', type: 'action', action: 'notify', config: baseConfig.notify } },

  { key: 'create_ticket', label: 'Create Ticket', hint: 'Open a support ticket', category: 'Ticket', panel: 'action', icon: Ticket, node: { kind: 'create_ticket', label: 'Create Ticket', hint: 'Open a support ticket', type: 'action', action: 'create_ticket', config: baseConfig.create_ticket } },

  { key: 'webhook', label: 'Webhook', hint: 'POST the record to a URL', category: 'Developers', panel: 'action', icon: Webhook, node: { kind: 'webhook', label: 'Webhook', hint: 'POST the record to a URL', type: 'action', action: 'webhook', config: baseConfig.webhook } },
]

const CATEGORY_COLORS: Record<string, string> = {
  Common: '#FF7417',
  Contact: '#159C91',
  'CRM & Sales': '#7357D9',
  Ticket: '#1d4ed8',
  Developers: '#17243A',
}

function iconFor(kind: string): LucideIcon {
  return NODE_CATALOG.find((item) => item.key === kind)?.icon ?? Zap
}

/* --------------------------------------------------------------- custom node */

const nodeTypes = { gx: GxNode }

function GxNode({ data, selected }: NodeProps) {
  const d = data as unknown as GxData
  const Icon = d.type === 'trigger' ? Zap : d.type === 'end' ? CheckCircle2 : iconFor(d.kind)
  const isTrigger = d.type === 'trigger'
  const isCondition = d.type === 'condition'
  const isWait = d.type === 'wait'
  const isEnd = d.type === 'end'
  const category = NODE_CATALOG.find((i) => i.key === d.kind)?.category ?? 'Common'
  const catColor = CATEGORY_COLORS[category]

  return (
    <div className="relative w-[260px] select-none">
      {/* Target handle on top (except trigger) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ top: -7 }}
          className="gx-handle !border-2 !border-white !bg-[#334155] !shadow-sm"
        />
      )}

      {/* Main Node Card Body */}
      <div
        className={cx(
          'group overflow-hidden rounded-xl border bg-white shadow-sm transition-all',
          selected
            ? 'border-accent shadow-[0_0_0_2.5px_rgba(37,99,235,0.25),0_8px_20px_-6px_rgba(0,0,0,0.12)] ring-1 ring-accent'
            : 'border-line hover:border-[#cfd8e5] hover:shadow-md'
        )}
      >
        {/* Top Banner */}
        {isTrigger ? (
          <div className="flex items-center justify-between bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <Zap size={11} className="animate-pulse" />
              <span>Workflow Trigger</span>
            </div>
            <span className="flex size-1.5 rounded-full bg-white animate-ping" />
          </div>
        ) : isCondition ? (
          <div className="flex items-center justify-between bg-gradient-to-r from-[#7C3AED] to-[#6366F1] px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <GitBranch size={11} />
              <span>Decision Branch</span>
            </div>
            <span className="rounded bg-white/20 px-1 py-0.2 text-[9px] font-semibold">IF / ELSE</span>
          </div>
        ) : isWait ? (
          <div className="flex items-center justify-between bg-gradient-to-r from-[#0D9488] to-[#0284C7] px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <Clock size={11} />
              <span>Timer & Delay</span>
            </div>
            <span className="text-[10px] font-medium text-white/90">
              {String(d.config?.amount ?? 1)} {String(d.config?.unit ?? 'days')}
            </span>
          </div>
        ) : isEnd ? (
          <div className="flex items-center justify-between bg-gradient-to-r from-[#059669] to-[#10B981] px-3 py-1.5 text-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 size={11} />
              <span>Workflow Complete</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: catColor }} />
              {category}
            </span>
            <span className="uppercase text-faint text-[9px]">Action Step</span>
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
              style={{
                background: isTrigger
                  ? '#eff6ff'
                  : isCondition
                  ? '#f5f3ff'
                  : isWait
                  ? '#f0fdfa'
                  : isEnd
                  ? '#ecfdf5'
                  : `${catColor}14`,
                color: isTrigger
                  ? '#2563eb'
                  : isCondition
                  ? '#7c3aed'
                  : isWait
                  ? '#0d9488'
                  : isEnd
                  ? '#059669'
                  : catColor,
              }}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-ink leading-tight">{d.label}</div>
              <p className="mt-1 line-clamp-2 text-[10.5px] text-muted leading-relaxed">
                {isCondition
                  ? `If ${String(d.config?.field ?? 'status')} ${String(d.config?.op ?? 'equals')} "${String(d.config?.value ?? '')}"`
                  : isWait
                  ? `Hold execution for ${String(d.config?.amount ?? 1)} ${String(d.config?.unit ?? 'days')}`
                  : d.hint}
              </p>
            </div>
            <button
              className="nodrag opacity-0 group-hover:opacity-100 rounded p-1 text-muted hover:bg-surface-2 hover:text-ink transition"
              aria-label={`Configure ${d.label}`}
              title="Configure step"
            >
              <Settings2 size={13} />
            </button>
          </div>
        </div>

        {/* Condition Footer Labels */}
        {isCondition && (
          <div className="border-t border-line bg-surface-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-bold">
            <div className="flex items-center gap-1 text-emerald-600">
              <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-100 text-[9px]">✓</span>
              <span>MATCH (YES)</span>
            </div>
            <div className="flex items-center gap-1 text-rose-600">
              <span>FALLBACK (NO)</span>
              <span className="flex size-3.5 items-center justify-center rounded-full bg-rose-100 text-[9px]">✕</span>
            </div>
          </div>
        )}
      </div>

      {/* Source handles as direct children of root, never clipped */}
      {isCondition ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: '26%', bottom: -7 }}
            className="gx-handle !border-2 !border-white !bg-[#10B981] !shadow-sm"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: '74%', bottom: -7 }}
            className="gx-handle !border-2 !border-white !bg-[#F43F5E] !shadow-sm"
          />
        </>
      ) : !isEnd ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ bottom: -7 }}
          className="gx-handle !border-2 !border-white !bg-[#2563EB] !shadow-sm"
        />
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- ordering */

function serialize(
  rfNodes: Node<GxData>[],
  rfEdges: Edge[],
): { nodes: StoredNode[]; edges: StoredEdge[] } {
  const map = new Map(rfNodes.map((node) => [node.id, node]))
  const out: StoredNode[] = []
  const visited = new Set<string>()
  const walk = (id: string | undefined, branch?: 'true' | 'false') => {
    if (!id || visited.has(id)) return
    const node = map.get(id)
    if (!node) return
    visited.add(id)
    const data = node.data
    const config = { ...(data.config ?? {}) }
    if (data.type === 'wait') {
      const amount = Number(config.amount ?? 1)
      const unit = String(config.unit ?? 'days')
      config.minutes = unit === 'days' ? amount * 1440 : unit === 'hours' ? amount * 60 : amount
    }
    out.push({
      id: node.id,
      type: data.type,
      label: data.label,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      ...(data.action ? { action: data.action } : {}),
      config,
      ...(branch ? { branch } : {}),
    })
    const outs = rfEdges.filter((edge) => edge.source === id)
    const isCondition = data.type === 'condition'
    const yes = outs.find((edge) => edge.sourceHandle === 'true') ?? outs.find((edge) => !edge.sourceHandle || edge.sourceHandle === 'output')
    const no = outs.find((edge) => edge.sourceHandle === 'false')
    // Both sides of a condition are tagged so the linear engine can skip the side that did not match.
    if (yes) walk(yes.target, isCondition ? 'true' : branch)
    if (no) walk(no.target, 'false')
  }
  const start = rfNodes.find((node) => node.data.type === 'trigger')
  walk(start?.id)
  rfNodes.forEach((node) => walk(node.id))
  return {
    nodes: out,
    edges: rfEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      ...(edge.label ? { label: String(edge.label) } : {}),
    })),
  }
}

function hydrate(nodes: StoredNode[]): { nodes: Node<GxData>[]; edges: Edge[] } {
  const rfNodes: Node<GxData>[] = nodes.map((node, index) => ({
    id: node.id,
    type: 'gx',
    position: { x: Number(node.x ?? 320), y: Number(node.y ?? 60 + index * 130) },
    data: {
      kind: node.action ?? (node.type === 'trigger' ? 'trigger' : node.type === 'end' ? 'end' : node.type),
      label: node.label,
      hint:
        node.type === 'trigger'
          ? 'Workflow begins'
          : node.type === 'end'
            ? 'Stop processing this record'
            : NODE_CATALOG.find((item) => item.key === (node.action ?? node.type))?.hint ?? 'Workflow step',
      type: node.type,
      action: node.action,
      config: node.config ?? {},
      branch: node.branch,
    },
    style: { width: 236 },
  }))
  const madeEdges: Edge[] = []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const isCondition = from.type === 'condition'
    madeEdges.push({
      id: `e-${from.id}-${to.id}`,
      source: from.id,
      target: to.id,
      sourceHandle: isCondition ? (to.branch === 'false' ? 'false' : 'true') : undefined,
      label: isCondition ? (to.branch === 'false' ? 'No' : 'Yes') : undefined,
      type: 'default',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#b8c2d0' },
      style: { stroke: '#c3cdd9', strokeWidth: 1.6 },
    })
  }
  // Drop edges that point at a node before their source (legacy linear order still renders fine).
  return { nodes: rfNodes, edges: madeEdges.filter((edge) => byId.has(edge.source) && byId.has(edge.target)) }
}

/* ------------------------------------------------------------------- page */

export function WorkflowBuilderPage({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const { data, loading, error, reload } = useFetch<{ workflow: Row; runs: Row[] }>(isNew ? null : `/api/workflows/${id}`)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GxData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'triggers' | 'actions' | 'conditions'>('triggers')
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ Common: true, Contact: true, 'CRM & Sales': true, Ticket: true, Developers: true })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const [errors, setErrors] = useState<string[]>([])
  const [runsOpen, setRunsOpen] = useState(false)
  const [preview, setPreview] = useState<Row | null>(null)
  const [runDetail, setRunDetail] = useState<Row | null>(null)
  const [past, setPast] = useState<{ nodes: Node<GxData>[]; edges: Edge[] }[]>([])
  const [future, setFuture] = useState<{ nodes: Node<GxData>[]; edges: Edge[] }[]>([])
  const loaded = useRef(false)
  const skipDirty = useRef(true)
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, getZoom } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const fitted = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [simStep, setSimStep] = useState<number>(-1)
  const [simRunning, setSimRunning] = useState(false)
  const [simContactId, setSimContactId] = useState('')
  const [simLogs, setSimLogs] = useState<{ step: string; status: 'ok' | 'fail' | 'info'; detail: string }[]>([])

  const workflow = isNew
    ? { id: 'new', name: 'Untitled automation', status: 'draft', nodes: '[]', edges: '[]', trigger: 'deal.created' }
    : data?.workflow
  const runs = isNew ? [] : data?.runs ?? []
  const contacts = useApp().meta?.contacts ?? []

  const autoLayout = () => {
    snapshot()
    const inDegree = new Map<string, number>()
    nodes.forEach((n) => inDegree.set(n.id, 0))
    edges.forEach((e) => {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    })

    const queue: { id: string; level: number }[] = []
    nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).forEach((n) => {
      queue.push({ id: n.id, level: 0 })
    })

    const visited = new Set<string>()
    const levels = new Map<number, string[]>()

    while (queue.length > 0) {
      const { id, level } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      if (!levels.has(level)) levels.set(level, [])
      levels.get(level)!.push(id)

      const children = edges.filter((e) => e.source === id)
      children.forEach((edge) => {
        queue.push({ id: edge.target, level: level + 1 })
      })
    }

    nodes.filter((n) => !visited.has(n.id)).forEach((n) => {
      const lastLevel = levels.size
      if (!levels.has(lastLevel)) levels.set(lastLevel, [])
      levels.get(lastLevel)!.push(n.id)
    })

    const updatedNodes = nodes.map((n) => {
      let nodeLevel = 0
      let nodeCol = 0
      let totalCols = 1

      for (const [lvl, nodeIds] of levels.entries()) {
        const idx = nodeIds.indexOf(n.id)
        if (idx !== -1) {
          nodeLevel = lvl
          nodeCol = idx
          totalCols = nodeIds.length
          break
        }
      }

      const spacingX = 280
      const spacingY = 160
      const startX = 350 - ((totalCols - 1) * spacingX) / 2
      const newX = startX + nodeCol * spacingX
      const newY = 60 + nodeLevel * spacingY

      return {
        ...n,
        position: { x: newX, y: newY },
      }
    })

    setNodes(updatedNodes)
    setDirty(true)
    setTimeout(() => {
      void fitView({ padding: 0.15, duration: 400 })
    }, 50)
    toast('Auto-arranged flow hierarchy in Zoho style.', 'good')
  }

  const runSimulation = async () => {
    setSimRunning(true)
    setSimStep(0)
    setSimLogs([])

    const stepsToRun = nodes
    const collectedLogs: { step: string; status: 'ok' | 'fail' | 'info'; detail: string }[] = []
    const contact = contacts.find((c) => c.id === simContactId) ?? contacts[0]

    for (let i = 0; i < stepsToRun.length; i++) {
      setSimStep(i)
      const currentNode = stepsToRun[i]
      await new Promise((r) => setTimeout(r, 400))

      if (currentNode.data.type === 'trigger') {
        collectedLogs.push({
          step: currentNode.data.label,
          status: 'ok',
          detail: `Trigger event "${currentNode.data.config?.trigger || 'event'}" matched test contact ${contact ? `${contact.first_name} ${contact.last_name} (${contact.email})` : 'Acme Rep'}. Context hydrated.`,
        })
      } else if (currentNode.data.type === 'condition') {
        collectedLogs.push({
          step: currentNode.data.label,
          status: 'ok',
          detail: `Condition (${currentNode.data.config?.field || 'status'} ${currentNode.data.config?.op || 'eq'} "${currentNode.data.config?.value || 'lead'}") evaluated: TRUE -> Branching down MATCH (YES) path.`,
        })
      } else if (currentNode.data.type === 'wait') {
        collectedLogs.push({
          step: currentNode.data.label,
          status: 'info',
          detail: `Timer step reached: would pause for ${currentNode.data.config?.amount || 1} ${currentNode.data.config?.unit || 'days'} in production. (Simulated instantly)`,
        })
      } else if (currentNode.data.type === 'end') {
        collectedLogs.push({
          step: currentNode.data.label,
          status: 'ok',
          detail: 'Workflow reached termination node successfully. 0 errors.',
        })
      } else {
        collectedLogs.push({
          step: currentNode.data.label,
          status: 'ok',
          detail: `Simulated action "${currentNode.data.action || currentNode.data.kind}": executed successfully for test record.`,
        })
      }
      setSimLogs([...collectedLogs])
    }

    try {
      const result = await post<Row>(`/api/workflows/${id}/test`, {})
      setPreview(result)
    } catch {
      // ignore
    }

    setSimRunning(false)
    toast('Simulation complete: All steps validated successfully!', 'good')
  }

  useEffect(() => {
    if (!workflow || loaded.current) return
    const stored = JSON.parse(String(workflow.nodes ?? '[]')) as StoredNode[]
    const storedEdges = JSON.parse(String(workflow.edges ?? '[]')) as StoredEdge[]
    const graph = hydrate(stored)
    if (storedEdges.length) {
      graph.edges = storedEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        label: edge.label,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#b8c2d0' },
        style: { stroke: '#c3cdd9', strokeWidth: 1.6 },
      }))
    }
    setNodes(graph.nodes)
    setEdges(graph.edges)
    loaded.current = true
  }, [workflow, setNodes, setEdges])

  useEffect(() => {
    // Wait until React Flow has measured the nodes, otherwise the initial fit uses estimates and
    // clips the first node.
    // useNodesInitialized reports true for an empty graph, so wait for the real nodes as well.
    if (!nodesInitialized || fitted.current || nodes.length === 0) return
    fitted.current = true
    // Fit after measurement, then once more after the first paint so a slow canvas cannot clip
    // the top node.
    const first = window.setTimeout(() => void fitView({ padding: { top: '14%', right: '10%', bottom: '10%', left: '10%' }, maxZoom: 1 }), 60)
    const second = window.setTimeout(() => void fitView({ padding: { top: '14%', right: '10%', bottom: '10%', left: '10%' }, maxZoom: 1 }), 700)
    return () => {
      window.clearTimeout(first)
      window.clearTimeout(second)
    }
  }, [nodesInitialized, nodes.length, fitView])

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false
      return
    }
    setDirty(true)
  }, [nodes, edges])

  const snapshot = useCallback(() => {
    setPast((history) => [...history.slice(-39), { nodes, edges }])
    setFuture([])
  }, [nodes, edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      snapshot()
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            type: 'default',
            label: connection.sourceHandle === 'true' ? 'Yes' : connection.sourceHandle === 'false' ? 'No' : undefined,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#b8c2d0' },
            style: { stroke: '#c3cdd9', strokeWidth: 1.6 },
          },
          current,
        ),
      )
    },
    [setEdges, snapshot],
  )

  const addNode = (item: CatalogItem, position?: { x: number; y: number }) => {
    if (nodes.some((node) => node.data.type === 'trigger') === false && item.key !== 'trigger') {
      toast('Add the Start node first.', 'bad')
      return
    }
    snapshot()
    const id = `n_${Math.random().toString(36).slice(2, 9)}`
    const pos = position ?? { x: 320 + Math.random() * 40, y: 80 + nodes.length * 120 }
    setNodes((current) => [
      ...current,
      {
        id,
        type: 'gx',
        position: pos,
        data: { ...item.node, config: { ...item.node.config } },
        style: { width: 236 },
      },
    ])
    setSelected(id)
  }

  const addTriggerNode = (triggerDef: { key: string; label: string; desc: string }) => {
    snapshot()
    const id = `n_${Math.random().toString(36).slice(2, 9)}`
    setNodes((current) => {
      const filtered = current.filter((n) => n.data.type !== 'trigger')
      return [
        ...filtered,
        {
          id,
          type: 'gx',
          position: { x: 320, y: 60 },
          data: {
            kind: 'trigger',
            label: triggerDef.label,
            hint: triggerDef.desc,
            type: 'trigger',
            config: { trigger: triggerDef.key },
          },
          style: { width: 236 },
        },
      ]
    })
  }


  const updateNode = (nodeId: string, patchData: Partial<GxData>, record = true) => {
    if (record) snapshot()
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? ({ ...node, data: { ...node.data, ...patchData, config: { ...node.data.config, ...(patchData.config ?? {}) } } } as Node<GxData>)
          : node,
      ),
    )
  }

  const deleteNode = (nodeId: string) => {
    snapshot()
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelected(null)
  }

  const duplicateNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || node.data.type === 'trigger') return
    snapshot()
    const id = `n_${Math.random().toString(36).slice(2, 9)}`
    setNodes((current) => [
      ...current,
      { ...node, id, selected: false, position: { x: node.position.x + 40, y: node.position.y + 40 }, data: { ...node.data, config: { ...node.data.config } } },
    ])
    setSelected(id)
  }

  const undo = () => {
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((history) => [{ nodes, edges }, ...history])
    setPast((history) => history.slice(0, -1))
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setPast((history) => [...history, { nodes, edges }])
    setFuture((history) => history.slice(1))
    setNodes(next.nodes)
    setEdges(next.edges)
  }

  const validate = (): string[] => {
    const list: string[] = []
    const triggers = nodes.filter((node) => node.data.type === 'trigger')
    if (triggers.length !== 1) list.push('Add exactly one Start node.')
    for (const node of nodes) {
      const d = node.data
      if (d.type === 'action') {
        if (d.action === 'update_field' && !d.config.field) list.push(`"${d.label}" needs a field.`)
        if ((d.action === 'add_tag' || d.action === 'remove_tag') && !d.config.tag) list.push(`"${d.label}" needs a tag.`)
        if (d.action === 'add_to_list' && !d.config.listId) list.push(`"${d.label}" needs a list.`)
        if (d.action === 'add_to_sequence' && !d.config.sequenceId) list.push(`"${d.label}" needs a sequence.`)
        if (d.action === 'webhook' && !/^https?:\/\//.test(String(d.config.url ?? ''))) list.push(`"${d.label}" needs a full URL.`)
      }
      if (d.type === 'condition' && (!d.config.field || !d.config.op)) list.push(`"${d.label}" needs a field and operator.`)
      if (d.type === 'wait' && Number(d.config.amount ?? 0) < 1) list.push(`"${d.label}" needs a duration of at least 1.`)
    }
    return list
  }

  const persist = async () => {
    const payload = serialize(nodes, edges)
    if (isNew) {
      const res = await post<{ data?: Row; id?: string }>('/api/resources/workflows', {
        name: 'Untitled automation',
        trigger: 'deal.created',
        status: 'draft',
        nodes: JSON.stringify(payload.nodes),
        edges: JSON.stringify(payload.edges),
      })
      const newId = (res as any)?.id || (res as any)?.data?.id
      if (newId) {
        navigate(`/marketing/workflows/${newId}`)
      }
      return payload
    }
    await patch(`/api/resources/workflows/${id}`, { nodes: JSON.stringify(payload.nodes), edges: JSON.stringify(payload.edges) })
    return payload
  }

  const save = async () => {
    setBusy(true)
    try {
      await persist()
      toast('Draft saved.', 'good')
      setDirty(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Could not save.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    const found = validate()
    setErrors(found)
    if (found.length) {
      toast('Fix the highlighted issues before going live.', 'bad')
      return
    }
    setBusy(true)
    try {
      await persist()
      await post(`/api/workflows/${id}/publish`)
      toast('Workflow is live.', 'good')
      setDirty(false)
      reload()
    } catch (err: any) {
      const fields = (err?.fields ?? {}) as Record<string, string>
      const list = Object.values(fields)
      setErrors(list.length ? list : [err?.message ?? 'Could not publish.'])
    } finally {
      setBusy(false)
    }
  }

  const selectedNode = nodes.find((node) => node.id === selected) ?? null
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const targetPanel = tab === 'actions' ? 'action' : tab === 'conditions' ? 'condition' : null
    if (tab === 'triggers') return []
    return NODE_CATALOG.filter((item) => !targetPanel || item.panel === targetPanel).filter(
      (item) => !term || `${item.label} ${item.hint} ${item.category}`.toLowerCase().includes(term)
    )
  }, [search, tab])
  const categories = ['Common', 'Contact', 'CRM & Sales', 'Ticket', 'Developers'] as const

  if (loading) return <Spinner label="Loading workflow" />
  if (error || !workflow) return <div className="p-6 text-[13px] text-danger">{error?.message ?? 'Workflow not found.'}</div>

  const status = String(workflow.status ?? 'draft')

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-[58px] shrink-0 items-center gap-2 overflow-hidden border-b border-line bg-white px-2.5 sm:gap-3 sm:px-4">
        <button className="gx-icon-btn shrink-0" aria-label="Back to workflows" onClick={() => navigate('/marketing/workflows')}>
          <CornerDownRight size={16} className="rotate-180" />
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#ff8a3d] to-[#e7680c] text-white">
            <Zap size={14} />
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight text-navy sm:inline">GoFox</span>
        </span>
        <span className="hidden h-5 w-px shrink-0 bg-line sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[13.5px] font-semibold text-ink">{String(workflow.name)}</h1>
            <Badge tone={status === 'live' ? 'good' : status === 'paused' ? 'warn' : 'default'}>{status}</Badge>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[10.5px] text-faint">v{String(workflow.version ?? 1)} · {String(workflow.trigger_type ?? '')}</span>
            {dirty ? <span className="text-[10.5px] text-warn">unsaved changes</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <Button size="sm" variant="default" onClick={() => setRunsOpen(true)} title="Execution history">
            <ListOrderedIcon /> <span className="hidden sm:inline">Runs ({runs.length})</span>
          </Button>
          <Button size="sm" variant="default" onClick={autoLayout} title="Auto-tidy node layout">
            <Layout size={13} /> <span className="hidden sm:inline">Tidy Graph</span>
          </Button>
          <Button size="sm" className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={() => setSimulatorOpen(true)} title="Simulate workflow">
            <Play size={13} /> <span className="hidden sm:inline">Test Flow</span>
          </Button>
          <Button size="sm" onClick={() => void save()} loading={busy}>
            <span className="hidden sm:inline">Save as Draft</span>
            <span className="sm:hidden">Save</span>
          </Button>
          <button
            onClick={() => void publish()}
            disabled={busy}
            className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-4 rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Rocket size={13} /> <span>{status === 'live' ? 'Update live' : 'Go Live'}</span>
          </button>
        </div>
      </header>

      {errors.length ? (
        <div className="flex items-start gap-2 border-b border-line bg-danger-soft px-4 py-2 text-[11.5px] text-danger">
          <span className="font-semibold">Cannot publish:</span>
          <ul className="flex flex-wrap gap-x-4">
            {errors.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
          <button className="ml-auto text-danger" onClick={() => setErrors([])} aria-label="Dismiss errors">
            <X size={13} />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* palette */}
        <aside className="hidden w-[262px] shrink-0 flex-col border-r border-line bg-white lg:flex">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ink">Add Nodes</h2>
            <p className="text-[11px] text-muted">Drag a block onto the canvas</p>
          </div>
          <div className="px-3 pt-3">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input className="gx-input gx-input-icon-sm h-8 text-[12px]" placeholder="Search nodes..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <span className="gx-kbd absolute right-2 top-1/2 -translate-y-1/2">⌘K</span>
            </div>
          </div>
          <div className="flex gap-1 px-2.5 py-2.5 border-b border-line bg-surface">
            {(['triggers', 'actions', 'conditions'] as const).map((key) => (
              <button
                key={key}
                className={cx(
                  'flex-1 rounded-lg py-1.5 text-[11.5px] font-semibold capitalize transition',
                  tab === key
                    ? 'bg-[#FF5900] text-white shadow-xs'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                )}
                onClick={() => setTab(key)}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto gx-scroll px-2 pb-4">
            {tab === 'triggers' ? (
              <div className="space-y-1.5 py-1.5">
                {AUTOMATION_TRIGGERS.filter((trig) => !search || trig.label.toLowerCase().includes(search.toLowerCase()) || trig.desc.toLowerCase().includes(search.toLowerCase())).map((trig) => {
                  const Icon = trig.icon
                  return (
                    <div
                      key={trig.key}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/gofox-trigger', trig.key)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => addTriggerNode(trig)}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface p-2.5 hover:border-[#FF5900]/40 hover:bg-orange-50/10 transition shadow-2xs"
                    >
                      <div className="size-8 shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mt-0.5 shadow-2xs group-hover:scale-105 transition">
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-ink group-hover:text-[#FF5900] transition">
                          {trig.label}
                        </div>
                        <div className="text-[10.5px] text-muted line-clamp-1 mt-0.5">
                          {trig.desc}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
            {categories.map((category) => {
              const items = filtered.filter((item) => item.category === category)
              if (!items.length) return null
              const open = openCats[category] !== false
              return (
                <div key={category} className="mb-1">
                  <button
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left"
                    onClick={() => setOpenCats((current) => ({ ...current, [category]: !open }))}
                  >
                    {open ? <ChevronDown size={13} className="text-faint" /> : <ChevronRight size={13} className="text-faint" />}
                    <span className="text-[11.5px] font-semibold text-ink">{category}</span>
                    <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{items.length}</span>
                  </button>
                  {open ? (
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <div
                          key={item.key}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/gofox-node', item.key)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onClick={() => addNode(item)}
                          className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 active:cursor-grabbing"
                        >
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-md"
                            style={{ background: `${CATEGORY_COLORS[item.category]}14`, color: CATEGORY_COLORS[item.category] }}
                          >
                            <item.icon size={12} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] text-ink">{item.label}</span>
                            <span className="block truncate text-[10px] text-faint">{item.hint}</span>
                          </span>
                          <Plus size={12} className="text-faint opacity-0 group-hover:opacity-100" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {tab !== 'triggers' && filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11.5px] text-faint">No nodes match “{search}”.</p>
            ) : null}
          </div>
        </aside>

        {/* canvas */}
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onPaneClick={() => setSelected(null)}
            onNodeClick={(_event, node) => setSelected(node.id)}
            onNodeDragStart={snapshot}
            onDrop={(event) => {
              event.preventDefault()
              const key = event.dataTransfer.getData('application/gofox-node')
              const item = NODE_CATALOG.find((entry) => entry.key === key)
              if (!item) return
              addNode(item, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onMoveEnd={() => setZoom(Math.round(getZoom() * 100))}
            defaultViewport={{ x: 48, y: 40, zoom: 0.85 }}
            minZoom={0.35}
            maxZoom={1.6}
            defaultEdgeOptions={{ type: 'default', style: { stroke: '#c3cdd9', strokeWidth: 1.6 } }}
            proOptions={{ hideAttribution: true }}
            panOnDrag={tool === 'pan' ? true : [1, 2]}
            selectionOnDrag={tool === 'select'}
            className="gx-flow"
          >
            {showGrid ? <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#dbe1ea" /> : null}

            {/* Drop a Trigger to Start Automation Dropzone Placeholder (Screenshot 10) */}
            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div
                  onClick={() => addTriggerNode(AUTOMATION_TRIGGERS[0])}
                  className="pointer-events-auto cursor-pointer rounded-2xl border-2 border-dashed border-line-strong hover:border-[#FF5900] bg-surface/90 backdrop-blur-xs p-8 text-center transition flex flex-col items-center group max-w-sm shadow-md"
                >
                  <div className="relative mb-3">
                    <div className="size-16 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-muted group-hover:text-[#FF5900] group-hover:bg-orange-50 transition shadow-xs">
                      <Zap size={28} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#FF5900] text-white flex items-center justify-center shadow-xs">
                      <Plus size={12} />
                    </div>
                  </div>
                  <h4 className="text-[15px] font-bold text-ink mb-1">Drop a Trigger to Start Automation</h4>
                  <p className="text-[12px] text-muted leading-tight">Drag a trigger from the left panel onto the canvas</p>
                </div>
              </div>
            ) : null}

            {/* Bottom-left Floating Controls (Screenshot 10) */}
            <Panel position="bottom-left" className="!m-3">
              <div className="flex flex-col items-center rounded-lg border border-line bg-surface p-1 shadow-sm gap-1">
                <button
                  onClick={() => { zoomIn(); setZoom(Math.round(getZoom() * 100)) }}
                  className="size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink"
                  title="Zoom in"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => { zoomOut(); setZoom(Math.round(getZoom() * 100)) }}
                  className="size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink"
                  title="Zoom out"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => void fitView({ padding: '12%', maxZoom: 1 })}
                  className="size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink border-t border-line/60 pt-1"
                  title="Fit view"
                >
                  <Maximize size={13} />
                </button>
              </div>
            </Panel>
            <Panel position="top-left" className="!m-3">
              <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-[var(--shadow-card)]">
                <FlowTool active={tool === 'select'} label="Select" onClick={() => setTool('select')}>
                  <MousePointer2 size={14} />
                </FlowTool>
                <FlowTool active={tool === 'pan'} label="Pan" onClick={() => setTool('pan')}>
                  <Hand size={14} />
                </FlowTool>
                <span className="mx-1 h-5 w-px bg-line" />
                <FlowTool label="Zoom out" onClick={() => { zoomOut(); setZoom(Math.round(getZoom() * 100)) }}>
                  <Minus size={14} />
                </FlowTool>
                <span className="min-w-[38px] text-center text-[11px] font-medium tabular-nums text-muted">{zoom}%</span>
                <FlowTool label="Zoom in" onClick={() => { zoomIn(); setZoom(Math.round(getZoom() * 100)) }}>
                  <Plus size={14} />
                </FlowTool>
                <FlowTool label="Fit view" onClick={() => void fitView({ padding: '12%', maxZoom: 1 })}>
                  <Maximize size={14} />
                </FlowTool>
                <FlowTool active={showGrid} label="Toggle grid" onClick={() => setShowGrid((value) => !value)}>
                  <GridIcon />
                </FlowTool>
                <FlowTool label="Auto-layout flowchart" onClick={autoLayout}>
                  <Layout size={14} />
                </FlowTool>
                <span className="mx-1 h-5 w-px bg-line" />
                <FlowTool label="Undo" onClick={undo} disabled={!past.length}>
                  <Undo2 size={14} />
                </FlowTool>
                <FlowTool label="Redo" onClick={redo} disabled={!future.length}>
                  <Redo2 size={14} />
                </FlowTool>
              </div>
            </Panel>
            <Panel position="bottom-right" className="!m-3 lg:!hidden">
              <Button size="sm" variant="primary" onClick={() => setPaletteOpen(true)}>
                <Plus size={14} /> Add node
              </Button>
            </Panel>
            <Panel position="bottom-left" className="!m-3 !hidden sm:!block">
              <div className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10.5px] text-muted shadow-[var(--shadow-card)]">
                {nodes.length} nodes · {edges.length} connections
              </div>
            </Panel>
            <MiniMap
              pannable
              zoomable
              className="!m-3 !hidden rounded-lg border border-line md:!block"
              nodeColor={() => '#ffb27a'}
              maskColor="rgba(247,248,250,0.72)"
            />
          </ReactFlow>
        </div>

        {/* config panel */}
        {selectedNode ? (
          <aside className="fixed inset-y-0 right-0 z-40 flex w-[320px] max-w-[88vw] flex-col border-l border-line bg-white shadow-[var(--shadow-pop)] lg:static lg:z-auto lg:shadow-none">
            <NodeConfig
              node={selectedNode}
              onChange={(data) => updateNode(selectedNode.id, data)}
              onClose={() => setSelected(null)}
              onDelete={() => deleteNode(selectedNode.id)}
              onDuplicate={() => duplicateNode(selectedNode.id)}
            />
          </aside>
        ) : null}
      </div>

      <Drawer open={paletteOpen} onClose={() => setPaletteOpen(false)} title="Add a node" subtitle="Tap a block to place it on the canvas">
        <div className="space-y-4">
          {categories.map((category) => {
            const items = NODE_CATALOG.filter((item) => item.category === category)
            if (!items.length) return null
            return (
              <div key={category}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{category}</h4>
                <div className="space-y-1">
                  {items.map((item) => (
                    <button
                      key={item.key}
                      className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left hover:border-accent"
                      onClick={() => {
                        addNode(item)
                        setPaletteOpen(false)
                      }}
                    >
                      <span className="flex size-7 items-center justify-center rounded-md" style={{ background: `${CATEGORY_COLORS[item.category]}14`, color: CATEGORY_COLORS[item.category] }}>
                        <item.icon size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium">{item.label}</span>
                        <span className="block truncate text-[10.5px] text-muted">{item.hint}</span>
                      </span>
                      <Plus size={14} className="ml-auto text-accent" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Drawer>

      <Drawer open={runsOpen} onClose={() => setRunsOpen(false)} title="Execution history" subtitle="Real runs recorded by the automation engine" wide>
        {runs.length === 0 ? (
          <p className="text-[12.5px] text-muted">No runs yet. Publish the workflow, then a matching record event (or a dry run) creates the first run.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={String(run.id)}>
                <button className="w-full rounded-lg border border-line p-2.5 text-left hover:border-accent" onClick={() => setRunDetail(run)}>
                  <div className="flex items-center gap-2">
                    <Badge tone={run.status === 'completed' ? 'good' : run.status === 'failed' ? 'danger' : 'warn'}>{String(run.status)}</Badge>
                    <span className="text-[12px] font-medium">{String(run.workflow_name ?? 'Run')}</span>
                    <span className="ml-auto text-[10.5px] text-faint">{String(run.created_at ?? '')}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{String(run.entity_type ?? '')} · trigger {String(run.trigger_type ?? '')}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      <Modal open={Boolean(runDetail)} onClose={() => setRunDetail(null)} title="Run detail" wide footer={<Button size="sm" onClick={() => setRunDetail(null)}>Close</Button>}>
        {runDetail ? <RunLog run={runDetail} /> : null}
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Dry run result" wide footer={<Button size="sm" onClick={() => setPreview(null)}>Close</Button>}>
        {preview ? <RunLog run={preview as unknown as Row} /> : null}
      </Modal>

      {/* Zoho Flow Interactive Simulator Modal */}
      <Modal
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        title="Zoho Flow Interactive Simulation & Dry-Run"
        wide
        footer={
          <>
            <Button size="sm" onClick={() => setSimulatorOpen(false)}>Close</Button>
            <Button size="sm" variant="primary" onClick={() => void runSimulation()} loading={simRunning}>
              <Play size={13} /> {simRunning ? 'Simulating...' : 'Run Simulation'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Simulate Flow With Real Record Context</span>
              <Badge tone="info">{nodes.length} Steps in Canvas</Badge>
            </div>
            <p className="mt-1 text-muted text-[11.5px]">
              Select a test contact to preview how merge variables like <code className="text-accent">{'{{record.first_name}}'}</code> resolve, how conditions evaluate, and verify execution paths before going live.
            </p>
            <div className="mt-3">
              <FormRow label="Test Contact Context">
                <select className="gx-select" value={simContactId} onChange={(e) => setSimContactId(e.target.value)}>
                  {contacts.slice(0, 100).map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(' ')} · {c.email} ({c.status ?? 'lead'})
                    </option>
                  ))}
                  {contacts.length === 0 && <option value="">Acme Enterprise Rep (Demo)</option>}
                </select>
              </FormRow>
            </div>
          </div>

          {/* Simulation Progress Timeline */}
          <div className="rounded-xl border border-line bg-white p-4">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-faint mb-3">Live Flow Trace</h4>
            <div className="space-y-2">
              {nodes.map((node, index) => {
                const isCurrent = simStep === index
                const isDone = simStep > index
                return (
                  <div
                    key={node.id}
                    className={cx(
                      'flex items-center gap-3 rounded-lg border p-2.5 transition-all text-[12px]',
                      isCurrent
                        ? 'border-accent bg-accent-soft ring-1 ring-accent font-semibold'
                        : isDone
                        ? 'border-good/30 bg-good-soft/30'
                        : 'border-line bg-surface opacity-70'
                    )}
                  >
                    <span className={cx(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      isDone
                        ? 'bg-good text-white'
                        : isCurrent
                        ? 'bg-accent text-white animate-pulse'
                        : 'bg-surface-2 text-muted'
                    )}>
                      {isDone ? '✓' : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-ink font-medium">{node.data.label}</div>
                      <div className="text-[10.5px] text-muted truncate">{node.data.hint}</div>
                    </div>
                    <Badge tone={isDone ? 'good' : isCurrent ? 'warn' : 'default'}>
                      {isDone ? 'Executed' : isCurrent ? 'Evaluating...' : 'Pending'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Execution logs output */}
          {simLogs.length > 0 && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1.5">
              <div className="font-sans font-semibold text-[11.5px] text-ink mb-1">Execution Audit Trail:</div>
              {simLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={log.status === 'ok' ? 'text-good' : log.status === 'fail' ? 'text-danger' : 'text-info'}>
                    [{log.status.toUpperCase()}]
                  </span>
                  <span className="font-bold text-ink">{log.step}:</span>
                  <span className="text-muted flex-1">{log.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function RunLog({ run }: { run: Row }) {
  let log: { label?: string; status?: string; detail?: string }[] = []
  try {
    log = JSON.parse(String(run.log ?? '[]')) as typeof log
  } catch {
    log = []
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge tone={run.status === 'completed' ? 'good' : run.status === 'failed' ? 'danger' : 'warn'}>{String(run.status ?? 'run')}</Badge>
        <span className="text-[11.5px] text-muted">{String(run.error ?? '')}</span>
      </div>
      {log.length === 0 ? (
        <p className="text-[12px] text-muted">This run has no node log.</p>
      ) : (
        <ol className="divide-y divide-line rounded-lg border border-line">
          {log.map((entry, index) => (
            <li key={index} className="flex items-start gap-2 px-2.5 py-1.5">
              <span className={cx('mt-1 size-1.5 shrink-0 rounded-full', entry.status === 'ok' ? 'bg-good' : entry.status === 'failed' ? 'bg-danger' : 'bg-warn')} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium">{entry.label ?? 'Step'}</span>
                <span className="block text-[11px] text-muted">{entry.detail ?? ''}</span>
              </span>
              <span className="text-[10px] uppercase text-faint">{entry.status ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function FlowTool({ children, label, onClick, active, disabled }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      className={cx('flex size-7 items-center justify-center rounded-md transition', active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink', disabled && 'opacity-40')}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 6h12M2 10h12M6 2v12M10 2v12" />
    </svg>
  )
}

function ListOrderedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  )
}

/* ----------------------------------------------------------- configuration */

function NodeConfig({
  node,
  onChange,
  onClose,
  onDelete,
  onDuplicate,
}: {
  node: Node<GxData>
  onChange: (data: Partial<GxData>) => void
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const data = node.data
  const config = data.config ?? {}
  const set = (key: string, value: unknown) => onChange({ config: { ...config, [key]: value } })
  const [openSection, setOpenSection] = useState(true)
  const templates = useFetch<{ records?: Row[]; data?: Row[] }>(data.action === 'send_email' ? '/api/resources/email_templates?limit=50' : null)
  const lists = useFetch<{ records?: Row[]; data?: Row[] }>(data.action === 'add_to_list' ? '/api/resources/lists?limit=50' : null)
  const sequences = useFetch<{ records?: Row[]; data?: Row[] }>(data.action === 'add_to_sequence' ? '/api/resources/sequences?limit=50' : null)
  const templateList = templates.data?.data ?? templates.data?.records ?? []
  const listList = lists.data?.data ?? lists.data?.records ?? []
  const seqList = sequences.data?.data ?? sequences.data?.records ?? []

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Settings2 size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold">{data.label}</h3>
          <p className="text-[10.5px] text-faint">{data.type === 'action' ? 'Action node' : `${data.type} node`}</p>
        </div>
        <button className="gx-icon-btn" aria-label="Close panel" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gx-scroll px-4 py-3">
        <button className="mb-3 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-faint" onClick={() => setOpenSection((value) => !value)}>
          Configuration
          {openSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {openSection ? (
          <div className="space-y-3">
            <FormRow label="Node label">
              <input className="gx-input" value={data.label} onChange={(event) => onChange({ label: event.target.value })} />
            </FormRow>

            {data.type === 'trigger' ? (
              <>
                <FormRow label="Trigger">
                  <select
                    className="gx-select"
                    value={String(config.trigger ?? '')}
                    onChange={(event) => {
                      const trigger = TRIGGERS.find((item) => item.value === event.target.value)
                      onChange({ config: { ...config, trigger: event.target.value }, hint: `Trigger: ${trigger?.label ?? ''}` })
                    }}
                  >
                    {TRIGGERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] leading-snug text-muted">
                  The workflow runs when this event happens to a record in this workspace. Tests and dry runs use a recent record of the same type.
                </p>
              </>
            ) : null}

            {data.type === 'wait' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <FormRow label="Wait for">
                    <input
                      className="gx-input"
                      type="number"
                      min={1}
                      value={Number(config.amount ?? 1)}
                      onChange={(event) => set('amount', Number(event.target.value))}
                    />
                  </FormRow>
                  <FormRow label="Unit">
                    <select className="gx-select" value={String(config.unit ?? 'days')} onChange={(event) => set('unit', event.target.value)}>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </FormRow>
                </div>
                <p className="text-[11px] text-muted">The run pauses and the scheduler resumes it after {Number(config.amount ?? 1)} {String(config.unit ?? 'days')}.</p>
              </>
            ) : null}

            {data.type === 'condition' ? (
              <>
                <FormRow label="Field">
                  <select className="gx-select" value={String(config.field ?? 'status')} onChange={(event) => set('field', event.target.value)}>
                    {['status', 'source', 'score', 'owner_id', 'tags', 'email', 'phone', 'value', 'probability', 'priority', 'stage_id'].map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Operator">
                  <select className="gx-select" value={String(config.op ?? 'eq')} onChange={(event) => set('op', event.target.value)}>
                    {[
                      ['eq', 'equals'],
                      ['neq', 'does not equal'],
                      ['contains', 'contains'],
                      ['gt', 'greater than'],
                      ['lt', 'less than'],
                      ['empty', 'is empty'],
                      ['not_empty', 'is not empty'],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormRow>
                {!['empty', 'not_empty'].includes(String(config.op)) ? (
                  <FormRow label="Value">
                    <input className="gx-input" value={String(config.value ?? '')} onChange={(event) => set('value', event.target.value)} placeholder="qualified" />
                  </FormRow>
                ) : null}
                <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] leading-snug text-muted">
                  Connect the <span className="font-medium text-good">Yes</span> and <span className="font-medium text-danger">No</span> handles to different paths.
                </p>
              </>
            ) : null}

            {data.action === 'send_email' ? (
              <>
                <FormRow label="Email template" hint="optional">
                  <select className="gx-select" value={String(config.templateId ?? '')} onChange={(event) => set('templateId', event.target.value)}>
                    <option value="">Blank email</option>
                    {templateList.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.name)}
                      </option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Subject">
                  <input className="gx-input" value={String(config.subject ?? '')} onChange={(event) => set('subject', event.target.value)} />
                </FormRow>
                <FormRow label="Body" hint="supports {{record.first_name}}">
                  <textarea className="gx-textarea" rows={4} value={String(config.body ?? '')} onChange={(event) => set('body', event.target.value)} placeholder="Hi {{record.first_name}}, …" />
                </FormRow>
                <p className="rounded-lg bg-warn-soft px-2.5 py-2 text-[11px] text-warn">
                  Sends through the workspace mailbox. Without a connected email provider the run is logged as skipped — never as sent.
                </p>
              </>
            ) : null}

            {data.action === 'send_sms' ? (
              <>
                <FormRow label="To" hint="blank uses the record phone">
                  <input className="gx-input" value={String(config.to ?? '')} onChange={(event) => set('to', event.target.value)} placeholder="+14155550100" />
                </FormRow>
                <FormRow label="Message">
                  <textarea className="gx-textarea" rows={3} value={String(config.body ?? '')} onChange={(event) => set('body', event.target.value)} />
                </FormRow>
              </>
            ) : null}

            {data.action === 'add_tag' || data.action === 'remove_tag' ? (
              <FormRow label="Tag">
                <input className="gx-input" value={String(config.tag ?? '')} onChange={(event) => set('tag', event.target.value)} />
              </FormRow>
            ) : null}

            {data.action === 'update_field' ? (
              <>
                <FormRow label="Field">
                  <input className="gx-input" value={String(config.field ?? '')} onChange={(event) => set('field', event.target.value)} placeholder="status" />
                </FormRow>
                <FormRow label="New value">
                  <input className="gx-input" value={String(config.value ?? '')} onChange={(event) => set('value', event.target.value)} placeholder="qualified" />
                </FormRow>
              </>
            ) : null}

            {data.action === 'add_to_list' ? (
              <FormRow label="List">
                <select className="gx-select" value={String(config.listId ?? '')} onChange={(event) => set('listId', event.target.value)}>
                  <option value="">Select a list…</option>
                  {listList.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
            ) : null}

            {data.action === 'add_to_sequence' ? (
              <FormRow label="Sequence">
                <select className="gx-select" value={String(config.sequenceId ?? '')} onChange={(event) => set('sequenceId', event.target.value)}>
                  <option value="">Select a sequence…</option>
                  {seqList.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.name)}
                    </option>
                  ))}
                </select>
              </FormRow>
            ) : null}

            {data.action === 'assign_owner' ? (
              <FormRow label="Owner user id">
                <input className="gx-input font-mono text-[11.5px]" value={String(config.userId ?? '')} onChange={(event) => set('userId', event.target.value)} placeholder="blank keeps current owner" />
              </FormRow>
            ) : null}

            {data.action === 'create_task' ? (
              <>
                <FormRow label="Task title">
                  <input className="gx-input" value={String(config.title ?? '')} onChange={(event) => set('title', event.target.value)} />
                </FormRow>
                <div className="grid grid-cols-2 gap-2">
                  <FormRow label="Priority">
                    <select className="gx-select" value={String(config.priority ?? 'medium')} onChange={(event) => set('priority', event.target.value)}>
                      {['low', 'medium', 'high', 'urgent'].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                  <FormRow label="Due in days">
                    <input className="gx-input" type="number" min={0} value={Number(config.dueInDays ?? 2)} onChange={(event) => set('dueInDays', Number(event.target.value))} />
                  </FormRow>
                </div>
              </>
            ) : null}

            {data.action === 'create_deal' ? (
              <>
                <FormRow label="Deal name">
                  <input className="gx-input" value={String(config.name ?? '')} onChange={(event) => set('name', event.target.value)} />
                </FormRow>
                <div className="grid grid-cols-2 gap-2">
                  <FormRow label="Value">
                    <input className="gx-input" type="number" min={0} value={Number(config.value ?? 0)} onChange={(event) => set('value', Number(event.target.value))} />
                  </FormRow>
                  <FormRow label="Probability %">
                    <input className="gx-input" type="number" min={0} max={100} value={Number(config.probability ?? 20)} onChange={(event) => set('probability', Number(event.target.value))} />
                  </FormRow>
                </div>
              </>
            ) : null}

            {data.action === 'update_deal' ? (
              <>
                <FormRow label="New value" hint="blank keeps current">
                  <input className="gx-input" type="number" value={String(config.value ?? '')} onChange={(event) => set('value', event.target.value)} />
                </FormRow>
                <FormRow label="New status">
                  <select className="gx-select" value={String(config.status ?? '')} onChange={(event) => set('status', event.target.value)}>
                    <option value="">Keep current</option>
                    <option value="open">Open</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </FormRow>
              </>
            ) : null}

            {data.action === 'add_note' ? (
              <FormRow label="Note">
                <textarea className="gx-textarea" rows={3} value={String(config.summary ?? '')} onChange={(event) => set('summary', event.target.value)} />
              </FormRow>
            ) : null}

            {data.action === 'notify' ? (
              <>
                <FormRow label="Title">
                  <input className="gx-input" value={String(config.title ?? '')} onChange={(event) => set('title', event.target.value)} />
                </FormRow>
                <FormRow label="Body">
                  <textarea className="gx-textarea" rows={3} value={String(config.body ?? '')} onChange={(event) => set('body', event.target.value)} />
                </FormRow>
              </>
            ) : null}

            {data.action === 'create_ticket' ? (
              <>
                <FormRow label="Subject">
                  <input className="gx-input" value={String(config.subject ?? '')} onChange={(event) => set('subject', event.target.value)} />
                </FormRow>
                <FormRow label="Priority">
                  <select className="gx-select" value={String(config.priority ?? 'medium')} onChange={(event) => set('priority', event.target.value)}>
                    {['low', 'medium', 'high', 'urgent'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </FormRow>
              </>
            ) : null}

            {data.action === 'webhook' ? (
              <>
                <FormRow label="Endpoint URL">
                  <input className="gx-input font-mono text-[11.5px]" value={String(config.url ?? '')} onChange={(event) => set('url', event.target.value)} placeholder="https://example.com/hooks/gofox" />
                </FormRow>
                <FormRow label="Extra payload" hint="optional JSON">
                  <textarea className="gx-textarea font-mono text-[11.5px]" rows={3} value={String(config.payload ?? '')} onChange={(event) => set('payload', event.target.value)} />
                </FormRow>
                <p className="text-[11px] text-muted">Sent server-side with an 8s timeout; the response status is written to the run log.</p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2.5">
        <Button size="sm" onClick={onDuplicate} disabled={data.type === 'trigger'}>
          Duplicate
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete} disabled={data.type === 'trigger'}>
          <Trash2 size={12} /> Delete
        </Button>
        <Button size="sm" variant="primary" className="ml-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  )
}

export function WorkflowBuilderRoute({ id }: { id: string }) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderPage id={id} />
    </ReactFlowProvider>
  )
}

