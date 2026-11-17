import type { Env } from './db'
import { addDays, addMinutes, insertMany, mulberry32, nowIso, uid } from './db'

const PASSWORD = 'gofox1234'

async function hash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(bytes = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Seeds one complete demo tenant. Every figure on the dashboards is derived
 * from these rows, so nothing is hardcoded in the UI.
 */
export async function seed(env: Env) {
  const rand = mulberry32(20261111)
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)]
  const chance = (p: number) => rand() < p
  const now = new Date()
  const iso = (d: Date) => d.toISOString()

  const orgId = uid()
  const salt = randomHex(16)
  const passwordHash = await hash(PASSWORD, salt)

  await insertMany(env, 'orgs', [
    {
      id: orgId,
      name: 'Northwind Trading',
      slug: 'northwind',
      currency: 'USD',
      currencies: 'USD,EUR,GBP,INR,AED',
      timezone: 'Asia/Calcutta',
      locale: 'en',
      website: 'https://northwind.example.com',
      phone: '+1 415 555 0100',
      address: '1200 Market Street',
      city: 'San Francisco',
      country: 'United States',
      tax_id: 'US-88-1234567',
      logo_url: null,
      letterhead: 'Northwind Trading · 1200 Market Street, San Francisco · northwind.example.com',
      created_at: iso(addDays(now, -240)),
    },
  ])

  const users = [
    { name: 'Ava Reed', email: 'owner@gofox.dev', role: 'owner', title: 'Founder & CEO', hue: 22 },
    { name: 'Marcus Webb', email: 'admin@gofox.dev', role: 'admin', title: 'Operations Lead', hue: 205 },
    { name: 'Priya Nair', email: 'manager@gofox.dev', role: 'manager', title: 'Sales Manager', hue: 325 },
    { name: 'Leo Fischer', email: 'sales@gofox.dev', role: 'sales', title: 'Account Executive', hue: 150 },
    { name: 'Sofia Marin', email: 'marketer@gofox.dev', role: 'marketer', title: 'Marketing Lead', hue: 265 },
    { name: 'Noah Adeyemi', email: 'support@gofox.dev', role: 'support', title: 'Support Agent', hue: 45 },
  ]
  const userIds: Record<string, string> = {}
  await insertMany(
    env,
    'users',
    users.map((u) => {
      const id = uid()
      userIds[u.role] = id
      return {
        id,
        org_id: orgId,
        email: u.email,
        name: u.name,
        password_hash: passwordHash,
        salt,
        role: u.role,
        title: u.title,
        phone: '+1 415 555 01' + String(10 + Object.keys(userIds).length),
        avatar_hue: u.hue,
        status: 'active',
        theme: 'light',
        locale: 'en',
        timezone: 'Asia/Calcutta',
        last_login: iso(addMinutes(now, -Math.floor(rand() * 600))),
        created_at: iso(addDays(now, -230)),
      }
    }),
  )
  const owner = userIds.owner
  const salesReps = [userIds.sales, userIds.manager, userIds.owner]
  const allReps = [...salesReps, userIds.marketer, userIds.support]

  // ---------------------------------------------------------------- companies
  const companySeed = [
    ['Halcyon Logistics', 'halcyonlogistics.com', 'Logistics', 'San Francisco', 'United States'],
    ['Vertex Manufacturing', 'vertexmfg.com', 'Manufacturing', 'Detroit', 'United States'],
    ['Lumen Health', 'lumenhealth.io', 'Healthcare', 'Boston', 'United States'],
    ['Meridian Finance', 'meridianfinance.com', 'Financial Services', 'New York', 'United States'],
    ['Orbital Robotics', 'orbitalrobotics.ai', 'Robotics', 'Austin', 'United States'],
    ['Quill Media', 'quillmedia.co', 'Media', 'London', 'United Kingdom'],
    ['Fathom Analytics', 'fathomanalytics.com', 'Software', 'Toronto', 'Canada'],
    ['Ember Foods', 'emberfoods.com', 'Food & Beverage', 'Portland', 'United States'],
    ['Atlas Construction', 'atlasbuild.com', 'Construction', 'Denver', 'United States'],
    ['Cobalt Energy', 'cobaltenergy.com', 'Energy', 'Houston', 'United States'],
    ['Juniper Retail', 'juniperretail.com', 'Retail', 'Seattle', 'United States'],
    ['Solstice Travel', 'solsticetravel.com', 'Travel', 'Barcelona', 'Spain'],
  ]
  const companyIds: string[] = []
  await insertMany(
    env,
    'companies',
    companySeed.map(([name, domain, industry, city, country], i) => {
      const id = uid()
      companyIds.push(id)
      return {
        id,
        org_id: orgId,
        name,
        domain,
        industry,
        phone: '+1 415 555 02' + String(10 + i),
        email: `hello@${domain}`,
        address: `${100 + i * 7} ${pick(['Market', 'Mission', 'Howard', 'Bryant'])} Street`,
        city,
        state: null,
        postal_code: String(90000 + i * 13),
        country,
        owner_id: allReps[i % allReps.length],
        description: `${name} is an established ${industry.toLowerCase()} organisation evaluating GoFox for its revenue and support teams.`,
        tags: ['customer', industry.toLowerCase()].join(','),
        status: i === 10 ? 'prospect' : 'active',
        created_at: iso(addDays(now, -180 + i * 6)),
        updated_at: iso(addDays(now, -Math.floor(rand() * 30))),
      }
    }),
  )

  // ----------------------------------------------------------------- contacts
  const firstNames = ['Elena', 'Ravi', 'Grace', 'Tomas', 'Nadia', 'Owen', 'Hana', 'Felix', 'Imani', 'Marco', 'Yuki', 'Amara', 'Dmitri', 'Clara', 'Idris', 'Rosa', 'Kai', 'Leila']
  const lastNames = ['Petrov', 'Menon', 'Okafor', 'Lindqvist', 'Haddad', 'Bryant', 'Sato', 'Bauer', 'Walker', 'Ferreira', 'Tanaka', 'Bello', 'Volkov', 'Moreau', 'Khan', 'Silva', 'Nakamura', 'Aziz']
  const titles = ['Head of Operations', 'VP Sales', 'Procurement Lead', 'Marketing Director', 'CTO', 'Finance Manager', 'Customer Success Lead', 'COO']
  const contactRows: Record<string, unknown>[] = []
  const contactIds: string[] = []
  for (let i = 0; i < 38; i++) {
    const first = firstNames[i % firstNames.length]
    const last = lastNames[(i * 5) % lastNames.length]
    const id = uid()
    contactIds.push(id)
    const company = companyIds[i % companyIds.length]
    const domain = companySeed[i % companySeed.length][1] as string
    contactRows.push({
      id,
      org_id: orgId,
      first_name: first,
      last_name: last,
      designation: pick(titles),
      company_id: company,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
      email_opt_out: chance(0.12) ? 1 : 0,
      phone: `+1 415 555 ${String(1000 + i)}`,
      tags: pick(['decision-maker', 'champion', 'evaluator', ''],
        ) || '',
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      linkedin: `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}`,
      twitter: null,
      owner_id: allReps[i % allReps.length],
      source: pick(['Website form', 'Referral', 'Outbound', 'Webinar', 'Lead conversion']),
      score: 40 + Math.floor(rand() * 60),
      description: null,
      status: 'active',
      created_at: iso(addDays(now, -160 + i * 4)),
      updated_at: iso(addDays(now, -Math.floor(rand() * 20))),
    })
  }
  await insertMany(env, 'contacts', contactRows)

  // -------------------------------------------------------------------- leads
  const sources = ['Website form', 'Outbound', 'Referral', 'Webinar', 'LinkedIn', 'Google Ads']
  const leadRows: Record<string, unknown>[] = []
  for (let i = 0; i < 26; i++) {
    const first = firstNames[(i * 3) % firstNames.length]
    const last = lastNames[(i * 7) % lastNames.length]
    const status = i < 9 ? 'new' : i < 15 ? 'contacted' : i < 20 ? 'qualified' : i < 23 ? 'unqualified' : 'converted'
    leadRows.push({
      id: uid(),
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${pick(['gmail.com', 'outlook.com', 'proton.me', 'acme.io'])}`,
      phone: `+1 628 555 ${String(2000 + i)}`,
      company_name: pick(['Brightline Labs', 'Cedar Works', 'Nimbus Data', 'Harbor Freight Co', 'Redwood Studio', 'Pioneer Systems']),
      job_title: pick(titles),
      source: pick(sources),
      status,
      owner_id: allReps[i % allReps.length],
      score: 20 + Math.floor(rand() * 70),
      priority: pick(['low', 'medium', 'high']),
      address: null,
      website: null,
      description: 'Inbound enquiry captured from the pricing page.',
      tags: pick(['hot', 'nurture', '']),
      opt_out: chance(0.1) ? 1 : 0,
      created_at: iso(addDays(now, -60 + i * 2)),
      updated_at: iso(addDays(now, -Math.floor(rand() * 10))),
      ...(status === 'converted'
        ? {
            converted_contact_id: contactIds[i % contactIds.length],
            converted_at: iso(addDays(now, -Math.floor(rand() * 20))),
          }
        : {}),
    })
  }
  await insertMany(env, 'leads', leadRows)

  // -------------------------------------------------------------- pipelines
  const pipelineId = uid()
  await insertMany(env, 'pipelines', [
    { id: pipelineId, org_id: orgId, name: 'Sales Pipeline', is_default: 1, created_at: nowIso() },
  ])
  const stageDefs = [
    ['Qualification', 10],
    ['Discovery', 25],
    ['Proposal', 55],
    ['Negotiation', 75],
    ['Closed Won', 100],
    ['Closed Lost', 0],
  ] as const
  const stageIds: string[] = []
  await insertMany(
    env,
    'stages',
    stageDefs.map(([name, probability], i) => {
      const id = uid()
      stageIds.push(id)
      return { id, org_id: orgId, pipeline_id: pipelineId, name, position: i, probability, created_at: nowIso() }
    }),
  )

  // -------------------------------------------------------------------- deals
  const dealRows: Record<string, unknown>[] = []
  for (let i = 0; i < 22; i++) {
    const stageIndex = i % 5
    const stage = stageDefs[stageIndex]
    dealRows.push({
      id: uid(),
      org_id: orgId,
      name: `${pick(['Platform rollout', 'Annual licence', 'Pilot programme', 'Expansion', 'Support retainer', 'Data migration'])} — ${companySeed[i % companySeed.length][0]}`,
      contact_id: contactIds[i % contactIds.length],
      company_id: companyIds[i % companyIds.length],
      pipeline_id: pipelineId,
      stage_id: stageIds[stageIndex],
      value: [4200, 8600, 12500, 24000, 38000, 62000, 96000, 128000][i % 8],
      currency: 'USD',
      probability: stage[1],
      expected_close: iso(addDays(now, 5 + i * 4)),
      owner_id: salesReps[i % salesReps.length],
      source: pick(sources),
      status: stage[0] === 'Closed Won' ? 'won' : stage[0] === 'Closed Lost' ? 'lost' : 'open',
      description: null,
      created_at: iso(addDays(now, -90 + i * 3)),
      updated_at: iso(addDays(now, -Math.floor(rand() * 12))),
    })
  }
  await insertMany(env, 'deals', dealRows)

  // -------------------------------------------------------------------- tasks
  const taskTitles = [
    'Send recap email', 'Book discovery call', 'Prepare renewal quote', 'Follow up on proposal',
    'Collect security questionnaire', 'Schedule onboarding kickoff', 'Review contract redlines',
    'Share pricing deck', 'Confirm implementation date', 'Check in after pilot',
  ]
  const taskRows: Record<string, unknown>[] = []
  for (let i = 0; i < 24; i++) {
    const status = i < 9 ? 'open' : i < 15 ? 'in_progress' : i < 21 ? 'completed' : 'cancelled'
    taskRows.push({
      id: uid(),
      org_id: orgId,
      title: `${taskTitles[i % taskTitles.length]} — ${companySeed[i % companySeed.length][0]}`,
      description: 'Auto-generated from the demo dataset so dashboards have real rows.',
      type: pick(['task', 'call', 'email', 'meeting']),
      priority: pick(['low', 'medium', 'high']),
      status,
      owner_id: allReps[i % allReps.length],
      assignee_id: allReps[i % allReps.length],
      due_date: iso(addDays(now, i < 9 ? Math.floor(rand() * 6) - 2 : Math.floor(rand() * 20) + 1)).slice(0, 10),
      related_type: 'deal',
      related_id: dealRows[i % dealRows.length].id,
      completed_at: status === 'completed' ? iso(addDays(now, -Math.floor(rand() * 6))) : null,
      created_at: iso(addDays(now, -25 + i)),
      updated_at: iso(addDays(now, -Math.floor(rand() * 6))),
    })
  }
  await insertMany(env, 'tasks', taskRows)

  // ------------------------------------------------------------------- events
  const eventRows: Record<string, unknown>[] = []
  for (let i = 0; i < 16; i++) {
    const dayOffset = i - 5
    const start = addDays(now, dayOffset)
    start.setUTCHours(9 + (i % 7), i % 2 ? 30 : 0, 0, 0)
    eventRows.push({
      id: uid(),
      org_id: orgId,
      title: pick(['Discovery call', 'Quarterly business review', 'Implementation workshop', 'Renewal conversation', 'Team pipeline review']) + ` — ${companySeed[i % companySeed.length][0]}`,
      description: null,
      start_at: iso(start),
      end_at: iso(addMinutes(start, 30 + (i % 3) * 30)),
      timezone: 'Asia/Calcutta',
      all_day: 0,
      location: pick(['Google Meet', 'Zoom', 'On-site', 'Phone']),
      meeting_url: 'https://meet.google.com/gofox-demo',
      type: pick(['meeting', 'call', 'demo']),
      owner_id: allReps[i % allReps.length],
      attendees: JSON.stringify([allReps[i % allReps.length], contactIds[i % contactIds.length]]),
      related_type: 'deal',
      related_id: dealRows[i % dealRows.length].id,
      status: 'scheduled',
      created_at: iso(addDays(now, -20)),
      updated_at: iso(addDays(now, -3)),
    })
  }
  await insertMany(env, 'events', eventRows)

  // -------------------------------------------------------------------- calls
  const callRows = Array.from({ length: 10 }, (_, i) => ({
    id: uid(),
    org_id: orgId,
    direction: i % 3 === 0 ? 'inbound' : 'outbound',
    number: `+1415555${String(3000 + i)}`,
    contact_id: contactIds[i % contactIds.length],
    owner_id: salesReps[i % salesReps.length],
    started_at: iso(addDays(now, -i)),
    duration: 60 + Math.floor(rand() * 1500),
    status: 'completed',
    outcome: pick(['Connected', 'Left voicemail', 'No answer', 'Follow-up booked']),
    notes: 'Logged manually by the rep.',
    provider: 'manual',
    created_at: iso(addDays(now, -i)),
    updated_at: iso(addDays(now, -i)),
  }))
  await insertMany(env, 'calls', callRows)

  // -------------------------------------------------------------- support data
  const slaIds: Record<string, string> = {}
  await insertMany(
    env,
    'sla_policies',
    (['urgent', 'high', 'medium', 'low'] as const).map((priority) => {
      const id = uid()
      slaIds[priority] = id
      const mins = ({ urgent: 15, high: 60, medium: 240, low: 480 } as Record<string, number>)[priority]
      return {
        id,
        org_id: orgId,
        name: `${priority[0].toUpperCase()}${priority.slice(1)} priority SLA`,
        priority,
        first_response_mins: mins,
        resolution_mins: mins * 8,
        business_hours: 'Mon-Fri 09:00-18:00 Asia/Calcutta',
        status: 'active',
        created_at: iso(addDays(now, -100)),
        updated_at: iso(addDays(now, -10)),
      }
    }),
  )

  const ticketRows: Record<string, unknown>[] = []
  const ticketSubjects = [
    'Login link expires too quickly', 'Invoice PDF missing tax id', 'Import failed on CSV row 42',
    'Cannot connect Google Drive', 'Workflow not firing on deal stage', 'Dashboard totals look off',
    'WhatsApp messages stuck pending', 'Request: bulk tag contacts', 'SLA breach notification missing',
    'Duplicate contacts after import', 'Webhook retries exhausted', 'Seat count wrong on billing',
    'Calendar timezone incorrect', 'Email template renders oddly in Outlook', 'API rate limit question',
    'Knowledge base article request',
  ]
  for (let i = 0; i < 16; i++) {
    const priority = pick(['urgent', 'high', 'medium', 'low'])
    const status = i < 5 ? 'open' : i < 9 ? 'pending' : i < 13 ? 'resolved' : 'closed'
    const created = addDays(now, -Math.floor(rand() * 18))
    const sla = slaIds[priority]
    ticketRows.push({
      id: uid(),
      org_id: orgId,
      subject: ticketSubjects[i],
      description: 'Reported through the support inbox. Reproduced by the agent on the demo tenant.',
      contact_id: contactIds[i % contactIds.length],
      company_id: companyIds[i % companyIds.length],
      channel: pick(['email', 'chat', 'web']),
      category: pick(['Technical', 'Billing', 'Product', 'Onboarding']),
      priority,
      status,
      assignee_id: i % 3 === 0 ? userIds.support : pick([userIds.support, userIds.admin, userIds.manager]),
      sla_policy_id: sla,
      first_response_due: iso(addMinutes(created, ({ urgent: 15, high: 60, medium: 240, low: 480 } as Record<string, number>)[priority])),
      resolution_due: iso(addMinutes(created, ({ urgent: 120, high: 480, medium: 1920, low: 3840 } as Record<string, number>)[priority])),
      first_response_at: status === 'open' ? null : iso(addMinutes(created, 20 + Math.floor(rand() * 120))),
      resolved_at: status === 'resolved' || status === 'closed' ? iso(addMinutes(created, 300)) : null,
      created_at: iso(created),
      updated_at: iso(addDays(created, 1)),
    })
  }
  await insertMany(env, 'tickets', ticketRows)
  await insertMany(
    env,
    'ticket_messages',
    ticketRows.slice(0, 10).map((t) => ({
      id: uid(),
      org_id: orgId,
      ticket_id: t.id,
      author_type: 'customer',
      author_id: t.contact_id,
      body: 'Hi team, this is still happening on our side. Could you take a look today?',
      internal: 0,
      created_at: t.created_at,
    })),
  )

  await insertMany(
    env,
    'kb_articles',
    [
      ['Getting started with GoFox CRM', 'getting-started', 'Onboarding', 'published'],
      ['Connecting your email provider', 'connect-email', 'Integrations', 'published'],
      ['Importing contacts from a CSV', 'import-contacts', 'Data', 'published'],
      ['How workflow triggers work', 'workflow-triggers', 'Automation', 'published'],
      ['Understanding SLA policies', 'sla-policies', 'Support', 'published'],
      ['Setting up the web tracker', 'web-tracker', 'Analytics', 'draft'],
    ].map(([title, slug, category, status]) => ({
      id: uid(),
      org_id: orgId,
      title,
      slug,
      category,
      body: `${title}\n\nThis article explains the setup steps and links to the relevant settings screens. It is served from the tenant knowledge base and only visible when published.`,
      status,
      views: Math.floor(rand() * 400),
      author_id: userIds.support,
      created_at: iso(addDays(now, -80)),
      updated_at: iso(addDays(now, -5)),
    })),
  )

  // ------------------------------------------------------------ marketing data
  const templateRows = ['Welcome — product tour', 'Quarterly product update', 'Renewal reminder', 'Webinar invite', 'Trial day 3 nudge'].map(
    (name, i) => ({
      id: uid(),
      org_id: orgId,
      name,
      category: pick(['Lifecycle', 'Announcement', 'Sales']),
      subject: i === 0 ? 'Welcome to {{company_name}} 👋' : `${name.split(' — ')[0]} for {{first_name}}`,
      preview_text: 'A short, useful note from the Northwind team.',
      body: `<p>Hi {{first_name}},</p><p>${name}. Reply to this email if you would like a walkthrough.</p><p>— The team</p><p style="color:#888;font-size:12px">Unsubscribe: {{unsubscribe_url}}</p>`,
      status: 'active',
      owner_id: userIds.marketer,
      created_at: iso(addDays(now, -70 + i * 4)),
      updated_at: iso(addDays(now, -4)),
    }),
  )
  await insertMany(env, 'email_templates', templateRows)

  const listIds: string[] = []
  const listDefs = [
    ['Newsletter subscribers', 'Marketing', 'Contacts who opted into the monthly newsletter'],
    ['Q4 pipeline contacts', 'Sales', 'Contacts attached to open Q4 deals'],
    ['Webinar — automation 101', 'Events', 'Attendees from the automation webinar'],
    ['Renewals 90 days', 'Customer success', 'Accounts renewing this quarter'],
    ['Trial users', 'Lifecycle', 'Contacts in an active product trial'],
  ] as const
  await insertMany(
    env,
    'lists',
    listDefs.map(([name, category, description], i) => {
      const id = uid()
      listIds.push(id)
      return {
        id,
        org_id: orgId,
        name,
        type: 'static',
        category,
        description,
        owner_id: userIds.marketer,
        created_at: iso(addDays(now, -60 + i * 5)),
        updated_at: iso(addDays(now, -3)),
      }
    }),
  )
  const memberRows: Record<string, unknown>[] = []
  listIds.forEach((listId, li) => {
    for (let i = 0; i < 12; i++) {
      memberRows.push({
        id: uid(),
        org_id: orgId,
        list_id: listId,
        entity_type: 'contact',
        entity_id: contactIds[(li * 5 + i) % contactIds.length],
        created_at: iso(addDays(now, -20)),
      })
    }
  })
  await insertMany(env, 'list_members', memberRows)

  const campaignRows: Record<string, unknown>[] = [
    {
      name: 'November product digest',
      channel: 'email',
      status: 'sent',
      list_id: listIds[0],
      template_id: templateRows[1].id,
      subject: 'What shipped in October',
      sent_count: 1200,
      delivered: 1164,
      opened: 512,
      clicked: 143,
      bounced: 36,
      sent_at: iso(addDays(now, -12)),
    },
    {
      name: 'Webinar invitation — automation 101',
      channel: 'email',
      status: 'sent',
      list_id: listIds[2],
      template_id: templateRows[3].id,
      subject: 'Live: automate your follow-ups in 30 minutes',
      sent_count: 640,
      delivered: 624,
      opened: 301,
      clicked: 98,
      bounced: 16,
      sent_at: iso(addDays(now, -6)),
    },
    {
      name: 'Renewal reminder — Q4',
      channel: 'email',
      status: 'scheduled',
      list_id: listIds[3],
      template_id: templateRows[2].id,
      subject: 'Your renewal is coming up',
      sent_count: 0,
      scheduled_at: iso(addDays(now, 3)),
    },
    {
      name: 'Trial day 3 nudge',
      channel: 'email',
      status: 'draft',
      list_id: listIds[4],
      template_id: templateRows[4].id,
      subject: 'Need a hand getting set up?',
    },
    {
      name: 'WhatsApp launch announcement',
      channel: 'whatsapp',
      status: 'draft',
      list_id: listIds[1],
      subject: null,
    },
    {
      name: 'Q4 pipeline check-in',
      channel: 'email',
      status: 'paused',
      list_id: listIds[1],
      template_id: templateRows[0].id,
      subject: 'Still interested in a walkthrough?',
    },
  ].map((c) => ({
    id: uid(),
    org_id: orgId,
    name: c.name,
    channel: c.channel,
    type: 'broadcast',
    category: 'Marketing',
    sender: 'Northwind <hello@northwind.example.com>',
    list_id: c.list_id,
    template_id: c.template_id ?? null,
    subject: c.subject ?? null,
    content: null,
    scheduled_at: c.scheduled_at ?? null,
    timezone: 'Asia/Calcutta',
    status: c.status,
    audience_count: c.sent_count ?? 12,
    suppressed_count: c.status === 'sent' ? 24 : 3,
    sent_count: c.sent_count ?? 0,
    delivered: c.delivered ?? 0,
    opened: c.opened ?? 0,
    clicked: c.clicked ?? 0,
    bounced: c.bounced ?? 0,
    provider: c.status === 'sent' ? 'sandbox' : null,
    sent_at: c.sent_at ?? null,
    created_at: iso(addDays(now, -20)),
    updated_at: iso(addDays(now, -2)),
  }))
  await insertMany(env, 'campaigns', campaignRows)

  const sequenceId = uid()
  await insertMany(env, 'sequences', [
    { id: sequenceId, org_id: orgId, name: 'New trial onboarding', description: 'Three emails over eight days for trial signups.', status: 'active', exit_on_reply: 1, created_at: iso(addDays(now, -40)), updated_at: iso(addDays(now, -2)) },
    { id: uid(), org_id: orgId, name: 'Event follow-up', description: 'Post-webinar follow-up for attendees.', status: 'paused', exit_on_reply: 1, created_at: iso(addDays(now, -35)), updated_at: iso(addDays(now, -8)) },
    { id: uid(), org_id: orgId, name: 'Dormant re-engagement', description: 'Win-back journey for cold contacts.', status: 'draft', exit_on_reply: 1, created_at: iso(addDays(now, -12)), updated_at: iso(addDays(now, -1)) },
  ])
  await insertMany(
    env,
    'sequence_steps',
    [
      { kind: 'email', subject: 'Welcome — here is your workspace', delay_days: 0, position: 0 },
      { kind: 'wait', delay_days: 3, position: 1 },
      { kind: 'email', subject: 'A quick tour of automations', delay_days: 0, position: 2 },
      { kind: 'wait', delay_days: 5, position: 3 },
      { kind: 'email', subject: 'Ready for a walkthrough?', delay_days: 0, position: 4 },
    ].map((s) => ({
      id: uid(),
      org_id: orgId,
      sequence_id: sequenceId,
      position: s.position,
      kind: s.kind,
      subject: s.subject ?? null,
      body: s.kind === 'email' ? '<p>Hi {{first_name}},</p><p>Sharing a short note to help you get value from GoFox.</p>' : null,
      delay_days: s.delay_days,
      template_id: null,
      created_at: iso(addDays(now, -40)),
    })),
  )
  await insertMany(
    env,
    'sequence_enrolments',
    contactIds.slice(0, 9).map((contactId, i) => ({
      id: uid(),
      org_id: orgId,
      sequence_id: sequenceId,
      contact_id: contactId,
      current_step: i % 3,
      status: i > 6 ? 'completed' : 'active',
      next_run_at: iso(addDays(now, (i % 3) + 1)),
      created_at: iso(addDays(now, -10)),
      updated_at: iso(addDays(now, -1)),
    })),
  )

  const formFields = (extra: { key: string; label: string; type: string; required?: boolean; options?: string[] }[]) =>
    JSON.stringify([
      { key: 'first_name', label: 'First name', type: 'text', required: true },
      { key: 'last_name', label: 'Last name', type: 'text', required: false },
      { key: 'email', label: 'Work email', type: 'email', required: true },
      { key: 'company', label: 'Company', type: 'text', required: false },
      { key: 'phone', label: 'Phone', type: 'tel', required: false },
      { key: 'consent', label: 'I agree to receive product updates', type: 'checkbox', required: false },
      ...extra,
    ])
  const formIds: string[] = []
  await insertMany(
    env,
    'forms',
    [
      ['Request a demo', 'request-a-demo', 'published', 'lead', 4],
      ['Newsletter signup', 'newsletter', 'published', 'contact', 2],
      ['Webinar registration', 'webinar-automation-101', 'published', 'lead', 3],
      ['Pricing enquiry', 'pricing-enquiry', 'paused', 'lead', 0],
    ].map(([name, slug, status, mapping, submissions]) => {
      const id = uid()
      formIds.push(id)
      return {
        id,
        org_id: orgId,
        name,
        slug,
        status,
        fields:
          slug === 'webinar-automation-101'
            ? formFields([{ key: 'company_size', label: 'Company size', type: 'select', required: false, options: ['1-10', '11-50', '51-200', '200+'] }])
            : formFields(slug === 'newsletter' ? [] : [{ key: 'message', label: 'How can we help?', type: 'textarea', required: false }]),
        success_message: 'Thanks — we will be in touch within one business day.',
        mapping,
        consent_text: 'By submitting you agree to our privacy policy.',
        submission_count: submissions as number,
        created_at: iso(addDays(now, -50)),
        updated_at: iso(addDays(now, -6)),
      }
    }),
  )
  const submissionRows: Record<string, unknown>[] = []
  for (let i = 0; i < 9; i++) {
    submissionRows.push({
      id: uid(),
      org_id: orgId,
      form_id: formIds[i % 3],
      data: JSON.stringify({
        first_name: firstNames[i],
        last_name: lastNames[i],
        email: `${firstNames[i].toLowerCase()}@example.com`,
        company: 'Brightline Labs',
        consent: 'on',
      }),
      lead_id: leadRows[i].id,
      source: 'Direct',
      created_at: iso(addDays(now, -20 + i)),
    })
  }
  await insertMany(env, 'form_submissions', submissionRows)

  await insertMany(
    env,
    'landing_pages',
    [
      ['Request a demo', 'demo', 'published', 'lead-magnet', formIds[0], 340],
      ['Automation 101 webinar', 'automation-webinar', 'published', 'webinar', formIds[2], 128],
      ['Q4 pricing update', 'pricing', 'draft', 'blank', formIds[3], 0],
    ].map(([name, slug, status, template, formId, views]) => ({
      id: uid(),
      org_id: orgId,
      name,
      slug,
      status,
      template,
      blocks: JSON.stringify([
        { id: 'b1', type: 'hero', title: String(name), subtitle: 'See how Northwind teams close more with less busywork.' },
        { id: 'b2', type: 'text', body: 'Book 30 minutes with a product specialist. We will map your current process and show exactly where automation helps.' },
        { id: 'b3', type: 'form', formId },
      ]),
      form_id: formId,
      seo_title: `${name} · Northwind`,
      seo_description: 'Book a walkthrough of GoFox CRM with the Northwind team.',
      views,
      created_at: iso(addDays(now, -45)),
      updated_at: iso(addDays(now, -7)),
    })),
  )

  await insertMany(
    env,
    'content_items',
    [
      ['blog', 'How we cut follow-up time by 62%', 'cut-follow-up-time', 'Case study', 'published', 12],
      ['blog', 'A practical guide to lead scoring', 'lead-scoring-guide', 'Guides', 'published', 21],
      ['blog', 'Designing automations people trust', 'automations-people-trust', 'Automation', 'draft', 0],
      ['faq', 'Does GoFox support WhatsApp?', 'whatsapp-support', 'Product', 'published', 5],
      ['faq', 'Can I import from a spreadsheet?', 'import-spreadsheet', 'Data', 'published', 9],
      ['page', 'About Northwind', 'about', 'Company', 'published', 30],
    ].map(([type, title, slug, category, status, days]) => ({
      id: uid(),
      org_id: orgId,
      type,
      title,
      slug,
      body: `<p>${title}</p><p>This is seeded editorial content so the Content Hub has published and draft states to work with.</p>`,
      excerpt: 'A short excerpt used on the content index and landing pages.',
      category,
      author_id: userIds.marketer,
      status,
      published_at: status === 'published' ? iso(addDays(now, -Number(days) * 3)) : null,
      created_at: iso(addDays(now, -Number(days) * 3)),
      updated_at: iso(addDays(now, -2)),
    })),
  )

  await insertMany(
    env,
    'products',
    [
      ['GoFox Growth — annual', 'GF-GROW-ANNUAL', 'plan', 11880, 0],
      ['GoFox Scale — annual', 'GF-SCALE-ANNUAL', 'plan', 29880, 0],
      ['Onboarding package', 'GF-ONBOARD', 'service', 4500, 0],
      ['Data migration', 'GF-MIGRATION', 'service', 2800, 0],
      ['Automation workshop', 'GF-WORKSHOP', 'service', 1500, 0],
      ['Priority support add-on', 'GF-SUPPORT-PRI', 'addon', 2400, 0],
      ['Additional seat', 'GF-SEAT', 'addon', 240, 0],
      ['Sandbox environment', 'GF-SANDBOX', 'addon', 900, 0],
    ].map(([name, sku, type, price, tax]) => ({
      id: uid(),
      org_id: orgId,
      name,
      sku,
      type,
      description: `${name} billed annually.`,
      unit_price: price,
      currency: 'USD',
      tax_rate: tax,
      status: 'active',
      created_at: iso(addDays(now, -120)),
      updated_at: iso(addDays(now, -15)),
    })),
  )

  const productIds = await env.DB.prepare('SELECT id, unit_price FROM products WHERE org_id = ?').bind(orgId).all<{ id: string; unit_price: number }>()
  const docTypes = ['quote', 'invoice', 'proposal'] as const
  const documentRows: Record<string, unknown>[] = []
  for (let i = 0; i < 10; i++) {
    const type = docTypes[i % 3]
    const lineRows = [0, 1].map((n) => {
      const p = productIds.results[(i + n) % productIds.results.length]
      const qty = 1 + n
      return { description: `Item ${n + 1}`, quantity: qty, unit_price: p.unit_price, product_id: p.id }
    })
    const subtotal = lineRows.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
    const status = ['draft', 'sent', 'accepted', 'paid', 'overdue'][i % 5]
    documentRows.push({
      id: uid(),
      org_id: orgId,
      doc_type: type,
      number: `${type === 'invoice' ? 'INV' : type === 'quote' ? 'QTE' : 'PRO'}-2026-${String(100 + i)}`,
      title: `${type === 'invoice' ? 'Invoice' : type === 'quote' ? 'Quote' : 'Proposal'} for ${companySeed[i % companySeed.length][0]}`,
      contact_id: contactIds[i % contactIds.length],
      company_id: companyIds[i % companyIds.length],
      deal_id: dealRows[i % dealRows.length].id,
      issue_date: iso(addDays(now, -20 + i)).slice(0, 10),
      due_date: iso(addDays(now, 10 + i)).slice(0, 10),
      currency: 'USD',
      discount: 0,
      tax_rate: 0,
      lines: JSON.stringify(lineRows),
      subtotal,
      total: subtotal,
      status,
      notes: 'Payable within 30 days.',
      terms: 'Standard terms apply.',
      locked: ['accepted', 'paid'].includes(status) ? 1 : 0,
      created_at: iso(addDays(now, -20 + i)),
      updated_at: iso(addDays(now, -2)),
    })
  }
  await insertMany(env, 'documents', documentRows)

  await insertMany(
    env,
    'payments',
    documentRows
      .filter((d) => d.status === 'paid')
      .map((d) => ({
        id: uid(),
        org_id: orgId,
        document_id: d.id,
        amount: d.total as number,
        currency: 'USD',
        provider: 'sandbox',
        status: 'succeeded',
        provider_ref: `sbx_${randomHex(6)}`,
        created_at: iso(addDays(now, -2)),
      })),
  )

  // ---------------------------------------------------------------- workflows
  const nodes = (list: Record<string, unknown>[]) => JSON.stringify(list)
  await insertMany(
    env,
    'workflows',
    [
      {
        name: 'New contact → welcome task',
        module: 'crm',
        status: 'live',
        trigger_type: 'contact.created',
        description: 'Every new contact gets an owner-assigned follow-up task and an in-app note.',
        nodes: nodes([
          { id: 'n1', type: 'trigger', label: 'Contact created', x: 80, y: 80, config: {} },
          { id: 'n2', type: 'condition', label: 'Has an email address?', x: 80, y: 210, config: { field: 'email', op: 'not_empty' } },
          { id: 'n3', type: 'action', action: 'create_task', label: 'Create follow-up task', x: 80, y: 350, config: { title: 'Welcome call — {{record.first_name}}', priority: 'high', dueInDays: 2 } },
          { id: 'n4', type: 'action', action: 'notify', label: 'Notify record owner', x: 80, y: 480, config: { title: 'New contact needs a welcome call' } },
        ]),
      },
      {
        name: 'Deal stage → notify owner',
        module: 'sales',
        status: 'live',
        trigger_type: 'deal.stage_changed',
        description: 'Notifies the deal owner when a stage changes and logs the movement.',
        nodes: nodes([
          { id: 'n1', type: 'trigger', label: 'Deal stage changed', x: 80, y: 80, config: {} },
          { id: 'n2', type: 'action', action: 'notify', label: 'Notify owner', x: 80, y: 220, config: { title: 'Deal moved stage', body: '{{record.name}} moved to a new stage.' } },
          { id: 'n3', type: 'action', action: 'add_note', label: 'Add note to timeline', x: 80, y: 350, config: { summary: 'Stage change recorded by automation.' } },
        ]),
      },
      {
        name: 'Urgent ticket → escalate',
        module: 'support',
        status: 'draft',
        trigger_type: 'ticket.created',
        description: 'Routes urgent tickets to the support lead.',
        nodes: nodes([
          { id: 'n1', type: 'trigger', label: 'Ticket created', x: 80, y: 80, config: {} },
          { id: 'n2', type: 'condition', label: 'Priority is urgent?', x: 80, y: 210, config: { field: 'priority', op: 'eq', value: 'urgent' } },
          { id: 'n3', type: 'action', action: 'create_task', label: 'Create escalation task', x: 80, y: 350, config: { title: 'Escalate urgent ticket', priority: 'high', dueInDays: 1 } },
        ]),
      },
    ].map((w) => ({
      id: uid(),
      org_id: orgId,
      name: w.name,
      module: w.module,
      status: w.status,
      trigger_type: w.trigger_type,
      trigger_config: '{}',
      nodes: w.nodes,
      version: 1,
      owner_id: userIds.admin,
      description: w.description,
      created_at: iso(addDays(now, -30)),
      updated_at: iso(addDays(now, -4)),
    })),
  )

  const integrationSeed: [string, string, string, string, string, string | null][] = [
    ['email', 'Sandbox Mail', 'Email', 'connected', 'sandbox', 'Test-mode sender. Messages are not delivered to real inboxes and no SMTP credentials are stored.'],
    ['whatsapp', 'WhatsApp Business', 'Messaging', 'not_connected', 'live', 'Add a WhatsApp Business provider to enable two-way conversations.'],
    ['sms', 'SMS provider', 'Messaging', 'not_connected', 'live', 'No SMS provider configured.'],
    ['google_drive', 'Google Drive', 'Storage', 'not_connected', 'live', 'Connect a Google account to store files in Drive.'],
    ['s3', 'AWS S3', 'Storage', 'not_connected', 'live', 'Bring your own bucket and credentials.'],
    ['gmail', 'Gmail', 'Email', 'not_connected', 'live', 'OAuth connection required to sync a mailbox.'],
    ['microsoft365', 'Microsoft 365', 'Email', 'not_connected', 'live', 'OAuth connection required to sync a mailbox.'],
    ['meta', 'Meta (Facebook / Instagram)', 'Social', 'not_connected', 'live', 'Publishing and ads require an approved Meta app.'],
    ['linkedin', 'LinkedIn', 'Social', 'not_connected', 'live', 'Organisation page posting requires LinkedIn approval.'],
    ['x', 'X (Twitter)', 'Social', 'not_connected', 'live', 'API access requires a paid plan.'],
    ['google_ads', 'Google Ads', 'Ads', 'not_connected', 'live', 'Connect an authorised Google Ads account.'],
    ['stripe', 'Stripe', 'Payments', 'not_connected', 'live', 'Add restricted API keys to accept payments.'],
    ['paypal', 'PayPal', 'Payments', 'not_connected', 'live', 'PayPal business account required.'],
    ['razorpay', 'Razorpay', 'Payments', 'not_connected', 'live', 'Razorpay account required.'],
    ['slack', 'Slack', 'Productivity', 'not_connected', 'live', 'Used by workflow Slack actions.'],
    ['asana', 'Asana', 'Productivity', 'not_connected', 'live', 'Used by workflow task actions.'],
    ['trello', 'Trello', 'Productivity', 'not_connected', 'live', 'Used by workflow card actions.'],
    ['openai', 'OpenAI', 'AI', 'not_connected', 'live', 'Add the OPENAI_API_KEY Worker secret, then connect here to route the assistant to a model.'],
    ['anthropic', 'Anthropic', 'AI', 'not_connected', 'live', 'Add the ANTHROPIC_API_KEY Worker secret, then connect here to route the assistant to a model.'],
    ['telephony', 'Telephony provider', 'Telephony', 'not_connected', 'live', 'Dial pad requires a connected provider.'],
  ]
  await insertMany(
    env,
    'integrations',
    integrationSeed.map(([provider, label, category, status, mode, note]) => ({
      id: uid(),
      org_id: orgId,
      provider,
      label,
      category,
      status,
      mode,
      account: status === 'connected' ? 'sandbox@northwind.example.com' : null,
      scopes: null,
      note,
      last_sync: status === 'connected' ? iso(addMinutes(now, -30)) : null,
      created_at: iso(addDays(now, -200)),
    })),
  )

  await insertMany(
    env,
    'files',
    [
      ['Mutual NDA — Halcyon.pdf', 'Contracts', 'application/pdf', 182_000],
      ['Pricing deck v4.pptx', 'Sales collateral', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 2_400_000],
      ['Implementation checklist.docx', 'Onboarding', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 64_000],
      ['Security questionnaire responses.pdf', 'Security', 'application/pdf', 320_000],
      ['Logo pack.zip', 'Brand', 'application/zip', 1_800_000],
    ].map(([name, folder, mime, size], i) => ({
      id: uid(),
      org_id: orgId,
      name,
      folder,
      mime,
      size,
      provider: 'local',
      data: null,
      related_type: null,
      related_id: null,
      owner_id: allReps[i % allReps.length],
      created_at: iso(addDays(now, -30 + i * 3)),
      updated_at: iso(addDays(now, -5)),
    })),
  )

  const reportDefs = [
    ['Pipeline by stage', 'deals', 'value,count', 'pipeline'],
    ['Lead sources', 'leads', 'count', 'source'],
    ['Campaign performance', 'campaigns', 'sent,opened,clicked', 'channel'],
    ['Ticket SLA compliance', 'tickets', 'breaches,resolved', 'priority'],
    ['Activity summary', 'activities', 'count', 'type'],
  ] as const
  await insertMany(
    env,
    'reports',
    reportDefs.map(([name, domain, metrics, dimension]) => ({
      id: uid(),
      org_id: orgId,
      name,
      domain,
      metrics,
      filters: JSON.stringify({ dimension, range: 'last_30_days' }),
      visibility: 'team',
      owner_id: owner,
      created_at: iso(addDays(now, -40)),
      updated_at: iso(addDays(now, -6)),
    })),
  )

  // ---------------------------------------------------- activities + web events
  const activityRows: Record<string, unknown>[] = []
  const activityTemplates: [string, string, string][] = [
    ['contact.created', 'contact', 'Contact created'],
    ['lead.converted', 'contact', 'Lead converted to contact'],
    ['deal.stage_changed', 'deal', 'Deal stage changed'],
    ['campaign.sent', 'campaign', 'Campaign sent'],
    ['ticket.created', 'ticket', 'Support ticket created'],
    ['form.submitted', 'form', 'Form submission received'],
    ['workflow.completed', 'workflow', 'Workflow run completed'],
    ['page.published', 'landing_page', 'Landing page published'],
    ['task.completed', 'task', 'Task completed'],
    ['email.sent', 'campaign', 'Email delivered by sandbox provider'],
  ]
  for (let i = 0; i < 48; i++) {
    const [type, entityType, summary] = activityTemplates[i % activityTemplates.length]
    activityRows.push({
      id: uid(),
      org_id: orgId,
      actor_id: allReps[i % allReps.length],
      type,
      entity_type: entityType,
      entity_id: entityType === 'deal' ? dealRows[i % dealRows.length].id : entityType === 'contact' ? contactIds[i % contactIds.length] : null,
      summary: `${summary}${entityType === 'deal' ? ` · ${(dealRows[i % dealRows.length].name as string).slice(0, 48)}` : ''}`,
      metadata: JSON.stringify({ source: 'seed' }),
      created_at: iso(addDays(now, -Math.floor(rand() * 28))),
    })
  }
  await insertMany(env, 'activities', activityRows)

  await insertMany(
    env,
    'notifications',
    [
      ['deal_stage', 'Deal moved to Proposal', 'Halcyon Logistics · Platform rollout moved to Proposal.', 'deal', dealRows[0].id, null],
      ['task_due', 'Task due today', 'Send recap email — Vertex Manufacturing.', 'task', taskRows[0].id, null],
      ['ticket_created', 'New urgent ticket', 'Login link expires too quickly.', 'ticket', ticketRows[0].id, null],
      ['workflow_failed', 'Workflow run failed', 'Urgent ticket → escalate could not reach a provider.', 'workflow', null, null],
      ['campaign_sent', 'Campaign delivered', 'November product digest finished sending.', 'campaign', campaignRows[0].id, iso(addDays(now, -1))],
      ['integration', 'Integration action required', 'Google Drive is not connected.', 'integration', null, null],
    ].map(([type, title, body, entityType, entityId, readAt]) => ({
      id: uid(),
      org_id: orgId,
      user_id: owner,
      type,
      title,
      body,
      entity_type: entityType,
      entity_id: entityId,
      read_at: readAt,
      created_at: iso(addMinutes(now, -Math.floor(rand() * 2000))),
    })),
  )

  const webRows: Record<string, unknown>[] = []
  const eventNames = ['page_view', 'page_view', 'page_view', 'form_submit', 'cta_click', 'pricing_view']
  for (let i = 0; i < 220; i++) {
    webRows.push({
      id: uid(),
      org_id: orgId,
      visitor_id: `v_${Math.floor(rand() * 60)}`,
      event: eventNames[i % eventNames.length],
      url: pick(['/', '/pricing', '/demo', '/blog/lead-scoring-guide', '/automation-webinar']),
      referrer: pick(['https://google.com', 'https://linkedin.com', 'direct', 'https://news.ycombinator.com']),
      utm_source: pick(['google', 'linkedin', 'newsletter', 'direct']),
      utm_campaign: pick(['q4-launch', 'webinar', 'always-on']),
      contact_id: chance(0.25) ? contactIds[i % contactIds.length] : null,
      created_at: iso(addDays(now, -Math.floor(rand() * 30))),
    })
  }
  await insertMany(env, 'web_events', webRows)

  await insertMany(env, 'invitations', [
    { id: uid(), org_id: orgId, email: 'newhire@northwind.example.com', role: 'sales', status: 'pending', invited_by: owner, created_at: iso(addDays(now, -2)) },
  ])

  await insertMany(
    env,
    'audit_logs',
    [
      { action: 'org.seeded', entity_type: 'org', summary: 'Demo tenant created' },
      { action: 'user.invited', entity_type: 'user', summary: 'Invitation sent to newhire@northwind.example.com' },
      { action: 'integration.connected', entity_type: 'integration', summary: 'Sandbox Mail connected in test mode' },
    ].map((a) => ({
      id: uid(),
      org_id: orgId,
      actor_id: owner,
      action: a.action,
      entity_type: a.entity_type,
      entity_id: null,
      before_json: null,
      after_json: JSON.stringify({ summary: a.summary }),
      ip: '127.0.0.1',
      created_at: iso(addDays(now, -20)),
    })),
  )

  await insertMany(env, 'meta', [{ key: 'seeded_at', value: nowIso() }])
}
