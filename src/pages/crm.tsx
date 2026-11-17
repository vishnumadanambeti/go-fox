import { useState } from 'react'
import { ArrowRight, Building2, Mail, Pencil, Phone, Plus, Sparkles, User } from 'lucide-react'
import { post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { Link, useNavigate } from '../lib/router'
import { formatDate, money } from '../lib/format'
import { Avatar, Badge, Button, Card, Drawer, EmptyState, FormRow, Modal, Spinner, StatusBadge, Tabs, cx } from '../components/ui'
import { ActivityFeed, FieldValue, RecordDetailPage, RecordFormDrawer, RelatedList, ResourcePage } from '../components/resource'

export function CompaniesPage() {
  return <ResourcePage entity="companies" title="Companies" subtitle="Organisations you sell to and support" />
}

export function CompanyDetailPage({ id }: { id: string }) {
  return (
    <RecordDetailPage
      id={id}
      backTo="/companies"
      backLabel="Companies"
      config={{
        entity: 'companies',
        title: (record) => String(record.name ?? 'Company'),
        subtitle: (record) => [record.industry, record.city].filter(Boolean).join(' · '),
        summary: ['domain', 'industry', 'phone', 'email', 'owner_id', 'status', 'city', 'country'],
        avatar: () => (
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Building2 size={19} />
          </span>
        ),
        related: [
          { entity: 'contacts', foreignKey: 'company_id', label: 'Contacts' },
          { entity: 'deals', foreignKey: 'company_id', label: 'Deals' },
          { entity: 'tickets', foreignKey: 'company_id', label: 'Tickets' },
        ],
      }}
      actions={(record) => (
        <>
          <Link to={`/contacts?company=${record.id}`} className="gx-btn gx-btn-sm">
            <User size={13} /> Add contact
          </Link>
          {record.email ? (
            <a className="gx-btn gx-btn-sm" href={`mailto:${record.email}`}>
              <Mail size={13} /> Email
            </a>
          ) : null}
        </>
      )}
    />
  )
}

export function ContactsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <>
      <ResourcePage
        entity="contacts"
        title="Contacts"
        subtitle="People, consent state and relationship history"
        onRowClick={(row) => setSelectedId(String(row.id))}
      />
      <ContactDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </>
  )
}

export function ContactDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { meta, schema } = useApp()
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
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar name={fullName} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{fullName}</div>
              <div className="text-[12.5px] text-muted">{[record.designation, company?.name].filter(Boolean).join(' · ')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {record.email ? (
                  <a className="gx-btn gx-btn-sm" href={`mailto:${record.email}`}>
                    <Mail size={13} /> Email
                  </a>
                ) : null}
                {record.phone ? (
                  <a className="gx-btn gx-btn-sm" href={`tel:${record.phone}`}>
                    <Phone size={13} /> Call
                  </a>
                ) : null}
                <Link to={`/sales/tasks?contact=${record.id}`} className="gx-btn gx-btn-sm">
                  <Plus size={13} /> Task
                </Link>
                <Link to={`/sales/deals?contact=${record.id}`} className="gx-btn gx-btn-sm">
                  <Plus size={13} /> Deal
                </Link>
              </div>
            </div>
            <div className="shrink-0 space-y-1 text-right text-[11.5px]">
              <StatusBadge value={record.status} />
              {record.score !== null && record.score !== undefined ? (
                <div className="text-muted">Score {record.score}</div>
              ) : null}
            </div>
          </div>

          {/* Tags */}
          {record.tags ? (
            <div className="flex flex-wrap gap-1.5">
              {String(record.tags)
                .split(',')
                .filter(Boolean)
                .map((tag) => (
                  <span key={tag} className="gx-badge">{tag.trim()}</span>
                ))}
            </div>
          ) : null}

          {/* Tabs */}
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
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.03em] text-faint">Updated</dt>
                  <dd className="mt-0.5 text-[13px]">{formatDate(record.updated_at)}</dd>
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

      <RecordFormDrawer
        entity="contacts"
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
  const { meta } = useApp()
  return (
    <RecordDetailPage
      id={id}
      backTo="/contacts"
      backLabel="Contacts"
      config={{
        entity: 'contacts',
        title: (record) => `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim(),
        subtitle: (record) => [record.designation, meta?.companies.find((c) => c.id === record.company_id)?.name].filter(Boolean).join(' · '),
        summary: ['email', 'phone', 'company_id', 'owner_id', 'source', 'score', 'status', 'email_opt_out'],
        related: [
          { entity: 'deals', foreignKey: 'contact_id', label: 'Deals' },
          { entity: 'tickets', foreignKey: 'contact_id', label: 'Tickets' },
        ],
      }}
      actions={(record) => (
        <>
          {record.email ? (
            <a className="gx-btn gx-btn-sm" href={`mailto:${record.email}`}>
              <Mail size={13} /> Email
            </a>
          ) : null}
          {record.phone ? (
            <a className="gx-btn gx-btn-sm" href={`tel:${record.phone}`}>
              <Phone size={13} /> Call
            </a>
          ) : null}
          {record.from_lead_id ? (
            <Link to={`/leads/${record.from_lead_id}`} className="gx-btn gx-btn-sm">
              From lead <ArrowRight size={13} />
            </Link>
          ) : null}
        </>
      )}
    />
  )
}

export function LeadsPage() {
  return <ResourcePage entity="leads" title="Leads" subtitle="Capture, qualify and convert prospective customers" />
}

export function LeadDetailPage({ id }: { id: string }) {
  const { toast } = useApp()
  const [open, setOpen] = useState(false)
  const [createDeal, setCreateDeal] = useState(true)
  const [dealValue, setDealValue] = useState(0)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useFetch<{ record: Row; activity: Row[] }>(`/api/resources/leads/${id}`)

  if (loading) return <Spinner label="Loading lead" />
  if (error || !data) return <div className="p-5 text-sm text-danger">Lead not found.</div>
  const lead = data.record

  const convert = async () => {
    setBusy(true)
    try {
      const result = await post<{ contactId: string; dealId: string | null; alreadyConverted?: boolean }>(`/api/leads/${id}/convert`, {
        create_deal: createDeal,
        deal_value: dealValue,
      })
      toast(result.alreadyConverted ? 'This lead was already converted.' : 'Lead converted to a contact.', 'good')
      setOpen(false)
      reload()
    } catch (err: any) {
      toast(err?.message ?? 'Conversion failed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <RecordDetailPage
        id={id}
        backTo="/leads"
        backLabel="Leads"
        config={{
          entity: 'leads',
          title: (record) => `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim(),
          subtitle: (record) => [record.company_name, record.job_title].filter(Boolean).join(' · '),
          summary: ['email', 'phone', 'company_name', 'source', 'status', 'priority', 'score', 'owner_id', 'opt_out'],
          related: [],
        }}
        actions={(record) =>
          record.converted_contact_id ? (
            <Link to={`/contacts/${record.converted_contact_id}`} className="gx-btn gx-btn-sm">
              <Sparkles size={13} /> Converted contact
            </Link>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              <Sparkles size={13} /> Convert lead
            </Button>
          )
        }
        tabs={[
          {
            key: 'conversion',
            label: 'Conversion',
            render: (record) =>
              record.converted_contact_id ? (
                <div className="space-y-3 text-[13px]">
                  <p className="text-muted">Converted on {formatDate(record.converted_at, 'long')}.</p>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/contacts/${record.converted_contact_id}`} className="gx-btn gx-btn-sm">
                      Open contact
                    </Link>
                    {record.converted_deal_id ? (
                      <Link to={`/sales/deals/${record.converted_deal_id}`} className="gx-btn gx-btn-sm">
                        Open deal
                      </Link>
                    ) : null}
                    {record.converted_company_id ? (
                      <Link to={`/companies/${record.converted_company_id}`} className="gx-btn gx-btn-sm">
                        Open company
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Sparkles size={18} />}
                  title="Not converted yet"
                  description="Converting creates a contact, links or creates the company, and can open a deal in the pipeline."
                  action={
                    <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                      Convert this lead
                    </Button>
                  }
                />
              ),
          },
        ]}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Convert ${lead.first_name} ${lead.last_name ?? ''}`}
        footer={
          <>
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={() => void convert()} loading={busy}>
              Convert lead
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-muted">
            A contact will be created{lead.company_name ? `, the company “${lead.company_name}” will be matched or created` : ''}. Conversion is
            idempotent: running it twice will not duplicate records.
          </p>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={createDeal} onChange={(event) => setCreateDeal(event.target.checked)} />
            Also create a deal in the first pipeline stage
          </label>
          {createDeal ? (
            <FormRow label="Deal value">
              <input className="gx-input" type="number" value={dealValue} onChange={(event) => setDealValue(Number(event.target.value))} />
            </FormRow>
          ) : null}
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11.5px] text-muted">
            After conversion the lead keeps a link to the created records, and the timeline records the conversion event.
          </div>
        </div>
      </Modal>
    </>
  )
}

export function ListsPage() {
  return <ResourcePage entity="lists" title="Lists" subtitle="Reusable audience segments for campaigns and sequences" />
}

export function ListDetailPage({ id }: { id: string }) {
  const { toast, schema } = useApp()
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const list = useFetch<{ record: Row }>(`/api/resources/lists/${id}`)
  const members = useFetch<{ data: Row[]; total: number }>(`/api/lists/${id}/members`)
  const contacts = useFetch<{ data: Row[] }>('/api/resources/contacts?limit=100&sort=first_name&dir=asc')

  if (list.loading || members.loading) return <Spinner label="Loading list" />
  if (list.error || !list.data) return <div className="p-5 text-sm text-danger">List not found.</div>
  const record = list.data.record

  const add = async () => {
    setBusy(true)
    try {
      await post(`/api/lists/${id}/members`, { contact_ids: selected })
      toast(`${selected.length} contact(s) added.`, 'good')
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
      members.reload()
    } catch {
      toast('Could not remove the contact.', 'bad')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 py-3.5">
        <Link to="/lists" className="text-[11.5px] text-muted hover:text-ink">
          ← Lists
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[17px] font-semibold">{record.name}</h1>
            <p className="text-[12.5px] text-muted">
              {record.category} · {members.data?.total ?? 0} members · {record.type}
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
              <Plus size={14} /> Add contacts
            </Button>
            <Button size="sm" onClick={() => navigate('/marketing/campaigns/new')}>
              Use in campaign
            </Button>
          </div>
        </div>
        {record.description ? <p className="mt-1 text-[12px] text-muted">{record.description}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto gx-scroll">
        {(members.data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<User size={18} />}
            title="This list is empty"
            description="Add contacts to build the audience. Opted-out contacts stay in the list but are excluded at send time."
            action={
              <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                Add contacts
              </Button>
            }
          />
        ) : (
          <table className="gx-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Consent</th>
                <th>Status</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {(members.data?.data ?? []).map((member) => (
                <tr key={member.id}>
                  <td className="font-medium">
                    <Link to={`/contacts/${member.id}`} className="hover:text-accent">
                      {member.first_name} {member.last_name}
                    </Link>
                  </td>
                  <td>{member.email}</td>
                  <td>{Number(member.email_opt_out) === 1 ? <Badge tone="danger">Opted out</Badge> : <Badge tone="good">Subscribed</Badge>}</td>
                  <td>
                    <StatusBadge value={member.status} />
                  </td>
                  <td>
                    <button className="text-[11.5px] text-danger hover:underline" onClick={() => void remove(member.membership_id)}>
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
              Add {selected.length || ''}
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          {(contacts.data?.data ?? []).map((contact) => {
            const already = (members.data?.data ?? []).some((m) => m.id === contact.id)
            return (
              <label key={contact.id} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]', already ? 'opacity-50' : 'hover:bg-surface-2')}>
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
                {Number(contact.email_opt_out) === 1 ? <Badge tone="danger">opt-out</Badge> : null}
                {already ? <Badge>in list</Badge> : null}
              </label>
            )
          })}
        </div>
      </Drawer>
      {schema.lists ? null : null}
    </div>
  )
}

export function LeadSourceCard({ source, count, converted }: { source: string; count: number; converted: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11.5px] text-muted">{source}</div>
      <div className="text-[17px] font-semibold">{count}</div>
      <div className="text-[11px] text-muted">{converted} converted</div>
    </Card>
  )
}

export function emptyActivity() {
  return <ActivityFeed items={[]} />
}

export function moneyLabel(value: unknown) {
  return money(value)
}

export function dateTab(rows: Row[]) {
  return rows.map((r) => formatDate(r.created_at))
}

export function statusTabs(active: string, onChange: (k: string) => void) {
  return (
    <Tabs
      tabs={[
        { key: 'all', label: 'All' },
        { key: 'active', label: 'Active' },
      ]}
      active={active}
      onChange={onChange}
    />
  )
}
