import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  Clock,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleUser,
  FileSignature,
  FileText,
  Folder,
  Gauge,
  Globe,
  Handshake,
  Headphones,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  Library,
  List,
  LogOut,
  Mail,
  Maximize2,
  Megaphone,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  Package,
  Phone,
  PieChart,
  Plug,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  Star,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Ticket,
  Timer,
  Trash2,
  UserCog,
  Users,
  Wallet,
  Workflow,
  X,
} from 'lucide-react'
import { Link, useNavigate, usePath } from '../lib/router'
import { useApp, useFetch, type Me } from '../lib/app-context'
import { get, patch, post, query, type Row } from '../lib/api'
import { initials, timeAgo, titleCase } from '../lib/format'
import { Avatar, Badge, Button, Card, Drawer, Dropdown, IconButton, MenuItem, Modal, StatusBadge, cx } from './ui'
import { RecordFormDrawer } from './resource'

type NavItem = { label: string; to: string; icon: ReactNode; badge?: string }
type NavGroup = { title: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    title: 'Core',
    items: [
      { label: 'Home', to: '/', icon: <Home size={15} /> },
      { label: 'Companies', to: '/companies', icon: <Building2 size={15} /> },
      { label: 'Leads', to: '/leads', icon: <Target size={15} /> },
      { label: 'Contacts', to: '/contacts', icon: <Users size={15} /> },
      { label: 'Lists', to: '/lists', icon: <List size={15} /> },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Dashboard', to: '/marketing', icon: <Gauge size={15} /> },
      { label: 'Forms', to: '/marketing/forms', icon: <Layers size={15} /> },
      { label: 'Landing Pages', to: '/marketing/landing-pages', icon: <LayoutDashboard size={15} /> },
      { label: 'Template Library', to: '/marketing/templates', icon: <Layers size={15} /> },
      { label: 'Email Templates', to: '/marketing/emails', icon: <Mail size={15} /> },
      { label: 'Campaigns', to: '/marketing/campaigns', icon: <Megaphone size={15} /> },
      { label: 'Email Sequences', to: '/marketing/sequences', icon: <Send size={15} /> },
      { label: 'WhatsApp', to: '/marketing/whatsapp', icon: <MessageCircle size={15} /> },
      { label: 'Social Posts', to: '/marketing/social', icon: <Share2 size={15} /> },
      { label: 'Social Ads', to: '/marketing/ads', icon: <PieChart size={15} /> },
      { label: 'Content Hub', to: '/marketing/content', icon: <Library size={15} /> },
      { label: 'Automations', to: '/marketing/automations', icon: <Sparkles size={15} /> },
      { label: 'Workflows', to: '/marketing/workflows', icon: <Workflow size={15} /> },
      { label: 'Web Analytics', to: '/marketing/analytics', icon: <PieChart size={15} /> },
      { label: 'Activities', to: '/marketing/activities', icon: <Activity size={15} /> },
      { label: 'Files Repository', to: '/files', icon: <Folder size={15} /> },
      { label: 'Trash', to: '/trash', icon: <Trash2 size={15} /> },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Dashboard', to: '/sales', icon: <Gauge size={15} /> },
      { label: 'Deals', to: '/sales/deals', icon: <Handshake size={15} /> },
      { label: 'Tasks', to: '/sales/tasks', icon: <Target size={15} /> },
      { label: 'Calendar', to: '/sales/calendar', icon: <Calendar size={15} /> },
      { label: 'Inbox', to: '/sales/inbox', icon: <Inbox size={15} /> },
      { label: 'Automations', to: '/sales/automations', icon: <Sparkles size={15} /> },
      { label: 'Proposals', to: '/sales/proposals', icon: <FileSignature size={15} /> },
      { label: 'Quotes', to: '/sales/quotes', icon: <FileText size={15} /> },
      { label: 'Invoices', to: '/sales/invoices', icon: <Receipt size={15} /> },
      { label: 'Products', to: '/sales/products', icon: <Package size={15} /> },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Dashboard', to: '/support', icon: <Gauge size={15} /> },
      { label: 'Tickets', to: '/support/tickets', icon: <Ticket size={15} /> },
      { label: 'Automations', to: '/support/automations', icon: <Sparkles size={15} /> },
      { label: 'Live Chat', to: '/support/live-chat', icon: <Headphones size={15} /> },
      { label: 'Knowledge Base', to: '/support/kb', icon: <BookOpen size={15} /> },
      { label: 'Activities', to: '/support/activities', icon: <Activity size={15} /> },
      { label: 'SLA Policies', to: '/support/sla', icon: <Timer size={15} /> },
    ],
  },
  {
    title: 'Reports',
    items: [{ label: 'Reports', to: '/reports', icon: <PieChart size={15} /> }],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Account & Users', to: '/settings/account', icon: <UserCog size={15} /> },
      { label: 'Profile', to: '/settings/profile', icon: <CircleUser size={15} /> },
      { label: 'Email accounts', to: '/general-settings/email-accounts', icon: <Mail size={15} /> },
      { label: 'Financial', to: '/settings/financial', icon: <Wallet size={15} /> },
      { label: 'Connected Apps', to: '/settings/apps', icon: <Plug size={15} /> },
      { label: 'Audit Log', to: '/settings/audit', icon: <ShieldCheck size={15} /> },
    ],
  },
]

export function entityHref(type: string | null | undefined, id: string | null | undefined): string | null {
  if (!type) return null
  const map: Record<string, string> = {
    company: '/companies',
    contact: '/contacts',
    lead: '/leads',
    deal: '/sales/deals',
    ticket: '/support/tickets',
    campaign: '/marketing/campaigns',
    workflow: '/marketing/workflows',
    form: '/marketing/forms',
    landing_page: '/marketing/landing-pages',
    task: '/sales/tasks',
    sequence: '/marketing/sequences',
    document: '/sales/quotes',
    file: '/files',
  }
  const base = map[type]
  if (!base) return null
  const detail = ['company', 'contact', 'lead', 'deal', 'ticket', 'campaign', 'workflow', 'form', 'landing_page', 'sequence']
  if (id && detail.includes(type)) {
    if (type === 'document') return base
    return `${base}/${id}`
  }
  return base
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me } = useApp()
  const path = usePath()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('gofox:sidebar') === 'collapsed')

  useEffect(() => {
    setMobileOpen(false)
  }, [path])

  if (!me) return null

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('gofox:sidebar', next ? 'collapsed' : 'expanded')
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside
        className={cx('gx-sidebar hidden shrink-0 flex-col md:flex', collapsed ? 'w-[70px]' : 'w-[236px]')}
      >
        <SidebarContent collapsed={collapsed} onCollapse={toggleCollapse} />
      </aside>

      {mobileOpen ? (
        <>
          <div className="gx-scrim md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="gx-sidebar fixed inset-y-0 left-0 z-[61] flex w-[252px] flex-col md:hidden">
            <SidebarContent collapsed={false} onCollapse={() => setMobileOpen(false)} />
          </aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto gx-scroll gx-fade pb-[62px] md:pb-0">{children}</main>
        <MobileTabs onMore={() => setMobileOpen(true)} />
      </div>
    </div>
  )
}

/** Thumb-reach navigation for phones and narrow panels. */
function MobileTabs({ onMore }: { onMore: () => void }) {
  const path = usePath()
  const tabs = [
    { label: 'Home', to: '/', icon: <Home size={18} /> },
    { label: 'Contacts', to: '/contacts', icon: <Users size={18} /> },
    { label: 'Deals', to: '/sales/deals', icon: <Handshake size={18} /> },
    { label: 'Inbox', to: '/sales/inbox', icon: <Inbox size={18} /> },
    { label: 'Tickets', to: '/support/tickets', icon: <Ticket size={18} /> },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      {tabs.map((tab) => {
        const active = tab.to === '/' ? path === '/' : path.startsWith(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]', active ? 'text-accent' : 'text-muted')}
          >
            <span className={cx('flex size-7 items-center justify-center rounded-lg', active && 'bg-accent-soft')}>{tab.icon}</span>
            {tab.label}
          </Link>
        )
      })}
      <button className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted" onClick={onMore}>
        <span className="flex size-7 items-center justify-center rounded-lg">
          <Menu size={18} />
        </span>
        More
      </button>
    </nav>
  )
}

function SidebarContent({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: () => void }) {
  const { me } = useApp()
  const path = usePath()
  const [term, setTerm] = useState('')
  const [pins, setPins] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gofox:pins') ?? '[]') as string[]
    } catch {
      return []
    }
  })

  const togglePin = (to: string) => {
    const next = pins.includes(to) ? pins.filter((item) => item !== to) : [...pins, to]
    setPins(next)
    try {
      localStorage.setItem('gofox:pins', JSON.stringify(next))
    } catch {
      /* storage may be blocked */
    }
  }

  const search = term.trim().toLowerCase()
  const groups = NAV.map((group) => ({
    ...group,
    items: search ? group.items.filter((item) => item.label.toLowerCase().includes(search)) : group.items,
  })).filter((group) => group.items.length > 0)
  const allItems = NAV.flatMap((group) => group.items)
  const pinned = allItems.filter((item) => pins.includes(item.to))

  const item = (navItem: NavItem) => {
    const active = navItem.to === '/' ? path === '/' : path.startsWith(navItem.to)
    return (
      <div key={navItem.to} className="group/item flex items-center">
        <Link
          to={navItem.to}
          className="gx-nav-item min-w-0 flex-1"
          data-active={active}
          title={collapsed ? navItem.label : undefined}
          aria-label={navItem.label}
        >
          <span className="shrink-0">{navItem.icon}</span>
          {!collapsed ? <span className="truncate">{navItem.label}</span> : null}
        </Link>
        {!collapsed ? (
          <button
            className="gx-pin ml-0.5 rounded p-1 hover:bg-white/10"
            data-pinned={pins.includes(navItem.to)}
            aria-label={pins.includes(navItem.to) ? `Unpin ${navItem.label}` : `Pin ${navItem.label}`}
            title={pins.includes(navItem.to) ? 'Unpin' : 'Pin to top'}
            onClick={() => togglePin(navItem.to)}
          >
            <Star size={11} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="flex h-[58px] shrink-0 items-center justify-between gap-2 px-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff8a3d] to-[#e7680c] text-white shadow-[0_6px_16px_-6px_rgba(255,116,23,0.9)]">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
              <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold leading-tight text-white">GoFox CRM</span>
              <span className="block truncate text-[10px] text-[#8296b0]">{me?.org_name}</span>
            </span>
          ) : null}
        </Link>
        <button
          className="gx-icon-btn shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onCollapse}
        >
          {collapsed ? <ChevronRight size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {!collapsed ? (
        <div className="relative px-3 pb-2">
          <Search size={12} className="pointer-events-none absolute left-[22px] top-1/2 -translate-y-1/2 text-[#7f8fa6]" />
          <input
            className="gx-nav-search"
            placeholder="Jump to…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Filter navigation"
          />
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto gx-scroll px-2 pb-3">
        {!search && pinned.length && !collapsed ? (
          <div>
            <div className="gx-nav-section">Pinned</div>
            <div className="space-y-0.5">{pinned.map(item)}</div>
          </div>
        ) : null}
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed ? <div className="gx-nav-section">{group.title}</div> : <div className="my-2 border-t border-white/10" />}
            <div className="space-y-0.5">{group.items.map(item)}</div>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-[11.5px] text-[#7f8fa6]">No pages match “{term}”.</p>
        ) : null}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2.5">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] p-2">
            <Avatar name={me?.name} hue={me?.avatar_hue} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">{me?.name}</div>
              <div className="truncate text-[10.5px] capitalize text-[#8fa1b8]">{me?.role} · {me?.org_name}</div>
            </div>
            <Link to="/settings/profile" className="gx-icon-btn" aria-label="Profile settings">
              <Settings size={14} />
            </Link>
          </div>
        ) : (
          <Link to="/settings/profile" className="flex justify-center py-1" aria-label="Profile settings">
            <Avatar name={me?.name} hue={me?.avatar_hue} size={28} />
          </Link>
        )}
      </div>
    </>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { me, dark, toggleTheme, notifications, unread, markRead, logout, toast } = useApp()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [dialOpen, setDialOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [quickEntity, setQuickEntity] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[58px] shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md sm:px-4">
        <IconButton label="Open navigation" className="md:hidden" onClick={onMenu}>
          <Menu size={17} />
        </IconButton>

        <button
          className="group flex h-9 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-left text-[12.5px] text-muted transition hover:border-line-strong hover:bg-surface md:max-w-[340px]"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={14} className="text-faint group-hover:text-accent" />
          <span className="flex-1 truncate">Search everything…</span>
          <span className="gx-kbd hidden sm:inline">⌘K</span>
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <Button size="sm" variant="primary" onClick={toggle} className="mr-1 shadow-[0_4px_14px_-6px_rgba(255,116,23,0.9)]">
                <Plus size={14} /> <span className="hidden sm:inline">Create</span>
              </Button>
            )}
          >
            {(close) => (
              <>
                {[
                  ['contacts', 'Contact'],
                  ['companies', 'Company'],
                  ['leads', 'Lead'],
                  ['deals', 'Deal'],
                  ['tasks', 'Task'],
                  ['events', 'Meeting'],
                  ['tickets', 'Ticket'],
                  ['campaigns', 'Campaign'],
                  ['forms', 'Form'],
                  ['landing_pages', 'Landing page'],
                ].map(([entity, label]) => (
                  <MenuItem
                    key={entity}
                    onClick={() => {
                      close()
                      setQuickEntity(entity)
                    }}
                  >
                    <Plus size={13} /> {label}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>

          <IconButton label="Dial pad" onClick={() => setDialOpen(true)}>
            <Phone size={16} />
          </IconButton>
          <IconButton label="AI assistant" onClick={() => setAiOpen(true)}>
            <Bot size={16} />
          </IconButton>

          <div className="hidden items-center gap-0.5 sm:flex">
            <Dropdown
              align="right"
              trigger={({ toggle }) => (
                <IconButton label="Language" onClick={toggle}>
                  <Globe size={16} />
                </IconButton>
              )}
            >
              {() => (
                <div className="p-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Interface language</div>
                  <select
                    className="gx-select"
                    value={me?.locale ?? 'en'}
                    onChange={async (event) => {
                      try {
                        await patch('/api/auth/profile', { locale: event.target.value })
                        toast('Language preference saved.', 'good')
                      } catch {
                        toast('Could not save the language preference.', 'bad')
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="de" disabled>
                      Deutsch (not translated yet)
                    </option>
                    <option value="fr" disabled>
                      Français (not translated yet)
                    </option>
                    <option value="ar" disabled>
                      العربية (not translated yet)
                    </option>
                  </select>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-faint">
                    Only English strings ship today. The preference is stored per user so translations can be added without a migration.
                  </p>
                </div>
              )}
            </Dropdown>

            <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => void toggleTheme()}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
            <IconButton
              label="Full screen"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void document.documentElement.requestFullscreen?.()
              }}
            >
              <Maximize2 size={15} />
            </IconButton>
            <IconButton label="Help" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={16} />
            </IconButton>
          </div>

          <div className="relative">
            <IconButton label={`Notifications (${unread} unread)`} onClick={() => setNotifOpen((v) => !v)}>
              <Bell size={16} />
              {unread > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </IconButton>
            {notifOpen ? (
              <>
                <div className="fixed inset-0 z-[49]" onClick={() => setNotifOpen(false)} />
                <div className="gx-card absolute right-0 z-50 mt-1.5 w-[330px] overflow-hidden p-0 shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <span className="text-[12.5px] font-semibold">Notifications</span>
                    <button className="text-[11px] text-accent hover:underline" onClick={() => void markRead()}>
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto gx-scroll">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-muted">Nothing yet. Deal, task and ticket events land here.</p>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          className={cx('flex w-full gap-2.5 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface-2', !item.read_at && 'bg-accent-soft/40')}
                          onClick={async () => {
                            await markRead(item.id)
                            setNotifOpen(false)
                            const href = entityHref(item.entity_type, item.entity_id)
                            if (href) navigate(href)
                          }}
                        >
                          <span className={cx('mt-1 size-1.5 shrink-0 rounded-full', item.read_at ? 'bg-transparent' : 'bg-accent')} />
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium">{item.title}</span>
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{item.body}</span>
                            <span className="mt-0.5 block text-[10.5px] text-faint">{timeAgo(item.created_at)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button className="ml-1 flex items-center gap-1.5 rounded-lg p-0.5 pr-1 hover:bg-surface-2" onClick={toggle} aria-label="Profile menu">
                <Avatar name={me?.name} hue={me?.avatar_hue} size={27} />
                <ChevronDown size={13} className="text-faint" />
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="border-b border-line px-2.5 pb-2 pt-1">
                  <div className="truncate text-[12.5px] font-semibold">{me?.name}</div>
                  <div className="truncate text-[11px] text-muted">{me?.email}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge tone="accent">{titleCase(me?.role)}</Badge>
                    <Badge>{me?.org_name}</Badge>
                  </div>
                </div>
                <div className="pt-1">
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/settings/profile')
                    }}
                  >
                    <CircleUser size={13} /> Profile settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/settings/account')
                    }}
                  >
                    <Settings size={13} /> Account settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/sales/inbox')
                    }}
                  >
                    <Inbox size={13} /> Inbox
                  </MenuItem>
                  <MenuItem
                    tone="danger"
                    onClick={() => {
                      close()
                      void logout()
                    }}
                  >
                    <LogOut size={13} /> Sign out
                  </MenuItem>
                </div>
              </div>
            )}
          </Dropdown>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <RecordFormDrawer
        entity={quickEntity ?? 'contacts'}
        open={Boolean(quickEntity)}
        record={null}
        onClose={() => setQuickEntity(null)}
        onSaved={() => setQuickEntity(null)}
      />
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <DialPad open={dialOpen} onClose={() => setDialOpen(false)} />
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help and shortcuts">
        <div className="space-y-3 text-[13px]">
          <p className="text-muted">
            GoFox CRM stores everything in the workspace database. Lists, drawers, detail pages and automations all write through the same
            authenticated API, so what you see here is what is persisted.
          </p>
          <div>
            <div className="mb-1 text-[12px] font-semibold">Keyboard</div>
            <ul className="space-y-1 text-[12.5px] text-muted">
              <li className="flex justify-between">
                <span>Global search</span>
                <span className="gx-kbd">⌘K / Ctrl K</span>
              </li>
              <li className="flex justify-between">
                <span>Close a drawer or dialog</span>
                <span className="gx-kbd">Esc</span>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold">Not connected in this build</div>
            <p className="text-[12.5px] text-muted">
              Mailbox sync, WhatsApp, social publishing, ads, payments and telephony need OAuth credentials or API keys from the account
              owner. Those screens report their real connection state instead of pretending to send. Email sends run through a clearly
              labelled sandbox adapter.
            </p>
          </div>
          <p className="text-[12px] text-muted">
            Full provider setup notes live in <code className="rounded bg-surface-2 px-1">docs/INTEGRATIONS.md</code>.
          </p>
        </div>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------ global search */
function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gofox.recentSearches') ?? '[]')
    } catch {
      return []
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setTerm('')
      setDebounced('')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 220)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data, loading } = useFetch<{ groups: { type: string; href: string; items: Row[] }[] }>(
    open && debounced.length >= 2 ? `/api/search?${query({ q: debounced })}` : null,
  )
  const groups = data?.groups ?? []
  const flatResults = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ group: g, item }))), [groups])

  useEffect(() => {
    setActiveIndex(0)
  }, [debounced])

  const saveRecent = (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) return
    const next = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, 8)
    setRecent(next)
    try {
      localStorage.setItem('gofox.recentSearches', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const openResult = (group: { type: string; href: string; items: Row[] }, item: Row) => {
    saveRecent(debounced || term)
    onClose()
    // Lists without a record route open at the list rather than a dead detail URL.
    const listOnly = ['activities', 'documents'].includes(group.type)
    navigate(listOnly ? group.href : `${group.href}/${item.id}`)
  }

  if (!open) return null
  return (
    <div className="gx-scrim" onClick={onClose}>
      <div
        className="gx-card mx-auto mt-[8vh] w-[min(620px,calc(100vw-28px))] overflow-hidden p-0 shadow-[var(--shadow-pop)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          <Search size={16} className="text-faint" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
            placeholder="Search companies, leads, contacts, deals, tasks, tickets…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              }
              if (event.key === 'Enter' && flatResults.length > 0) {
                const r = flatResults[activeIndex] ?? flatResults[0]
                openResult(r.group, r.item)
              }
            }}
          />
          <button className="gx-kbd" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto gx-scroll p-2">
          {debounced.length < 2 ? (
            recent.length > 0 ? (
              <div>
                <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Recent searches</div>
                {recent.map((r) => (
                  <button
                    key={r}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => setTerm(r)}
                  >
                    <Clock size={12} className="text-faint" />
                    <span className="text-[13px]">{r}</span>
                  </button>
                ))}
                <p className="px-3 py-3 text-[11.5px] text-muted">Type at least two characters to search all records.</p>
              </div>
            ) : (
              <p className="px-3 py-5 text-[12.5px] text-muted">Type at least two characters. Results are limited to records you can access in this workspace.</p>
            )
          ) : loading ? (
            <p className="px-3 py-5 text-[12.5px] text-muted">Searching…</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-5 text-[12.5px] text-muted">No matches for “{debounced}”.</p>
          ) : (
            groups.map((group) => (
              <div key={group.type} className="mb-1">
                <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">{group.type}</div>
                {group.items.map((item) => {
                  const flatIdx = flatResults.findIndex((r) => r.group === group && r.item.id === item.id)
                  const active = flatIdx === activeIndex
                  return (
                    <button
                      key={item.id}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left ${active ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
                      onClick={() => openResult(group, item)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{item.label}</span>
                        <span className="block truncate text-[11px] text-muted">{item.sub}</span>
                      </span>
                      <ChevronRight size={13} className="text-faint" />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-line px-3.5 py-1.5 text-[10.5px] text-faint">↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ AI panel */
function AIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<{ role: string; body: string; sources?: { label: string; href: string }[] }[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    get<{ messages: Row[] }>('/api/ai/messages')
      .then((data) =>
        setMessages(
          data.messages.map((row) => ({
            role: String(row.role),
            body: String(row.body),
            sources: row.sources ? JSON.parse(String(row.sources)) : [],
          })),
        ),
      )
      .catch(() => setMessages([]))
  }, [open])

  const send = async (text?: string) => {
    const content = (text ?? message).trim()
    if (!content || busy) return
    setMessages((current) => [...current, { role: 'user', body: content }])
    setMessage('')
    setBusy(true)
    try {
      const reply = await post<{ reply: string; sources: { label: string; href: string }[] }>('/api/ai/chat', { message: content })
      setMessages((current) => [...current, { role: 'assistant', body: reply.reply, sources: reply.sources }])
    } catch (error: any) {
      toast(error?.message ?? 'The assistant could not answer.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="GoFox assistant" subtitle="Answers computed from your CRM data" wide>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-4">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
                <Sparkles size={14} className="text-accent" /> Try one of these
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['How is the pipeline looking?', 'What are my tasks this week?', 'Draft a follow-up email', 'Explain how workflows run'].map((prompt) => (
                  <button key={prompt} className="gx-badge hover:border-accent" onClick={() => void send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((item, index) => (
            <div key={index} className={cx('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cx(
                  'max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed',
                  item.role === 'user' ? 'bg-accent text-white' : 'border border-line bg-surface-2',
                )}
              >
                {item.body}
                {item.sources?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.sources.map((source) => (
                      <button
                        key={source.href}
                        className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10.5px] text-accent hover:border-accent"
                        onClick={() => {
                          onClose()
                          navigate(source.href)
                        }}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy ? <p className="text-[12px] text-muted">Thinking…</p> : null}
        </div>
        <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
          <textarea
            className="gx-textarea min-h-[42px] flex-1"
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask about a record, your pipeline or a workflow…"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <Button variant="primary" onClick={() => void send()} loading={busy}>
            Send
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

/* ------------------------------------------------------------------ dial pad */
function DialPad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setNumber('')
      setError(null)
    }
  }, [open])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
  const call = async () => {
    setBusy(true)
    setError(null)
    try {
      await post('/api/telephony/dial', { number })
    } catch (err: any) {
      setError(err?.message ?? 'The call could not be placed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dial pad"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" variant="primary" onClick={() => void call()} loading={busy} disabled={number.replace(/\D/g, '').length < 7}>
            <Phone size={14} /> Call
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <Phone size={14} className="text-muted" />
          <input
            className="w-full bg-transparent text-[15px] tracking-wide outline-none placeholder:text-faint"
            value={number}
            onChange={(event) => setNumber(event.target.value.replace(/[^\d+*#]/g, ''))}
            placeholder="+1 415 555 0100"
            aria-label="Phone number"
          />
          <button className="text-[11px] text-muted hover:text-ink" onClick={() => setNumber((n) => n.slice(0, -1))}>
            ⌫
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {keys.map((key) => (
            <button key={key} className="rounded-lg border border-line py-2.5 text-[15px] font-medium hover:bg-surface-2" onClick={() => setNumber((n) => n + key)}>
              {key}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11.5px] text-muted">
          <span className="font-medium text-ink">Telephony is not connected.</span> Calls are not placed from this build. Attempts are logged
          with the blocked outcome so nothing is reported as a real call.
        </div>
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------- notification util */
export function useUnreadBadge() {
  const { unread } = useApp()
  return useMemo(() => (unread > 0 ? String(unread) : undefined), [unread])
}

export function EntityChip({ type, id, label }: { type: string; id?: string | null; label: string }) {
  const href = entityHref(type, id)
  return href ? (
    <Link to={href} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
      <Badge tone="accent">{type}</Badge> {label}
    </Link>
  ) : (
    <span className="text-[12px] text-muted">{label}</span>
  )
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-faint">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
    </div>
  )
}

export function StatusLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 text-[12.5px] last:border-0">
      <span className="text-muted">{label}</span>
      {value ? <StatusBadge value={value} /> : <span className="text-faint">—</span>}
    </div>
  )
}

export function ShellEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Card className="m-5">
      <div className="px-4 py-8 text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Plus size={18} />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted">{description}</p>
      </div>
    </Card>
  )
}

export function PersonChip({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} size={24} />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px]">{name}</span>
        {subtitle ? <span className="block truncate text-[10.5px] text-muted">{subtitle}</span> : null}
      </span>
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={role === 'owner' ? 'accent' : role === 'admin' ? 'info' : 'default'}>{titleCase(role)}</Badge>
}

export function MeAvatar({ user }: { user: Me }) {
  return <Avatar name={user.name} hue={user.avatar_hue} size={32} />
}

export function InitialsOnly({ name }: { name: string }) {
  return <span className="text-[11px] text-muted">{initials(name)}</span>
}

export { X }
