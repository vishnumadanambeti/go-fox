import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  Clock,
  BookOpen,
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
import { LANGUAGES } from '../lib/i18n'
import { Avatar, Badge, Card, Dropdown, IconButton, MenuItem, Modal, StatusBadge, cx } from './ui'
import { RecordFormDrawer } from './resource'

type NavItem = { label: string; to: string; icon: ReactNode; badge?: string }
type NavGroup = { title: string; expandable?: boolean; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    title: 'Core',
    expandable: false,
    items: [
      { label: 'Home', to: '/', icon: <Home size={16} /> },
      { label: 'Companies', to: '/companies', icon: <Building2 size={16} /> },
      { label: 'Leads', to: '/leads', icon: <Target size={16} /> },
      { label: 'Contacts', to: '/contacts', icon: <Users size={16} /> },
      { label: 'Lists', to: '/lists', icon: <List size={16} /> },
    ],
  },
  {
    title: 'Marketing',
    expandable: true,
    items: [
      { label: 'Dashboard', to: '/marketing', icon: <Gauge size={15} /> },
      { label: 'Forms', to: '/marketing/forms', icon: <Layers size={15} /> },
      { label: 'Landing Pages', to: '/marketing/landing-pages', icon: <LayoutDashboard size={15} /> },
      { label: 'Email Templates', to: '/marketing/emails', icon: <Mail size={15} /> },
      { label: 'Campaigns', to: '/marketing/campaigns', icon: <Megaphone size={15} /> },
      { label: 'Email Sequences', to: '/marketing/sequences', icon: <Send size={15} /> },
      { label: 'WhatsApp', to: '/marketing/whatsapp', icon: <MessageCircle size={15} /> },
      { label: 'Social Media Posts', to: '/marketing/social', icon: <Share2 size={15} /> },
      { label: 'Social Media Ads', to: '/marketing/ads', icon: <PieChart size={15} /> },
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
    expandable: true,
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
    expandable: true,
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
    expandable: true,
    items: [{ label: 'Reports', to: '/reports', icon: <PieChart size={15} /> }],
  },
  {
    title: 'Settings',
    expandable: true,
    items: [
      { label: 'Theme Gallery', to: '/settings/themes', icon: <Sparkles size={15} /> },
      { label: 'Language & Region', to: '/settings/language', icon: <Globe size={15} /> },
      { label: 'Roles & Permissions', to: '/settings/roles', icon: <ShieldCheck size={15} /> },
      { label: 'Account & Users', to: '/settings/account', icon: <UserCog size={15} /> },
      { label: 'Profile Settings', to: '/settings/profile', icon: <CircleUser size={15} /> },
      { label: 'Email accounts', to: '/general-settings/email-accounts', icon: <Mail size={15} /> },
      { label: 'Financial', to: '/settings/financial', icon: <Wallet size={15} /> },
      { label: 'Connected Apps', to: '/settings/apps', icon: <Plug size={15} /> },
      { label: 'Audit Log', to: '/settings/audit', icon: <Activity size={15} /> },
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    Marketing: path.startsWith('/marketing') || path === '/files' || path === '/trash',
    Sales: path.startsWith('/sales'),
    Support: path.startsWith('/support'),
    Reports: path.startsWith('/reports'),
    Settings: path.startsWith('/settings') || path.startsWith('/general-settings'),
  }))

  useEffect(() => {
    if (path.startsWith('/marketing') || path === '/files' || path === '/trash') {
      setExpanded((prev) => ({ ...prev, Marketing: true }))
    } else if (path.startsWith('/sales')) {
      setExpanded((prev) => ({ ...prev, Sales: true }))
    } else if (path.startsWith('/support')) {
      setExpanded((prev) => ({ ...prev, Support: true }))
    } else if (path.startsWith('/reports')) {
      setExpanded((prev) => ({ ...prev, Reports: true }))
    } else if (path.startsWith('/settings') || path.startsWith('/general-settings')) {
      setExpanded((prev) => ({ ...prev, Settings: true }))
    }
  }, [path])

  const toggleGroup = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const item = (navItem: NavItem) => {
    const active = navItem.to === '/' ? path === '/' : path.startsWith(navItem.to)
    return (
      <Link
        key={navItem.to}
        to={navItem.to}
        className={cx(
          'gx-nav-item flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
          active
            ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15 dark:text-accent shadow-xs'
            : 'text-muted hover:bg-surface-2 hover:text-ink',
        )}
        title={collapsed ? navItem.label : undefined}
        aria-label={navItem.label}
      >
        <span className={cx('shrink-0', active ? 'text-accent' : 'text-faint')}>{navItem.icon}</span>
        {!collapsed ? <span className="truncate">{navItem.label}</span> : null}
      </Link>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface border-r border-line text-ink">
      {/* Brand Header */}
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-line px-3.5">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
              <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {!collapsed ? (
            <span className="flex items-center gap-1 font-bold text-[19px] tracking-tight text-ink">
              <span>go</span>
              <span className="text-accent">fox</span>
            </span>
          ) : null}
        </Link>
        <button
          className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-ink transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="min-h-0 flex-1 overflow-y-auto gx-scroll px-2 py-3 space-y-1">
        {NAV.map((group) => {
          if (!group.expandable) {
            return (
              <div key={group.title} className="space-y-0.5">
                {group.items.map(item)}
              </div>
            )
          }

          const isGroupOpen = expanded[group.title]
          const filteredItems = group.items

          const isGroupActive = group.items.some((i) => (i.to === '/' ? path === '/' : path.startsWith(i.to)))

          return (
            <div key={group.title} className="pt-0.5">
              {!collapsed ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className={cx(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                      isGroupActive ? 'text-accent font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className={cx(isGroupActive ? 'text-accent' : 'text-faint')}>
                        {group.title === 'Marketing' && <Megaphone size={16} />}
                        {group.title === 'Sales' && <Handshake size={16} />}
                        {group.title === 'Support' && <Headphones size={16} />}
                        {group.title === 'Reports' && <PieChart size={16} />}
                        {group.title === 'Settings' && <Settings size={16} />}
                      </span>
                      <span>{group.title}</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={cx('text-faint transition-transform duration-150', !isGroupOpen && '-rotate-90')}
                    />
                  </button>
                  {isGroupOpen ? (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-1.5">
                      {filteredItems.map(item)}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-0.5 border-t border-line pt-1 mt-1">
                  {filteredItems.map(item)}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="shrink-0 border-t border-line p-2.5">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 border border-line">
            <Avatar name={me?.name} hue={me?.avatar_hue} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-ink">{me?.name}</div>
              <div className="truncate text-[10.5px] capitalize text-muted">{me?.role} · {me?.org_name}</div>
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
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { me, dark, toggleTheme, notifications, unread, markRead, logout, toast, locale, updateLocale } = useApp()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [dialOpen, setDialOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [referOpen, setReferOpen] = useState(false)
  const [quickEntity, setQuickEntity] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const handler = () => setDialOpen(true)
    window.addEventListener('gofox:dial', handler)
    return () => window.removeEventListener('gofox:dial', handler)
  }, [])

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
      <header className="sticky top-0 z-30 flex h-[58px] shrink-0 items-center gap-2 border-b border-line bg-surface px-3 backdrop-blur-md sm:px-4">
        <IconButton label="Open navigation" className="md:hidden" onClick={onMenu}>
          <Menu size={17} />
        </IconButton>

        {/* Global Search Bar matching competitor reference */}
        <button
          className="group flex h-9 flex-1 items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 text-left text-[12.5px] text-muted transition hover:border-[#ff7417] hover:bg-surface md:max-w-[420px]"
          onClick={() => setSearchOpen(true)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search size={14} className="text-[#98a2b3] group-hover:text-[#ff7417]" />
            <span className="truncate text-[#667085]">Search name, email, phone, company…</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="gx-kbd text-[10px] text-[#667085]">⌘ +</span>
          </div>
        </button>

        {/* Quick Create Button matching competitor reference */}
        <Dropdown
          align="left"
          trigger={({ toggle }) => (
            <button
              onClick={toggle}
              className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-[#475467] hover:border-[#ff7417] hover:text-[#ff7417] transition-colors"
              title="Quick create"
              aria-label="Quick create"
            >
              <Plus size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="w-[200px] py-1">
              <div className="px-3 py-1 text-[11px] font-semibold text-[#98a2b3] uppercase tracking-wider">Quick Create</div>
              <MenuItem
                onClick={() => {
                  close()
                  setQuickEntity('contacts')
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Contacts</span>
                  <Plus size={13} className="text-[#ff7417]" />
                </div>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close()
                  setQuickEntity('deals')
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Pipeline</span>
                  <Plus size={13} className="text-[#ff7417]" />
                </div>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close()
                  setQuickEntity('tasks')
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Activities</span>
                  <Plus size={13} className="text-[#ff7417]" />
                </div>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close()
                  navigate('/reports')
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Reports</span>
                  <ChevronRight size={13} className="text-[#98a2b3]" />
                </div>
              </MenuItem>
            </div>
          )}
        </Dropdown>

        {/* Right Toolbar Action Icons */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Dial Pad Button */}
          <button
            onClick={() => setDialOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-lg bg-[#f4f3ff] text-[#7f56d9] hover:bg-[#ebe9fe] border border-[#e9d7fe] transition-colors"
            title="Dial Pad"
            aria-label="Dial Pad"
          >
            <Phone size={15} />
          </button>

          {/* AI Assistant Button */}
          <button
            onClick={() => setAiOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-lg bg-[#f4f3ff] text-[#7f56d9] hover:bg-[#ebe9fe] border border-[#e9d7fe] transition-colors"
            title="GoFox Assistant"
            aria-label="GoFox Assistant"
          >
            <Sparkles size={15} />
          </button>

          {/* Full Screen */}
          <IconButton
            label="Full screen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void document.documentElement.requestFullscreen?.()
            }}
          >
            <Maximize2 size={15} />
          </IconButton>

          {/* Theme Toggle */}
          <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => void toggleTheme()}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>

          {/* Language Selector */}
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <IconButton label="Language" onClick={toggle}>
                <Globe size={15} />
              </IconButton>
            )}
          >
            {(close) => (
              <div className="p-2 w-52">
                <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Language & Region</div>
                <div className="space-y-0.5 max-h-60 overflow-y-auto gx-scroll">
                  {LANGUAGES.map((lang) => {
                    const isSelected = (locale ?? me?.locale ?? 'en') === lang.code
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        className={cx(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] text-left transition',
                          isSelected ? 'bg-accent-soft text-accent font-semibold' : 'text-ink hover:bg-surface-2',
                        )}
                        onClick={async () => {
                          updateLocale(lang.code)
                          toast(`Language set to ${lang.name}.`, 'good')
                          close()
                          patch('/api/auth/profile', { locale: lang.code }).catch(() => undefined)
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        {isSelected ? <span className="size-2 rounded-full bg-accent" /> : <span className="text-[10.5px] text-muted">{lang.nativeName}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </Dropdown>

          {/* Help Button */}
          <IconButton label="Help" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={15} />
          </IconButton>

          {/* Notification Bell */}
          <div className="relative">
            <IconButton label={`Notifications (${unread} unread)`} onClick={() => setNotifOpen((v) => !v)}>
              <Bell size={15} />
              {unread > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-[#ff7417] text-[9px] font-bold text-white shadow-sm">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </IconButton>
            {notifOpen ? (
              <>
                <div className="fixed inset-0 z-[49]" onClick={() => setNotifOpen(false)} />
                <div className="gx-card absolute right-0 z-50 mt-1.5 w-[340px] overflow-hidden p-0 shadow-[var(--shadow-pop)] border border-line bg-surface">
                  <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5 bg-surface-2">
                    <span className="text-[13px] font-semibold text-ink">Notifications</span>
                    <button className="text-[11px] font-medium text-[#ff7417] hover:underline" onClick={() => void markRead()}>
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
                          className={cx(
                            'flex w-full gap-2.5 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-surface-2 transition-colors',
                            !item.read_at && 'bg-[#fff9f5]',
                          )}
                          onClick={async () => {
                            await markRead(item.id)
                            setNotifOpen(false)
                            const href = entityHref(item.entity_type, item.entity_id)
                            if (href) navigate(href)
                          }}
                        >
                          <span className={cx('mt-1 size-1.5 shrink-0 rounded-full', item.read_at ? 'bg-transparent' : 'bg-[#ff7417]')} />
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-ink">{item.title}</span>
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{item.body}</span>
                            <span className="mt-0.5 block text-[10.5px] text-faint">{timeAgo(item.created_at)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-line p-2 bg-surface">
                    <button
                      className="w-full rounded-lg bg-[#ff7417] py-2 text-center text-[12px] font-medium text-white hover:bg-[#e7680c] transition-colors"
                      onClick={() => {
                        setNotifOpen(false)
                        navigate('/marketing/activities')
                      }}
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* User Profile Avatar Popover matching Page 6 top */}
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                className="ml-1 flex size-8 items-center justify-center rounded-full bg-[#ff7417] text-white font-semibold text-[13px] shadow-sm hover:opacity-90 transition-opacity"
                onClick={toggle}
                aria-label="Profile menu"
              >
                {(me?.name ?? 'V').charAt(0).toUpperCase()}
              </button>
            )}
          >
            {(close) => (
              <div className="w-56 py-1">
                <div className="border-b border-line px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#ff7417] text-white font-bold text-[14px]">
                      {(me?.name ?? 'V').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ink">{me?.name}</div>
                      <div className="truncate text-[11px] text-muted">{me?.email}</div>
                      <div className="mt-1">
                        <span className="inline-block rounded bg-[#e0f2fe] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0369a1]">
                          {me?.role ?? 'Admin'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-1">
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/settings/account')
                    }}
                  >
                    <Settings size={14} className="text-[#667085]" /> Settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      setReferOpen(true)
                    }}
                  >
                    <Star size={14} className="text-[#667085]" /> Refer & Earn
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/')
                    }}
                  >
                    <Target size={14} className="text-[#667085]" /> Get Started
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      navigate('/support/kb')
                    }}
                  >
                    <BookOpen size={14} className="text-[#667085]" /> Knowledge Base
                  </MenuItem>
                  <div className="my-1 border-t border-line" />
                  <MenuItem
                    tone="danger"
                    onClick={() => {
                      close()
                      void logout()
                    }}
                  >
                    <LogOut size={14} /> Sign Out
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
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} onQuickDeal={() => setQuickEntity('deals')} />
      <DialPad open={dialOpen} onClose={() => setDialOpen(false)} />

      {/* Refer & Earn Modal */}
      <Modal open={referOpen} onClose={() => setReferOpen(false)} title="Refer & Earn">
        <div className="space-y-3 text-[13px]">
          <p className="text-muted">
            Share GoFox with your network. When a new customer subscribes using your referral link, you receive a 20% ongoing partner commission.
          </p>
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <div className="text-[11px] font-semibold text-[#98a2b3] uppercase tracking-wider mb-1">Your Referral Link</div>
            <div className="flex items-center justify-between gap-2 bg-surface p-2 rounded border border-line text-[12px] font-mono select-all">
              <span>https://gofox.io/ref/{me?.id ?? 'partner'}</span>
              <button
                className="text-[#ff7417] text-[11px] font-medium hover:underline shrink-0"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://gofox.io/ref/${me?.id ?? 'partner'}`)
                  toast('Referral link copied to clipboard.', 'good')
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help and shortcuts">
        <div className="space-y-3 text-[13px]">
          <p className="text-muted">
            GoFox CRM stores everything in your workspace database. Lists, drawers, detail pages, and automations all operate through the authenticated tenant API.
          </p>
          <div>
            <div className="mb-1 text-[12px] font-semibold text-ink">Keyboard Shortcuts</div>
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
            <div className="mb-1 text-[12px] font-semibold text-ink">Integrations & Connections</div>
            <p className="text-[12.5px] text-muted">
              Configure your mailboxes, Meta Ads, WhatsApp, payment gateways, and social channels under Settings &gt; Connected Apps.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------ global search & command palette */
function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState<'all' | 'crm' | 'sales' | 'marketing' | 'support'>('all')
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
      setCategory('all')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 180)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data, loading } = useFetch<{ groups: { type: string; href: string; items: Row[] }[] }>(
    open && debounced.length >= 2 ? `/api/search${query({ q: debounced })}` : null,
  )

  const rawGroups = data?.groups ?? []

  const filteredGroups = useMemo(() => {
    if (category === 'all') return rawGroups
    if (category === 'crm') return rawGroups.filter((g) => ['companies', 'contacts', 'leads'].includes(g.type))
    if (category === 'sales') return rawGroups.filter((g) => ['deals', 'tasks', 'documents'].includes(g.type))
    if (category === 'marketing') return rawGroups.filter((g) => ['campaigns', 'workflows', 'emails'].includes(g.type))
    if (category === 'support') return rawGroups.filter((g) => ['tickets'].includes(g.type))
    return rawGroups
  }, [rawGroups, category])

  const flatResults = useMemo(() => filteredGroups.flatMap((g) => g.items.map((item) => ({ group: g, item }))), [filteredGroups])

  useEffect(() => {
    setActiveIndex(0)
  }, [debounced, category])

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

  const clearRecent = () => {
    setRecent([])
    try {
      localStorage.removeItem('gofox.recentSearches')
    } catch {
      /* ignore */
    }
  }

  const openResult = (group: { type: string; href: string; items: Row[] }, item: Row) => {
    saveRecent(debounced || term)
    onClose()
    const listOnly = ['activities', 'documents'].includes(group.type)
    navigate(listOnly ? group.href : `${group.href}/${item.id}`)
  }

  const QUICK_COMMANDS = [
    { label: 'Create New Lead', path: '/leads', icon: Target, category: 'Sales' },
    { label: 'Create New Contact', path: '/contacts', icon: Users, category: 'CRM' },
    { label: 'Create New Deal', path: '/sales/deals', icon: Handshake, category: 'Sales' },
    { label: 'Build Email Campaign', path: '/marketing/campaigns/new', icon: Megaphone, category: 'Marketing' },
    { label: 'Create Visual Workflow', path: '/marketing/workflows', icon: Workflow, category: 'Automations' },
    { label: 'Theme Gallery & Appearance', path: '/settings/themes', icon: Sparkles, category: 'Personalization' },
    { label: 'Language & Regional Settings', path: '/settings/language', icon: Globe, category: 'Personalization' },
  ]

  if (!open) return null
  return (
    <div className="gx-scrim" onClick={onClose}>
      <div
        className="gx-card mx-auto mt-[7vh] w-[min(650px,calc(100vw-28px))] overflow-hidden p-0 shadow-[var(--shadow-pop)] border border-line bg-surface"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search and command palette"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 bg-surface">
          <Search size={17} className="text-accent shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-faint font-medium text-ink"
            placeholder="Search contacts, deals, campaigns, workflows, settings..."
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
          <button className="gx-kbd text-[10.5px]" onClick={onClose}>
            Esc
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-3 py-1.5 overflow-x-auto gx-scroll">
          {(
            [
              ['all', 'All Categories'],
              ['crm', 'CRM & Contacts'],
              ['sales', 'Deals & Tasks'],
              ['marketing', 'Marketing & Flows'],
              ['support', 'Support Tickets'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setCategory(val)}
              className={cx(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition shrink-0',
                category === val
                  ? 'bg-surface text-accent shadow-xs'
                  : 'text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Results / Suggestions Area */}
        <div className="max-h-[55vh] overflow-y-auto gx-scroll p-2.5">
          {debounced.length < 2 ? (
            <div>
              {/* Quick Navigation Commands */}
              <div className="mb-3">
                <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-faint">
                  Quick Actions & Navigation
                </div>
                <div className="grid gap-1 sm:grid-cols-2 mt-1">
                  {QUICK_COMMANDS.map((cmd) => {
                    const Icon = cmd.icon
                    return (
                      <button
                        key={cmd.label}
                        onClick={() => {
                          onClose()
                          navigate(cmd.path)
                        }}
                        className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface p-2 text-left hover:border-accent/40 hover:bg-surface-2 transition group"
                      >
                        <span className="flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent group-hover:scale-105 transition">
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-bold text-ink truncate group-hover:text-accent transition">
                            {cmd.label}
                          </div>
                          <div className="text-[10px] text-muted">{cmd.category}</div>
                        </div>
                        <ChevronRight size={12} className="text-faint group-hover:text-accent transition" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {recent.length > 0 ? (
                <div className="pt-2 border-t border-line/60">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Recent searches</span>
                    <button onClick={clearRecent} className="text-[10.5px] text-muted hover:text-danger">
                      Clear history
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1 px-1">
                    {recent.map((r) => (
                      <button
                        key={r}
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted hover:border-accent hover:text-accent transition"
                        onClick={() => setTerm(r)}
                      >
                        <Clock size={11} className="text-faint" />
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-[12.5px] text-muted">
              <span className="animate-pulse">Searching enterprise CRM database…</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-muted">
              No matching records found for "{debounced}". Try searching by full name, domain or deal ID.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.type} className="mb-2">
                <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-faint flex items-center justify-between">
                  <span>{group.type}</span>
                  <span className="text-[9.5px] font-normal font-mono">{group.items.length} records</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const flatIdx = flatResults.findIndex((r) => r.group === group && r.item.id === item.id)
                    const active = flatIdx === activeIndex
                    return (
                      <button
                        key={item.id}
                        className={cx(
                          'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition',
                          active
                            ? 'bg-accent-soft text-accent ring-1 ring-accent/30'
                            : 'hover:bg-surface-2 text-ink',
                        )}
                        onClick={() => openResult(group, item)}
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                          <span className="block truncate text-[11px] text-muted">{item.sub}</span>
                        </div>
                        <ChevronRight size={13} className={active ? 'text-accent' : 'text-faint'} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Keyboard Footer */}
        <div className="border-t border-line px-3.5 py-2 text-[10.5px] text-faint flex items-center justify-between bg-surface-2">
          <span>↑↓ to navigate · Enter to select · Esc to dismiss</span>
          <span>GoFox Global Engine</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ AI panel */
function AIPanel({ open, onClose, onQuickDeal }: { open: boolean; onClose: () => void; onQuickDeal?: () => void }) {
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

  if (!open) return null

  return (
    <>
      <div className="gx-scrim" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[61] flex w-[min(460px,100vw)] flex-col bg-surface shadow-[var(--shadow-pop)] border-l border-line animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-line px-4 bg-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#ff7417] text-white">
              <Sparkles size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink leading-tight">GoFox Assistant</div>
              <div className="truncate text-[11px] text-[#667085]">Ready to help with CRM data, how-tos, and tickets</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-[#667085] hover:bg-surface-2 hover:text-ink"
            aria-label="Close assistant"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto gx-scroll p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#fff4eb] text-[#ff7417] mb-3 shadow-sm">
                <Sparkles size={26} />
              </div>
              <h3 className="text-[16px] font-semibold text-ink mb-1">How can I help you today?</h3>
              <p className="max-w-xs text-[12px] text-[#667085] leading-relaxed mb-6">
                Ask how-tos with in-app steps, or look up live CRM and marketing data — deals, contacts, tickets, lists, landing pages, and more.
              </p>

              {/* Competitor Chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                <button
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-[#344054] hover:border-[#ff7417] hover:text-[#ff7417] transition-colors shadow-sm"
                  onClick={() => {
                    onClose()
                    navigate('/marketing/social')
                  }}
                >
                  Social posting
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-[#344054] hover:border-[#ff7417] hover:text-[#ff7417] transition-colors shadow-sm"
                  onClick={() => {
                    onClose()
                    navigate('/lists')
                  }}
                >
                  Show lists
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-[#ff7417] border-[#ff7417]/40 bg-[#fff4eb]/50 hover:bg-[#fff4eb] transition-colors shadow-sm"
                  onClick={() => {
                    onClose()
                    onQuickDeal?.()
                  }}
                >
                  + Create a deal
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-[#344054] hover:border-[#ff7417] hover:text-[#ff7417] transition-colors shadow-sm"
                  onClick={() => {
                    onClose()
                    navigate('/marketing/landing-pages')
                  }}
                >
                  Landing pages
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-[#344054] hover:border-[#ff7417] hover:text-[#ff7417] transition-colors shadow-sm"
                  onClick={() => {
                    onClose()
                    navigate('/support/tickets')
                  }}
                >
                  Open tickets
                </button>
              </div>
            </div>
          ) : null}

          {messages.map((item, index) => (
            <div key={index} className={cx('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cx(
                  'max-w-[88%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm',
                  item.role === 'user' ? 'bg-[#ff7417] text-white' : 'border border-line bg-surface-2 text-ink',
                )}
              >
                {item.body}
                {item.sources?.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line/60 pt-2">
                    {item.sources.map((source) => (
                      <button
                        key={source.href}
                        className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-[#ff7417] hover:border-[#ff7417]"
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
          {busy ? (
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="size-2 rounded-full bg-[#ff7417] animate-ping" />
              <span>Analyzing CRM records…</span>
            </div>
          ) : null}
        </div>

        {/* Input Bar */}
        <div className="border-t border-line p-3 bg-surface">
          <div className="relative rounded-xl border border-line bg-surface-2 p-1.5 focus-within:border-[#ff7417] focus-within:ring-2 focus-within:ring-[#ff7417]/10 transition-all">
            <textarea
              className="w-full bg-transparent px-2.5 py-1.5 text-[13px] text-ink outline-none resize-none placeholder:text-[#98a2b3]"
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about deals, tickets, contacts, or how-tos…"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex items-center justify-between px-2 pt-1 border-t border-line/40 text-[11px] text-[#98a2b3]">
              <span>Enter to send · Shift+Enter for a new line</span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!message.trim() || busy}
                className="flex size-7 items-center justify-center rounded-full bg-[#ff7417] text-white hover:bg-[#e7680c] disabled:opacity-40 transition-colors"
                aria-label="Send message"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ dial pad */
function DialPad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [called, setCalled] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setCalled(false)
    }
  }, [open])

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.number) {
        setNumber(e.detail.number)
      }
    }
    window.addEventListener('gofox:dial', handler)
    return () => window.removeEventListener('gofox:dial', handler)
  }, [])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
  const call = async () => {
    setBusy(true)
    setError(null)
    try {
      await post('/api/telephony/dial', { number })
      setCalled(true)
    } catch (err: any) {
      setError(err?.message ?? 'The call could not be placed.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="gx-scrim" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[95] flex w-[320px] flex-col bg-surface shadow-[var(--shadow-pop)] border-l border-line animate-in slide-in-from-right duration-200">
        {/* Header matching Page 3 top */}
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4 bg-surface">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#667085]">DIAL PAD</span>
          <button
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-[#667085] hover:bg-surface-2 hover:text-ink"
            aria-label="Close dial pad"
          >
            <X size={15} />
          </button>
        </div>

        {/* Dial Pad Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <div className="text-[11px] font-semibold text-[#667085] mb-1">Type or paste number</div>
            <div className="flex items-center justify-between gap-1">
              <input
                className="w-full bg-transparent text-[16px] font-mono tracking-wider text-ink outline-none placeholder:text-[#98a2b3]"
                value={number}
                onChange={(event) => setNumber(event.target.value.replace(/[^\d+*#]/g, ''))}
                placeholder="Paste or dial, then Call"
                aria-label="Phone number"
              />
              {number ? (
                <button
                  type="button"
                  className="text-[13px] text-[#667085] hover:text-ink p-1"
                  onClick={() => setNumber((n) => n.slice(0, -1))}
                  title="Backspace"
                >
                  ⌫
                </button>
              ) : null}
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                className="flex h-12 items-center justify-center rounded-lg border border-line bg-surface text-[18px] font-medium text-ink hover:bg-surface-2 hover:border-[#d0d5dd] transition-colors shadow-sm"
                onClick={() => setNumber((n) => n + key)}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call Button */}
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#12b76a] text-white font-semibold text-[14px] hover:bg-[#039855] disabled:opacity-50 transition-colors shadow-sm"
            onClick={() => void call()}
            disabled={busy || number.replace(/\D/g, '').length < 3}
          >
            <Phone size={16} />
            <span>{busy ? 'Calling…' : 'Call'}</span>
          </button>

          {called ? (
            <div className="rounded-xl border border-[#a6f4c5] bg-[#edfcf2] p-3 text-[12px] text-[#037847] space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[12.5px]">Call connected</span>
                <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-bold text-rose-600 border border-rose-500/20">
                  <span className="size-1.5 rounded-full bg-rose-600 animate-ping" />
                  REC ACTIVE
                </span>
              </div>
              <div className="text-[11px] text-[#025a35] leading-relaxed">
                Twilio dual-channel audio recording is active. All attempt logs and audio recordings are saved to your CRM timeline.
              </div>
            </div>
          ) : null}

          {error ? <div className="rounded-lg border border-[#fecdca] bg-[#fef3f2] p-2.5 text-[12px] text-[#b42318]">{error}</div> : null}

          <div className="rounded-lg border border-line bg-surface-2 p-2.5 text-[11px] text-[#667085] leading-relaxed">
            Calls use your configured workspace telephony (Twilio). All attempts are recorded and saved to your contact timeline.
          </div>
        </div>
      </div>
    </>
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
