import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Headphones,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { initAnalytics } from '../lib/firebase'
import { Link } from '../lib/router'

const NAV = [
  {
    label: 'Products',
    items: [
      { label: 'Sales CRM', desc: 'Pipeline, deals and tasks' },
      { label: 'Marketing Automation', desc: 'Campaigns, forms and sequences' },
      { label: 'Customer Support', desc: 'Tickets, SLA and knowledge base' },
      { label: 'Workflow Automation', desc: 'Visual drag-and-drop builder' },
      { label: 'Form Builder', desc: 'Multi-step forms with CRM mapping' },
      { label: 'Analytics & Reporting', desc: 'Revenue dashboards and reports' },
    ],
  },
  {
    label: 'Solutions',
    items: [
      { label: 'Small Business', desc: 'Get organised in a day' },
      { label: 'Sales Teams', desc: 'Close more, faster' },
      { label: 'Marketing Teams', desc: 'Capture and nurture leads' },
      { label: 'Support Teams', desc: 'Resolve with SLA clocks' },
      { label: 'Agencies', desc: 'Multi-client workspaces' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Blog', desc: 'Growth and CRM playbooks' },
      { label: 'Knowledge Base', desc: 'Setup and how-to guides' },
      { label: 'CRM Guides', desc: 'Best practices' },
      { label: 'Documentation', desc: 'API and developer docs' },
      { label: 'Case Studies', desc: 'Customer stories' },
    ],
  },
]

const FEATURES = [
  { icon: Users, title: 'Contact Management', body: 'Unified contact records with timeline, tags, lists and 360° related records.' },
  { icon: Building2, title: 'Company Management', body: 'Account hierarchies, health scores and revenue roll-ups.' },
  { icon: Sparkles, title: 'Lead Management', body: 'Capture, score, qualify and convert leads with full attribution.' },
  { icon: LayoutDashboard, title: 'Sales Pipeline', body: 'Kanban and list views with weighted forecast and stage funnels.' },
  { icon: Rocket, title: 'Deal Management', body: 'Quotes, proposals, invoices and products tied to deals.' },
  { icon: Megaphone, title: 'Marketing Automation', body: 'Campaigns, sequences, audiences and consent-aware sends.' },
  { icon: Mail, title: 'Email Marketing', body: 'Templates, tracking and sandbox-labelled delivery until connected.' },
  { icon: Workflow, title: 'Workflow Automation', body: 'Visual drag-and-drop canvas with branching, waits and retries.' },
  { icon: FileText, title: 'Visual Form Builder', body: 'Multi-step forms with conditional logic and CRM field mapping.' },
  { icon: Globe, title: 'Landing Pages', body: 'Published pages with tracker and conversion analytics.' },
  { icon: Calendar, title: 'Appointment Scheduling', body: 'Calendar, availability and meeting links.' },
  { icon: Headphones, title: 'Customer Support', body: 'Tickets, internal notes, SLA clocks and knowledge base.' },
  { icon: MessageSquare, title: 'Free Live Chat', body: 'Visitor chat that creates contacts and tickets automatically.' },
  { icon: Bot, title: 'AI Sales Intelligence', body: 'Deterministic assistant over real tenant data; says so when no model is connected.' },
  { icon: BarChart3, title: 'CRM Reporting', body: 'Report tables and dashboards derived from persisted rows.' },
  { icon: BarChart3, title: 'CRM Analytics', body: 'Web analytics, channel performance and funnel views.' },
  { icon: FileText, title: 'Documents & Proposals', body: 'Proposals, quotes and invoices with line items.' },
  { icon: Zap, title: 'Integrations', body: 'Google Workspace, Microsoft 365, webhooks and more.' },
]

const INTEGRATIONS = [
  'Google Workspace', 'Gmail', 'Google Calendar', 'Microsoft 365', 'LinkedIn', 'WhatsApp Business', 'Twilio', 'Calendly', 'Zoom', 'Webhooks',
]

const SHOWCASE_TABS = [
  { key: 'sales', label: 'Sales CRM', body: 'Pipeline board, deal detail, tasks and weighted forecast — all aggregates over live deal rows.' },
  { key: 'marketing', label: 'Marketing', body: 'Campaigns, forms, landing pages, sequences and audience lists with real send metrics.' },
  { key: 'support', label: 'Customer Support', body: 'Ticket threads, SLA clocks, breach reporting and knowledge base.' },
  { key: 'automation', label: 'Automation', body: 'Visual workflow canvas with triggers, conditions, waits and actions — runs on real events.' },
  { key: 'analytics', label: 'Analytics', body: 'Revenue, funnel, channel and web-traffic dashboards derived from persisted events.' },
]

const PRICING = [
  { name: 'Free', price: '£0', period: '/month', desc: 'For small teams getting organised.', cta: 'Get started free', features: ['Up to 3 users', '1,000 contacts', 'Core CRM modules', 'Community support'] },
  { name: 'Starter', price: '£19', period: '/user/month', desc: 'For growing teams.', cta: 'Start free trial', features: ['Everything in Free', 'Unlimited contacts', 'Marketing automation', 'Email sequences', 'Standard support'] },
  { name: 'Growth', price: '£49', period: '/user/month', desc: 'For revenue teams at scale.', cta: 'Start free trial', popular: true, features: ['Everything in Starter', 'Visual workflows', 'Form builder', 'Advanced analytics', 'Priority support'] },
  { name: 'Enterprise', price: 'Custom', period: '', desc: 'For organisations with security needs.', cta: 'Book a demo', features: ['Everything in Growth', 'SSO and SCIM', 'Audit log and data residency', 'Custom roles', 'Dedicated success manager'] },
]

const BENEFITS = [
  { title: 'One registry, no drift', body: 'A single resource registry drives the CRUD API and the client UI, so lists, forms and detail pages can never disagree with the server.' },
  { title: 'Tenant isolation by design', body: 'org_id comes from the session, never the request body. Every query and mutation is tenant-scoped.' },
  { title: 'Role-based access control', body: 'Owner, admin, manager, sales, marketer and support — checked on every endpoint, not just the UI.' },
  { title: 'Append-only audit trail', body: 'Creates, updates, deletes, sends, exports and settings changes are recorded per tenant.' },
  { title: 'Honest integrations', body: 'Providers are seeded as Not connected and the UI says so. No fabricated success states.' },
  { title: 'Real automation', body: 'Idempotent runs, immutable published versions, dry-run and replayable execution history.' },
]

export function SitePage() {
  useEffect(() => {
    void initAnalytics()
  }, [])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showcase, setShowcase] = useState('sales')

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
                <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold">GoFox</span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 text-[13px] text-muted md:flex">
            {NAV.map((group) => (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenMenu(group.label)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition hover:bg-surface-2 hover:text-ink">
                  {group.label} <ChevronDown size={13} />
                </button>
                {openMenu === group.label ? (
                  <div className="absolute left-0 top-full z-50 w-72 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
                    {group.items.map((item) => (
                      <a key={item.label} href="#features" className="flex flex-col rounded-lg px-3 py-2 transition hover:bg-surface-2">
                        <span className="text-[13px] font-medium text-ink">{item.label}</span>
                        <span className="text-[11px] text-muted">{item.desc}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {['Pricing', 'Integrations'].map((label) => (
              <a key={label} href={`#${label.toLowerCase()}`} className="rounded-lg px-2.5 py-1.5 transition hover:bg-surface-2 hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="hidden text-[13px] font-medium text-muted transition hover:text-ink sm:block">
              Log In
            </Link>
            <Link to="/signup" className="gx-btn gx-btn-primary gx-btn-sm">
              Get Started Free <ArrowRight size={13} />
            </Link>
            <a href="#demo" className="hidden gx-btn gx-btn-sm lg:inline-flex">
              Book a Demo
            </a>
            <button className="md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
              <Layers size={20} />
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="border-t border-line bg-surface px-5 py-4 md:hidden">
            <div className="flex flex-col gap-2 text-[13px]">
              {NAV.map((g) => (
                <div key={g.label}>
                  <div className="py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{g.label}</div>
                  {g.items.map((i) => (
                    <a key={i.label} href="#features" className="block rounded-lg px-2 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
                      {i.label}
                    </a>
                  ))}
                </div>
              ))}
              <Link to="/login" className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">Log In</Link>
              <Link to="/signup" className="gx-btn gx-btn-primary gx-btn-sm">Get Started Free</Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#17243a] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 85% at 8% 0%, rgba(255,116,23,0.5) 0%, rgba(255,116,23,0.14) 40%, transparent 72%), radial-gradient(75% 60% at 100% 100%, rgba(21,156,145,0.24) 0%, transparent 62%)',
          }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="gx-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] text-white/75">
              <Zap size={12} className="text-accent" /> Multi-tenant CRM, marketing, sales and support
            </span>
            <h1 className="mt-6 text-[42px] font-semibold leading-[1.06] tracking-tight sm:text-[54px]">
              Unlock Your Growth Potential with GoFox
            </h1>
            <p className="mt-4 text-[20px] font-medium text-white/85">Sell with Confidence. Win More Deals.</p>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
              Generate quality leads, track your pipeline, and automate follow-ups so every opportunity moves closer to a successful close.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="gx-btn gx-btn-primary gx-btn-lg">
                Get Started Free <ArrowRight size={15} />
              </Link>
              <a href="#demo" className="gx-btn gx-btn-lg border border-white/15 bg-white/5 text-white hover:bg-white/10">
                Book a Demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-[12px] text-white/60">
              <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> Free plan available</span>
              <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> Set up in minutes</span>
            </div>
          </div>
          <div className="gx-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)] backdrop-blur">
              <div className="overflow-hidden rounded-xl bg-surface text-ink">
                <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
                  <span className="size-2 rounded-full bg-danger/60" />
                  <span className="size-2 rounded-full bg-warn/60" />
                  <span className="size-2 rounded-full bg-good/60" />
                  <span className="ml-3 rounded-md border border-line bg-surface px-2 py-0.5 text-[10.5px] text-faint">gofox / workspace</span>
                </div>
                <div className="grid grid-cols-[96px_1fr]">
                  <div className="space-y-1.5 border-r border-line bg-surface-2/60 p-2.5">
                    {['Home', 'Companies', 'Leads', 'Contacts', 'Deals', 'Tasks', 'Campaigns', 'Workflows', 'Tickets', 'Reports'].map((item, index) => (
                      <div key={item} className={`rounded-md px-2 py-1 text-[10.5px] ${index === 4 ? 'bg-accent text-white' : 'text-muted'}`}>{item}</div>
                    ))}
                  </div>
                  <div className="space-y-3 p-3.5">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['Open pipeline', '$751.3K'],
                        ['Weighted', '$253.1K'],
                        ['Win rate', '38%'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                          <div className="text-[9.5px] uppercase tracking-wide text-faint">{label}</div>
                          <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-line p-2.5">
                      <div className="mb-2 text-[10.5px] font-semibold text-muted">Pipeline by stage</div>
                      <div className="space-y-1.5">
                        {[
                          ['Qualification', 84],
                          ['Discovery', 62],
                          ['Proposal', 44],
                          ['Negotiation', 26],
                        ].map(([stage, width]) => (
                          <div key={String(stage)} className="flex items-center gap-2">
                            <span className="w-[68px] text-[9.5px] text-faint">{stage}</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-line p-2.5">
                      <div className="mb-1.5 text-[10.5px] font-semibold text-muted">Recent activity</div>
                      {['Deal stage changed · Meridian Finance', 'Ticket replied · Atlas Construction', 'Form submitted · Request a demo'].map((row) => (
                        <div key={row} className="flex items-center gap-2 py-1 text-[10.5px] text-muted">
                          <span className="size-1.5 rounded-full bg-accent" />
                          {row}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product storytelling */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="grid gap-16">
          {[
            {
              eyebrow: 'Capture Leads',
              title: 'Capture Every Opportunity, The Moment It Arrives',
              body: 'Website forms, landing pages, live chat and lead inbox — every channel feeds one clean lead record with source attribution and automatic assignment.',
              points: ['Website forms', 'Landing pages', 'Live chat', 'Lead inbox', 'Lead capture', 'Lead assignment'],
              tone: 'accent',
            },
            {
              eyebrow: 'Lead Nurturing',
              title: 'Build Stronger Relationships With Every Follow-Up',
              body: 'Campaigns, email sequences, automated follow-ups, lead scoring and segmentation keep every prospect moving without manual chasing.',
              points: ['Campaigns', 'Email sequences', 'Automated follow-ups', 'Lead scoring', 'Customer segmentation'],
              tone: 'teal',
            },
            {
              eyebrow: 'Business Growth',
              title: 'Turn Customer Insights Into Measurable Growth',
              body: 'Revenue dashboards, customer health, renewals, support tickets and sales analytics — all derived from persisted, tenant-scoped rows.',
              points: ['Revenue dashboards', 'Customer health', 'Renewals', 'Support tickets', 'Sales analytics'],
              tone: 'purple',
            },
          ].map((block, index) => (
            <div key={block.title} className={`grid gap-10 lg:grid-cols-2 lg:items-center ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${block.tone === 'accent' ? 'text-accent' : block.tone === 'teal' ? 'text-teal' : 'text-purple'}`}>{block.eyebrow}</span>
                <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">{block.title}</h2>
                <p className="mt-4 text-[14px] leading-relaxed text-muted">{block.body}</p>
                <ul className="mt-6 grid grid-cols-2 gap-2">
                  {block.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-[13px] text-ink">
                      <Check size={14} className={block.tone === 'accent' ? 'text-accent' : block.tone === 'teal' ? 'text-teal' : 'text-purple'} />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
                <div className="grid grid-cols-2 gap-3">
                  {block.points.map((point, i) => (
                    <div key={point} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                      <div className="text-[12px] font-semibold">{point}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${60 + (i * 7) % 35}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <div className="max-w-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Features</span>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">Everything a revenue team touches, in one place</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              Each module writes to the same tenant-scoped data model, so a stage change moves the dashboard, the forecast and the activity trail at once.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="gx-card p-5 transition hover:border-accent/40">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <feature.icon size={18} />
                </span>
                <h3 className="mt-4 text-[14px] font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{feature.body}</p>
                <a href="#product" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                  Learn more <ArrowRight size={12} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive showcase */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Product</span>
          <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">One workspace, many views</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">The same work, seen your way — sales, marketing, support, automation and analytics in a single tenant.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {SHOWCASE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setShowcase(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${showcase === tab.key ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-ink'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h3 className="text-[16px] font-semibold">{SHOWCASE_TABS.find((t) => t.key === showcase)?.label}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{SHOWCASE_TABS.find((t) => t.key === showcase)?.body}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {['KPIs', 'Charts', 'Tables'].map((item) => (
                <div key={item} className="rounded-lg border border-line bg-surface-2 px-3 py-4 text-center text-[12px] font-medium text-muted">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-[#17243a] p-6 text-white">
            <div className="text-[11px] uppercase tracking-wide text-white/50">Live data</div>
            <div className="mt-2 text-[28px] font-semibold">Real aggregates</div>
            <p className="mt-2 text-[12.5px] text-white/70">Every figure on the dashboard is a SQL aggregate over persisted, tenant-scoped rows. No cached counters that drift.</p>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <div className="max-w-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Integrations</span>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">Connects to the tools you already use</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              Providers are seeded as Not connected and the UI says so. Outbound email runs through a labelled sandbox adapter until real credentials exist.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            {INTEGRATIONS.map((name) => (
              <span key={name} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-[13px] font-medium text-ink">
                {name}
              </span>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-muted">
            Only advertise integrations that are genuinely available or clearly label upcoming integrations. OAuth flows for Gmail and Microsoft 365 are implemented and activate with credentials.
          </p>
        </div>
      </section>

      {/* Benefits (instead of fabricated testimonials) */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Why GoFox</span>
          <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">Built so a tenant boundary is not a hope</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">Verified product benefits — no fabricated customer identities, logos or quotes.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((item) => (
            <div key={item.title} className="gx-card flex gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-semibold">{item.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-20">
          <div className="max-w-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Resources</span>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">Learn, build and grow</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['Blog', 'Knowledge Base', 'CRM Guides', 'Documentation', 'Sales Resources', 'Marketing Resources', 'Case Studies', 'API Reference'].map((item) => (
              <a key={item} href="#" className="gx-card flex items-center gap-3 p-4 transition hover:border-accent/40">
                <BookOpen size={16} className="text-accent" />
                <span className="text-[13px] font-medium">{item}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Pricing</span>
          <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">Simple pricing that grows with you</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">Start free. Upgrade when your team does. Pricing and limits reflect the configured plans.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {PRICING.map((tier) => (
            <div key={tier.name} className={`gx-card flex flex-col p-6 ${tier.popular ? 'border-accent ring-2 ring-accent/20' : ''}`}>
              {tier.popular ? <span className="mb-2 self-start rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">Most popular</span> : null}
              <h3 className="text-[16px] font-semibold">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[32px] font-semibold tracking-tight">{tier.price}</span>
                <span className="text-[12px] text-muted">{tier.period}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">{tier.desc}</p>
              <ul className="mt-5 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12.5px]">
                    <Check size={13} className="text-good" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className={`mt-6 ${tier.popular ? 'gx-btn gx-btn-primary' : 'gx-btn'} w-full justify-center`}>
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[#17243a] px-8 py-12 text-white">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(90% 140% at 100% 0%, rgba(255,116,23,0.45) 0%, transparent 62%)' }} />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="max-w-xl">
              <h2 className="text-[28px] font-semibold tracking-tight">Unlock your growth potential today</h2>
              <p className="mt-2 text-[13.5px] text-white/70">Join teams selling with confidence, winning more deals and automating every follow-up.</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              <Link to="/signup" className="gx-btn gx-btn-primary gx-btn-lg">Get Started Free <ArrowRight size={15} /></Link>
              <a href="#demo" className="gx-btn gx-btn-lg border border-white/15 bg-white/5 text-white hover:bg-white/10">Book a Demo</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { title: 'Product', links: ['Sales CRM', 'Marketing Automation', 'Customer Support', 'Workflow Automation', 'Form Builder', 'Analytics'] },
              { title: 'Solutions', links: ['Small Business', 'Sales Teams', 'Marketing Teams', 'Support Teams', 'Agencies'] },
              { title: 'Resources', links: ['Blog', 'Knowledge Base', 'CRM Guides', 'Documentation', 'Case Studies'] },
              { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact', 'Status'] },
              { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{col.title}</h4>
                <ul className="mt-3 space-y-1.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-[12.5px] text-muted transition hover:text-ink">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-[12px] text-muted">
            <span className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
                  <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="font-medium text-ink">GoFox</span>
            </span>
            <span>© {new Date().getFullYear()} GoFox, Inc. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-ink">Twitter</a>
              <a href="#" className="hover:text-ink">LinkedIn</a>
              <a href="#" className="hover:text-ink">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
