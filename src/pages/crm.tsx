import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  DollarSign,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  History,
  Layers,
  Link2,
  Mail,
  MapPin,
  Maximize2,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Puzzle,
  RefreshCw,
  Send,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { del, patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDate, formatDateTime, initials, money } from '../lib/format'
import { Avatar, Badge, Button, Card, Drawer, EmptyState, FormRow, Modal, Spinner, StatusBadge, Tabs, cx } from '../components/ui'
import { ActivityFeed, FieldValue, RelatedList, ResourcePage } from '../components/resource'

/* ==========================================================================
   COMPANIES MODULE (Competitor Pages 6 & 7)
   ========================================================================== */

export function CompaniesPage() {
  return (
    <ResourcePage
      entity="companies"
      title="Companies"
      subtitle="Organisations you sell to and support"
      breadcrumb={
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span>/</span>
          <span className="font-semibold text-ink">Companies</span>
        </span>
      }
      renderDrawer={({ open, record, onClose, onSaved }) => (
        <AddCompanyDrawer open={open} record={record} onClose={onClose} onSaved={onSaved} />
      )}
    />
  )
}

export function AddCompanyDrawer({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean
  record: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, meta } = useApp()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({
    name: record?.name ?? '',
    domain: record?.domain ?? '',
    industry: record?.industry ?? 'Software',
    size: record?.size ?? '11-50',
    rating: record?.rating ?? 4,
    phone: record?.phone ?? '',
    email: record?.email ?? '',
    address: record?.address ?? '',
    city: record?.city ?? '',
    state: record?.state ?? '',
    country: record?.country ?? 'United States',
    owner_id: record?.owner_id ?? meta?.currentUser.id ?? '',
    tags: record?.tags ?? 'customer',
    description: record?.description ?? '',
  })

  const save = async () => {
    if (!String(form.name).trim()) {
      toast('Company name is required.', 'bad')
      return
    }
    setBusy(true)
    try {
      if (record?.id) {
        await patch(`/api/resources/companies/${record.id}`, form)
        toast('Company updated successfully.', 'good')
      } else {
        await post('/api/resources/companies', form)
        toast('Company created successfully.', 'good')
      }
      onSaved()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save company.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit Company' : 'Add Company'}
      subtitle="Enter company organization details and contact info"
      wide
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} loading={busy}>
            {record ? 'Save Changes' : 'Create Company'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        {/* Basic Info */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Basic Information</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Company Name *">
              <input
                className="gx-input"
                placeholder="Acme Corporation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormRow>
            <FormRow label="Website / Domain">
              <input
                className="gx-input"
                placeholder="acme.com"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </FormRow>
            <FormRow label="Industry">
              <select
                className="gx-select"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              >
                {['Logistics', 'Manufacturing', 'Healthcare', 'Financial Services', 'Robotics', 'Media', 'Software', 'Food & Beverage', 'Construction', 'Energy', 'Retail', 'Travel', 'Other'].map(
                  (ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  )
                )}
              </select>
            </FormRow>
            <FormRow label="Company Size">
              <select
                className="gx-select"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              >
                {['1-10', '11-50', '51-200', '201-500', '500+'].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} employees
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Phone Number">
              <input
                className="gx-input"
                type="tel"
                placeholder="+1 555 0100"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormRow>
            <FormRow label="Company Email">
              <input
                className="gx-input"
                type="email"
                placeholder="contact@acme.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormRow>
          </div>
        </div>

        {/* Address Info */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Address Information</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FormRow label="Street Address">
                <input
                  className="gx-input"
                  placeholder="100 Market Street"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </FormRow>
            </div>
            <FormRow label="City">
              <input
                className="gx-input"
                placeholder="San Francisco"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </FormRow>
            <FormRow label="Country">
              <input
                className="gx-input"
                placeholder="United States"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </FormRow>
          </div>
        </div>

        {/* Ownership & Notes */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Ownership & Tags</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Account Owner">
              <select
                className="gx-select"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              >
                {(meta?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Tags (comma-separated)">
              <input
                className="gx-input"
                placeholder="customer, high-priority"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </FormRow>
            <div className="sm:col-span-2">
              <FormRow label="Description / Notes">
                <textarea
                  className="gx-input min-h-[70px]"
                  placeholder="Key background, requirements or account summary..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormRow>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

export function CompanyDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('activities')
  const [editing, setEditing] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/companies/${id}`)

  if (loading) return <Spinner label="Loading company 360° profile..." />
  if (error || !data) return <div className="p-6 text-sm text-danger">Company record not found.</div>

  const company = data.record
  const owner = meta?.users.find((u) => u.id === company.owner_id)

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setBusy(true)
    try {
      await post('/api/resources/activities', {
        entity_type: 'company',
        entity_id: id,
        activity_type: 'note',
        title: 'Note added',
        description: newNote.trim(),
      })
      toast('Note recorded.', 'good')
      setNewNote('')
      reload()
    } catch {
      toast('Could not save note.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <Link to="/companies" className="text-[12px] text-muted hover:text-ink flex items-center gap-1">
            <ArrowLeft size={13} /> Companies
          </Link>
          <span className="text-muted">/</span>
          <span className="text-[14px] font-semibold text-ink">{String(company.name)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                toast('Link copied to clipboard.', 'good')
              }
            }}
          >
            <Share2 size={13} /> Share
          </Button>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm('Move this company to trash?')) {
                await del(`/api/resources/companies/${id}`)
                toast('Company moved to trash.', 'good')
                navigate('/companies')
              }
            }}
          >
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>

      {/* Main 360 View */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr]">
          {/* Left Column: Profile & Info Cards */}
          <div className="space-y-4">
            {/* Primary Profile Card */}
            <Card className="p-5 text-center">
              <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent text-xl font-bold">
                {initials(String(company.name))}
              </div>
              <h2 className="text-[16px] font-bold text-ink">{company.name}</h2>
              {company.domain ? (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                >
                  <Globe size={12} /> {company.domain} <ExternalLink size={10} />
                </a>
              ) : null}

              {/* Star Rating */}
              <div className="mt-2.5 flex items-center justify-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    fill={star <= Number(company.rating ?? 4) ? 'currentColor' : 'none'}
                    className={star <= Number(company.rating ?? 4) ? 'text-amber-500' : 'text-faint'}
                  />
                ))}
                <span className="ml-1 text-[11.5px] font-semibold text-muted">({Number(company.rating ?? 4.0).toFixed(1)})</span>
              </div>

              {company.tags ? (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {String(company.tags)
                    .split(',')
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="gx-badge">
                        {tag.trim()}
                      </span>
                    ))}
                </div>
              ) : null}
            </Card>

            {/* Basic Information Card */}
            <Card className="p-4 space-y-3">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Basic Information</h3>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Industry:</span>
                  <span className="font-medium text-ink">{company.industry ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Company Size:</span>
                  <span className="font-medium text-ink">{company.size ?? '11-50 employees'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Phone:</span>
                  <span className="font-medium text-ink">{company.phone ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Email:</span>
                  <span className="font-medium text-ink">{company.email ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Status:</span>
                  <StatusBadge value={company.status} />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Created:</span>
                  <span className="font-medium text-ink">{formatDate(company.created_at)}</span>
                </div>
              </div>
            </Card>

            {/* Address & Owner Card */}
            <Card className="p-4 space-y-3">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Location & Ownership</h3>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Address:</span>
                  <span className="font-medium text-ink text-right max-w-[60%]">{company.address ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">City / Country:</span>
                  <span className="font-medium text-ink">
                    {[company.city, company.country].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Account Owner:</span>
                  <span className="font-medium text-ink">{owner?.name ?? '—'}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: 8 Competitor Tabs */}
          <div className="min-w-0">
            <Card className="overflow-hidden">
              <div className="border-b border-line bg-surface">
                <Tabs
                  tabs={[
                    { key: 'activities', label: 'Activities', count: data.activity.length },
                    { key: 'contacts', label: 'Contacts' },
                    { key: 'deals', label: 'Deals' },
                    { key: 'projects', label: 'Projects' },
                    { key: 'tasks', label: 'Tasks' },
                    { key: 'emails', label: 'Emails' },
                    { key: 'notes', label: 'Notes' },
                    { key: 'calls', label: 'Calls' },
                  ]}
                  active={tab}
                  onChange={setTab}
                  className="px-4"
                />
              </div>

              <div className="p-5">
                {/* Tab: Activities */}
                {tab === 'activities' ? (
                  <div className="space-y-4">
                    {/* Quick Add Note / Log Activity Box */}
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <div className="text-[12px] font-semibold text-muted">Log an activity or quick note</div>
                      <textarea
                        className="gx-input min-h-[64px]"
                        placeholder="Discussed contract terms with executive sponsor..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          <Send size={12} /> Post Activity
                        </Button>
                      </div>
                    </div>
                    <ActivityFeed items={data.activity} />
                  </div>
                ) : tab === 'contacts' ? (
                  /* Tab: Contacts */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Contacts at {company.name}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => navigate(`/contacts?company_id=${id}`)}>
                          <Plus size={13} /> Create Contact
                        </Button>
                      </div>
                    </div>
                    <RelatedList relation={{ entity: 'contacts', foreignKey: 'company_id', label: 'Contacts' }} record={company} />
                  </div>
                ) : tab === 'deals' ? (
                  /* Tab: Deals */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Deals for {company.name}</h4>
                      <Button size="sm" variant="primary" onClick={() => navigate(`/sales/deals?company_id=${id}`)}>
                        <Plus size={13} /> Add Deal
                      </Button>
                    </div>
                    <RelatedList relation={{ entity: 'deals', foreignKey: 'company_id', label: 'Deals' }} record={company} />
                  </div>
                ) : tab === 'projects' ? (
                  <RelatedList relation={{ entity: 'projects', foreignKey: 'company_id', label: 'Projects' }} record={company} />
                ) : tab === 'tasks' ? (
                  /* Tab: Tasks */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Pending & Follow-up Tasks</h4>
                      <Button size="sm" variant="primary" onClick={() => navigate(`/sales/tasks?company_id=${id}`)}>
                        <Plus size={13} /> Add Task
                      </Button>
                    </div>
                    <RelatedList relation={{ entity: 'tasks', foreignKey: 'related_id', label: 'Tasks', extra: { related_type: 'company' } }} record={company} />
                  </div>
                ) : tab === 'emails' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Email Communication</h4>
                      {company.email ? (
                        <a href={`mailto:${company.email}`} className="gx-btn gx-btn-sm gx-btn-primary">
                          <Mail size={13} /> Send Email
                        </a>
                      ) : null}
                    </div>
                    <RelatedList relation={{ entity: 'emails', foreignKey: 'company_id', label: 'Emails' }} record={company} />
                  </div>
                ) : tab === 'notes' ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <textarea
                        className="gx-input min-h-[64px]"
                        placeholder="Add a detailed account note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          Add Note
                        </Button>
                      </div>
                    </div>
                    <RelatedList relation={{ entity: 'notes', foreignKey: 'entity_id', label: 'Notes', extra: { entity_type: 'company' } }} record={company} />
                  </div>
                ) : tab === 'calls' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Call Records & Logs</h4>
                      {company.phone ? (
                        <a href={`tel:${company.phone}`} className="gx-btn gx-btn-sm gx-btn-primary">
                          <Phone size={13} /> Call Company
                        </a>
                      ) : null}
                    </div>
                    <RelatedList relation={{ entity: 'calls', foreignKey: 'company_id', label: 'Calls' }} record={company} />
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <AddCompanyDrawer
        open={editing}
        record={company}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />
    </div>
  )
}

/* ==========================================================================
   LEADS MODULE (Competitor Pages 8 & 9)
   ========================================================================== */

export function LeadsPage() {
  const [activeTab, setActiveTab] = useState('all')

  const tabFilters: Record<string, Record<string, string>> = {
    all: {},
    raw: { status: 'new' },
    primary: { status: 'contacted' },
    qualified: { status: 'qualified' },
  }

  return (
    <ResourcePage
      entity="leads"
      title="Leads"
      subtitle="Capture, qualify and convert prospective customers"
      breadcrumb={
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span>/</span>
          <span className="font-semibold text-ink">Leads</span>
        </span>
      }
      tabs={[
        { key: 'all', label: 'All Leads' },
        { key: 'raw', label: 'Raw' },
        { key: 'primary', label: 'Primary' },
        { key: 'qualified', label: 'Qualified' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fixedFilters={tabFilters[activeTab]}
      renderDrawer={({ open, record, onClose, onSaved }) => (
        <AddLeadDrawer open={open} record={record} onClose={onClose} onSaved={onSaved} />
      )}
    />
  )
}

export function AddLeadDrawer({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean
  record: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, meta } = useApp()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({
    lead_type: record?.lead_type ?? 'person',
    first_name: record?.first_name ?? '',
    last_name: record?.last_name ?? '',
    email: record?.email ?? '',
    phone: record?.phone ?? '',
    company_name: record?.company_name ?? '',
    job_title: record?.job_title ?? '',
    source: record?.source ?? 'Website form',
    industry: record?.industry ?? 'Software',
    value: record?.value ?? 5000,
    currency: record?.currency ?? 'USD',
    birthday: record?.birthday ?? '',
    status: record?.status ?? 'new',
    priority: record?.priority ?? 'medium',
    owner_id: record?.owner_id ?? meta?.currentUser.id ?? '',
    tags: record?.tags ?? 'inbound',
    description: record?.description ?? '',
  })

  const save = async () => {
    if (!String(form.first_name).trim()) {
      toast('First name is required.', 'bad')
      return
    }
    setBusy(true)
    try {
      if (record?.id) {
        await patch(`/api/resources/leads/${record.id}`, form)
        toast('Lead updated successfully.', 'good')
      } else {
        await post('/api/resources/leads', form)
        toast('Lead created successfully.', 'good')
      }
      onSaved()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save lead.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit Lead' : 'Add Lead'}
      subtitle="Capture prospect details and qualification criteria"
      wide
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} loading={busy}>
            {record ? 'Save Changes' : 'Create Lead'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        {/* Lead Type Radio (Page 8 Bottom) */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-faint mb-2">Lead Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium">
              <input
                type="radio"
                name="lead_type"
                value="person"
                checked={form.lead_type === 'person'}
                onChange={() => setForm({ ...form, lead_type: 'person' })}
                className="size-4 accent-[var(--color-accent)]"
              />
              Person
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium">
              <input
                type="radio"
                name="lead_type"
                value="organization"
                checked={form.lead_type === 'organization'}
                onChange={() => setForm({ ...form, lead_type: 'organization' })}
                className="size-4 accent-[var(--color-accent)]"
              />
              Organization
            </label>
          </div>
        </div>

        {/* Contact Fields */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Identity & Contact</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="First Name *">
              <input
                className="gx-input"
                placeholder="Sarah"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </FormRow>
            <FormRow label="Last Name">
              <input
                className="gx-input"
                placeholder="Connor"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </FormRow>
            <FormRow label="Email Address">
              <input
                className="gx-input"
                type="email"
                placeholder="sarah@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormRow>
            <FormRow label="Phone Number">
              <input
                className="gx-input"
                type="tel"
                placeholder="+1 555 0199"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormRow>
            <FormRow label="Company Name">
              <input
                className="gx-input"
                placeholder="TechCorp Innovations"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </FormRow>
            <FormRow label="Job Title">
              <input
                className="gx-input"
                placeholder="VP of Engineering"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
            </FormRow>
          </div>
        </div>

        {/* Commercial & Qualification */}
        <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
          <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Commercial & Qualification</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Lead Source">
              <select
                className="gx-select"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                {['Website form', 'Outbound', 'Referral', 'Webinar', 'LinkedIn', 'Google Ads', 'Manual'].map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Industry">
              <input
                className="gx-input"
                placeholder="Software / Logistics"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </FormRow>
            <FormRow label="Estimated Value">
              <input
                className="gx-input"
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              />
            </FormRow>
            <FormRow label="Currency">
              <select
                className="gx-select"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Date of Birth / Anniversary">
              <input
                className="gx-input"
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              />
            </FormRow>
            <FormRow label="Priority">
              <select
                className="gx-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {['low', 'medium', 'high', 'urgent'].map((pr) => (
                  <option key={pr} value={pr}>
                    {pr.toUpperCase()}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Assigned Owner">
              <select
                className="gx-select"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              >
                {(meta?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Tags">
              <input
                className="gx-input"
                placeholder="warm, enterprise"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </FormRow>
            <div className="sm:col-span-2">
              <FormRow label="Lead Notes / Description">
                <textarea
                  className="gx-input min-h-[60px]"
                  placeholder="Notes from initial interaction or qualification call..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormRow>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

export function LeadDetailPage({ id }: { id: string }) {
  const { toast, meta } = useApp()
  const [openConvert, setOpenConvert] = useState(false)
  const [createDeal, setCreateDeal] = useState(true)
  const [dealValue, setDealValue] = useState(5000)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('activities')
  const [newNote, setNewNote] = useState('')
  const [aiData, setAiData] = useState<{ score?: number; intent?: string; reasons?: string[]; recommendation?: string } | null>(null)

  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/leads/${id}`)

  if (loading) return <Spinner label="Loading lead 360° profile..." />
  if (error || !data) return <div className="p-6 text-sm text-danger">Lead record not found.</div>

  const lead = data.record
  const owner = meta?.users.find((u) => u.id === lead.owner_id)

  const stages = [
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ]

  const currentStageIndex = stages.findIndex((s) => s.key === String(lead.status).toLowerCase())

  const handleStageChange = async (stageKey: string) => {
    try {
      await post(`/api/leads/${id}/stage`, { stage: stageKey })
      toast(`Stage changed to ${stageKey.toUpperCase()}.`, 'good')
      reload()
    } catch {
      toast('Failed to change stage.', 'bad')
    }
  }

  const handleAiScoreRequest = async () => {
    setAiBusy(true)
    try {
      const res = await post<any>(`/api/leads/${id}/ai-score`, {})
      setAiData(res)
      toast(`AI score updated: ${res.score}/100.`, 'good')
      reload()
    } catch {
      toast('Could not analyze AI score.', 'bad')
    } finally {
      setAiBusy(false)
    }
  }

  const convert = async () => {
    setBusy(true)
    try {
      const result = await post<{ contactId: string; dealId: string | null; alreadyConverted?: boolean }>(`/api/leads/${id}/convert`, {
        create_deal: createDeal,
        deal_value: dealValue,
      })
      toast(result.alreadyConverted ? 'This lead was already converted.' : 'Lead converted to Contact and Company!', 'good')
      setOpenConvert(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Conversion failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setBusy(true)
    try {
      await post('/api/resources/activities', {
        entity_type: 'lead',
        entity_id: id,
        activity_type: 'note',
        title: 'Note recorded',
        description: newNote.trim(),
      })
      toast('Note saved.', 'good')
      setNewNote('')
      reload()
    } catch {
      toast('Could not save note.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <Link to="/leads" className="text-[12px] text-muted hover:text-ink flex items-center gap-1">
            <ArrowLeft size={13} /> Leads
          </Link>
          <span className="text-muted">/</span>
          <span className="text-[14px] font-semibold text-ink">
            {lead.first_name} {lead.last_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lead.converted_contact_id ? (
            <Link to={`/contacts/${lead.converted_contact_id}`} className="gx-btn gx-btn-sm gx-btn-primary">
              <Sparkles size={13} /> Converted Contact
            </Link>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setOpenConvert(true)}>
              <Sparkles size={13} /> Convert Lead
            </Button>
          )}
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </Button>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="gx-btn gx-btn-sm">
              <Mail size={13} /> Email
            </a>
          ) : null}
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className="gx-btn gx-btn-sm">
              <Phone size={13} /> Call
            </a>
          ) : null}
        </div>
      </div>

      {/* Visual Pipeline Stage Ribbon (Page 9 Top) */}
      <div className="border-b border-line bg-surface-2/40 px-5 py-2.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {stages.map((st, idx) => {
            const isCurrent = st.key === String(lead.status).toLowerCase()
            const isCompleted = idx < currentStageIndex
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => void handleStageChange(st.key)}
                className={cx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition cursor-pointer shrink-0',
                  isCurrent
                    ? 'bg-accent text-white shadow-sm font-semibold'
                    : isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-surface text-muted border border-line hover:text-ink'
                )}
              >
                {isCompleted ? <Check size={12} className="text-emerald-600" /> : null}
                <span>{st.label}</span>
                {idx < stages.length - 1 ? <ChevronRight size={12} className="opacity-40" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Score Suggestion Card Banner (Page 9 Top) */}
      <div className="border-b border-line bg-gradient-to-r from-orange-50/60 via-amber-50/40 to-surface px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white shadow-sm">
              <Sparkles size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[13.5px] text-ink">
                  AI Lead Score: {aiData?.score ?? lead.score ?? 85}/100
                </span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {aiData?.intent ?? (Number(lead.score ?? 85) > 75 ? 'High Intent' : 'Medium Intent')}
                </span>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                {aiData?.recommendation ??
                  'High priority lead. Recommended immediate executive follow-up and proposal scheduling.'}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void handleAiScoreRequest()} loading={aiBusy}>
            <Sparkles size={13} className="text-accent" /> Request AI analysis
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr]">
          {/* Left Column: Lead Info */}
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent text-lg font-bold">
                  {initials(`${lead.first_name ?? ''} ${lead.last_name ?? ''}`)}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-[15px] truncate">
                    {lead.first_name} {lead.last_name}
                  </div>
                  <div className="text-[12px] text-muted truncate">{lead.job_title ?? 'Prospect'}</div>
                </div>
              </div>

              <div className="space-y-2 border-t border-line/60 pt-3 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Company:</span>
                  <span className="font-medium text-ink">{lead.company_name ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Lead Source:</span>
                  <span className="font-medium text-ink">{lead.source ?? 'Website form'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Priority:</span>
                  <Badge tone={lead.priority === 'high' ? 'danger' : lead.priority === 'urgent' ? 'danger' : 'default'}>
                    {String(lead.priority ?? 'medium').toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Deal Value:</span>
                  <span className="font-semibold text-accent">{money(lead.value ?? 5000, lead.currency ?? 'USD')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Owner:</span>
                  <span className="font-medium text-ink">{owner?.name ?? '—'}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Contact Details</h3>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Email:</span>
                  <span className="font-medium text-ink truncate">{lead.email ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Phone:</span>
                  <span className="font-medium text-ink">{lead.phone ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Industry:</span>
                  <span className="font-medium text-ink">{lead.industry ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Created:</span>
                  <span className="font-medium text-ink">{formatDate(lead.created_at)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Tabs */}
          <div className="min-w-0">
            <Card className="overflow-hidden">
              <div className="border-b border-line bg-surface">
                <Tabs
                  tabs={[
                    { key: 'activities', label: 'Activities', count: data.activity.length },
                    { key: 'notes', label: 'Notes' },
                    { key: 'calls', label: 'Calls' },
                    { key: 'tasks', label: 'Tasks' },
                    { key: 'files', label: 'Files' },
                    { key: 'email', label: 'Email' },
                    { key: 'sms', label: 'SMS' },
                    { key: 'whatsapp', label: 'WhatsApp' },
                    { key: 'conversion', label: 'Conversion' },
                  ]}
                  active={tab}
                  onChange={setTab}
                  className="px-4"
                />
              </div>

              <div className="p-5">
                {tab === 'activities' ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <textarea
                        className="gx-input min-h-[64px]"
                        placeholder="Log meeting summary or discussion notes..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          <Send size={12} /> Post Activity
                        </Button>
                      </div>
                    </div>
                    <ActivityFeed items={data.activity} />
                  </div>
                ) : tab === 'notes' ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <textarea
                        className="gx-input min-h-[64px]"
                        placeholder="Add a private note about this lead..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          Save Note
                        </Button>
                      </div>
                    </div>
                    <RelatedList relation={{ entity: 'notes', foreignKey: 'entity_id', label: 'Notes', extra: { entity_type: 'lead' } }} record={lead} />
                  </div>
                ) : tab === 'calls' ? (
                  <RelatedList relation={{ entity: 'calls', foreignKey: 'lead_id', label: 'Calls' }} record={lead} />
                ) : tab === 'tasks' ? (
                  <RelatedList relation={{ entity: 'tasks', foreignKey: 'related_id', label: 'Tasks', extra: { related_type: 'lead' } }} record={lead} />
                ) : tab === 'files' ? (
                  <RelatedList relation={{ entity: 'files', foreignKey: 'lead_id', label: 'Files' }} record={lead} />
                ) : tab === 'email' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-ink">Email History</h4>
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="gx-btn gx-btn-sm gx-btn-primary">
                          <Mail size={13} /> Compose Email
                        </a>
                      ) : null}
                    </div>
                    <RelatedList relation={{ entity: 'emails', foreignKey: 'lead_id', label: 'Emails' }} record={lead} />
                  </div>
                ) : tab === 'sms' ? (
                  <div className="p-4 text-center text-muted text-[13px]">
                    <MessageSquare size={24} className="mx-auto text-faint mb-2" />
                    SMS channel integration ready. No direct SMS messages logged yet.
                  </div>
                ) : tab === 'whatsapp' ? (
                  <div className="p-4 text-center text-muted text-[13px]">
                    <MessageSquare size={24} className="mx-auto text-emerald-500 mb-2" />
                    WhatsApp business messaging ready.
                  </div>
                ) : tab === 'conversion' ? (
                  lead.converted_contact_id ? (
                    <div className="space-y-3 text-[13px]">
                      <p className="text-muted">Lead successfully converted on {formatDate(lead.converted_at, 'long')}.</p>
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/contacts/${lead.converted_contact_id}`} className="gx-btn gx-btn-sm">
                          <User size={13} /> Open Contact
                        </Link>
                        {lead.converted_deal_id ? (
                          <Link to={`/sales/deals/${lead.converted_deal_id}`} className="gx-btn gx-btn-sm">
                            <DollarSign size={13} /> Open Deal
                          </Link>
                        ) : null}
                        {lead.converted_company_id ? (
                          <Link to={`/companies/${lead.converted_company_id}`} className="gx-btn gx-btn-sm">
                            <Building2 size={13} /> Open Company
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Sparkles size={20} />}
                      title="Lead not converted yet"
                      description="Convert this lead to seamlessly generate a permanent contact, link or create the associated company, and optionally launch a deal in your sales pipeline."
                      action={
                        <Button size="sm" variant="primary" onClick={() => setOpenConvert(true)}>
                          Convert Lead Now
                        </Button>
                      }
                    />
                  )
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Convert Lead Modal */}
      <Modal
        open={openConvert}
        onClose={() => setOpenConvert(false)}
        title={`Convert ${lead.first_name} ${lead.last_name ?? ''}`}
        footer={
          <>
            <Button size="sm" onClick={() => setOpenConvert(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void convert()} loading={busy}>
              Confirm Conversion
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px]">
          <p className="text-muted">
            A Contact record will be created. {lead.company_name ? `The company “${lead.company_name}” will be matched or created automatically.` : ''} Conversion is idempotent and will not create duplicate records.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={createDeal}
              onChange={(e) => setCreateDeal(e.target.checked)}
            />
            <span>Create a new Deal in the Sales Pipeline</span>
          </label>
          {createDeal ? (
            <FormRow label="Deal Value">
              <input
                className="gx-input"
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
              />
            </FormRow>
          ) : null}
        </div>
      </Modal>

      <AddLeadDrawer
        open={editing}
        record={lead}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />
    </div>
  )
}

/* ==========================================================================
   CONTACTS MODULE (Competitor Pages 9 Bottom, 10 & 11)
   ========================================================================== */

export function ContactsPage() {
  const navigate = useNavigate()
  const { toast } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <ResourcePage
        key={refreshKey}
        entity="contacts"
        title="Contacts"
        subtitle="People, consent state and relationship history"
        breadcrumb={
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Link to="/" className="hover:text-ink">Home</Link>
            <span>/</span>
            <span className="font-semibold text-ink">Contacts</span>
          </span>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={13} /> Import CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast('Viewing recent import audit trail in Telemetry.', 'good')
                navigate('/marketing/automations')
              }}
            >
              <History size={13} /> History
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast('Scanning verified contact discoveries across team…', 'good')
              }}
            >
              <Mail size={13} /> Email Discoveries
            </Button>
          </div>
        }
        onRowClick={(row) => setSelectedId(row.id)}
        renderDrawer={({ open, record, onClose, onSaved }) => (
          <AddContactDrawer open={open} record={record} onClose={onClose} onSaved={onSaved} />
        )}
      />
      <ContactDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      <ImportContactsDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          setRefreshKey((k) => k + 1)
        }}
      />
    </>
  )
}

export function ImportContactsDrawer({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const { toast } = useApp()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ total: number; inserted: number; skipped: number } | null>(null)

  useEffect(() => {
    if (open) {
      setStep(1)
      setFileName('')
      setParsedRows([])
      setCsvHeaders([])
      setFieldMapping({})
      setImportResult(null)
    }
  }, [open])

  const parseCsvText = (text: string, name: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      toast('CSV file must contain a header row and at least one contact row.', 'bad')
      return
    }

    const splitLine = (line: string) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''))
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''))
      return result
    }

    const headers = splitLine(lines[0])
    const rows: Record<string, string>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = splitLine(lines[i])
      if (values.every((v) => !v)) continue
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? ''
      })
      rows.push(row)
    }

    setFileName(name)
    setCsvHeaders(headers)
    setParsedRows(rows.slice(0, 125))

    const initialMapping: Record<string, string> = {}
    headers.forEach((h) => {
      const low = h.toLowerCase()
      if (low.includes('first') || low === 'fname') initialMapping[h] = 'first_name'
      else if (low.includes('last') || low === 'lname') initialMapping[h] = 'last_name'
      else if (low === 'name' || low === 'full name' || low === 'contact name') initialMapping[h] = 'first_name'
      else if (low.includes('mail')) initialMapping[h] = 'email'
      else if (low.includes('phone') || low.includes('mobile') || low.includes('cell')) initialMapping[h] = 'phone'
      else if (low.includes('company') || low.includes('org')) initialMapping[h] = 'company_name'
      else if (low.includes('title') || low.includes('designation') || low.includes('role')) initialMapping[h] = 'designation'
      else if (low.includes('city')) initialMapping[h] = 'city'
      else if (low.includes('state')) initialMapping[h] = 'state'
      else if (low.includes('country')) initialMapping[h] = 'country'
      else if (low.includes('addr')) initialMapping[h] = 'address'
      else if (low.includes('source')) initialMapping[h] = 'source'
      else initialMapping[h] = 'skip'
    })
    setFieldMapping(initialMapping)
    setStep(2)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = String(event.target?.result ?? '')
      parseCsvText(text, file.name)
    }
    reader.readAsText(file)
  }

  const loadSampleDataset = () => {
    const sampleCsv = `First Name,Last Name,Email,Phone,Designation,City,Country
Pranay,Gadi,pranay.gadi@enterprise.com,+1 (415) 890-1201,Director of IT,San Francisco,United States
Jaya,Kumar,jaya.kumar@technologies.in,+91 98490 23145,VP Product Engineering,Bengaluru,India
Saurav,Agrawal,saurav.agrawal@growthcorp.co,+1 (212) 555-0199,Head of Marketing,New York,United States
Kanna,Hari,kanna.hari@cloudscale.net,+91 97012 34567,Chief Architect,Hyderabad,India
Ashraf,Khan,ashraf.khan@ventures.io,+971 50 123 4567,Managing Partner,Dubai,United Arab Emirates`
    parseCsvText(sampleCsv, 'crm_enterprise_prospects.csv')
  }

  const executeImport = async () => {
    setImporting(true)
    try {
      const mappedRecords = parsedRows.map((row) => {
        const record: Record<string, unknown> = {}
        for (const [csvCol, targetField] of Object.entries(fieldMapping)) {
          if (targetField && targetField !== 'skip' && row[csvCol]) {
            record[targetField] = row[csvCol]
          }
        }
        if (record.first_name && !record.last_name && String(record.first_name).includes(' ')) {
          const parts = String(record.first_name).split(' ')
          record.first_name = parts[0]
          record.last_name = parts.slice(1).join(' ')
        }
        return record
      })

      const res = await post<{ ok: boolean; count: number; skipped: number; total: number }>(
        '/api/resources/contacts/import',
        { records: mappedRecords }
      )

      setImportResult({
        total: mappedRecords.length,
        inserted: res.count ?? mappedRecords.length,
        skipped: res.skipped ?? 0,
      })
      setStep(3)
      toast(`Successfully imported ${res.count ?? mappedRecords.length} contacts!`, 'good')
    } catch (err: any) {
      toast(err?.message ?? 'Import failed. Verify CSV mapping and tenant plan limits.', 'bad')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Import contacts"
      subtitle="Upload a CSV or Excel file, map columns, then import."
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step === 2 ? (
              <>
                <Button size="sm" onClick={() => setStep(1)}>
                  <ArrowLeft size={13} /> Back
                </Button>
                <Button size="sm" variant="primary" loading={importing} onClick={() => void executeImport()}>
                  Import {parsedRows.length} Contacts <ArrowRight size={13} />
                </Button>
              </>
            ) : step === 3 ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose()
                  onImported()
                }}
              >
                View Contacts <Check size={13} />
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-[13px]">
        {/* Stepper Header (1 Upload -> 2 Map fields -> 3 Done) */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Map fields' },
            { num: 3, label: 'Done' },
          ].map((st, idx) => {
            const active = step === st.num
            const done = step > st.num
            return (
              <div key={st.num} className="flex items-center gap-2">
                <span
                  className={cx(
                    'flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition',
                    active
                      ? 'bg-[#FF5900] text-white'
                      : done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-surface-3 text-muted'
                  )}
                >
                  {done ? '✓' : st.num}
                </span>
                <span className={cx('font-medium text-[12.5px]', active ? 'text-ink font-semibold' : 'text-muted')}>
                  {st.label}
                </span>
                {idx < 2 ? <span className="text-line text-[14px] mx-2">────</span> : null}
              </div>
            )
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 1 ? (
          <div className="space-y-4">
            {/* 3 Information Pills */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-[12px] text-ink">
                <div className="size-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={13} />
                </div>
                <span>CSV or Excel (<strong>.xlsx / .xls / .csv</strong>) with a header row required.</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-sky-200/60 bg-sky-50/50 p-3 text-[12px] text-ink">
                <div className="size-6 rounded bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Link2 size={13} />
                </div>
                <span>Each contact row needs an <strong>email</strong> or a <strong>mobile number</strong>. Map that column on the next step.</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-purple-200/60 bg-purple-50/50 p-3 text-[12px] text-ink">
                <div className="size-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Puzzle size={13} />
                </div>
                <span>Unmapped columns become <strong>custom fields</strong> — pick each one's data type on the next step.</span>
              </div>
            </div>

            {/* Plan Capacity Warning Banner */}
            <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-[12px] text-amber-900">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">i</div>
                <span>Up to <strong>125 rows</strong> per upload (25% of your 500 contacts plan limit).</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 rounded-full bg-amber-200 overflow-hidden">
                  <div className="h-full w-1/4 bg-[#FF5900] rounded-full" />
                </div>
                <span className="font-bold text-[11px] text-[#FF5900]">25%</span>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <label className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line hover:border-accent bg-surface-2/30 hover:bg-surface-2/60 p-8 text-center cursor-pointer transition">
              <input type="file" accept=".csv,text/csv,application/vnd.ms-excel" onChange={handleFileUpload} className="hidden" />
              <div className="size-12 rounded-full bg-amber-100 text-[#FF5900] flex items-center justify-center mb-3 shadow-xs">
                <UploadCloud size={24} />
              </div>
              <div className="text-[14px] font-bold text-ink">Drop your CSV or Excel here</div>
              <div className="text-[12px] text-accent font-semibold mt-1">or browse files</div>
              <div className="mt-2 text-[11px] text-faint">.csv / .xlsx · max 125 rows</div>
            </label>

            {/* Quick 1-Click Sample Dataset Button */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
              <div>
                <div className="font-semibold text-ink text-[12.5px]">No file on hand?</div>
                <div className="text-[11.5px] text-muted">Test with our pre-formatted 5-prospect enterprise CRM dataset.</div>
              </div>
              <Button size="sm" variant="default" onClick={loadSampleDataset}>
                <Sparkles size={12} className="text-amber-500" /> Load Sample Contacts
              </Button>
            </div>
          </div>
        ) : step === 2 ? (
          /* Step 2: Map Fields */
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-[12px]">
              <div>
                <span className="text-muted">Source File:</span>{' '}
                <span className="font-bold text-ink">{fileName}</span>{' '}
                <span className="text-muted">({parsedRows.length} rows detected)</span>
              </div>
              <Badge tone="good">Header row mapped</Badge>
            </div>

            <div className="rounded-xl border border-line overflow-hidden max-h-[380px] overflow-y-auto gx-scroll">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-surface-2 border-b border-line text-muted uppercase text-[10.5px] font-bold sticky top-0">
                  <tr>
                    <th className="p-3">CSV Column</th>
                    <th className="p-3">Sample Value (Row 1)</th>
                    <th className="p-3">Map to GoFox Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {csvHeaders.map((col) => (
                    <tr key={col} className="hover:bg-surface-2/40">
                      <td className="p-3 font-semibold text-ink">{col}</td>
                      <td className="p-3 text-muted font-mono text-[11.5px] truncate max-w-[180px]">
                        {parsedRows[0]?.[col] || '—'}
                      </td>
                      <td className="p-3">
                        <select
                          className="gx-select text-[12px] py-1"
                          value={fieldMapping[col] || 'skip'}
                          onChange={(e) => setFieldMapping({ ...fieldMapping, [col]: e.target.value })}
                        >
                          <option value="first_name">First Name *</option>
                          <option value="last_name">Last Name</option>
                          <option value="email">Email Address *</option>
                          <option value="phone">Phone Number</option>
                          <option value="company_name">Company Name</option>
                          <option value="designation">Designation / Title</option>
                          <option value="address">Street Address</option>
                          <option value="city">City</option>
                          <option value="state">State / Province</option>
                          <option value="country">Country</option>
                          <option value="source">Lead Source</option>
                          <option value="tags">Tags</option>
                          <option value="skip">-- Do Not Import (Skip) --</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Step 3: Done */
          <div className="space-y-5 text-center py-6">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Contacts Imported Successfully</h3>
              <p className="mt-1 text-[12.5px] text-muted">
                Your contacts were parsed, validated, and persisted into the live database.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-line bg-surface p-3 text-center">
                <div className="text-xl font-bold text-good">{importResult?.inserted ?? 0}</div>
                <div className="text-[11px] text-muted uppercase mt-0.5">Contacts Created</div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 text-center">
                <div className="text-xl font-bold text-ink">{importResult?.total ?? 0}</div>
                <div className="text-[11px] text-muted uppercase mt-0.5">Rows Processed</div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 text-center">
                <div className="text-xl font-bold text-muted">{importResult?.skipped ?? 0}</div>
                <div className="text-[11px] text-muted uppercase mt-0.5">Duplicates / Skipped</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}

export function AddContactDrawer({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean
  record: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, meta } = useApp()
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState<'basic' | 'address' | 'social' | 'access'>('basic')
  const [form, setForm] = useState<Record<string, any>>({
    first_name: record?.first_name ?? '',
    last_name: record?.last_name ?? '',
    email: record?.email ?? '',
    phone: record?.phone ?? '',
    designation: record?.designation ?? '',
    company_id: record?.company_id ?? '',
    source: record?.source ?? 'Direct',
    owner_id: record?.owner_id ?? meta?.currentUser.id ?? '',
    address: record?.address ?? '',
    city: record?.city ?? '',
    state: record?.state ?? '',
    postal_code: record?.postal_code ?? '',
    country: record?.country ?? 'United States',
    linkedin: record?.linkedin ?? '',
    twitter: record?.twitter ?? '',
    email_opt_out: record?.email_opt_out ? 1 : 0,
    tags: record?.tags ?? '',
    description: record?.description ?? '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        first_name: record?.first_name ?? '',
        last_name: record?.last_name ?? '',
        email: record?.email ?? '',
        phone: record?.phone ?? '',
        designation: record?.designation ?? '',
        company_id: record?.company_id ?? '',
        source: record?.source ?? 'Direct',
        owner_id: record?.owner_id ?? meta?.currentUser.id ?? '',
        address: record?.address ?? '',
        city: record?.city ?? '',
        state: record?.state ?? '',
        postal_code: record?.postal_code ?? '',
        country: record?.country ?? 'United States',
        linkedin: record?.linkedin ?? '',
        twitter: record?.twitter ?? '',
        email_opt_out: record?.email_opt_out ? 1 : 0,
        tags: record?.tags ?? '',
        description: record?.description ?? '',
      })
      setSection('basic')
    }
  }, [record, open, meta?.currentUser.id])

  const save = async () => {
    if (!String(form.first_name).trim() || !String(form.email).trim()) {
      toast('First name and email are required.', 'bad')
      return
    }
    setBusy(true)
    try {
      if (record?.id) {
        await patch(`/api/resources/contacts/${record.id}`, form)
        toast('Contact updated successfully.', 'good')
      } else {
        await post('/api/resources/contacts', form)
        toast('Contact created successfully.', 'good')
      }
      onSaved()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save contact.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit Contact' : 'Add Contact'}
      subtitle="Complete CRM contact profile with structured sections"
      wide
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} loading={busy}>
            {record ? 'Save Changes' : 'Create Contact'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        {/* Section Navigation Tabs (Page 10) */}
        <div className="flex border-b border-line pb-1 gap-2">
          {[
            { key: 'basic', label: '1. Basic Info' },
            { key: 'address', label: '2. Address Info' },
            { key: 'social', label: '3. Social Profile' },
            { key: 'access', label: '4. Access & Tags' },
          ].map((sec) => (
            <button
              key={sec.key}
              type="button"
              className={cx(
                'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition',
                section === sec.key ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-surface-2'
              )}
              onClick={() => setSection(sec.key as any)}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* 1. Basic Info */}
        {section === 'basic' ? (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Primary Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRow label="First Name *">
                <input
                  className="gx-input"
                  placeholder="John"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </FormRow>
              <FormRow label="Last Name">
                <input
                  className="gx-input"
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </FormRow>
              <FormRow label="Email Address *">
                <input
                  className="gx-input"
                  type="email"
                  placeholder="john.doe@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormRow>
              <FormRow label="Phone Number">
                <input
                  className="gx-input"
                  type="tel"
                  placeholder="+1 555 0122"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormRow>
              <FormRow label="Designation / Job Title">
                <input
                  className="gx-input"
                  placeholder="Senior Account Executive"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </FormRow>
              <FormRow label="Associated Company">
                <select
                  className="gx-select"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                >
                  <option value="">Select Company…</option>
                  {(meta?.companies ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Lead Source">
                <input
                  className="gx-input"
                  placeholder="Referral / Organic"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </FormRow>
              <FormRow label="Account Owner">
                <select
                  className="gx-select"
                  value={form.owner_id}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                >
                  {(meta?.users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </FormRow>
            </div>
          </div>
        ) : null}

        {/* 2. Address Info */}
        {section === 'address' ? (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Address Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <FormRow label="Street Address">
                  <input
                    className="gx-input"
                    placeholder="200 Broadway Ave"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </FormRow>
              </div>
              <FormRow label="City">
                <input
                  className="gx-input"
                  placeholder="New York"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </FormRow>
              <FormRow label="State / Province">
                <input
                  className="gx-input"
                  placeholder="NY"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </FormRow>
              <FormRow label="Postal Code">
                <input
                  className="gx-input"
                  placeholder="10001"
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                />
              </FormRow>
              <FormRow label="Country">
                <input
                  className="gx-input"
                  placeholder="United States"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </FormRow>
            </div>
          </div>
        ) : null}

        {/* 3. Social Profile */}
        {section === 'social' ? (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Social & Online Profiles</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRow label="LinkedIn Profile URL">
                <input
                  className="gx-input"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                />
              </FormRow>
              <FormRow label="Twitter / X Handle">
                <input
                  className="gx-input"
                  placeholder="@handle"
                  value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                />
              </FormRow>
            </div>
          </div>
        ) : null}

        {/* 4. Access & Tags */}
        {section === 'access' ? (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="font-semibold text-[13.5px] text-ink border-b border-line pb-2">Preferences & Tags</div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.email_opt_out)}
                  onChange={(e) => setForm({ ...form, email_opt_out: e.target.checked ? 1 : 0 })}
                  className="size-4 accent-[var(--color-accent)]"
                />
                <span className="text-[13px] font-medium text-ink">Marketing Email Opt-Out (Do not send campaigns)</span>
              </label>
              <FormRow label="Tags (comma-separated)">
                <input
                  className="gx-input"
                  placeholder="decision-maker, vip, q4-lead"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </FormRow>
              <FormRow label="Background Notes">
                <textarea
                  className="gx-input min-h-[70px]"
                  placeholder="Key relationship background or personal notes..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormRow>
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}

export function ContactDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { meta, schema, toast } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(id ? `/api/resources/contacts/${id}` : null)

  if (!id) return null
  if (loading) {
    return (
      <Drawer open={true} onClose={onClose} title="Loading contact…" wide>
        <div className="flex items-center justify-center py-12">
          <Spinner label="Loading contact" />
        </div>
      </Drawer>
    )
  }
  if (error || !data) {
    return (
      <Drawer open={true} onClose={onClose} title="Contact not found" wide>
        <div className="p-5 text-sm text-danger">{error?.message ?? 'The contact could not be loaded.'}</div>
      </Drawer>
    )
  }
  const record = data.record
  const def = schema.contacts
  const company = meta?.companies.find((c) => c.id === record.company_id)
  const owner = meta?.users.find((u) => u.id === record.owner_id)
  const fullName = `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim()

  return (
    <>
      <Drawer
        open={true}
        onClose={onClose}
        title={fullName || 'Contact'}
        subtitle={[record.designation, company?.name].filter(Boolean).join(' · ') || 'Contact record'}
        wide
        footer={
          <>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Edit
            </Button>
            <Button size="sm" variant="primary" onClick={() => { onClose(); navigate(`/contacts/${record.id}`) }}>
              Open full page
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar name={fullName} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{fullName}</div>
              <div className="text-[12.5px] text-muted">{[record.designation, company?.name].filter(Boolean).join(' · ')}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {record.email ? (
                  <a
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[12px] font-medium hover:bg-blue-100 transition shadow-xs"
                    href={`mailto:${record.email}`}
                  >
                    <Mail size={13} /> Email
                  </a>
                ) : null}
                {record.phone ? (
                  <a
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[12px] font-medium hover:bg-emerald-100 transition shadow-xs"
                    href={`tel:${record.phone}`}
                  >
                    <Phone size={13} /> Call
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/contacts/${record.id}`)
                    toast('Contact link copied to clipboard.', 'good')
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-[12px] font-medium hover:bg-purple-100 transition shadow-xs"
                >
                  <Share2 size={13} /> Share
                </button>
                <Link
                  to={`/sales/tasks?contact=${record.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-[12px] font-medium hover:bg-surface-2 transition shadow-xs"
                >
                  <Plus size={13} /> Task
                </Link>
                <Link
                  to={`/sales/deals?contact=${record.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-[12px] font-medium hover:bg-amber-100 transition shadow-xs"
                >
                  <Plus size={13} /> Deal
                </Link>
              </div>
            </div>
            <div className="shrink-0 space-y-1 text-right text-[11.5px]">
              <StatusBadge value={record.status} />
              {record.score !== null && record.score !== undefined ? (
                <div className="text-muted font-medium">Score {record.score}</div>
              ) : null}
            </div>
          </div>

          {record.tags ? (
            <div className="flex flex-wrap gap-1.5">
              {String(record.tags)
                .split(',')
                .filter(Boolean)
                .map((tag) => (
                  <span key={tag} className="gx-badge">
                    {tag.trim()}
                  </span>
                ))}
            </div>
          ) : null}

          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'activity', label: 'Activity', count: data.activity.length },
              { key: 'deals', label: 'Deals' },
              { key: 'tasks', label: 'Tasks' },
              { key: 'tickets', label: 'Tickets' },
              { key: 'calls', label: 'Calls' },
              { key: 'documents', label: 'Documents' },
              { key: 'events', label: 'Meetings' },
            ]}
            active={tab}
            onChange={setTab}
          />

          <div className="min-h-[200px]">
            {tab === 'overview' ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {(def?.fields ?? []).map((field) => (
                  <div key={field.key}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">{field.label}</dt>
                    <dd className="mt-0.5 text-[13px]">
                      <FieldValue entity="contacts" field={field.key} value={record[field.key]} />
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">Company</dt>
                  <dd className="mt-0.5 text-[13px]">{company?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">Owner</dt>
                  <dd className="mt-0.5 text-[13px]">{owner?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">Created</dt>
                  <dd className="mt-0.5 text-[13px]">{formatDate(record.created_at)}</dd>
                </div>
              </dl>
            ) : tab === 'activity' ? (
              <ActivityFeed items={data.activity} />
            ) : tab === 'deals' ? (
              <RelatedList relation={{ entity: 'deals', foreignKey: 'contact_id', label: 'Deals' }} record={record} />
            ) : tab === 'tasks' ? (
              <RelatedList relation={{ entity: 'tasks', foreignKey: 'related_id', label: 'Tasks', extra: { related_type: 'contact' } }} record={record} />
            ) : tab === 'tickets' ? (
              <RelatedList relation={{ entity: 'tickets', foreignKey: 'contact_id', label: 'Tickets' }} record={record} />
            ) : tab === 'calls' ? (
              <RelatedList relation={{ entity: 'calls', foreignKey: 'contact_id', label: 'Calls' }} record={record} />
            ) : tab === 'documents' ? (
              <RelatedList relation={{ entity: 'documents', foreignKey: 'contact_id', label: 'Documents' }} record={record} />
            ) : tab === 'events' ? (
              <RelatedList relation={{ entity: 'events', foreignKey: 'contact_id', label: 'Meetings' }} record={record} />
            ) : null}
          </div>
        </div>
      </Drawer>

      <AddContactDrawer
        open={editing}
        record={record}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />
    </>
  )
}

export function ContactDetailPage({ id }: { id: string }) {
  const { meta, toast } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('activities')
  const [activitySubTab, setActivitySubTab] = useState<'all' | 'calls' | 'analytics' | 'audit'>('all')
  const [editing, setEditing] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/contacts/${id}`)

  if (loading) return <Spinner label="Loading contact 360° profile..." />
  if (error || !data) return <div className="p-6 text-sm text-danger">Contact record not found.</div>

  const contact = data.record
  const company = meta?.companies.find((c) => c.id === contact.company_id)
  const owner = meta?.users.find((u) => u.id === contact.owner_id)
  const fullName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unnamed Contact'

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setBusy(true)
    try {
      await post('/api/resources/activities', {
        entity_type: 'contact',
        entity_id: id,
        activity_type: 'note',
        title: 'Discussion Note',
        description: newNote.trim(),
      })
      toast('Activity note logged.', 'good')
      setNewNote('')
      reload()
    } catch {
      toast('Could not save note.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const contactTabs = [
    { key: 'activities', label: 'Activities', count: (data.activity?.length || 0) },
    { key: 'calls', label: 'Calls' },
    { key: 'notes', label: 'Notes' },
    { key: 'deals', label: 'Deals' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'projects', label: 'Projects' },
    { key: 'workflows', label: 'Workflows' },
    { key: 'automations', label: 'Automations' },
    { key: 'proposals', label: 'Proposals' },
    { key: 'quotes', label: 'Quotes' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Header bar - Matching Screenshot 1 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-bold text-ink tracking-tight">Contacts</h1>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">360°</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
            <Link to="/" className="hover:text-ink">Home</Link>
            <span>&gt;</span>
            <Link to="/contacts" className="hover:text-ink">Contacts</Link>
            <span>&gt;</span>
            <span className="text-ink font-semibold">{fullName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const all = meta?.contacts ?? []
              const idx = all.findIndex((c) => c.id === id)
              if (idx > 0) navigate(`/contacts/${all[idx - 1].id}`)
              else navigate('/contacts')
            }}
            title="Previous contact"
            className="size-8 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink transition"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => {
              const all = meta?.contacts ?? []
              const idx = all.findIndex((c) => c.id === id)
              if (idx >= 0 && idx < all.length - 1) navigate(`/contacts/${all[idx + 1].id}`)
              else navigate('/contacts')
            }}
            title="Next contact"
            className="size-8 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink transition"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => reload()}
            title="Refresh profile"
            className="size-8 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink transition ml-1"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setEditing(true)}
            title="Full Edit"
            className="size-8 rounded-lg border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink transition"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Main Content (Competitor Page 11 & Screenshot 1) */}
      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        <div className="grid gap-5 p-5 lg:grid-cols-[330px_1fr]">
          {/* Left Column: Contact Profile & Info Cards */}
          <div className="space-y-4">
            {/* Profile Avatar Card */}
            <Card className="p-5 text-center bg-surface border-line shadow-xs">
              <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-amber-100 text-amber-700 text-xl font-bold">
                {initials(fullName) || 'PG'}
              </div>
              <h2 className="text-[17px] font-bold text-ink">{fullName}</h2>

              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="rounded-full bg-sky-50 border border-sky-200 px-3 py-0.5 text-[11.5px] font-medium text-sky-600">
                  Contact
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-500">
                  ★ <span className="text-muted font-normal text-[11px]">{contact.score ?? 0}</span>
                </span>
              </div>

              {/* 5 Distinct Round Quick Action Buttons */}
              <div className="mt-4 flex items-center justify-center gap-2.5">
                <button
                  title="Send Email / Message"
                  onClick={() => {
                    if (contact.email) {
                      window.open(`mailto:${contact.email}`)
                    } else {
                      toast('No email address on file for this contact.', 'bad')
                    }
                  }}
                  className="size-9 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 hover:border-blue-300 transition shadow-xs"
                >
                  <Mail size={14} />
                </button>
                <button
                  title="Call Phone"
                  onClick={() => {
                    if (contact.phone) {
                      window.open(`tel:${contact.phone}`)
                    } else {
                      toast('No phone number on file for this contact.', 'bad')
                    }
                  }}
                  className="size-9 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 hover:border-emerald-300 transition shadow-xs"
                >
                  <Phone size={14} />
                </button>
                <button
                  title="Share / Connect"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href)
                    toast('Profile link copied to clipboard.', 'good')
                  }}
                  className="size-9 rounded-xl border border-purple-200 bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 hover:border-purple-300 transition shadow-xs"
                >
                  <Share2 size={14} />
                </button>
                <button
                  title="Edit Contact"
                  onClick={() => setEditing(true)}
                  className="size-9 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 hover:border-amber-300 transition shadow-xs"
                >
                  <Pencil size={14} />
                </button>
                <button
                  title="Delete Contact"
                  onClick={async () => {
                    if (confirm('Delete this contact?')) {
                      await del(`/api/resources/contacts/${id}`)
                      toast('Contact removed.', 'good')
                      navigate('/contacts')
                    }
                  }}
                  className="size-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 hover:border-rose-300 transition shadow-xs"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>

            {/* Basic Information Card */}
            <Card className="overflow-hidden bg-surface border-line shadow-xs">
              <div className="bg-blue-50/70 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-blue-600" />
                  <span className="text-[13px] font-semibold text-blue-700">Basic Information</span>
                </div>
              </div>
              <div className="p-4 space-y-3.5 text-[12.5px]">
                {/* Email */}
                <div className="flex items-start gap-2.5">
                  <div className="size-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-ink font-medium truncate">{contact.email || 'No email provided'}</span>
                      {contact.email ? (
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(String(contact.email))
                            toast('Email copied to clipboard', 'good')
                          }}
                          className="text-muted hover:text-ink p-0.5"
                          title="Copy email"
                        >
                          <Copy size={11} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-2.5">
                  <div className="size-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Phone size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-ink font-medium truncate">
                        {contact.phone ? (
                          <a href={`tel:${contact.phone}`} className="hover:underline text-emerald-700 font-semibold">
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-muted">No phone provided</span>
                        )}
                      </span>
                      {contact.phone ? (
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(String(contact.phone))
                            toast('Phone copied to clipboard', 'good')
                          }}
                          className="text-muted hover:text-ink p-0.5"
                          title="Copy phone"
                        >
                          <Copy size={11} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2.5">
                  <div className="size-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={12} />
                  </div>
                  <div className="text-ink leading-tight">
                    <div>{contact.address || contact.city || 'No address specified'}</div>
                    {(contact.city || contact.state || contact.country) ? (
                      <div className="text-muted text-[11px] mt-0.5">
                        {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Created Date */}
                <div className="flex items-start gap-2.5">
                  <div className="size-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar size={12} />
                  </div>
                  <div className="text-muted text-[11.5px]">
                    Created on {formatDateTime(String(contact.created_at ?? ''))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Other Information Card */}
            <Card className="overflow-hidden bg-surface border-line shadow-xs">
              <div className="bg-purple-50/70 border-b border-purple-100 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 size={14} className="text-purple-600" />
                  <span className="text-[13px] font-semibold text-purple-700">Other Information</span>
                </div>
              </div>
              <div className="p-4 space-y-3 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Owner</span>
                  <span className="font-medium text-ink flex items-center gap-1">
                    {owner?.name || meta?.currentUser?.name || 'Unassigned'}
                    <ChevronDown size={12} className="text-muted" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Company</span>
                  <span className="font-semibold text-ink">
                    {company?.name ? (
                      <Link to={`/companies/${company.id}`} className="text-accent hover:underline">
                        {company.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Designation</span>
                  <span className="font-medium text-ink">{contact.designation || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Score</span>
                  <span className="font-semibold text-ink">{contact.score ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Source</span>
                  <span className="font-medium text-ink uppercase">{contact.source ?? 'MANUAL'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Last Modified</span>
                  <span className="text-muted text-[11.5px]">
                    {formatDateTime(String(contact.updated_at || contact.created_at || ''))}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: 10 Tabs Ribbon & Activities Stream */}
          <div className="min-w-0">
            <Card className="overflow-hidden bg-surface border-line shadow-xs">
              {/* Top Horizontal Tabs Ribbon with Orange Underline */}
              <div className="border-b border-line bg-surface overflow-x-auto gx-scroll">
                <div className="flex items-center gap-1 px-4 min-w-max">
                  {contactTabs.map((t) => {
                    const active = tab === t.key
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cx(
                          'relative flex items-center gap-2 py-3 px-3 text-[13px] font-medium transition',
                          active
                            ? 'text-[#FF5900] font-semibold'
                            : 'text-muted hover:text-ink'
                        )}
                      >
                        <span className="text-muted/60 text-[11px]">::</span>
                        <span>{t.label}</span>
                        {active ? (
                          <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#FF5900] rounded-t-sm" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tab Content Body */}
              <div className="p-5">
                {tab === 'activities' ? (
                  <div className="space-y-4">
                    {/* Header + Sub-tabs */}
                    <div>
                      <h3 className="text-[16px] font-bold text-ink">Activities</h3>
                      <div className="flex items-center gap-4 border-b border-line/60 mt-2 text-[12.5px]">
                        {[
                          ['all', 'All'],
                          ['calls', 'Calls'],
                          ['analytics', 'Email analytics'],
                          ['audit', 'PII audit'],
                        ].map(([key, label]) => {
                          const active = activitySubTab === key
                          return (
                            <button
                              key={key}
                              onClick={() => setActivitySubTab(key as any)}
                              className={cx(
                                'pb-2 relative font-medium transition',
                                active ? 'text-[#FF5900] font-semibold' : 'text-muted hover:text-ink'
                              )}
                            >
                              {label}
                              {active ? (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5900]" />
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Quick Activity Note Composer */}
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <textarea
                        className="gx-input min-h-[60px]"
                        placeholder="Log contact activity or quick discussion note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          <Send size={12} /> Post Activity
                        </Button>
                      </div>
                    </div>

                    {/* Timeline Stream with Filtered Database Activity Records */}
                    <div className="space-y-3">
                      {(() => {
                        const allActs = data.activity || []
                        const filtered = allActs.filter((act) => {
                          if (activitySubTab === 'all') return true
                          const title = (act.title || act.summary || act.action || '').toLowerCase()
                          const actType = (act.activity_type || '').toLowerCase()
                          if (activitySubTab === 'calls') {
                            return actType === 'call' || title.includes('call')
                          }
                          if (activitySubTab === 'analytics') {
                            return actType === 'email' || title.includes('email') || title.includes('campaign') || title.includes('opened') || title.includes('clicked')
                          }
                          if (activitySubTab === 'audit') {
                            return title.includes('update') || title.includes('created') || title.includes('tag') || title.includes('score') || title.includes('audit')
                          }
                          return true
                        })

                        if (filtered.length > 0) {
                          return filtered.map((act) => {
                            const isNote = act.activity_type === 'note' || act.title?.toLowerCase().includes('note')
                            const isTag = act.title?.toLowerCase().includes('tag')
                            const isCall = act.activity_type === 'call' || act.title?.toLowerCase().includes('call')
                            const isDeal = act.entity_type === 'deal' || act.title?.toLowerCase().includes('deal')

                            const bg = isNote
                              ? 'bg-rose-500'
                              : isTag
                              ? 'bg-purple-600'
                              : isCall
                              ? 'bg-emerald-600'
                              : isDeal
                              ? 'bg-amber-500'
                              : 'bg-indigo-600'

                            const icon = isNote ? (
                              <FileText size={15} />
                            ) : isTag ? (
                              <UserCheck size={15} />
                            ) : isCall ? (
                              <Phone size={15} />
                            ) : isDeal ? (
                              <DollarSign size={15} />
                            ) : (
                              <Activity size={15} />
                            )

                            return (
                              <div
                                key={act.id}
                                className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 transition hover:shadow-xs"
                              >
                                <div className={cx('size-9 shrink-0 rounded-lg text-white flex items-center justify-center shadow-xs', bg)}>
                                  {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-ink">{act.title || act.summary || act.action}</div>
                                  {act.description && act.description !== act.title ? (
                                    <div className="text-[12px] text-ink/80 mt-0.5">{act.description}</div>
                                  ) : null}
                                  <div className="text-[11px] text-muted mt-0.5">
                                    {formatDateTime(String(act.created_at ?? ''))} {act.actor ? `· ${act.actor}` : ''}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        }

                        if (activitySubTab !== 'all') {
                          return (
                            <div className="rounded-xl border border-dashed border-line bg-surface-2/30 p-6 text-center text-[12.5px] text-muted space-y-1.5">
                              <div className="font-semibold text-ink">
                                No {activitySubTab === 'calls' ? 'call logs' : activitySubTab === 'analytics' ? 'email analytics events' : 'audit logs'} recorded
                              </div>
                              <p className="text-[11.5px] text-muted max-w-sm mx-auto">
                                Switch to "All" to view general activities or post a new discussion note above.
                              </p>
                            </div>
                          )
                        }

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 transition hover:shadow-xs">
                              <div className="size-9 shrink-0 rounded-lg text-white flex items-center justify-center shadow-xs bg-indigo-600">
                                <UserPlus size={15} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium text-ink">Contact created: {fullName}</div>
                                <div className="text-[11px] text-muted mt-0.5">
                                  {formatDateTime(String(contact.created_at ?? ''))} · {owner?.name || meta?.currentUser?.name || 'System'}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl border border-dashed border-line bg-surface-2/30 p-4 text-center text-[12px] text-muted">
                              No additional notes or calls logged yet. Post an activity above or log a call to record relationship history.
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : tab === 'calls' ? (
                  <RelatedList relation={{ entity: 'calls', foreignKey: 'contact_id', label: 'Calls' }} record={contact} />
                ) : tab === 'notes' ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
                      <textarea
                        className="gx-input min-h-[64px]"
                        placeholder="Add a permanent note about this contact..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="primary" onClick={() => void handleAddNote()} loading={busy} disabled={!newNote.trim()}>
                          Save Note
                        </Button>
                      </div>
                    </div>
                    <RelatedList relation={{ entity: 'notes', foreignKey: 'entity_id', label: 'Notes', extra: { entity_type: 'contact' } }} record={contact} />
                  </div>
                ) : tab === 'deals' ? (
                  <RelatedList relation={{ entity: 'deals', foreignKey: 'contact_id', label: 'Deals' }} record={contact} />
                ) : tab === 'tasks' ? (
                  <RelatedList relation={{ entity: 'tasks', foreignKey: 'related_id', label: 'Tasks', extra: { related_type: 'contact' } }} record={contact} />
                ) : tab === 'projects' ? (
                  <RelatedList relation={{ entity: 'projects', foreignKey: 'contact_id', label: 'Projects' }} record={contact} />
                ) : tab === 'workflows' ? (
                  <RelatedList relation={{ entity: 'workflows', foreignKey: 'contact_id', label: 'Workflows' }} record={contact} />
                ) : tab === 'automations' ? (
                  <RelatedList relation={{ entity: 'sequences', foreignKey: 'contact_id', label: 'Automations' }} record={contact} />
                ) : tab === 'proposals' || tab === 'quotes' ? (
                  <RelatedList relation={{ entity: 'documents', foreignKey: 'contact_id', label: tab === 'proposals' ? 'Proposals' : 'Quotes' }} record={contact} />
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <AddContactDrawer
        open={editing}
        record={contact}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />
    </div>
  )
}

/* ==========================================================================
   LISTS MODULE (Competitor Page 11 Bottom & Screenshot 2)
   ========================================================================== */

export function ListsPage() {
  const navigate = useNavigate()
  return (
    <>
      <ResourcePage
        entity="lists"
        title="Lists"
        subtitle="Reusable audience segments for campaigns and sequences"
        breadcrumb={
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Link to="/" className="hover:text-ink">Home</Link>
            <span>&gt;</span>
            <Link to="/marketing" className="hover:text-ink">Marketing</Link>
            <span>&gt;</span>
            <span className="font-semibold text-ink">Lists</span>
          </span>
        }
        onRowClick={(row) => navigate(`/lists/${row.id}`)}
        renderDrawer={({ open, record, onClose, onSaved }) => (
          <CreateListDrawer open={open} record={record} onClose={onClose} onSaved={onSaved} />
        )}
      />
    </>
  )
}

export function CreateListDrawer({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean
  record: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: record?.name ?? '',
    type: record?.type ?? 'smart',
    category: record?.category ?? 'Registered',
    description: record?.description ?? '',
  })

  // Condition builder state matching Screenshot 2
  const [matchType, setMatchType] = useState<'ALL' | 'ANY'>('ALL')
  const [conditions, setConditions] = useState([
    { id: '1', field: 'Name', operator: 'is', value: '' }
  ])

  const addFilter = () => {
    setConditions([
      ...conditions,
      { id: String(Date.now()), field: 'Email', operator: 'contains', value: '' }
    ])
  }

  const removeFilter = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id))
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast('List name is required.', 'bad')
      return
    }
    setBusy(true)
    try {
      if (record?.id) {
        await patch(`/api/resources/lists/${record.id}`, form)
        toast('List updated.', 'good')
      } else {
        await post('/api/resources/lists', form)
        toast('List created successfully.', 'good')
      }
      onSaved()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save list.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-[580px] flex-col bg-surface shadow-2xl border-l border-line animate-in slide-in-from-right duration-200">
        {/* Drawer Header - Matching Screenshot 2 */}
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-orange-50 border border-orange-200 text-[#FF5900] flex items-center justify-center shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-ink">New List</h2>
                <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase">
                  DRAFT
                </span>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                Segment contacts dynamically or curate fixed lists for targeted marketing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body Form */}
        <div className="flex-1 overflow-y-auto gx-scroll p-5 space-y-5">
          {/* List Name */}
          <div>
            <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
              Name <span className="text-danger">*</span>
            </label>
            <input
              className="gx-input text-[13px]"
              placeholder="e.g. GoFox Enterprise Prospects"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="text-[11px] text-muted mt-1">
              Give your segment a recognizable, descriptive title for campaigns.
            </p>
          </div>

          {/* List Type - 2 Side-by-side Selectable Cards */}
          <div>
            <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
              List type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Static List Card */}
              <div
                onClick={() => setForm({ ...form, type: 'static' })}
                className={cx(
                  'cursor-pointer rounded-xl border p-3.5 transition flex items-start gap-2.5',
                  form.type === 'static'
                    ? 'border-[#FF5900] bg-orange-50/10 shadow-xs'
                    : 'border-line bg-surface hover:border-line-strong'
                )}
              >
                <div className={cx(
                  'size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0',
                  form.type === 'static' ? 'border-[#FF5900]' : 'border-line-strong'
                )}>
                  {form.type === 'static' ? <div className="size-2 rounded-full bg-[#FF5900]" /> : null}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-ink">Static List</div>
                  <div className="text-[11px] text-muted mt-0.5 leading-snug">
                    Manually add and manage contacts.
                  </div>
                </div>
              </div>

              {/* Smart List Card */}
              <div
                onClick={() => setForm({ ...form, type: 'smart' })}
                className={cx(
                  'cursor-pointer rounded-xl border p-3.5 transition flex items-start gap-2.5',
                  form.type === 'smart'
                    ? 'border-[#FF5900] bg-orange-50/10 shadow-xs ring-1 ring-[#FF5900]/20'
                    : 'border-line bg-surface hover:border-line-strong'
                )}
              >
                <div className={cx(
                  'size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0',
                  form.type === 'smart' ? 'border-[#FF5900]' : 'border-line-strong'
                )}>
                  {form.type === 'smart' ? <div className="size-2 rounded-full bg-[#FF5900]" /> : null}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-ink">Smart List</span>
                    <span className="rounded bg-orange-100 text-[#FF5900] px-1 py-0.2 text-[9.5px] font-bold">
                      Auto
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 leading-snug">
                    Contacts match your conditions automatically.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Dropdown + Add Category */}
          <div>
            <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
              Category
            </label>
            <div className="flex items-center gap-2">
              <select
                className="gx-select flex-1 text-[13px]"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Registered">Registered</option>
                <option value="VIP Customers">VIP Customers</option>
                <option value="Newsletter">Newsletter</option>
                <option value="Prospects">Prospects</option>
                <option value="General">General</option>
              </select>
              <button
                type="button"
                onClick={() => toast('Custom category dialog ready', 'good')}
                className="gx-btn text-[12px] whitespace-nowrap"
              >
                Add Category
              </button>
            </div>

            {/* Selected category pill box */}
            {form.category ? (
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[12.5px]">
                <span className="text-ink font-medium">{form.category}</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: '' })}
                  className="text-muted hover:text-danger p-0.5"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : null}
          </div>

          {/* Smart Condition Builder (Active when Smart List is selected) */}
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-ink">
                  Meet all of the following conditions
                </span>
                <span className="rounded bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold">
                  {matchType}
                </span>
              </div>
              <select
                className="gx-select text-[11.5px] py-1 px-2 w-auto"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as any)}
              >
                <option value="ALL">ALL (AND)</option>
                <option value="ANY">ANY (OR)</option>
              </select>
            </div>

            {/* Filter Rules Rows */}
            <div className="space-y-2.5">
              {conditions.map((cond) => (
                <div key={cond.id} className="grid grid-cols-[1fr_120px_100px_32px] gap-2 items-center">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-faint mb-1">VALUE</label>
                    <input
                      className="gx-input text-[12px] h-8"
                      placeholder="Enter value"
                      value={cond.value}
                      onChange={(e) => {
                        const val = e.target.value
                        setConditions(conditions.map((c) => (c.id === cond.id ? { ...c, value: val } : c)))
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-faint mb-1">FIELD</label>
                    <select
                      className="gx-select text-[12px] h-8"
                      value={cond.field}
                      onChange={(e) => {
                        const f = e.target.value
                        setConditions(conditions.map((c) => (c.id === cond.id ? { ...c, field: f } : c)))
                      }}
                    >
                      <option value="Name">Name</option>
                      <option value="Email">Email</option>
                      <option value="Company">Company</option>
                      <option value="City">City</option>
                      <option value="Score">Score</option>
                      <option value="Status">Status</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-faint mb-1">OPERATOR</label>
                    <select
                      className="gx-select text-[12px] h-8"
                      value={cond.operator}
                      onChange={(e) => {
                        const op = e.target.value
                        setConditions(conditions.map((c) => (c.id === cond.id ? { ...c, operator: op } : c)))
                      }}
                    >
                      <option value="is">is</option>
                      <option value="contains">contains</option>
                      <option value="starts_with">starts with</option>
                      <option value="is_not">is not</option>
                    </select>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => removeFilter(cond.id)}
                      className="size-7 rounded-lg text-muted hover:bg-surface-2 hover:text-danger flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom action links */}
            <div className="flex items-center justify-between border-t border-line/60 pt-3 text-[12px]">
              <button
                type="button"
                onClick={addFilter}
                className="text-[#FF5900] hover:underline font-semibold flex items-center gap-1"
              >
                + Add filter
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addFilter}
                  className="text-muted hover:text-ink font-medium"
                >
                  + Add nested group
                </button>
                <button
                  type="button"
                  onClick={addFilter}
                  className="text-muted hover:text-ink font-medium"
                >
                  + Add OR group
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer - Cancel & Create List */}
        <div className="flex items-center justify-end gap-2.5 border-t border-line bg-surface p-4">
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <button
            onClick={() => void save()}
            disabled={busy}
            className="gx-btn gx-btn-sm bg-[#FF5900] hover:bg-[#E04F00] text-white font-semibold px-5 rounded-lg shadow-sm"
          >
            {record ? 'Save Changes' : 'Create List →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Backward compatibility alias for modal callers
export const CreateListModal = CreateListDrawer

export function ListDetailPage({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const list = useFetch<{ record: Row }>(`/api/resources/lists/${id}`)
  const members = useFetch<{ data: Row[]; total: number }>(`/api/lists/${id}/members`)
  const contacts = useFetch<{ data: Row[] }>('/api/resources/contacts?limit=100&sort=first_name&dir=asc')

  if (list.loading || members.loading) return <Spinner label="Loading audience list…" />
  if (list.error || !list.data) return <div className="p-5 text-sm text-danger">List not found.</div>
  const record = list.data.record

  const add = async () => {
    setBusy(true)
    try {
      await post(`/api/lists/${id}/members`, { contact_ids: selected })
      toast(`${selected.length} contact(s) added to list.`, 'good')
      setSelected([])
      setAddOpen(false)
      members.reload()
    } catch (error: any) {
      toast(error?.message ?? 'Could not add contacts.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (membershipId: string) => {
    try {
      await fetch(`/api/lists/${id}/members/${membershipId}`, { method: 'DELETE' })
      toast('Contact removed from list.', 'good')
      members.reload()
    } catch {
      toast('Could not remove the contact.', 'bad')
    }
  }

  const memberRows = (members.data?.data ?? []).filter((m) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      String(m.first_name ?? '').toLowerCase().includes(term) ||
      String(m.last_name ?? '').toLowerCase().includes(term) ||
      String(m.email ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-5 py-3.5">
        <Link to="/lists" className="text-[11.5px] text-muted hover:text-ink flex items-center gap-1">
          <ArrowLeft size={12} /> Lists
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-bold text-ink">{record.name}</h1>
              <Badge>{record.type}</Badge>
            </div>
            <p className="text-[12.5px] text-muted mt-0.5">
              {record.category} · {members.data?.total ?? 0} audience members
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setAddOpen(true)
                setSelected([])
              }}
            >
              <Plus size={14} /> Add Contacts
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate('/marketing/campaigns/new')}>
              Use in Campaign
            </Button>
          </div>
        </div>
        {record.description ? <p className="mt-1 text-[12px] text-muted">{record.description}</p> : null}
      </div>

      {/* Member Filter Bar */}
      <div className="border-b border-line bg-surface-2/40 px-5 py-2">
        <input
          type="text"
          placeholder="Filter contacts in this list…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="gx-input w-full sm:w-64 text-[12px]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {memberRows.length === 0 ? (
          <EmptyState
            icon={<User size={18} />}
            title={search ? 'No matching contacts' : 'This list is empty'}
            description="Add contacts from your workspace to build this marketing audience segment."
            action={
              <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                Add Contacts
              </Button>
            }
          />
        ) : (
          <table className="gx-table">
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Email</th>
                <th>Consent Status</th>
                <th>Account Status</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {memberRows.map((member) => (
                <tr key={member.id}>
                  <td className="font-medium">
                    <Link to={`/contacts/${member.id}`} className="hover:text-accent font-semibold">
                      {member.first_name} {member.last_name}
                    </Link>
                  </td>
                  <td>{member.email}</td>
                  <td>
                    {Number(member.email_opt_out) === 1 ? (
                      <Badge tone="danger">Opted Out</Badge>
                    ) : (
                      <Badge tone="good">Subscribed</Badge>
                    )}
                  </td>
                  <td>
                    <StatusBadge value={member.status} />
                  </td>
                  <td>
                    <button
                      className="text-[11.5px] text-danger hover:underline cursor-pointer"
                      onClick={() => void remove(member.membership_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add contacts to this list"
        subtitle="Only contacts in this workspace can be added"
        footer={
          <>
            <Button size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void add()} loading={busy} disabled={!selected.length}>
              Add {selected.length || ''} Contacts
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          {(contacts.data?.data ?? []).map((contact) => {
            const already = (members.data?.data ?? []).some((m) => m.id === contact.id)
            return (
              <label
                key={contact.id}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]',
                  already ? 'opacity-50' : 'hover:bg-surface-2 cursor-pointer'
                )}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--color-accent)]"
                  disabled={already}
                  checked={selected.includes(contact.id)}
                  onChange={(event) =>
                    setSelected((current) => (event.target.checked ? [...current, contact.id] : current.filter((v) => v !== contact.id)))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {contact.first_name} {contact.last_name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{contact.email}</span>
                </span>
                {Number(contact.email_opt_out) === 1 ? <Badge tone="danger">Opt-Out</Badge> : null}
                {already ? <Badge>In List</Badge> : null}
              </label>
            )
          })}
        </div>
      </Drawer>
    </div>
  )
}

/* ==========================================================================
   LEGACY / HELPER EXPORTS (Maintained for Backward Compatibility)
   ========================================================================== */

export function LeadSourceCard({ source, count, converted }: { source: string; count: number; converted: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11.5px] text-muted">{source}</div>
      <div className="text-[17px] font-semibold">{count}</div>
      <div className="text-[11px] text-muted">{converted} converted</div>
    </Card>
  )
}

