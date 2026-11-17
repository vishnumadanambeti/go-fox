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
  GitBranch,
  Hand,
  Layers,
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
  Ticket,
  Trash2,
  Undo2,
  UserCog,
  Webhook,
  X,
  Zap,
} from 'lucide-react'
import { patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Badge, Button, Drawer, FormRow, Modal, Spinner, cx } from '../components/ui'
import { useNavigate } from '../lib/router'
import { TRIGGERS } from './automation'

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
  { key: 'condition', label: 'Condition', hint: 'Branch on a field value', category: 'Common', panel: 'condition', icon: GitBranch, node: { kind: 'condition', label: 'Check condition', hint: 'Branch on a field value', type: 'condition', config: baseConfig.condition } },

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
  const color = d.type === 'trigger' ? '#FF7417' : d.type === 'condition' ? '#7357D9' : d.type === 'wait' ? '#1d4ed8' : d.type === 'end' ? '#159C91' : CATEGORY_COLORS[NODE_CATALOG.find((i) => i.key === d.kind)?.category ?? 'Common']
  return (
    <div className={cx('gx-flow-node', selected && 'is-selected')}>
      {d.type !== 'trigger' ? <Handle type="target" position={Position.Top} className="gx-handle" /> : null}
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}14`, color }}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-ink">{d.label}</span>
            <span className={cx('size-1.5 shrink-0 rounded-full', d.type === 'trigger' ? 'bg-good' : 'bg-[#c9d2df]')} />
          </div>
          <p className="mt-0.5 truncate text-[10.5px] text-muted">{d.hint}</p>
        </div>
        <button className="gx-node-cog nodrag" aria-label={`Configure ${d.label}`} title="Configure">
          <Settings2 size={12} />
        </button>
      </div>
      {d.type === 'condition' ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} className="gx-handle" style={{ left: '32%' }} />
          <Handle id="false" type="source" position={Position.Bottom} className="gx-handle" style={{ left: '68%' }} />
          <span className="pointer-events-none absolute -bottom-5 left-[22%] text-[10px] font-medium text-good">Yes</span>
          <span className="pointer-events-none absolute -bottom-5 right-[22%] text-[10px] font-medium text-danger">No</span>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="gx-handle" />
      )}
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
  const { data, loading, error, reload } = useFetch<{ workflow: Row; runs: Row[] }>(`/api/workflows/${id}`)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GxData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'action' | 'condition'>('action')
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

  const workflow = data?.workflow
  const runs = data?.runs ?? []

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

  const addStart = () => {
    if (nodes.some((node) => node.data.type === 'trigger')) return
    const id = `n_${Math.random().toString(36).slice(2, 9)}`
    snapshot()
    setNodes((current) => [
      ...current,
      {
        id,
        type: 'gx',
        position: { x: 320, y: 60 },
        data: {
          kind: 'trigger',
          label: 'Start',
          hint: `Trigger: ${TRIGGERS[0].label}`,
          type: 'trigger',
          config: { trigger: TRIGGERS[0].value },
        },
        style: { width: 236 },
      },
    ])
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

  const dryRun = async () => {
    setBusy(true)
    try {
      await persist()
      const result = await post<Row>(`/api/workflows/${id}/test`, {})
      setPreview(result)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Dry run failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const selectedNode = nodes.find((node) => node.id === selected) ?? null
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return NODE_CATALOG.filter((item) => item.panel === tab).filter((item) => !term || `${item.label} ${item.hint} ${item.category}`.toLowerCase().includes(term))
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
          <button className="gx-icon-btn hidden sm:flex" aria-label="Execution history" title="Execution history" onClick={() => setRunsOpen(true)}>
            <ListOrderedIcon />
          </button>
          <button className="gx-icon-btn hidden sm:flex" aria-label="Dry run" title="Dry run" onClick={() => void dryRun()} disabled={busy}>
            <Play size={15} />
          </button>
          <Button size="sm" onClick={() => void save()} loading={busy}>
            <span className="hidden sm:inline">Save as Draft</span>
            <span className="sm:hidden">Save</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => void publish()} loading={busy}>
            <Rocket size={13} /> <span className="hidden sm:inline">{status === 'live' ? 'Update live' : 'Go Live'}</span>
            <span className="sm:hidden">Live</span>
          </Button>
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
          <div className="flex gap-1 px-3 py-2.5">
            {(['action', 'condition'] as const).map((key) => (
              <button
                key={key}
                className={cx('flex-1 rounded-md py-1.5 text-[12px] font-medium capitalize transition', tab === key ? 'bg-accent text-white shadow-[0_2px_8px_-2px_rgba(255,116,23,0.7)]' : 'text-muted hover:bg-surface-2')}
                onClick={() => setTab(key)}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto gx-scroll px-2 pb-4">
            {tab === 'action' && !search && !nodes.some((node) => node.data.type === 'trigger') ? (
              <button className="mb-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-2 text-left hover:border-accent" onClick={addStart}>
                <span className="flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Zap size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium">Start workflow</span>
                  <span className="block text-[10.5px] text-muted">Required first node</span>
                </span>
                <Plus size={13} className="ml-auto text-accent" />
              </button>
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
            {filtered.length === 0 ? <p className="px-2 py-6 text-center text-[11.5px] text-faint">No nodes match “{search}”.</p> : null}
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
  const templates = useFetch<{ records: Row[] }>(data.action === 'send_email' ? '/api/resources/email_templates?limit=50' : null)
  const lists = useFetch<{ records: Row[] }>(data.action === 'add_to_list' ? '/api/resources/lists?limit=50' : null)
  const sequences = useFetch<{ records: Row[] }>(data.action === 'add_to_sequence' ? '/api/resources/sequences?limit=50' : null)

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
                    {(templates.data?.records ?? []).map((row) => (
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
                  {(lists.data?.records ?? []).map((row) => (
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
                  {(sequences.data?.records ?? []).map((row) => (
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

