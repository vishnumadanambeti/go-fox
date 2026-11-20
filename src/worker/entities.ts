import type { Env } from './db'
import { insertRow, jsonParse, nowIso, uid } from './db'

/**
 * Whitelisted resource registry. Every list, drawer and API mutation in the CRM
 * is generated from these definitions, so validation, permissions and column
 * names stay consistent between the client and the Worker.
 */
export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'money'
  | 'textarea'
  | 'select'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'tags'
  | 'json'
  | 'ref'

export type FieldDef = {
  key: string
  label: string
  type?: FieldType
  options?: string[]
  required?: boolean
  ref?: string
  half?: boolean
  placeholder?: string
  readOnly?: boolean
}

export type EntityDef = {
  table: string
  label: string
  singular: string
  module: 'crm' | 'marketing' | 'sales' | 'support' | 'system'
  permission: string
  search: string[]
  sort: string
  dir: 'asc' | 'desc'
  fields: FieldDef[]
  list: string[]
  detailPath?: string
  filters?: string[]
  softDelete?: boolean
  unique?: { columns: string[]; label: string }[]
  transform?: (values: Record<string, unknown>) => Record<string, unknown>
}

const PRIORITY = ['low', 'medium', 'high', 'urgent']
const TASK_STATUS = ['open', 'in_progress', 'completed', 'cancelled']
const CONTACT_STATUS = ['active', 'inactive', 'bounced']

export const ENTITIES: Record<string, EntityDef> = {
  companies: {
    table: 'companies',
    label: 'Companies',
    singular: 'Company',
    module: 'crm',
    permission: 'crm.write',
    search: ['name', 'domain', 'industry', 'city', 'email', 'phone'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/companies',
    softDelete: true,
    unique: [{ columns: ['name'], label: 'company name' }],
    filters: ['status', 'industry', 'size', 'country'],
    list: ['name', 'email', 'domain', 'industry', 'size', 'phone', 'tags'],
    fields: [
      { key: 'name', label: 'Company name', required: true, half: true },
      { key: 'domain', label: 'Website / domain', half: true, placeholder: 'acme.com' },
      { key: 'industry', label: 'Industry', half: true, type: 'select', options: ['Logistics', 'Manufacturing', 'Healthcare', 'Financial Services', 'Robotics', 'Media', 'Software', 'Food & Beverage', 'Construction', 'Energy', 'Retail', 'Travel', 'Other'] },
      { key: 'size', label: 'Company size', half: true, type: 'select', options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
      { key: 'rating', label: 'Rating (1-5)', type: 'number', half: true },
      { key: 'phone', label: 'Phone', type: 'tel', half: true },
      { key: 'email', label: 'Email', type: 'email', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'prospect', 'churned'], half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'tags', label: 'Tags', type: 'tags', half: true, placeholder: 'customer, enterprise' },
      { key: 'address', label: 'Address', half: true },
      { key: 'city', label: 'City', half: true },
      { key: 'state', label: 'State', half: true },
      { key: 'postal_code', label: 'Postal code', half: true },
      { key: 'country', label: 'Country', half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  contacts: {
    table: 'contacts',
    label: 'Contacts',
    singular: 'Contact',
    module: 'crm',
    permission: 'crm.write',
    search: ['first_name', 'last_name', 'email', 'phone', 'designation'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/contacts',
    softDelete: true,
    filters: ['status', 'source', 'email_opt_out'],
    list: ['first_name', 'last_name', 'email', 'designation', 'company_id', 'owner_id', 'email_opt_out', 'updated_at'],
    fields: [
      { key: 'first_name', label: 'First name', required: true, half: true },
      { key: 'last_name', label: 'Last name', half: true },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true },
      { key: 'phone', label: 'Phone', type: 'tel', half: true },
      { key: 'designation', label: 'Job title', half: true },
      { key: 'company_id', label: 'Company', type: 'ref', ref: 'companies', half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'source', label: 'Source', half: true },
      { key: 'score', label: 'Score', type: 'number', half: true },
      { key: 'status', label: 'Status', type: 'select', options: CONTACT_STATUS, half: true },
      { key: 'email_opt_out', label: 'Email opt-out', type: 'checkbox', half: true },
      { key: 'tags', label: 'Tags', type: 'tags', half: true },
      { key: 'linkedin', label: 'LinkedIn URL', type: 'url', half: true },
      { key: 'address', label: 'Address', half: true },
      { key: 'city', label: 'City', half: true },
      { key: 'country', label: 'Country', half: true },
      { key: 'photo_url', label: 'Photo' },
      { key: 'avatar_url', label: 'Avatar' },
      { key: 'description', label: 'Notes', type: 'textarea' },
    ],
    transform: (v) => ({ ...v, email_opt_out: v.email_opt_out ? 1 : 0 }),
  },
  leads: {
    table: 'leads',
    label: 'Leads',
    singular: 'Lead',
    module: 'crm',
    permission: 'crm.write',
    search: ['first_name', 'last_name', 'email', 'company_name', 'phone', 'industry'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/leads',
    softDelete: true,
    filters: ['status', 'source', 'priority', 'lead_type'],
    list: ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'status', 'score', 'owner_id', 'created_at'],
    fields: [
      { key: 'lead_type', label: 'Lead type', type: 'select', options: ['person', 'organization'], half: true },
      { key: 'first_name', label: 'First name', required: true, half: true },
      { key: 'last_name', label: 'Last name', half: true },
      { key: 'email', label: 'Email', type: 'email', half: true },
      { key: 'phone', label: 'Phone', type: 'tel', half: true },
      { key: 'company_name', label: 'Company', half: true },
      { key: 'job_title', label: 'Job title', half: true },
      { key: 'industry', label: 'Industry', half: true },
      { key: 'source', label: 'Source', type: 'select', options: ['Website form', 'Outbound', 'Referral', 'Webinar', 'LinkedIn', 'Google Ads', 'Manual'], half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['new', 'contacted', 'qualified', 'unqualified', 'converted'], half: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY, half: true },
      { key: 'value', label: 'Lead value', type: 'money', half: true },
      { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'AED'], half: true },
      { key: 'score', label: 'Score', type: 'number', half: true },
      { key: 'birthday', label: 'Date of birth', type: 'date', half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'opt_out', label: 'Opted out of marketing', type: 'checkbox', half: true },
      { key: 'tags', label: 'Tags', type: 'tags', half: true },
      { key: 'website', label: 'Website', type: 'url', half: true },
      { key: 'address', label: 'Address', half: true },
      { key: 'photo_url', label: 'Photo' },
      { key: 'avatar_url', label: 'Avatar' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    transform: (v) => ({ ...v, opt_out: v.opt_out ? 1 : 0 }),
  },
  lists: {
    table: 'lists',
    label: 'Lists',
    singular: 'List',
    module: 'crm',
    permission: 'crm.write',
    search: ['name', 'category', 'description'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/lists',
    softDelete: true,
    unique: [{ columns: ['name'], label: 'list name' }],
    list: ['name', 'category', 'type', 'owner_id', 'created_at'],
    fields: [
      { key: 'name', label: 'List name', required: true },
      { key: 'category', label: 'Category', half: true },
      { key: 'type', label: 'Type', type: 'select', options: ['static', 'dynamic'], half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  deals: {
    table: 'deals',
    label: 'Deals',
    singular: 'Deal',
    module: 'sales',
    permission: 'sales.write',
    search: ['name', 'source', 'description'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/sales/deals',
    softDelete: true,
    filters: ['status', 'stage_id', 'owner_id', 'pipeline_id'],
    list: ['name', 'company_id', 'contact_id', 'value', 'stage_id', 'probability', 'expected_close', 'owner_id'],
    fields: [
      { key: 'name', label: 'Deal name', required: true },
      { key: 'contact_id', label: 'Primary contact', type: 'ref', ref: 'contacts', required: true, half: true },
      { key: 'company_id', label: 'Company', type: 'ref', ref: 'companies', half: true },
      { key: 'pipeline_id', label: 'Pipeline', type: 'ref', ref: 'pipelines', half: true },
      { key: 'stage_id', label: 'Stage', type: 'ref', ref: 'stages', half: true },
      { key: 'value', label: 'Value', type: 'money', required: true, half: true },
      { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'AED'], half: true },
      { key: 'probability', label: 'Probability %', type: 'number', half: true },
      { key: 'expected_close', label: 'Expected close', type: 'date', half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'source', label: 'Source', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['open', 'won', 'lost'], half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    transform: (v) => ({
      ...v,
      value: Number(v.value ?? 0),
      probability: Math.max(0, Math.min(100, Number(v.probability ?? 0))),
    }),
  },
  tasks: {
    table: 'tasks',
    label: 'Tasks',
    singular: 'Task',
    module: 'sales',
    permission: 'sales.write',
    search: ['title', 'description'],
    sort: 'due_date',
    dir: 'asc',
    softDelete: true,
    filters: ['status', 'priority', 'type', 'assignee_id'],
    list: ['title', 'type', 'priority', 'status', 'assignee_id', 'due_date', 'related_type'],
    fields: [
      { key: 'title', label: 'Task title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'type', label: 'Type', type: 'select', options: ['task', 'call', 'email', 'meeting'], half: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY, half: true },
      { key: 'status', label: 'Status', type: 'select', options: TASK_STATUS, half: true },
      { key: 'assignee_id', label: 'Assignee', type: 'ref', ref: 'users', half: true },
      { key: 'owner_id', label: 'Created by', type: 'ref', ref: 'users', half: true },
      { key: 'due_date', label: 'Due date', type: 'date', half: true },
      { key: 'related_type', label: 'Related to', type: 'select', options: ['contact', 'company', 'lead', 'deal', 'ticket'], half: true },
      { key: 'related_id', label: 'Related record id', half: true },
    ],
  },
  events: {
    table: 'events',
    label: 'Calendar',
    singular: 'Event',
    module: 'sales',
    permission: 'sales.write',
    search: ['title', 'description', 'location'],
    sort: 'start_at',
    dir: 'asc',
    softDelete: true,
    filters: ['type', 'status', 'owner_id'],
    list: ['title', 'type', 'start_at', 'end_at', 'location', 'owner_id', 'status'],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['meeting', 'call', 'demo', 'reminder'], half: true },
      { key: 'start_at', label: 'Starts', type: 'datetime', required: true, half: true },
      { key: 'end_at', label: 'Ends', type: 'datetime', required: true, half: true },
      { key: 'timezone', label: 'Timezone', half: true },
      { key: 'all_day', label: 'All day', type: 'checkbox', half: true },
      { key: 'location', label: 'Location', half: true },
      { key: 'meeting_url', label: 'Meeting link', type: 'url', half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'cancelled', 'completed'], half: true },
      { key: 'related_type', label: 'Related type', type: 'select', options: ['contact', 'company', 'deal', 'ticket'], half: true },
      { key: 'related_id', label: 'Related id', half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  calls: {
    table: 'calls',
    label: 'Calls',
    singular: 'Call',
    module: 'sales',
    permission: 'sales.write',
    search: ['number', 'outcome', 'notes'],
    sort: 'started_at',
    dir: 'desc',
    list: ['number', 'direction', 'started_at', 'duration', 'outcome', 'owner_id'],
    fields: [
      { key: 'number', label: 'Number', type: 'tel', required: true, half: true },
      { key: 'direction', label: 'Direction', type: 'select', options: ['outbound', 'inbound'], half: true },
      { key: 'started_at', label: 'Started', type: 'datetime', half: true },
      { key: 'duration', label: 'Duration (seconds)', type: 'number', half: true },
      { key: 'contact_id', label: 'Contact', type: 'ref', ref: 'contacts', half: true },
      { key: 'owner_id', label: 'Owner', type: 'ref', ref: 'users', half: true },
      { key: 'outcome', label: 'Outcome', half: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  tickets: {
    table: 'tickets',
    label: 'Tickets',
    singular: 'Ticket',
    module: 'support',
    permission: 'support.write',
    search: ['subject', 'description', 'category'],
    sort: 'created_at',
    dir: 'desc',
    detailPath: '/support/tickets',
    softDelete: true,
    filters: ['status', 'priority', 'assignee_id', 'channel'],
    list: ['subject', 'contact_id', 'priority', 'status', 'assignee_id', 'resolution_due', 'created_at'],
    fields: [
      { key: 'subject', label: 'Subject', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'contact_id', label: 'Requester', type: 'ref', ref: 'contacts', required: true, half: true },
      { key: 'company_id', label: 'Company', type: 'ref', ref: 'companies', half: true },
      { key: 'channel', label: 'Channel', type: 'select', options: ['email', 'chat', 'web', 'phone'], half: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Technical', 'Billing', 'Product', 'Onboarding', 'General'], half: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY, half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['open', 'pending', 'resolved', 'closed'], half: true },
      { key: 'assignee_id', label: 'Assignee', type: 'ref', ref: 'users', half: true },
      { key: 'sla_policy_id', label: 'SLA policy', type: 'ref', ref: 'sla', half: true },
    ],
  },
  kb_articles: {
    table: 'kb_articles',
    label: 'Knowledge Base',
    singular: 'Article',
    module: 'support',
    permission: 'support.write',
    search: ['title', 'category', 'body'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'category'],
    list: ['title', 'category', 'status', 'views', 'updated_at'],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'slug', label: 'Slug', required: true, half: true },
      { key: 'category', label: 'Category', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'], half: true },
      { key: 'body', label: 'Article body', type: 'textarea' },
    ],
  },
  sla_policies: {
    table: 'sla_policies',
    label: 'SLA Policies',
    singular: 'SLA policy',
    module: 'support',
    permission: 'support.write',
    search: ['name', 'priority'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    list: ['name', 'priority', 'first_response_mins', 'resolution_mins', 'business_hours', 'status'],
    fields: [
      { key: 'name', label: 'Policy name', required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY, half: true },
      { key: 'first_response_mins', label: 'First response (minutes)', type: 'number', half: true },
      { key: 'resolution_mins', label: 'Resolution (minutes)', type: 'number', half: true },
      { key: 'business_hours', label: 'Business hours', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'disabled'], half: true },
    ],
  },
  campaigns: {
    table: 'campaigns',
    label: 'Campaigns',
    singular: 'Campaign',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['name', 'subject', 'category'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'channel', 'category'],
    list: ['name', 'channel', 'status', 'audience_count', 'sent_count', 'opened', 'clicked', 'scheduled_at'],
    fields: [
      { key: 'name', label: 'Campaign name', required: true },
      { key: 'channel', label: 'Channel', type: 'select', options: ['email', 'sms', 'whatsapp'], half: true },
      { key: 'category', label: 'Category', half: true },
      { key: 'list_id', label: 'Audience list', type: 'ref', ref: 'lists', half: true },
      { key: 'template_id', label: 'Email template', type: 'ref', ref: 'templates', half: true },
      { key: 'subject', label: 'Subject', half: true },
      { key: 'sender', label: 'Sender', half: true },
      { key: 'scheduled_at', label: 'Schedule', type: 'datetime', half: true },
      { key: 'timezone', label: 'Timezone', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'], half: true },
      { key: 'content', label: 'Content', type: 'textarea' },
      { key: 'body_html', label: 'Body HTML' },
    ],
  },
  email_templates: {
    table: 'email_templates',
    label: 'Email Templates',
    singular: 'Template',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['name', 'subject', 'category'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'category'],
    list: ['name', 'category', 'subject', 'status', 'updated_at'],
    fields: [
      { key: 'name', label: 'Template name', required: true },
      { key: 'category', label: 'Category', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'archived'], half: true },
      { key: 'subject', label: 'Subject line', half: true },
      { key: 'preview_text', label: 'Preview text', half: true },
      { key: 'body', label: 'HTML body', type: 'textarea' },
      { key: 'html', label: 'Designed HTML', type: 'textarea' },
      { key: 'css', label: 'Designed CSS', type: 'textarea' },
      { key: 'plain_text', label: 'Plain-text version', type: 'textarea' },
      { key: 'builder', label: 'Builder mode', half: true },
      { key: 'thumbnail', label: 'Thumbnail', half: true },
    ],
  },
  sequences: {
    table: 'sequences',
    label: 'Email Sequences',
    singular: 'Sequence',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['name', 'description'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status'],
    list: ['name', 'status', 'created_at', 'updated_at'],
    fields: [
      { key: 'name', label: 'Sequence name', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'paused', 'archived'], half: true },
      { key: 'exit_on_reply', label: 'Exit on reply', type: 'checkbox', half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  forms: {
    table: 'forms',
    label: 'Forms',
    singular: 'Form',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['name', 'slug'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'mapping'],
    list: ['name', 'slug', 'mapping', 'status', 'submission_count', 'updated_at'],
    fields: [
      { key: 'name', label: 'Form name', required: true },
      { key: 'slug', label: 'Public slug', required: true, half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'paused'], half: true },
      { key: 'mapping', label: 'Creates', type: 'select', options: ['lead', 'contact'], half: true },
      { key: 'success_message', label: 'Success message', type: 'textarea' },
      { key: 'consent_text', label: 'Consent text', type: 'textarea' },
    ],
    unique: [{ columns: ['slug'], label: 'slug' }],
  },
  landing_pages: {
    table: 'landing_pages',
    label: 'Landing Pages',
    singular: 'Landing page',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['name', 'slug'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'template'],
    list: ['name', 'slug', 'status', 'views', 'form_id', 'updated_at'],
    fields: [
      { key: 'name', label: 'Page name', required: true },
      { key: 'slug', label: 'Slug', required: true, half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'], half: true },
      { key: 'template', label: 'Template', type: 'select', options: ['lead-magnet', 'webinar', 'blank', 'imported'], half: true },
      { key: 'html', label: 'HTML', type: 'textarea' },
      { key: 'css', label: 'CSS', type: 'textarea' },
      { key: 'form_id', label: 'Connected form', type: 'ref', ref: 'forms', half: true },
      { key: 'seo_title', label: 'SEO title', half: true },
      { key: 'seo_description', label: 'SEO description' },
    ],
    unique: [{ columns: ['slug'], label: 'slug' }],
  },
  content_items: {
    table: 'content_items',
    label: 'Content Hub',
    singular: 'Content',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['title', 'category', 'body'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['type', 'status', 'category'],
    list: ['title', 'type', 'category', 'status', 'updated_at'],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['blog', 'faq', 'page'], half: true },
      { key: 'slug', label: 'Slug', required: true, half: true },
      { key: 'category', label: 'Category', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published'], half: true },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
      { key: 'body', label: 'Body', type: 'textarea' },
    ],
  },
  products: {
    table: 'products',
    label: 'Products',
    singular: 'Product',
    module: 'sales',
    permission: 'sales.write',
    search: ['name', 'sku', 'description'],
    sort: 'name',
    dir: 'asc',
    softDelete: true,
    filters: ['status', 'type'],
    list: ['name', 'sku', 'type', 'unit_price', 'currency', 'status'],
    fields: [
      { key: 'name', label: 'Product name', required: true, half: true },
      { key: 'sku', label: 'SKU', half: true },
      { key: 'type', label: 'Type', type: 'select', options: ['plan', 'service', 'addon'], half: true },
      { key: 'unit_price', label: 'Unit price', type: 'money', half: true },
      { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'AED'], half: true },
      { key: 'tax_rate', label: 'Tax rate %', type: 'number', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'archived'], half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    transform: (v) => ({ ...v, unit_price: Number(v.unit_price ?? 0), tax_rate: Number(v.tax_rate ?? 0) }),
  },
  documents: {
    table: 'documents',
    label: 'Documents',
    singular: 'Document',
    module: 'sales',
    permission: 'sales.write',
    search: ['number', 'title', 'notes'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['doc_type', 'status'],
    list: ['number', 'title', 'doc_type', 'total', 'status', 'due_date'],
    fields: [
      { key: 'number', label: 'Document number', half: true },
      { key: 'doc_type', label: 'Type', type: 'select', options: ['quote', 'invoice', 'proposal'], half: true },
      { key: 'title', label: 'Title', half: true },
      { key: 'contact_id', label: 'Customer', type: 'ref', ref: 'contacts', half: true },
      { key: 'company_id', label: 'Company', type: 'ref', ref: 'companies', half: true },
      { key: 'deal_id', label: 'Deal', type: 'ref', ref: 'deals', half: true },
      { key: 'issue_date', label: 'Issue date', type: 'date', half: true },
      { key: 'due_date', label: 'Due date', type: 'date', half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'sent', 'accepted', 'rejected', 'paid', 'overdue', 'cancelled'], half: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  workflows: {
    table: 'workflows',
    label: 'Automations',
    singular: 'Workflow',
    module: 'marketing',
    permission: 'workflows.write',
    search: ['name', 'description', 'trigger_type'],
    sort: 'updated_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'module', 'trigger_type'],
    list: ['name', 'module', 'trigger_type', 'status', 'updated_at'],
    fields: [
      { key: 'name', label: 'Workflow name', required: true },
      { key: 'module', label: 'Module', type: 'select', options: ['marketing', 'sales', 'support', 'crm'], half: true },
      { key: 'trigger_type', label: 'Trigger', type: 'select', options: ['contact.created', 'contact.updated', 'lead.created', 'lead.status_changed', 'deal.created', 'deal.stage_changed', 'task.created', 'task.completed', 'ticket.created', 'ticket.updated', 'form.submitted'], half: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  social_posts: {
    table: 'social_posts',
    label: 'Social Posts',
    singular: 'Post',
    module: 'marketing',
    permission: 'marketing.write',
    search: ['content', 'channel'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['status', 'channel'],
    list: ['content', 'channel', 'status', 'scheduled_at', 'created_at'],
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['linkedin', 'facebook', 'instagram', 'x'], half: true },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'scheduled', 'published', 'failed'], half: true },
      { key: 'scheduled_at', label: 'Schedule', type: 'datetime', half: true },
      { key: 'content', label: 'Post copy', type: 'textarea' },
    ],
  },
  reports: {
    table: 'reports',
    label: 'Reports',
    singular: 'Report',
    module: 'system',
    permission: 'audit.read',
    search: ['name', 'domain'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['domain'],
    list: ['name', 'domain', 'metrics', 'visibility', 'updated_at'],
    fields: [
      { key: 'name', label: 'Report name', required: true },
      { key: 'domain', label: 'Domain', type: 'select', options: ['deals', 'leads', 'campaigns', 'tickets', 'activities'], half: true },
      { key: 'visibility', label: 'Visibility', type: 'select', options: ['private', 'team'], half: true },
      { key: 'metrics', label: 'Metrics', half: true },
      { key: 'filters', label: 'Filters', type: 'json', half: true },
    ],
  },
  files: {
    table: 'files',
    label: 'Files Repository',
    singular: 'File',
    module: 'system',
    permission: 'crm.write',
    search: ['name', 'folder'],
    sort: 'created_at',
    dir: 'desc',
    softDelete: true,
    filters: ['folder', 'provider'],
    list: ['name', 'folder', 'mime', 'size', 'provider', 'updated_at'],
    fields: [{ key: 'name', label: 'File name', required: true }, { key: 'folder', label: 'Folder', half: true }],
  },
}

export const ENTITY_KEYS = Object.keys(ENTITIES)

/** Value coercion and validation shared by create and update. */
export function validateValues(
  def: EntityDef,
  input: Record<string, unknown>,
  partial: boolean,
): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const field of def.fields) {
    if (!(field.key in input)) continue
    const raw = input[field.key]
    const empty = raw === '' || raw === null || raw === undefined
    if (empty) {
      if (field.required) errors[field.key] = `${field.label} is required.`
      values[field.key] = null
      continue
    }
    switch (field.type) {
      case 'number':
      case 'money': {
        const num = Number(raw)
        if (!Number.isFinite(num)) errors[field.key] = `${field.label} must be a number.`
        else if (field.type === 'money' && num < 0) errors[field.key] = `${field.label} cannot be negative.`
        else values[field.key] = num
        break
      }
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) errors[field.key] = 'Enter a valid email address.'
        else values[field.key] = String(raw).trim()
        break
      case 'url':
        if (!/^https?:\/\/[^\s.]+\.\S+/.test(String(raw))) errors[field.key] = 'Enter a full URL starting with http(s)://'
        else values[field.key] = String(raw).trim()
        break
      case 'tel':
        if (!/^[+0-9()\-\s]{6,24}$/.test(String(raw))) errors[field.key] = 'Enter a valid phone number.'
        else values[field.key] = String(raw).trim()
        break
      case 'select':
        if (field.options && !field.options.includes(String(raw))) errors[field.key] = `Choose a valid ${field.label.toLowerCase()}.`
        else values[field.key] = String(raw)
        break
      case 'checkbox':
        values[field.key] = raw === true || raw === 1 || raw === '1' || raw === 'on' ? 1 : 0
        break
      case 'json':
        values[field.key] = typeof raw === 'string' ? raw : JSON.stringify(raw)
        break
      default:
        values[field.key] = typeof raw === 'string' ? raw.trim() : raw
    }
  }
  if (!partial) {
    for (const field of def.fields) {
      if (field.required && !(field.key in values)) errors[field.key] = `${field.label} is required.`
    }
  }
  const transformed = def.transform ? def.transform(values) : values
  return { values: transformed, errors }
}

export async function checkUnique(
  env: Env,
  orgId: string,
  def: EntityDef,
  values: Record<string, unknown>,
  excludeId?: string,
): Promise<string | null> {
  for (const rule of def.unique ?? []) {
    const column = rule.columns[0]
    if (!(column in values) || values[column] == null) continue
    const row = await env.DB.prepare(
      `SELECT id FROM ${def.table} WHERE org_id = ? AND lower(${column}) = lower(?) AND deleted_at IS NULL ${
        excludeId ? 'AND id != ?' : ''
      } LIMIT 1`,
    )
      .bind(...[orgId, String(values[column]), ...(excludeId ? [excludeId] : [])])
      .first<{ id: string }>()
    if (row) return `A record with that ${rule.label} already exists.`
  }
  return null
}

export async function logActivity(
  env: Env,
  orgId: string,
  actorId: string | null,
  type: string,
  entityType: string | null,
  entityId: string | null,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  await insertRow(env, 'activities', {
    id: uid(),
    org_id: orgId,
    actor_id: actorId,
    type,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata: metadata ? JSON.stringify(metadata) : null,
    created_at: nowIso(),
  })
}

export async function audit(
  env: Env,
  orgId: string,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  ip?: string,
) {
  await insertRow(env, 'audit_logs', {
    id: uid(),
    org_id: orgId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    ip: ip ?? null,
    created_at: nowIso(),
  })
}

export async function notify(
  env: Env,
  orgId: string,
  userId: string,
  type: string,
  title: string,
  body: string,
  entityType?: string,
  entityId?: string,
) {
  if (!userId) return
  await insertRow(env, 'notifications', {
    id: uid(),
    org_id: orgId,
    user_id: userId,
    type,
    title,
    body,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    created_at: nowIso(),
  })
}

export { jsonParse, uid, nowIso }
