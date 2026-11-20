import { lazy, Suspense, useEffect } from 'react'
import { useApp } from './lib/app-context'
import { RouterProvider, matchPath, useNavigate, usePath } from './lib/router'
import { AppShell } from './components/shell'
import { Spinner, Toasts } from './components/ui'
import { LoginPage } from './pages/login'
import { SignupPage } from './pages/signup'
import { ForgotPasswordPage } from './pages/forgot-password'
import { HomePage } from './pages/home'
import { CompaniesPage, CompanyDetailPage, ContactDetailPage, ContactsPage, LeadDetailPage, LeadsPage, ListDetailPage, ListsPage } from './pages/crm'
import {
  CalendarPage,
  DealDetailPage,
  DealsPage,
  DocumentsPage,
  ProductsPage,
  SalesDashboardPage,
  TasksPage,
} from './pages/sales'
import {
  ActivitiesPage,
  AdsPage,
  CampaignDetailPage,
  CampaignWizardPage,
  CampaignsPage,
  ContentPage,
  FormBuilderPage,
  FormsPage,
  LandingPageEditorPage,
  LandingPagesPage,
  MarketingDashboardPage,
  SequenceDetailPage,
  SequencesPage,
  SocialPostsPage,
  WebAnalyticsPage,
  WhatsappPage,
} from './pages/marketing'
import { WorkflowRunsPage, WorkflowsPage } from './pages/automation'
import { InboxPage } from './pages/inbox'

// Lazy-load heavy visual builder canvases for lightning-fast initial load
const WorkflowBuilderRoute = lazy(() => import('./pages/workflow-builder').then((m) => ({ default: m.WorkflowBuilderRoute })))
const LandingPageGrapesEditor = lazy(() => import('./pages/landing-editor').then((m) => ({ default: m.LandingPageGrapesEditor })))
const EmailStudioPage = lazy(() => import('./pages/email-studio').then((m) => ({ default: m.EmailStudioPage })))
const EmailStudioEditor = lazy(() => import('./pages/email-studio').then((m) => ({ default: m.EmailStudioEditor })))
import {
  KnowledgeBasePage,
  LiveChatPage,
  SlaPoliciesPage,
  SupportAutomationsPage,
  SupportDashboardPage,
  TicketDetailPage,
  TicketsPage,
} from './pages/support'
import {
  AccountSettingsPage,
  AuditLogPage,
  ConnectedAppsPage,
  EmailAccountsPage,
  FinancialSettingsPage,
  IntegrationDetailPage,
  LanguageSettingsPage,
  ProfileSettingsPage,
  RolesPermissionsPage,
  ThemeGalleryPage,
} from './pages/settings'
import { FilesPage, NotFoundPage, PublicFormPage, PublicLandingPage, ReportsPage, TrashPage } from './pages/misc'
import { SitePage } from './pages/site'

// The landing-page gallery carries megabytes of template HTML; keep it out of the app shell.
const TemplateLibraryPage = lazy(() => import('./pages/templates').then((module) => ({ default: module.TemplateLibraryPage })))

const PUBLIC_PREFIXES = ['/f/', '/p/', '/login', '/signup', '/forgot-password', '/welcome']

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function App() {
  const { me, loading } = useApp()
  const path = usePath()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    // A bookmarked workspace URL must land on the sign-in screen, not the marketing page.
    if (!me && !isPublic(path) && path !== '/') navigate('/login', { replace: true })
    if (me && (path === '/login' || path === '/welcome')) navigate('/', { replace: true })
  }, [me, loading, path, navigate])

  if (isPublic(path)) {
    return (
      <>
        <PublicRoutes path={path} />
        <Toasts />
      </>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-white">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6c0 6 2 9 8 9V9c0-2 2-3 4-3h4" />
              <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <Spinner label="Opening your workspace" />
        </div>
      </div>
    )
  }

  if (!me) return <SitePage />

  return (
    <>
      <AppShell>
        <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><Spinner label="Loading workspace…" /></div>}>
          <WorkspaceRoutes path={path} />
        </Suspense>
      </AppShell>
      <Toasts />
    </>
  )
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [navigate, to])
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner />
    </div>
  )
}

function PublicRoutes({ path }: { path: string }) {
  if (path === '/login') return <LoginPage />
  if (path === '/signup') return <SignupPage />
  if (path === '/forgot-password') return <ForgotPasswordPage />
  if (path === '/welcome') return <SitePage />
  const form = matchPath('/f/:slug', path)
  if (form) return <PublicFormPage slug={form.slug} />
  const page = matchPath('/p/:slug', path)
  if (page) return <PublicLandingPage slug={page.slug} />
  return <NotFoundPage />
}

function WorkspaceRoutes({ path }: { path: string }) {
  const param = (pattern: string) => matchPath(pattern, path)

  // Short links people type or bookmark. They render the canonical page at its canonical URL.
  const alias: Record<string, string> = {
    '/deals': '/sales/deals',
    '/tasks': '/sales/tasks',
    '/apps': '/settings/apps',
    '/crm/contact-list': '/contacts',
    '/contact-list': '/contacts',
    '/leads-list': '/leads',
    '/crm/leads-list': '/leads',
    '/crm/leads': '/leads',
    '/crm/contacts': '/contacts',
  }
  if (alias[path]) {
    return <Redirect to={alias[path]} />
  }

  if (path === '/') return <HomePage />

  if (path === '/companies') return <CompaniesPage />
  const company = param('/companies/:id')
  if (company) return <CompanyDetailPage id={company.id} />

  if (path === '/leads') return <LeadsPage />
  const lead = param('/leads/:id')
  if (lead) return <LeadDetailPage id={lead.id} />

  if (path === '/contacts') return <ContactsPage />
  const contact = param('/contacts/:id')
  if (contact) return <ContactDetailPage id={contact.id} />

  if (path === '/lists' || path === '/marketing/lists') return <ListsPage />
  const list = param('/lists/:id')
  if (list) return <ListDetailPage id={list.id} />

  if (path === '/marketing') return <MarketingDashboardPage />
  if (path === '/marketing/forms') return <FormsPage />
  const formBuilder = param('/marketing/forms/:id')
  if (formBuilder) return <FormBuilderPage id={formBuilder.id} />
  if (path === '/marketing/landing-pages') return <LandingPagesPage />
  if (path === '/marketing/templates') {
    return (
      <Suspense fallback={<Spinner label="Loading template library" />}>
        <TemplateLibraryPage />
      </Suspense>
    )
  }
  const grapesEditor = param('/marketing/landing-pages/:id/edit')
  if (grapesEditor) return <LandingPageGrapesEditor id={grapesEditor.id} />
  const pageEditor = param('/marketing/landing-pages/:id')
  if (pageEditor) return <LandingPageEditorPage id={pageEditor.id} />
  if (path === '/marketing/emails') return <EmailStudioPage />
  const emailEditor = param('/marketing/emails/:id/edit')
  if (emailEditor) return <EmailStudioEditor id={emailEditor.id} key={emailEditor.id} />
  if (path === '/marketing/campaigns' || path === '/crm/campaign' || path === '/crm/campaigns') return <CampaignsPage />
  if (path === '/marketing/campaigns/new' || path === '/crm/campaigns/new') return <CampaignWizardPage />
  const campaignWizard = param('/marketing/campaigns/:id/wizard') || param('/crm/campaigns/:id/wizard')
  if (campaignWizard) return <CampaignWizardPage campaignId={campaignWizard.id} />
  const campaign = param('/marketing/campaigns/:id') || param('/crm/campaigns/:id')
  if (campaign) return <CampaignDetailPage id={campaign.id} />
  if (path === '/marketing/sequences') return <SequencesPage />
  const sequence = param('/marketing/sequences/:id')
  if (sequence) return <SequenceDetailPage id={sequence.id} />
  if (path === '/marketing/whatsapp') return <WhatsappPage />
  if (path === '/marketing/social') return <SocialPostsPage />
  if (path === '/marketing/ads') return <AdsPage />
  if (path === '/marketing/content') return <ContentPage />
  if (path === '/marketing/automations') return <WorkflowRunsPage />
  if (path === '/marketing/workflows') return <WorkflowsPage />
  const workflow = param('/marketing/workflows/:id')
  if (workflow) return <WorkflowBuilderRoute id={workflow.id} />
  if (path === '/marketing/analytics') return <WebAnalyticsPage />
  if (path === '/marketing/activities') return <ActivitiesPage />

  if (path === '/files') return <FilesPage />
  if (path === '/trash') return <TrashPage />

  if (path === '/sales') return <SalesDashboardPage />
  if (path === '/sales/deals') return <DealsPage />
  const deal = param('/sales/deals/:id')
  if (deal) return <DealDetailPage id={deal.id} />
  if (path === '/sales/tasks') return <TasksPage />
  if (path === '/sales/calendar') return <CalendarPage />
  if (path === '/sales/inbox') return <InboxPage />
  if (path === '/sales/automations') return <WorkflowRunsPage module="sales" />
  if (path === '/sales/proposals') return <DocumentsPage docType="proposal" />
  if (path === '/sales/quotes') return <DocumentsPage docType="quote" />
  if (path === '/sales/invoices') return <DocumentsPage docType="invoice" />
  if (path === '/sales/products') return <ProductsPage />

  if (path === '/support') return <SupportDashboardPage />
  if (path === '/support/tickets') return <TicketsPage />
  const ticket = param('/support/tickets/:id')
  if (ticket) return <TicketDetailPage id={ticket.id} />
  if (path === '/support/automations') return <SupportAutomationsPage />
  if (path === '/support/live-chat') return <LiveChatPage />
  if (path === '/support/kb') return <KnowledgeBasePage />
  if (path === '/support/activities') return <ActivitiesPage scope="support" />
  if (path === '/support/sla') return <SlaPoliciesPage />

  if (path === '/reports') return <ReportsPage />

  if (path === '/settings' || path === '/settings/themes') return <ThemeGalleryPage />
  if (path === '/settings/language') return <LanguageSettingsPage />
  if (path === '/settings/roles') return <RolesPermissionsPage />
  if (path === '/settings/users' || path === '/settings/account') return <AccountSettingsPage />
  if (path === '/settings/profile') return <ProfileSettingsPage />
  if (path === '/settings/financial') return <FinancialSettingsPage />
  if (path === '/settings/apps') return <ConnectedAppsPage />
  if (path.startsWith('/settings/apps/')) {
    const provider = path.replace('/settings/apps/', '')
    return <IntegrationDetailPage provider={provider === 'google' ? 'gmail' : provider} />
  }
  if (path === '/settings/integrations') return <ConnectedAppsPage />
  if (
    path === '/general-settings/email-accounts' ||
    path === '/general-settings' ||
    path === '/settings/email-accounts' ||
    path === '/settings/email' ||
    path === '/settings/mailboxes'
  ) {
    return <EmailAccountsPage />
  }
  if (path === '/settings/audit') return <AuditLogPage />

  return <NotFoundPage />
}

export function Root() {
  return (
    <RouterProvider>
      <App />
    </RouterProvider>
  )
}
