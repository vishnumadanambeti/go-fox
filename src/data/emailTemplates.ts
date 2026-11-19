/**
 * Professional email template presets for the GoFox email studio.
 * Each preset is a complete, responsive table-based HTML email (works in Gmail, Outlook and Apple Mail)
 * with its own layout and palette — they are not recolours of a single template.
 */
export type EmailPreset = {
  slug: string
  name: string
  category: string
  subject: string
  previewText: string
  description: string
  accent: string
  html: string
  plain: string
}

const button = (label: string, href: string, bg: string, color = '#ffffff') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0"><tr><td style="border-radius:8px;background:${bg}"><a href="${href}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${color};text-decoration:none;letter-spacing:.2px">${label}</a></td></tr></table>`

const wrap = (inner: string, bg = '#F4F6F9', width = 600) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GoFox</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${width}px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08)">
${inner}
</table>
<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#98A2B3;text-align:center">Sent with GoFox CRM · <a href="{{unsubscribe_url}}" style="color:#98A2B3">Unsubscribe</a></p>
</td></tr></table></body></html>`

const P = (text: string, color = '#475467', size = 15) =>
  `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.65;color:${color}">${text}</p>`

const H = (text: string, color = '#101828', size = 26) =>
  `<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.25;color:${color};letter-spacing:-.4px">${text}</h1>`

export const EMAIL_PRESETS: EmailPreset[] = [
  {
    slug: 'welcome',
    name: 'Warm welcome',
    category: 'Onboarding',
    subject: 'Welcome aboard, {{first_name}} 👋',
    previewText: 'Your workspace is ready — here are the first three things to do.',
    description: 'Friendly onboarding email with a three-step checklist and a single primary action.',
    accent: '#FF7417',
    html: wrap(`
<tr><td style="padding:40px 40px 0;text-align:center">
  <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#FFF1E6;font-family:Arial;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#C2410C;text-transform:uppercase">Welcome</div>
  <h1 style="margin:18px 0 10px;font-family:Arial;font-size:30px;line-height:1.2;color:#17243A;letter-spacing:-.8px">Hi {{first_name}}, your workspace is ready</h1>
  <p style="margin:0 auto 26px;max-width:420px;font-family:Arial;font-size:15px;line-height:1.6;color:#5B6577">You have joined <strong style="color:#17243A">{{company_name}}</strong> on GoFox. Three quick steps and your pipeline starts working for you.</p>
</td></tr>
<tr><td style="padding:0 40px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;border-radius:12px;padding:6px">
    <tr><td style="padding:14px 16px;font-family:Arial;font-size:14px;color:#344054"><strong style="color:#FF7417">1.</strong>&nbsp; Import your contacts</td></tr>
    <tr><td style="padding:14px 16px;font-family:Arial;font-size:14px;color:#344054;border-top:1px solid #E7EAF0"><strong style="color:#FF7417">2.</strong>&nbsp; Connect your inbox</td></tr>
    <tr><td style="padding:14px 16px;font-family:Arial;font-size:14px;color:#344054;border-top:1px solid #E7EAF0"><strong style="color:#FF7417">3.</strong>&nbsp; Build your first automation</td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:26px 40px 38px">${button('Open my workspace', '{{workspace_url}}', '#FF7417')}</td></tr>`),
    plain: 'Hi {{first_name}},\n\nYour GoFox workspace for {{company_name}} is ready.\n\n1. Import your contacts\n2. Connect your inbox\n3. Build your first automation\n\nOpen your workspace: {{workspace_url}}',
  },
  {
    slug: 'password-reset',
    name: 'Password reset',
    category: 'Transactional',
    subject: 'Reset your GoFox password',
    previewText: 'This link expires in 30 minutes.',
    description: 'Minimal transactional message with a prominent single-use link and safety note.',
    accent: '#17243A',
    html: wrap(`
<tr><td style="padding:34px 36px 0">
  <table role="presentation" width="100%"><tr><td style="font-family:Arial;font-size:20px;font-weight:800;color:#17243A">GoFox</td><td align="right" style="font-family:Arial;font-size:11px;color:#98A2B3">SECURITY</td></tr></table>
  <div style="height:1px;background:#E7EAF0;margin:20px 0 28px"></div>
  ${H('Reset your password', '#17243A', 24)}
  ${P('We received a request to reset the password for <strong style="color:#17243A">{{email}}</strong>. Choose a new password below. This link is valid for 30 minutes and can only be used once.')}
</td></tr>
<tr><td style="padding:0 36px">${button('Choose a new password', '{{reset_url}}', '#17243A')}</td></tr>
<tr><td style="padding:22px 36px 36px">
  <div style="border-left:3px solid #FF7417;background:#FFF8F3;padding:12px 14px;font-family:Arial;font-size:12.5px;line-height:1.6;color:#7A5A44">If you did not request this, you can ignore this email — your password stays unchanged. Someone may have typed your address by mistake.</div>
</td></tr>`),
    plain: 'Reset your GoFox password\n\nWe received a request for {{email}}.\n\nOpen this link within 30 minutes: {{reset_url}}\n\nIf you did not request it, ignore this email.',
  },
  {
    slug: 'invoice',
    name: 'Invoice notification',
    category: 'Transactional',
    subject: 'Invoice #{{invoice_number}} from {{company_name}}',
    previewText: 'Amount due {{invoice_total}} · due {{invoice_due_date}}',
    description: 'Clean invoice summary with a totals table and a download action, corporate styling.',
    accent: '#159C91',
    html: wrap(`
<tr><td style="background:#0F2E2B;padding:26px 36px">
  <table role="presentation" width="100%"><tr>
    <td style="font-family:Arial;font-size:18px;font-weight:800;color:#ffffff">GoFox</td>
    <td align="right" style="font-family:Arial;font-size:12px;color:#9BD8CF">INVOICE #{{invoice_number}}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:30px 36px 6px">
  ${P('Hello {{first_name}}, here is your invoice for the period ending {{invoice_period_end}}.', '#475467', 14)}
  <table role="presentation" width="100%" style="margin:18px 0 4px">
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7EAF0;font-family:Arial;font-size:13px;color:#667085">Plan</td><td align="right" style="padding:10px 0;border-bottom:1px solid #E7EAF0;font-family:Arial;font-size:13px;color:#101828">{{plan_name}}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7EAF0;font-family:Arial;font-size:13px;color:#667085">Seats</td><td align="right" style="padding:10px 0;border-bottom:1px solid #E7EAF0;font-family:Arial;font-size:13px;color:#101828">{{seats}}</td></tr>
    <tr><td style="padding:16px 0 4px;font-family:Arial;font-size:14px;font-weight:700;color:#0F2E2B">Total due</td><td align="right" style="padding:16px 0 4px;font-family:Arial;font-size:22px;font-weight:800;color:#159C91">{{invoice_total}}</td></tr>
  </table>
  ${P(`Payment is due on <strong style="color:#101828">{{invoice_due_date}}</strong>.`, '#667085', 12.5)}
</td></tr>
<tr><td style="padding:8px 36px 34px">${button('View & download invoice', '{{invoice_url}}', '#159C91')}</td></tr>`),
    plain: 'Hello {{first_name}},\n\nInvoice #{{invoice_number}} for {{plan_name}} is ready.\n\nAmount due: {{invoice_total}}\nDue date: {{invoice_due_date}}\n\nView invoice: {{invoice_url}}',
  },
  {
    slug: 'order-confirmation',
    name: 'Order confirmation',
    category: 'E-Commerce',
    subject: 'Order #{{order_number}} confirmed 🎉',
    previewText: 'We are preparing your order for dispatch.',
    description: 'Product thumbnail, order lines and delivery estimate in a warm retail layout.',
    accent: '#7357D9',
    html: wrap(`
<tr><td style="padding:32px 36px 0;text-align:center">
  <div style="width:52px;height:52px;border-radius:999px;background:#F0EDFF;margin:0 auto 14px;line-height:52px;font-size:24px">🎉</div>
  ${H('Thanks, {{first_name}} — order confirmed', '#2B1B63', 24)}
  ${P('Order <strong style="color:#2B1B63">#{{order_number}}</strong> is confirmed. We will email tracking as soon as it ships.', '#5B527A', 14)}
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="background:#F8F7FF;border-radius:12px;padding:18px">
    <tr><td width="72" style="vertical-align:top"><div style="width:64px;height:64px;border-radius:10px;background:#E5DEFF;text-align:center;line-height:64px;font-size:26px">📦</div></td>
    <td style="font-family:Arial"><div style="font-size:14px;font-weight:700;color:#2B1B63">{{product_name}}</div><div style="font-size:12px;color:#6B6292;margin-top:3px">Qty {{quantity}} · {{product_variant}}</div><div style="font-size:14px;font-weight:700;color:#2B1B63;margin-top:8px">{{order_total}}</div></td></tr>
  </table>
  <table role="presentation" width="100%" style="margin-top:16px">
    <tr><td style="font-family:Arial;font-size:12px;color:#6B6292">Estimated delivery</td><td align="right" style="font-family:Arial;font-size:12px;font-weight:700;color:#2B1B63">{{delivery_date}}</td></tr>
    <tr><td style="font-family:Arial;font-size:12px;color:#6B6292;padding-top:6px">Shipping to</td><td align="right" style="font-family:Arial;font-size:12px;color:#2B1B63;padding-top:6px">{{shipping_city}}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 36px 34px">${button('Track my order', '{{order_url}}', '#7357D9')}</td></tr>`),
    plain: 'Thanks {{first_name}} — order #{{order_number}} is confirmed.\n\n{{product_name}} · Qty {{quantity}}\nTotal: {{order_total}}\nEstimated delivery: {{delivery_date}}\n\nTrack: {{order_url}}',
  },
  {
    slug: 'promo-offer',
    name: 'Seasonal offer',
    category: 'Promotional',
    subject: '{{discount_percent}}% off — 48 hours only',
    previewText: 'Use code {{promo_code}} before Sunday.',
    description: 'Bold promotional banner, coupon block and urgency line.',
    accent: '#D92D20',
    html: wrap(`
<tr><td style="background:linear-gradient(135deg,#D92D20,#FF7417);padding:36px 32px;text-align:center">
  <div style="font-family:Arial;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.8)">LIMITED TIME</div>
  <div style="font-family:Arial;font-size:52px;font-weight:800;color:#ffffff;letter-spacing:-2px;line-height:1.05;margin-top:8px">{{discount_percent}}% OFF</div>
  <div style="font-family:Arial;font-size:14px;color:rgba(255,255,255,.92);margin-top:8px">Everything in the {{category_name}} collection</div>
</td></tr>
<tr><td style="padding:30px 32px;text-align:center">
  <p style="margin:0 0 18px;font-family:Arial;font-size:16px;line-height:1.6;color:#344054">Hi {{first_name}}, your early-access code is ready. Apply it at checkout — valid until <strong>{{expiry_date}}</strong>.</p>
  <div style="border:1.5px dashed #D92D20;border-radius:10px;padding:14px;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:4px;color:#D92D20">{{promo_code}}</div>
  <div style="margin-top:22px">${button('Shop the offer', '{{shop_url}}', '#D92D20')}</div>
</td></tr>
<tr><td style="padding:0 32px 30px;text-align:center;font-family:Arial;font-size:11px;color:#98A2B3">One use per customer. Cannot be combined with other offers.</td></tr>`),
    plain: 'LImited time: {{discount_percent}}% off {{category_name}}.\n\nHi {{first_name}}, use code {{promo_code}} before {{expiry_date}}.\n\nShop: {{shop_url}}',
  },
  {
    slug: 'product-launch',
    name: 'Product announcement',
    category: 'Promotional',
    subject: 'Introducing {{product_name}}',
    previewText: 'The thing you asked for is here.',
    description: 'Dark editorial launch layout with feature grid and a strong CTA.',
    accent: '#0B1220',
    html: wrap(`
<tr><td style="background:#0B1220;padding:34px 36px 30px">
  <div style="font-family:Arial;font-size:11px;font-weight:700;letter-spacing:2.5px;color:#FF7417">NEW RELEASE</div>
  <h1 style="margin:10px 0 10px;font-family:Arial;font-size:32px;line-height:1.15;color:#ffffff;letter-spacing:-1px">{{product_name}}</h1>
  <p style="margin:0;font-family:Arial;font-size:14.5px;line-height:1.6;color:#9AA7BD">Hi {{first_name}}, {{product_tagline}}. Built with the teams in {{industry_name}} in mind.</p>
</td></tr>
<tr><td style="padding:26px 36px 8px">
  <table role="presentation" width="100%">
    <tr>
      <td width="50%" style="padding:0 8px 16px 0;vertical-align:top"><div style="font-family:Arial;font-size:13px;font-weight:700;color:#101828">⚡ Faster</div><div style="font-family:Arial;font-size:12px;color:#667085;margin-top:4px;line-height:1.5">{{feature_one}}</div></td>
      <td width="50%" style="padding:0 0 16px 8px;vertical-align:top"><div style="font-family:Arial;font-size:13px;font-weight:700;color:#101828">🔒 Safer</div><div style="font-family:Arial;font-size:12px;color:#667085;margin-top:4px;line-height:1.5">{{feature_two}}</div></td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:2px 36px 32px">${button('See what is new', '{{release_url}}', '#FF7417')}</td></tr>`),
    plain: 'Introducing {{product_name}}\n\n{{product_tagline}}\n\n{{feature_one}}\n{{feature_two}}\n\nSee what is new: {{release_url}}',
  },
  {
    slug: 'newsletter',
    name: 'Monthly digest',
    category: 'Newsletter',
    subject: '{{company_name}} monthly · {{month_name}}',
    previewText: 'Three ideas, one customer story, and what we shipped.',
    description: 'Editorial newsletter with section dividers and a story card.',
    accent: '#159C91',
    html: wrap(`
<tr><td style="padding:28px 36px 18px;border-bottom:1px solid #E7EAF0">
  <table role="presentation" width="100%"><tr><td style="font-family:Arial;font-size:15px;font-weight:800;color:#17243A;letter-spacing:-.3px">GoFox Monthly</td><td align="right" style="font-family:Arial;font-size:11px;color:#98A2B3">{{month_name}} · #{{issue_number}}</td></tr></table>
</td></tr>
<tr><td style="padding:26px 36px 0">
  <div style="font-family:Arial;font-size:10.5px;font-weight:700;letter-spacing:1.8px;color:#159C91">THIS MONTH</div>
  ${H('The quiet work behind a predictable pipeline', '#17243A', 24)}
  ${P('Hi {{first_name}} — a short read on why the best sales teams spend their Monday on data hygiene, not dials.')}
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="background:#F2FAF8;border-radius:12px;padding:20px">
    <tr><td style="font-family:Arial;font-size:12px;color:#5F7C77;line-height:1.7"><strong style="color:#11786F">In this issue</strong><br>· The 3 metrics that actually predict revenue<br>· Customer story: {{customer_name}}<br>· Product notes from the team</td></tr>
  </table>
</td></tr>
<tr><td style="padding:20px 36px 34px">${button('Read the full issue', '{{newsletter_url}}', '#159C91')}</td></tr>`),
    plain: 'GoFox Monthly · {{month_name}}\n\nThis month: The quiet work behind a predictable pipeline.\n\n· The 3 metrics that predict revenue\n· Customer story: {{customer_name}}\n· Product notes\n\nRead: {{newsletter_url}}',
  },
  {
    slug: 'event-invite',
    name: 'Event invitation',
    category: 'Events',
    subject: "You're invited: {{event_name}}",
    previewText: '{{event_date}} · {{event_location}}',
    description: 'Elegant invitation with date badge, agenda and RSVP.',
    accent: '#7357D9',
    html: wrap(`
<tr><td style="padding:34px 36px 0;text-align:center">
  <div style="display:inline-block;background:#2B1B63;color:#ffffff;border-radius:12px;padding:14px 18px;font-family:Arial">
    <div style="font-size:11px;letter-spacing:2px;color:#B9A8FF">{{event_month}}</div>
    <div style="font-size:28px;font-weight:800;line-height:1">{{event_day}}</div>
  </div>
  ${H('{{event_name}}', '#2B1B63', 26)}
  ${P('{{event_tagline}}', '#6B6292', 14)}
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="border-top:1px solid #EDE9FE;border-bottom:1px solid #EDE9FE">
    <tr><td style="padding:14px 0;font-family:Arial;font-size:12.5px;color:#6B6292">When</td><td align="right" style="padding:14px 0;font-family:Arial;font-size:12.5px;font-weight:700;color:#2B1B63">{{event_date}} · {{event_time}}</td></tr>
    <tr><td style="padding:14px 0;font-family:Arial;font-size:12.5px;color:#6B6292;border-top:1px solid #EDE9FE">Where</td><td align="right" style="padding:14px 0;font-family:Arial;font-size:12.5px;font-weight:700;color:#2B1B63">{{event_location}}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 36px 34px;text-align:center">${button('Reserve my seat', '{{rsvp_url}}', '#7357D9')}<div style="font-family:Arial;font-size:11px;color:#98A2B3;margin-top:10px">Seats are limited · {{seats_left}} remaining</div></td></tr>`),
    plain: "You're invited: {{event_name}}\n\n{{event_tagline}}\n\nWhen: {{event_date}} · {{event_time}}\nWhere: {{event_location}}\n\nReserve: {{rsvp_url}}",
  },
  {
    slug: 'appointment',
    name: 'Appointment confirmation',
    category: 'Customer Success',
    subject: 'Confirmed: {{meeting_time}} with {{owner_name}}',
    previewText: 'Calendar invite attached · reschedule any time.',
    description: 'Calendar-style confirmation with clear time block and reschedule link.',
    accent: '#FF7417',
    html: wrap(`
<tr><td style="padding:32px 36px 0">
  <div style="display:inline-block;background:#FFF1E6;color:#B54708;border-radius:8px;padding:6px 12px;font-family:Arial;font-size:11px;font-weight:700;letter-spacing:1.2px">CONFIRMED</div>
  ${H('See you {{meeting_day}}', '#17243A', 26)}
  ${P('Hi {{first_name}}, your call with <strong style="color:#17243A">{{owner_name}}</strong> is booked. A calendar invitation is attached.', '#5B6577', 14)}
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="border:1px solid #E7EAF0;border-radius:12px">
    <tr><td style="padding:18px 20px;border-bottom:1px solid #E7EAF0;font-family:Arial;font-size:14px;font-weight:700;color:#17243A">{{meeting_time}}</td></tr>
    <tr><td style="padding:16px 20px;font-family:Arial;font-size:13px;color:#5B6577;line-height:1.7">{{meeting_agenda}}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:22px 36px 34px">
  <table role="presentation"><tr>
    <td style="padding-right:10px">${button('Join the meeting', '{{meeting_url}}', '#FF7417')}</td>
    <td><a href="{{reschedule_url}}" style="font-family:Arial;font-size:12.5px;color:#667085;text-decoration:underline">Reschedule</a></td>
  </tr></table>
</td></tr>`),
    plain: 'Confirmed: {{meeting_time}} with {{owner_name}}\n\nHi {{first_name}}, your call is booked.\n{{meeting_agenda}}\n\nJoin: {{meeting_url}}\nReschedule: {{reschedule_url}}',
  },
  {
    slug: 'onboarding-day3',
    name: 'Onboarding check-in',
    category: 'Behavioral',
    subject: 'How is {{first_name}} getting on?',
    previewText: 'Two minutes to unblock yourself.',
    description: 'Behavioural nudge with a progress bar and help resources.',
    accent: '#0BA5EC',
    html: wrap(`
<tr><td style="padding:32px 36px 0">
  ${H('You are 60% set up, {{first_name}}', '#0B2239', 25)}
  ${P('Most teams finish setup in two short sessions. You are nearly there — here is what is left.', '#475467', 14)}
  <table role="presentation" width="100%" style="margin:6px 0 20px"><tr>
    <td style="background:#E7EAF0;border-radius:999px;height:8px"><div style="width:60%;height:8px;border-radius:999px;background:#0BA5EC"></div></td>
    <td width="44" align="right" style="font-family:Arial;font-size:12px;font-weight:700;color:#0B2239">60%</td>
  </tr></table>
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="background:#F0F9FF;border-radius:12px;padding:18px">
    <tr><td style="font-family:Arial;font-size:13px;line-height:1.9;color:#0B4A6F">☐ Invite a teammate<br>☑ Connect your inbox<br>☑ Import contacts</td></tr>
  </table>
</td></tr>
<tr><td style="padding:22px 36px 34px">${button('Finish setup', '{{setup_url}}', '#0BA5EC')}</td></tr>`),
    plain: 'You are 60% set up, {{first_name}}.\n\nRemaining: invite a teammate.\n\nFinish setup: {{setup_url}}',
  },
  {
    slug: 'follow-up',
    name: 'Sales follow-up',
    category: 'Sales',
    subject: 'Following up on {{deal_name}}',
    previewText: 'A short recap and one clear next step.',
    description: 'Person-to-person follow-up styled like a real human email with a signature.',
    accent: '#17243A',
    html: wrap(`
<tr><td style="padding:34px 38px 0">
  ${P('Hi {{first_name}},', '#101828', 15)}
  ${P('Thanks for the conversation about <strong style="color:#101828">{{deal_name}}</strong>. Quick recap so nothing gets lost:')}
  <table role="presentation" width="100%" style="margin:0 0 18px">
    <tr><td style="padding:8px 0 8px 14px;border-left:2px solid #FF7417;font-family:Arial;font-size:13.5px;color:#475467;line-height:1.6">You wanted a rollout that does not disrupt the team in {{company_name}}.</td></tr>
  </table>
  ${P('I have put together a two-week pilot plan. It needs about 20 minutes of your time on day one — the rest runs itself.')}
  ${P('Is {{suggested_time}} still workable for a short call?')}
</td></tr>
<tr><td style="padding:0 38px 34px">
  ${button('Book the pilot call', '{{booking_url}}', '#17243A')}
  <div style="margin-top:26px;padding-top:18px;border-top:1px solid #E7EAF0;font-family:Arial;font-size:13px;line-height:1.6;color:#475467"><strong style="color:#101828">{{owner_name}}</strong><br>{{owner_title}} · GoFox<br><a href="mailto:{{owner_email}}" style="color:#FF7417;text-decoration:none">{{owner_email}}</a></div>
</td></tr>`),
    plain: 'Hi {{first_name}},\n\nThanks for the conversation about {{deal_name}}.\n\nYou wanted a rollout that does not disrupt {{company_name}}. I have a two-week pilot plan ready.\n\nIs {{suggested_time}} still workable?\n\n{{owner_name}}\n{{owner_title}} · GoFox',
  },
  {
    slug: 'renewal',
    name: 'Subscription renewal',
    category: 'Transactional',
    subject: 'Your {{plan_name}} plan renews on {{renewal_date}}',
    previewText: 'Nothing to do — here is what changes.',
    description: 'Calm renewal notice with billing summary and retention options.',
    accent: '#159C91',
    html: wrap(`
<tr><td style="padding:30px 36px 0">
  <div style="font-family:Arial;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#159C91">BILLING</div>
  ${H('Your plan renews in 7 days', '#0F2E2B', 24)}
  ${P('Hi {{first_name}}, your <strong style="color:#0F2E2B">{{plan_name}}</strong> subscription renews on <strong style="color:#0F2E2B">{{renewal_date}}</strong>. No action needed.')}
</td></tr>
<tr><td style="padding:0 36px">
  <table role="presentation" width="100%" style="background:#F7F8FA;border-radius:12px;padding:20px">
    <tr><td style="font-family:Arial;font-size:12.5px;color:#667085">Amount</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#0F2E2B">{{renewal_amount}} / {{billing_period}}</td></tr>
    <tr><td style="font-family:Arial;font-size:12.5px;color:#667085;padding-top:10px">Payment method</td><td align="right" style="font-family:Arial;font-size:13px;color:#0F2E2B;padding-top:10px">{{payment_method}}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:22px 36px 34px">
  <table role="presentation"><tr>
    <td style="padding-right:14px">${button('Manage billing', '{{billing_url}}', '#159C91')}</td>
    <td><a href="{{cancel_url}}" style="font-family:Arial;font-size:12px;color:#98A2B3">Cancel plan</a></td>
  </tr></table>
</td></tr>`),
    plain: 'Your {{plan_name}} plan renews on {{renewal_date}}.\n\nAmount: {{renewal_amount}} / {{billing_period}}\nPayment method: {{payment_method}}\n\nManage billing: {{billing_url}}',
  },
  {
    slug: 'abandoned-cart',
    name: 'Abandoned cart',
    category: 'E-Commerce',
    subject: 'Still thinking it over, {{first_name}}?',
    previewText: 'Your cart is saved — and stock is low.',
    description: 'Warm reminder with product card, free-shipping nudge and simple return policy.',
    accent: '#FF7417',
    html: wrap(`
<tr><td style="padding:30px 34px 0">
  ${H('Your cart is still here', '#17243A', 25)}
  ${P('We saved the items you picked. Nothing is reserved, so if something catches your eye it is worth finishing now.', '#5B6577', 14)}
</td></tr>
<tr><td style="padding:0 34px">
  <table role="presentation" width="100%" style="border:1px solid #E7EAF0;border-radius:12px;padding:16px">
    <tr><td width="64"><div style="width:56px;height:56px;border-radius:8px;background:#FFF3E8;text-align:center;line-height:56px;font-size:24px">🛍️</div></td>
    <td style="font-family:Arial"><div style="font-size:13.5px;font-weight:700;color:#17243A">{{product_name}}</div><div style="font-size:12px;color:#667085;margin-top:2px">{{product_variant}} · Qty {{quantity}}</div><div style="font-size:13.5px;font-weight:700;color:#17243A;margin-top:6px">{{cart_total}}</div></td></tr>
  </table>
  <div style="margin-top:14px;font-family:Arial;font-size:12px;color:#B54708;background:#FFF8F3;border-radius:8px;padding:10px 12px">⏳ {{stock_left}} left in this size · free returns for 30 days</div>
</td></tr>
<tr><td style="padding:20px 34px 32px">${button('Finish checkout', '{{cart_url}}', '#FF7417')}</td></tr>`),
    plain: 'Still thinking it over, {{first_name}}?\n\nYour cart: {{product_name}} ({{product_variant}}) x{{quantity}} · {{cart_total}}\n\nFinish checkout: {{cart_url}}',
  },
  {
    slug: 'saas-enterprise-launch',
    name: 'Enterprise AI Pipeline Launch',
    category: 'Product Launch',
    subject: 'Introducing Autonomous Sales Workflows on GoFox 🚀',
    previewText: 'Double your pipeline velocity without adding rep headcount.',
    description: 'Dark tech editorial layout with metric badges, video preview and high-impact CTA.',
    accent: '#FF7417',
    html: wrap(`
<tr><td style="background:#0B1220;padding:42px 38px;text-align:left">
  <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:rgba(255,116,23,0.18);border:1px solid rgba(255,116,23,0.3);font-family:Arial;font-size:11px;font-weight:700;color:#FF8A3D;letter-spacing:1px;text-transform:uppercase">NEW ENTERPRISE RELEASE</div>
  <h1 style="margin:16px 0 12px;font-family:Arial;font-size:32px;line-height:1.2;color:#ffffff;letter-spacing:-.8px">The Next Evolution of Revenue Automation</h1>
  <p style="margin:0 0 24px;font-family:Arial;font-size:15px;line-height:1.6;color:#94A3B8">Hi {{first_name}}, we engineered GoFox 2.0 to eliminate repetitive CRM data entry and predict customer intent before your competitors do.</p>
  <table role="presentation" width="100%" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px">
    <tr>
      <td width="33%" align="center" style="font-family:Arial;border-right:1px solid rgba(255,255,255,0.1)">
        <div style="font-size:24px;font-weight:800;color:#FF7417">3.4x</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">Lead Velocity</div>
      </td>
      <td width="33%" align="center" style="font-family:Arial;border-right:1px solid rgba(255,255,255,0.1)">
        <div style="font-size:24px;font-weight:800;color:#10B981">99.8%</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">Inbox Delivery</div>
      </td>
      <td width="33%" align="center" style="font-family:Arial">
        <div style="font-size:24px;font-weight:800;color:#38BDF8">40 hrs</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">Saved Per Rep/Mo</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:32px 38px 12px">
  <div style="font-family:Arial;font-size:16px;font-weight:700;color:#1E293B;margin-bottom:14px">What is included in this upgrade:</div>
  <table role="presentation" width="100%">
    <tr><td style="padding:8px 0;font-family:Arial;font-size:13.5px;color:#475467"><strong style="color:#FF7417">✔ Zoho & Salesforce Bi-directional Sync</strong> — Zero data silos.</td></tr>
    <tr><td style="padding:8px 0;font-family:Arial;font-size:13.5px;color:#475467"><strong style="color:#FF7417">✔ Predictive AI Scoring</strong> — Automatically prioritize deals ready to close.</td></tr>
    <tr><td style="padding:8px 0;font-family:Arial;font-size:13.5px;color:#475467"><strong style="color:#FF7417">✔ Visual Multi-Branch Journeys</strong> — Trigger actions on email clicks or status changes.</td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:24px 38px 40px">${button('Launch My Workspace Free Trial', '{{release_url}}', '#FF7417')}</td></tr>`),
    plain: 'Introducing Autonomous Sales Workflows on GoFox 2.0\n\nHi {{first_name}},\n\nDouble your pipeline velocity without adding rep headcount.\n\n- 3.4x Lead Velocity\n- 99.8% Inbox Delivery\n- 40 hrs Saved Per Rep\n\nExplore what is new: {{release_url}}',
  },
  {
    slug: 'cyber-special-deal',
    name: 'Executive VIP Special Offer',
    category: 'Promotions',
    subject: '🔥 Exclusive: 40% Off GoFox Enterprise for {{company_name}}',
    previewText: 'Lock in founding enterprise pricing before the quarter closes.',
    description: 'High-converting urgent promotional layout with discount coupon block and guarantee lock.',
    accent: '#D92D20',
    html: wrap(`
<tr><td style="background:linear-gradient(135deg,#B91C1C,#C2410C);padding:38px 34px;text-align:center">
  <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,0.2);font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase">VIP EXECUTIVE INVITATION</div>
  <h1 style="margin:14px 0 8px;font-family:Arial;font-size:46px;font-weight:900;color:#ffffff;letter-spacing:-1.5px">40% OFF ANNUAL</h1>
  <p style="margin:0;font-family:Arial;font-size:15px;color:rgba(255,255,255,0.92)">Reserved exclusively for {{company_name}} · Expires in 48 hours</p>
</td></tr>
<tr><td style="padding:32px 34px;text-align:center">
  <p style="margin:0 0 18px;font-family:Arial;font-size:15px;line-height:1.6;color:#334155">Hi {{first_name}}, as a valued partner, we are unlocking our Enterprise Tier with custom visual workflows, multi-channel campaigns, and dedicated onboarding support.</p>
  <div style="background:#FFF8F3;border:2px dashed #EA580C;border-radius:12px;padding:16px;margin:20px 0">
    <div style="font-family:Arial;font-size:11px;font-weight:700;color:#9A3412;letter-spacing:1px;text-transform:uppercase">USE ACCESS CODE AT CHECKOUT</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;color:#C2410C;letter-spacing:4px;margin-top:4px">GOFOX-VIP-40</div>
    <div style="font-family:Arial;font-size:11.5px;color:#78350F;margin-top:6px">Guaranteed price lock for the lifetime of your account.</div>
  </div>
  <div style="margin-top:24px">${button('Claim 40% Off Enterprise Now', '{{upgrade_url}}', '#EA580C')}</div>
  <p style="margin:18px 0 0;font-family:Arial;font-size:11px;color:#94A3B8">🛡️ 30-Day Money-Back Guarantee · Cancel Anytime With One Click</p>
</td></tr>`),
    plain: 'Exclusive: 40% Off GoFox Enterprise for {{company_name}}\n\nHi {{first_name}},\n\nUse code GOFOX-VIP-40 at checkout to lock in 40% off annual pricing.\n\nClaim offer: {{upgrade_url}}',
  },
  {
    slug: 'case-study-velocity',
    name: 'Customer Success Story: +340% Pipeline',
    category: 'Case Studies',
    subject: 'How {{company_name}} can replicate Acme Corp’s +340% Pipeline Velocity 📈',
    previewText: 'A breakdown of the exact 3-step automation blueprint they used.',
    description: 'B2B social proof layout with executive quote, before/after contrast and blueprint breakdown.',
    accent: '#059669',
    html: wrap(`
<tr><td style="background:#064E3B;padding:36px 36px">
  <table role="presentation" width="100%">
    <tr>
      <td style="font-family:Arial;font-size:11px;font-weight:700;color:#6EE7B7;letter-spacing:1.5px;text-transform:uppercase">CASE STUDY & ROI REPORT</td>
      <td align="right" style="font-family:Arial;font-size:11px;color:#A7F3D0">5 MIN READ</td>
    </tr>
  </table>
  <h1 style="margin:14px 0 0;font-family:Arial;font-size:28px;line-height:1.25;color:#ffffff;letter-spacing:-.5px">How Acme Scaled from $2M to $8.4M ARR Using GoFox Workflows</h1>
</td></tr>
<tr><td style="padding:32px 36px 0">
  <p style="margin:0 0 20px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">Hi {{first_name}}, before migrating to GoFox, Acme Corp’s sales reps spent 14 hours a week manually copying lead data between forms, spreadsheets, and emails.</p>
  <div style="background:#F0FDF4;border-left:4px solid #10B981;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0 0 10px;font-family:Georgia,serif;font-style:italic;font-size:15px;line-height:1.6;color:#065F46">“Switching to GoFox gave us the fastest ramp-up we have ever seen. Our deal cycle dropped from 48 days down to 14 days in the first quarter.”</p>
    <div style="font-family:Arial;font-size:12px;font-weight:700;color:#047857">Sarah Jenkins · VP of Revenue Operations, Acme</div>
  </div>
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:24px">
    <tr>
      <td width="50%" align="center" style="border-right:1px solid #E2E8F0;padding:8px">
        <div style="font-family:Arial;font-size:11px;color:#64748B;text-transform:uppercase">Before GoFox</div>
        <div style="font-family:Arial;font-size:18px;font-weight:700;color:#64748B;margin-top:4px">48 Days Cycle</div>
      </td>
      <td width="50%" align="center" style="padding:8px">
        <div style="font-family:Arial;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">With GoFox</div>
        <div style="font-family:Arial;font-size:22px;font-weight:800;color:#059669;margin-top:4px">14 Days Cycle ⚡</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:0 36px 36px">${button('Read the Full Case Study & Architecture', '{{case_study_url}}', '#059669')}</td></tr>`),
    plain: 'How Acme Scaled from $2M to $8.4M ARR Using GoFox\n\nHi {{first_name}},\n\nRead how Acme reduced deal cycle times from 48 days to 14 days using automated CRM workflows.\n\nFull case study: {{case_study_url}}',
  },
  {
    slug: 'webinar-live-demo',
    name: 'Live Masterclass & Product Demo',
    category: 'Events',
    subject: 'Live Masterclass: Scaling Outbound & Inbound CRM in 2026 🎙️',
    previewText: 'Save your seat for Thursday · Live Q&A and workflow templates provided.',
    description: 'Event registration layout with calendar badge, speaker bio, and seats remaining counter.',
    accent: '#4F46E5',
    html: wrap(`
<tr><td style="background:#1E1B4B;padding:36px 36px;text-align:center">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.4);font-family:Arial;font-size:11px;font-weight:700;color:#A5B4FC;letter-spacing:1px">LIVE INTERACTIVE WORKSHOP</div>
  <h1 style="margin:14px 0 10px;font-family:Arial;font-size:28px;line-height:1.2;color:#ffffff">The Modern Revenue Stack: Zero-Code Automations</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#C7D2FE">Hosted by GoFox Product Architecture Team · 45 mins + Live Q&A</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <table role="presentation" width="100%" style="background:#EEF2FF;border-radius:12px;padding:18px;margin-bottom:20px">
    <tr>
      <td width="60" align="center" style="vertical-align:middle">
        <div style="background:#4F46E5;color:#ffffff;border-radius:8px;padding:8px 10px;font-family:Arial;text-align:center">
          <div style="font-size:10px;letter-spacing:1px;font-weight:700">OCT</div>
          <div style="font-size:22px;font-weight:800;line-height:1">24</div>
        </div>
      </td>
      <td style="padding-left:14px;font-family:Arial">
        <div style="font-size:14px;font-weight:700;color:#1E1B4B">Thursday, October 24, 2026</div>
        <div style="font-size:12px;color:#4338CA;margin-top:2px">11:00 AM EDT · 4:00 PM BST · Online (Zoom)</div>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14px;line-height:1.6;color:#334155">Hi {{first_name}}, join 400+ SaaS leaders as we demonstrate the exact workflows top companies use to turn inbound web visitors into signed contracts.</p>
  <div style="margin-top:22px;text-align:center">${button('Reserve My Seat (Free Registration)', '{{webinar_url}}', '#4F46E5')}</div>
  <p style="margin:14px 0 0;text-align:center;font-family:Arial;font-size:11.5px;color:#64748B">⏳ Only 38 seats remaining for the live cohort</p>
</td></tr>`),
    plain: 'Live Masterclass: Scaling Outbound & Inbound CRM in 2026\n\nThursday, October 24, 2026 at 11:00 AM EDT\n\nReserve your seat: {{webinar_url}}',
  },
  {
    slug: 're-engagement-credit',
    name: 'Pipeline Win-Back ($250 Credit)',
    category: 'Re-engagement',
    subject: 'We miss you, {{first_name}} — here is a $250 credit for {{company_name}}',
    previewText: 'A lot has changed in GoFox. Come back and see what is new.',
    description: 'Personalized win-back letter layout with credits badge, feature recap and one-click reactivation.',
    accent: '#FF7417',
    html: wrap(`
<tr><td style="padding:36px 36px 0">
  <div style="display:inline-block;padding:4px 10px;border-radius:6px;background:#FFF1E6;color:#C2410C;font-family:Arial;font-size:11px;font-weight:700">ACCOUNT STATUS: INACTIVE</div>
  <h1 style="margin:14px 0 12px;font-family:Arial;font-size:26px;color:#0F172A">We would love to welcome you back, {{first_name}}</h1>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#475467">It has been a little while since you logged into your workspace for <strong style="color:#0F172A">{{company_name}}</strong>. In that time, our engineering team has shipped over 40 major updates including visual automations, email builders, and predictive AI lead scoring.</p>
  <table role="presentation" width="100%" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px;margin:20px 0">
    <tr>
      <td width="48" style="font-size:28px">🎁</td>
      <td style="font-family:Arial">
        <div style="font-size:14px;font-weight:700;color:#92400E">$250 Automation Credit Applied</div>
        <div style="font-size:12px;color:#B45309;margin-top:2px">Valid on your account for the next 14 days. No minimum spend required.</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:6px 36px 36px">${button('Reactivate Workspace & Claim $250', '{{claim_url}}', '#FF7417')}</td></tr>`),
    plain: 'We miss you, {{first_name}} — here is a $250 credit for {{company_name}}\n\nLog back into your workspace to explore GoFox 2.0:\n\nReactivate: {{claim_url}}',
  },
  {
    slug: 'lead-magnet-guide',
    name: 'Industry Benchmark Report Download',
    category: 'Lead Generation',
    subject: 'Your 2026 SaaS Revenue Benchmark Report is ready 📊',
    previewText: 'Data from 850+ B2B companies on conversion, churn and payback.',
    description: 'Lead generation delivery template with report mockup, key takeaways bullet list, and direct PDF download.',
    accent: '#2563EB',
    html: wrap(`
<tr><td style="background:#1E3A8A;padding:36px 36px;text-align:center">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,0.15);font-family:Arial;font-size:10.5px;font-weight:700;color:#BFDBFE;letter-spacing:1px;text-transform:uppercase">RESEARCH REPORT</div>
  <h1 style="margin:14px 0 8px;font-family:Arial;font-size:26px;color:#ffffff;line-height:1.25">2026 Enterprise Pipeline Benchmark</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#93C5FD">Complimentary analysis curated for {{company_name}}</p>
</td></tr>
<tr><td style="padding:32px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">Hi {{first_name}}, thanks for requesting our latest benchmark report. Inside you will find verified data from 850+ fast-growing software companies.</p>
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin:20px 0">
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">Key Insight 1:</strong> Top quartiles convert 32% of MQLs within 48 hours.</td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">Key Insight 2:</strong> Multi-channel sequence automation reduces rep churn by 41%.</td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">Key Insight 3:</strong> Automated qualification workflows recover 18% of stalled deals.</td></tr>
  </table>
  <div style="text-align:center;margin-top:24px">${button('Download PDF Report (18 MB)', '{{download_url}}', '#2563EB')}</div>
</td></tr>`),
    plain: 'Your 2026 SaaS Revenue Benchmark Report is ready.\n\nDownload your copy: {{download_url}}',
  },
  {
    slug: 'b2b-executive-brief',
    name: 'Executive CEO Briefing & Strategy',
    category: 'B2B Enterprise',
    subject: 'Q4 Pipeline Architecture Memo for {{company_name}}',
    previewText: 'Three observations on outbound economics from our product leadership.',
    description: 'Refined editorial letter format with serif styling, pull quotes, and executive consultation booking.',
    accent: '#1E293B',
    html: wrap(`
<tr><td style="padding:40px 42px 0">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#64748B;text-transform:uppercase">EXECUTIVE BRIEFING · GOFOX REVENUE LABS</div>
  <div style="height:1px;background:#E2E8F0;margin:16px 0 24px"></div>
  <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:16px;line-height:1.75;color:#1E293B">Dear {{first_name}},</p>
  <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15px;line-height:1.75;color:#334155">Over the last quarter, our architecture team analyzed more than 2.4 million pipeline transitions across enterprise sales teams. One pattern proved unmistakable: teams that synchronize CRM status transitions with automated email follow-up close deals 2.8x faster than manual dialers.</p>
  <blockquote style="margin:24px 0;padding:12px 20px;border-left:3px solid #2563EB;background:#F8FAFC;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#1E293B">
    “Revenue predictability is never a talent problem; it is a system latency problem.”
  </blockquote>
  <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:15px;line-height:1.75;color:#334155">I would welcome 15 minutes to share our revenue architecture review for {{company_name}}.</p>
</td></tr>
<tr><td style="padding:0 42px 40px">
  ${button('Schedule 15-Minute Architecture Review', '{{calendar_url}}', '#1E293B')}
  <div style="margin-top:24px;font-family:Arial;font-size:12.5px;color:#64748B">
    <strong>David Vance</strong><br>Chief Product Architect, GoFox
  </div>
</td></tr>`),
    plain: 'Q4 Pipeline Architecture Memo for {{company_name}}\n\nDear {{first_name}},\n\nSchedule a 15-minute briefing: {{calendar_url}}\n\nDavid Vance, Chief Product Architect',
  },
  {
    slug: 'sales-cold-outreach',
    name: 'Consultative 1-on-1 Sales Outreach',
    category: 'Sales Outreach',
    subject: 'Quick question about {{company_name}}’s pipeline automation',
    previewText: 'Noticed your team’s recent expansion in {{industry_name}}.',
    description: 'Human-to-human consultative cold outreach designed to avoid spam filters and spark conversations.',
    accent: '#0D9488',
    html: wrap(`
<tr><td style="padding:36px 36px 0">
  <p style="margin:0 0 14px;font-family:Arial;font-size:14.5px;color:#1E293B">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;font-family:Arial;font-size:14px;line-height:1.65;color:#334155">Saw that {{company_name}} recently expanded the revenue team. Typically when teams scale past 20 reps, CRM data hygiene and manual follow-ups become the primary bottleneck slowing deal cycles.</p>
  <p style="margin:0 0 14px;font-family:Arial;font-size:14px;line-height:1.65;color:#334155">We built GoFox to automate repetitive stage transitions, lead scoring, and multi-channel journeys so your reps focus entirely on conversations.</p>
  <p style="margin:0 0 20px;font-family:Arial;font-size:14px;color:#1E293B">Would you be opposed to a brief 10-minute preview on Thursday morning?</p>
</td></tr>
<tr><td style="padding:0 36px 36px">
  ${button('Pick a 10-Minute Slot', '{{calendar_url}}', '#0D9488')}
  <p style="margin:20px 0 0;font-family:Arial;font-size:12px;color:#64748B">P.S. If you are not the right person for revenue systems at {{company_name}}, who would you recommend I reach out to?</p>
</td></tr>`),
    plain: 'Hi {{first_name}},\n\nQuick question about {{company_name}}’s pipeline automation.\n\nPick a 10-min slot: {{calendar_url}}',
  },
  {
    slug: 'product-update-changelog',
    name: 'Monthly Feature Release Changelog',
    category: 'Product Marketing',
    subject: 'What is new in GoFox v2.5: Visual Journeys & AI Forecaster 🚀',
    previewText: '12 new features, 8 performance enhancements, and 0 breaking changes.',
    description: 'Clean product release changelog layout with version badges, improvement bullets, and documentation link.',
    accent: '#2563EB',
    html: wrap(`
<tr><td style="background:#0F172A;padding:32px 36px">
  <table role="presentation" width="100%"><tr>
    <td style="font-family:Arial;font-size:11px;font-weight:700;color:#38BDF8;letter-spacing:1px">CHANGELOG · RELEASE v2.5</td>
    <td align="right" style="font-family:Arial;font-size:11px;color:#94A3B8">{{release_date}}</td>
  </tr></table>
  <h1 style="margin:12px 0 0;font-family:Arial;font-size:26px;color:#ffffff">What We Shipped in October</h1>
</td></tr>
<tr><td style="padding:28px 36px">
  <div style="font-family:Arial;font-size:14px;font-weight:700;color:#1E293B;margin-bottom:8px">✨ Major Highlights</div>
  <table role="presentation" width="100%" style="margin-bottom:20px">
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">Make.com Visual Flow Canvas:</strong> Build complex branching automations with interactive node simulations.</td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">30+ Selling Email Templates:</strong> Launch multi-channel campaigns directly from the template builder in 1 click.</td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13px;color:#475467"><strong style="color:#2563EB">Predictive AI Scoring:</strong> Auto-rank lead conversion probability from 1 to 100 based on CRM interactions.</td></tr>
  </table>
  <div style="font-family:Arial;font-size:14px;font-weight:700;color:#1E293B;margin-bottom:8px">⚡ Performance & Speed</div>
  <p style="margin:0 0 20px;font-family:Arial;font-size:13px;color:#475467">Worker API responses now resolve in under 45ms with Cloudflare D1 query indexing.</p>
  <div style="text-align:center">${button('Explore Full Release Notes', '{{docs_url}}', '#2563EB')}</div>
</td></tr>`),
    plain: 'What is new in GoFox v2.5\n\n- Visual Flow Canvas\n- 30+ Selling Email Templates\n- Predictive AI Scoring\n\nRead release notes: {{docs_url}}',
  },
  {
    slug: 'customer-satisfaction-nps',
    name: 'Customer Satisfaction & NPS Survey',
    category: 'Customer Retention',
    subject: 'How likely are you to recommend GoFox to a colleague?',
    previewText: 'One quick tap from 1 to 10 helps our product team improve.',
    description: 'Clean survey email featuring a clickable 1–10 button scale and brief feedback prompt.',
    accent: '#0D9488',
    html: wrap(`
<tr><td style="padding:36px 36px 0;text-align:center">
  <h1 style="margin:0 0 10px;font-family:Arial;font-size:24px;color:#1E293B">Your opinion shapes our roadmap</h1>
  <p style="margin:0 0 24px;font-family:Arial;font-size:14px;color:#64748B">Hi {{first_name}}, how likely are you to recommend GoFox CRM to a friend or industry peer?</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="margin:0 auto 12px">
    <tr>
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => `
        <td align="center" style="background:#F1F5F9;border-radius:6px;padding:10px 0;border:1px solid #E2E8F0">
          <a href="{{survey_url}}?score=${num}" style="font-family:Arial;font-size:14px;font-weight:700;color:#1E293B;text-decoration:none;display:block">${num}</a>
        </td>
      `).join('')}
    </tr>
  </table>
  <table role="presentation" width="100%">
    <tr>
      <td style="font-family:Arial;font-size:11px;color:#94A3B8">Not likely at all</td>
      <td align="right" style="font-family:Arial;font-size:11px;color:#94A3B8">Extremely likely</td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:24px 36px 36px;text-align:center;font-family:Arial;font-size:12px;color:#64748B">
  Takes less than 30 seconds. Your feedback goes directly to our executive engineering team.
</td></tr>`),
    plain: 'How likely are you to recommend GoFox from 1 to 10?\n\nTake the 30-second survey: {{survey_url}}',
  },
  {
    slug: 'vip-loyalty-rewards',
    name: 'VIP Loyalty Tier Status & Perks',
    category: 'Customer Retention',
    subject: 'You have unlocked Platinum Partner Status on GoFox 🌟',
    previewText: 'Exclusive priority support and 15,000 bonus automation credits inside.',
    description: 'Gamified loyalty rewards card showing current tier, reward points balance, and unlockable enterprise perks.',
    accent: '#D97706',
    html: wrap(`
<tr><td style="background:linear-gradient(135deg,#78350F,#D97706);padding:36px 36px;text-align:center;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#FDE68A;text-transform:uppercase">VIP PARTNER REWARDS</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:28px;letter-spacing:-.5px">Welcome to Platinum Tier</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#FEF3C7">{{company_name}} is in the top 5% of active CRM workspaces</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <table role="presentation" width="100%" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px;margin-bottom:20px">
    <tr>
      <td width="50%" align="center" style="border-right:1px solid #FDE68A;padding:8px">
        <div style="font-family:Arial;font-size:11px;color:#92400E;text-transform:uppercase">Available Credits</div>
        <div style="font-family:Arial;font-size:24px;font-weight:800;color:#B45309;margin-top:2px">15,000 pts</div>
      </td>
      <td width="50%" align="center" style="padding:8px">
        <div style="font-family:Arial;font-size:11px;color:#92400E;text-transform:uppercase">Next Tier</div>
        <div style="font-family:Arial;font-size:18px;font-weight:700;color:#B45309;margin-top:4px">Diamond VIP</div>
      </td>
    </tr>
  </table>
  <div style="font-family:Arial;font-size:13.5px;font-weight:700;color:#1E293B;margin-bottom:10px">Your Active Platinum Perks:</div>
  <p style="margin:0 0 6px;font-family:Arial;font-size:13px;color:#475467">✔ 15-minute dedicated SLA response times</p>
  <p style="margin:0 0 6px;font-family:Arial;font-size:13px;color:#475467">✔ Complimentary quarterly architecture review</p>
  <p style="margin:0 0 20px;font-family:Arial;font-size:13px;color:#475467">✔ Priority access to new AI workflow beta features</p>
  <div style="text-align:center">${button('Access VIP Partner Portal', '{{vip_portal_url}}', '#D97706')}</div>
</td></tr>`),
    plain: 'You have unlocked Platinum Partner Status on GoFox.\n\nEnjoy 15k bonus credits and priority SLA support.\n\nOpen portal: {{vip_portal_url}}',
  },
  {
    slug: 'black-friday-doorbuster',
    name: 'Black Friday & Cyber Week Mega Deal',
    category: 'Seasonal Campaigns',
    subject: '⚡ Black Friday: 50% Off Everything in GoFox Enterprise',
    previewText: 'The biggest promotion of the year ends midnight Friday.',
    description: 'High-contrast festive seasonal campaign layout featuring 50% discount hero and countdown urgency.',
    accent: '#E11D48',
    html: wrap(`
<tr><td style="background:#0F172A;padding:40px 36px;text-align:center">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:2px;color:#FB7185;text-transform:uppercase">CYBER WEEK SPECIAL</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:46px;font-weight:900;color:#ffffff;letter-spacing:-1.5px">50% OFF ALL PLANS</h1>
  <p style="margin:0;font-family:Arial;font-size:15px;color:#E2E8F0">Lock in half-price enterprise revenue tools for life</p>
</td></tr>
<tr><td style="padding:32px 36px;text-align:center">
  <p style="margin:0 0 20px;font-family:Arial;font-size:15px;line-height:1.6;color:#334155">Hi {{first_name}}, for the next 72 hours only, upgrade {{company_name}} to GoFox Unlimited with complete marketing automation and visual flow canvases at 50% off.</p>
  <div style="background:#FFF1F2;border:2px dashed #E11D48;border-radius:12px;padding:16px;margin:20px 0">
    <div style="font-family:Arial;font-size:11px;font-weight:700;color:#9F1239;letter-spacing:1px">PROMO CODE (AUTOMATICALLY APPLIED)</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;color:#E11D48;letter-spacing:3px;margin:4px 0">CYBER50</div>
    <div style="font-family:Arial;font-size:11.5px;color:#881337">Offer strictly closes Friday at 11:59 PM EST.</div>
  </div>
  <div style="margin-top:24px">${button('Claim 50% Off Lifetime Discount', '{{checkout_url}}', '#E11D48')}</div>
</td></tr>`),
    plain: 'Black Friday: 50% Off Everything in GoFox Enterprise.\n\nUse code CYBER50 before Friday midnight.\n\nClaim deal: {{checkout_url}}',
  },
  {
    slug: 'customer-referral-invite',
    name: 'Customer Referral Program (Give $100, Get $100)',
    category: 'Promotions',
    subject: 'Give $100, Get $100: Share GoFox with your network 🎁',
    previewText: 'Earn invoice credits whenever a peer launches their pipeline on GoFox.',
    description: 'Referral program invitation with dual benefit cards, unique tracking link, and 3-step timeline.',
    accent: '#2563EB',
    html: wrap(`
<tr><td style="background:#1E40AF;padding:36px 36px;text-align:center;color:#ffffff">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,0.2);font-family:Arial;font-size:11px;font-weight:700">REFERRAL PROGRAM</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:28px">Give $100, Get $100</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#BFDBFE">Share the revenue stack you love with your network</p>
</td></tr>
<tr><td style="padding:32px 36px">
  <p style="margin:0 0 18px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">Hi {{first_name}}, whenever a friend or founder uses your personal referral link, they receive a $100 welcome credit and your workspace receives a $100 invoice discount.</p>
  <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;padding:14px;text-align:center;margin:18px 0">
    <div style="font-family:Arial;font-size:11px;color:#64748B;font-weight:700">YOUR PERSONAL SHARING LINK</div>
    <div style="font-family:monospace;font-size:14px;font-weight:700;color:#1E40AF;margin-top:4px">https://gofox.io/r/{{referral_code}}</div>
  </div>
  <div style="text-align:center;margin-top:22px">${button('Copy Referral Link & Invite', '{{referral_url}}', '#2563EB')}</div>
</td></tr>`),
    plain: 'Give $100, Get $100 with GoFox.\n\nShare your referral link: https://gofox.io/r/{{referral_code}}',
  },
  {
    slug: 'security-audit-notice',
    name: 'Security Alert: New Sign-in Detected',
    category: 'Transactional',
    subject: 'Security Alert: New login detected for {{email}}',
    previewText: 'If this was you, no action is needed.',
    description: 'High-priority security notification with device details, IP location, and one-click session termination.',
    accent: '#DC2626',
    html: wrap(`
<tr><td style="padding:32px 36px 0">
  <table role="presentation" width="100%"><tr>
    <td style="font-family:Arial;font-size:18px;font-weight:800;color:#1E293B">GoFox Security</td>
    <td align="right" style="font-family:Arial;font-size:11px;color:#DC2626;font-weight:700">ALERT</td>
  </tr></table>
  <div style="height:1px;background:#E2E8F0;margin:16px 0 22px"></div>
  <h1 style="margin:0 0 12px;font-family:Arial;font-size:22px;color:#1E293B">New sign-in to your workspace</h1>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14px;line-height:1.6;color:#475467">We noticed a new login to your account <strong>{{email}}</strong> from an unrecognized device.</p>
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:20px">
    <tr><td style="font-family:Arial;font-size:12.5px;color:#64748B;padding:4px 0">Device</td><td align="right" style="font-family:Arial;font-size:12.5px;font-weight:700;color:#1E293B">{{device_info}}</td></tr>
    <tr><td style="font-family:Arial;font-size:12.5px;color:#64748B;padding:4px 0">Location</td><td align="right" style="font-family:Arial;font-size:12.5px;font-weight:700;color:#1E293B">{{login_location}}</td></tr>
    <tr><td style="font-family:Arial;font-size:12.5px;color:#64748B;padding:4px 0">Time</td><td align="right" style="font-family:Arial;font-size:12.5px;font-weight:700;color:#1E293B">{{login_time}}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 36px 36px">
  <table role="presentation"><tr>
    <td style="padding-right:12px">${button('This Was Me', '{{confirm_url}}', '#059669')}</td>
    <td><a href="{{secure_account_url}}" style="font-family:Arial;font-size:13px;color:#DC2626;font-weight:700;text-decoration:none">Lock Account & Revoke</a></td>
  </tr></table>
</td></tr>`),
    plain: 'Security Alert: New login detected for {{email}}.\n\nDevice: {{device_info}}\nLocation: {{login_location}}\n\nReview activity: {{secure_account_url}}',
  },
  {
    slug: 'podcast-episode-drop',
    name: 'Executive Podcast Episode Release',
    category: 'Events',
    subject: '🎧 New Episode: Scaling Outbound from $1M to $20M ARR',
    previewText: 'Featuring guest Sarah Jenkins, VP of RevOps at Acme Corp.',
    description: 'Media announcement format with waveform mockup, key conversation timestamps, and direct listening links.',
    accent: '#7C3AED',
    html: wrap(`
<tr><td style="background:#2E1065;padding:36px 36px;text-align:center;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#DDD6FE;text-transform:uppercase">THE REVENUE ARCHITECT PODCAST</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:26px">Episode #48: Zero-Waste Sales Pipelines</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#C4B5FD">With Sarah Jenkins · 38 mins</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">Hi {{first_name}}, in this week’s conversation we unpack how top revenue organizations remove manual spreadsheet syncs and double qualified rep throughput.</p>
  <div style="background:#F5F3FF;border-left:3px solid #7C3AED;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;font-family:Georgia,serif;font-style:italic;font-size:14.5px;color:#4C1D95">
    “If an AE spends more than 5 minutes logging notes into a CRM, your system is failing the team.”
  </div>
  <div style="text-align:center">${button('Listen Now on Spotify & Apple', '{{podcast_url}}', '#7C3AED')}</div>
</td></tr>`),
    plain: 'New Podcast Episode #48: Zero-Waste Sales Pipelines.\n\nListen now: {{podcast_url}}',
  },
  {
    slug: 'free-trial-ending',
    name: 'Free Trial Expiration Warning (3 Days Left)',
    category: 'Customer Retention',
    subject: '{{first_name}}, your GoFox trial expires in 3 days ⏳',
    previewText: 'Keep your automated workflows and email sequences running without interruption.',
    description: 'Conversion-focused expiration warning with countdown badge, checklist of active pipelines, and one-click upgrade.',
    accent: '#EA580C',
    html: wrap(`
<tr><td style="padding:36px 36px 0">
  <div style="display:inline-block;padding:4px 10px;border-radius:6px;background:#FFF7ED;color:#C2410C;font-family:Arial;font-size:11px;font-weight:700">3 DAYS REMAINING</div>
  <h1 style="margin:12px 0 10px;font-family:Arial;font-size:26px;color:#1E293B">Keep your automated pipeline active</h1>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.6;color:#475467">Hi {{first_name}}, your 14-day trial of GoFox Enterprise ends on <strong>{{trial_end_date}}</strong>. To avoid workflow pauses or deliverability stops, activate your subscription today.</p>
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:24px">
    <tr><td style="font-family:Arial;font-size:13px;color:#334155;padding:4px 0">Active Workflows in {{company_name}}</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#1E293B">4 Live</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#334155;padding:4px 0">Automated Leads Processed</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#1E293B">184 Contacts</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#334155;padding:4px 0">Time Saved This Week</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#059669">18.5 Hours</td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:0 36px 36px">${button('Activate My Enterprise Subscription', '{{upgrade_url}}', '#EA580C')}</td></tr>`),
    plain: 'Your GoFox trial expires in 3 days.\n\nKeep your pipelines running: {{upgrade_url}}',
  },
  {
    slug: 'partner-ecosystem-announce',
    name: 'Strategic Integration & Partner Announcement',
    category: 'B2B Enterprise',
    subject: 'GoFox + Snowflake: Native Bi-directional Data Warehouse Sync ❄️',
    previewText: 'Query your entire CRM pipeline directly in SQL with zero ETL scripts.',
    description: 'Enterprise technical partnership release with architecture diagram mockup, key capabilities, and developer setup guide.',
    accent: '#0284C7',
    html: wrap(`
<tr><td style="background:#082F49;padding:36px 36px;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1px;color:#38BDF8;text-transform:uppercase">TECHNOLOGY PARTNERSHIP</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:26px">GoFox + Snowflake Native Warehouse Sync</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#BAE6FD">Bi-directional data streaming with sub-second replication latency</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14px;line-height:1.65;color:#334155">Hi {{first_name}}, enterprise analytics teams can now query real-time GoFox contacts, deals, activities, and campaign interactions natively inside Snowflake.</p>
  <table role="presentation" width="100%" style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:16px;margin-bottom:20px">
    <tr><td style="font-family:Arial;font-size:13px;color:#0369A1">✔ Zero third-party ETL connectors needed</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#0369A1;padding-top:6px">✔ Row-level tenant isolation guaranteed</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#0369A1;padding-top:6px">✔ Pre-built dbt models provided for pipeline attribution</td></tr>
  </table>
  <div style="text-align:center">${button('Connect Snowflake in 1 Click', '{{integration_url}}', '#0284C7')}</div>
</td></tr>`),
    plain: 'GoFox + Snowflake Native Data Warehouse Sync.\n\nConnect now: {{integration_url}}',
  },
  {
    slug: 'quote-proposal-delivery',
    name: 'Commercial Quote & Pricing Proposal Delivery',
    category: 'Sales Outreach',
    subject: 'Commercial Proposal for {{company_name}} (#{{proposal_id}})',
    previewText: 'Prepared by {{owner_name}} · Valid through {{expiry_date}}.',
    description: 'Executive commercial proposal notification with pricing plan breakdown, contract terms summary, and e-signature link.',
    accent: '#059669',
    html: wrap(`
<tr><td style="background:#064E3B;padding:32px 36px;color:#ffffff">
  <table role="presentation" width="100%"><tr>
    <td style="font-family:Arial;font-size:18px;font-weight:800">GoFox Enterprise</td>
    <td align="right" style="font-family:Arial;font-size:11px;color:#A7F3D0">PROPOSAL #{{proposal_id}}</td>
  </tr></table>
  <h1 style="margin:14px 0 4px;font-family:Arial;font-size:24px">Commercial Agreement</h1>
  <p style="margin:0;font-family:Arial;font-size:13.5px;color:#D1FAE5">Prepared specifically for {{company_name}}</p>
</td></tr>
<tr><td style="padding:28px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14px;color:#334155">Hi {{first_name}}, following our executive architecture review, here is the customized proposal for {{company_name}}.</p>
  <table role="presentation" width="100%" style="border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:20px">
    <tr><td style="font-family:Arial;font-size:13px;color:#64748B;padding:4px 0">Plan Tier</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#1E293B">Enterprise Unlimited</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#64748B;padding:4px 0">User Seats</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#1E293B">{{seats_count}} Full Seats</td></tr>
    <tr><td style="font-family:Arial;font-size:13px;color:#64748B;padding:4px 0">Term</td><td align="right" style="font-family:Arial;font-size:13px;font-weight:700;color:#1E293B">Annual (Price Lock)</td></tr>
    <tr><td style="font-family:Arial;font-size:14px;font-weight:700;color:#064E3B;padding:8px 0 0">Total Investment</td><td align="right" style="font-family:Arial;font-size:18px;font-weight:800;color:#059669;padding:8px 0 0">{{proposal_total}}</td></tr>
  </table>
  <div style="text-align:center">${button('Review & Sign Proposal Online', '{{proposal_url}}', '#059669')}</div>
  <p style="margin:14px 0 0;text-align:center;font-family:Arial;font-size:11px;color:#94A3B8">This quote is valid until {{expiry_date}}. Secure electronic signature powered by GoFox.</p>
</td></tr>`),
    plain: 'Commercial Proposal for {{company_name}}.\n\nReview & sign: {{proposal_url}}',
  },
  {
    slug: 'b2b-demo-followup',
    name: 'B2B Executive Demo Follow-up & Next Steps',
    category: 'Sales Outreach',
    subject: 'Great meeting you today, {{first_name}} — demo recording & action plan',
    previewText: 'Here is the summary of our conversation and personalized rollout timeline for {{company_name}}.',
    description: 'High-converting demo follow-up with recording link, customized ROI estimate, and direct scheduling calendar.',
    accent: '#2563EB',
    html: wrap(`
<tr><td style="background:#0F172A;padding:36px 36px;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#60A5FA;text-transform:uppercase">EXECUTIVE FOLLOW-UP</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:26px;color:#ffffff">Great connecting today, {{first_name}}</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#94A3B8">Next steps and implementation timeline tailored for {{company_name}}</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.6;color:#334155">Hi {{first_name}}, thank you for sharing your revenue targets. As discussed, here are the key deliverables to unlock the 3.4x pipeline velocity you are aiming for:</p>
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:22px">
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13.5px;color:#1E293B">🎥 <a href="{{recording_url}}" style="color:#2563EB;font-weight:600;text-decoration:none">Watch Demo Recording (18 mins)</a></td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13.5px;color:#1E293B">📊 <a href="{{roi_calculator_url}}" style="color:#2563EB;font-weight:600;text-decoration:none">Interactive ROI & CAC Projection Model</a></td></tr>
    <tr><td style="padding:6px 0;font-family:Arial;font-size:13.5px;color:#1E293B">⚡ <a href="{{security_packet_url}}" style="color:#2563EB;font-weight:600;text-decoration:none">Enterprise Security & SOC2 Compliance Packet</a></td></tr>
  </table>
  <div style="text-align:center">${button('Book 15-Min Technical Architecture Review', '{{calendar_url}}', '#2563EB')}</div>
  <p style="margin:18px 0 0;font-family:Arial;font-size:12px;color:#64748B;text-align:center">Questions? Feel free to reply directly to this thread.</p>
</td></tr>`),
    plain: 'Hi {{first_name}},\n\nGreat meeting you today. Here are the next steps for {{company_name}}:\n- Watch Demo: {{recording_url}}\n- ROI Model: {{roi_calculator_url}}\n\nBook follow-up: {{calendar_url}}',
  },
  {
    slug: 'customer-nps-survey',
    name: 'Customer Satisfaction & NPS Rating Request',
    category: 'Customer Success',
    subject: 'Quick question for {{first_name}}: How are we doing? ⭐',
    previewText: 'Takes less than 30 seconds. Your candid feedback directly shapes our product roadmap.',
    description: 'Frictionless 1-10 clickable NPS score survey with instant feedback submission.',
    accent: '#F59E0B',
    html: wrap(`
<tr><td style="padding:36px 36px 10px;text-align:center">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#FEF3C7;color:#D97706;font-family:Arial;font-size:11px;font-weight:700">FEEDBACK & ROADMAP</div>
  <h1 style="margin:14px 0 8px;font-family:Arial;font-size:26px;color:#1E293B">How likely are you to recommend GoFox?</h1>
  <p style="margin:0 auto 24px;max-width:440px;font-family:Arial;font-size:14.5px;line-height:1.6;color:#64748B">Hi {{first_name}}, as an active user at {{company_name}}, your opinion helps us decide what features to ship next.</p>
</td></tr>
<tr><td style="padding:0 30px 24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="text-align:center">
    <tr>
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => `<td style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:8px;padding:12px 0"><a href="{{feedback_url}}?score=${num}" style="font-family:Arial;font-size:15px;font-weight:700;color:#1E293B;text-decoration:none;display:block">${num}</a></td>`).join('')}
    </tr>
    <tr>
      <td colspan="5" align="left" style="font-family:Arial;font-size:11px;color:#94A3B8;padding-top:6px">Not likely at all</td>
      <td colspan="5" align="right" style="font-family:Arial;font-size:11px;color:#94A3B8;padding-top:6px">Extremely likely</td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:0 36px 34px;text-align:center;font-family:Arial;font-size:12px;color:#94A3B8">Clicking a number records your vote instantly. Thank you for your support!</td></tr>`),
    plain: 'Hi {{first_name}},\n\nHow likely are you to recommend GoFox to a peer? Rate us 1 to 10:\n{{feedback_url}}',
  },
  {
    slug: 'annual-upgrade-voucher',
    name: 'Annual Plan Upgrade Voucher (40% OFF Special)',
    category: 'Promotional',
    subject: 'Exclusive: Save 40% when switching to Annual Billing 🔥',
    previewText: 'Lock in enterprise pipeline automations at our lowest rate ever.',
    description: 'High-converting discount incentive card with dashed promo code box, feature checklist, and countdown urgency.',
    accent: '#EA580C',
    html: wrap(`
<tr><td style="background:linear-gradient(135deg,#C2410C,#EA580C);padding:38px 36px;text-align:center;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:2px;color:#FFEDD5">EXCLUSIVE VIP SAVINGS</div>
  <div style="font-family:Arial;font-size:46px;font-weight:800;letter-spacing:-1.5px;margin:8px 0">SAVE 40% ON ANNUAL</div>
  <p style="margin:0;font-family:Arial;font-size:14.5px;color:#FFEDD5">Available exclusively for {{company_name}} through {{expiry_date}}</p>
</td></tr>
<tr><td style="padding:32px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.6;color:#334155">Hi {{first_name}}, save more than <strong>$1,800/year</strong> by switching your workspace to annual billing. Unlock unlimited email sequences, custom visual workflows, and dedicated deliverability IP pools.</p>
  <div style="border:2px dashed #EA580C;border-radius:12px;background:#FFF7ED;padding:18px;text-align:center;margin:18px 0 24px">
    <div style="font-family:Arial;font-size:11px;font-weight:700;color:#C2410C;letter-spacing:1px">ONE-CLICK PROMO CODE</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:4px;color:#9A3412;margin:6px 0">GROWTH40-VIP</div>
    <div style="font-family:Arial;font-size:11px;color:#78350F">Applies automatically at checkout · Guaranteed price lock for 24 months</div>
  </div>
  <div style="text-align:center">${button('Claim 40% Off Annual Plan', '{{upgrade_url}}?code=GROWTH40-VIP', '#EA580C')}</div>
</td></tr>`),
    plain: 'Switch to Annual & Save 40% with code GROWTH40-VIP.\n\nClaim now: {{upgrade_url}}',
  },
  {
    slug: 'executive-cold-outreach',
    name: 'Executive B2B Cold Outreach & Discovery Call',
    category: 'Sales Outreach',
    subject: 'Quick question regarding revenue operations at {{company_name}}',
    previewText: 'Noticed your team is expanding marketing channels this quarter.',
    description: 'Clean, high-response plain-formatted executive outreach with personal observations and low-friction CTA.',
    accent: '#0F172A',
    html: wrap(`
<tr><td style="padding:36px 36px 32px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#1E293B">Hi {{first_name}},</p>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">I noticed {{company_name}} recently posted new openings in sales development and marketing operations. Typically when teams scale this quickly, lead drop-off between inbound capture and sales reps becomes a primary headache.</p>
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">We built GoFox specifically to solve that handoff bottleneck. For instance, teams in {{industry_name}} use our automated routing and multi-channel sequences to contact new leads in under 90 seconds, which typically yields a <strong>3x increase in qualified meetings</strong>.</p>
  <p style="margin:0 0 20px;font-family:Arial;font-size:14.5px;line-height:1.65;color:#334155">Would you be open to a 10-minute introductory chat this Thursday or Friday to benchmark how {{company_name}} compares?</p>
  <div style="margin:24px 0">${button('Pick a Convenient Time on My Calendar', '{{calendar_url}}', '#0F172A')}</div>
  <p style="margin:0;font-family:Arial;font-size:13.5px;line-height:1.6;color:#64748B">Best regards,<br><strong style="color:#1E293B">{{owner_name}}</strong><br>GoFox Strategic Partnerships</p>
</td></tr>`),
    plain: 'Hi {{first_name}},\n\nI noticed {{company_name}} is scaling sales operations. We help teams contact leads in under 90 seconds, boosting meetings 3x.\n\nOpen to a 10-min chat? Pick a time: {{calendar_url}}\n\nBest,\n{{owner_name}}',
  },
  {
    slug: 'investor-quarterly-update',
    name: 'Investor & Board Quarterly Performance Roundup',
    category: 'Corporate',
    subject: 'GoFox Q3 Shareholder & Performance Report 📈',
    previewText: 'ARR reaches $12.4M (+84% YoY), net revenue retention at 128%, and launch of Enterprise Sentinel.',
    description: 'Polished executive investor memo with key KPI scorecard, cohort retention analysis, and next quarter roadmap highlights.',
    accent: '#047857',
    html: wrap(`
<tr><td style="background:#064E3B;padding:34px 36px;color:#ffffff">
  <table role="presentation" width="100%"><tr>
    <td style="font-family:Arial;font-size:16px;font-weight:800">GoFox Investor Relations</td>
    <td align="right" style="font-family:Arial;font-size:11px;color:#A7F3D0">CONFIDENTIAL · Q3 FY26</td>
  </tr></table>
  <h1 style="margin:14px 0 4px;font-family:Arial;font-size:26px">Quarterly Performance Report</h1>
  <p style="margin:0;font-family:Arial;font-size:13.5px;color:#D1FAE5">Prepared for Shareholders and Board Members</p>
</td></tr>
<tr><td style="padding:28px 36px">
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:22px">
    <tr>
      <td width="33%" align="center" style="font-family:Arial;border-right:1px solid #E2E8F0"><div style="font-size:22px;font-weight:800;color:#047857">$12.4M</div><div style="font-size:11px;color:#64748B">Annual Recurring Revenue</div></td>
      <td width="33%" align="center" style="font-family:Arial;border-right:1px solid #E2E8F0"><div style="font-size:22px;font-weight:800;color:#2563EB">+84%</div><div style="font-size:11px;color:#64748B">YoY ARR Growth</div></td>
      <td width="33%" align="center" style="font-family:Arial"><div style="font-size:22px;font-weight:800;color:#7C3AED">128%</div><div style="font-size:11px;color:#64748B">Net Retention Rate</div></td>
    </tr>
  </table>
  <h3 style="font-family:Arial;font-size:15px;color:#1E293B;margin:0 0 8px">Executive Highlights</h3>
  <ul style="font-family:Arial;font-size:13.5px;line-height:1.65;color:#334155;padding-left:18px;margin:0 0 20px">
    <li>Closed 42 new mid-market enterprise logos in North America and EMEA.</li>
    <li>Maintained GAAP gross margin of 81.2% with positive operating cash flow.</li>
    <li>Completed rollout of GoFox Visual Automation Canvas and CRM 2.0.</li>
  </ul>
  <div style="text-align:center">${button('Download Complete Shareholder Deck (PDF)', '{{deck_url}}', '#047857')}</div>
</td></tr>`),
    plain: 'GoFox Q3 Shareholder Report:\n- ARR: $12.4M (+84% YoY)\n- NRR: 128%\n\nDownload full report: {{deck_url}}',
  },
  {
    slug: 'vip-referral-invite',
    name: 'VIP Client Referral Program ($100 Amazon Card)',
    category: 'Growth & Viral',
    subject: 'Give $100, Get $100: The GoFox Advocate Program 🎁',
    previewText: 'Introduce a fellow revenue leader and earn a $100 reward on their first demo.',
    description: 'High-converting viral referral email with personalized sharing link, social sharing buttons, and terms note.',
    accent: '#7C3AED',
    html: wrap(`
<tr><td style="background:#4C1D95;padding:36px 36px;text-align:center;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#DDD6FE">ADVOCATE REWARDS</div>
  <h1 style="margin:10px 0 6px;font-family:Arial;font-size:28px">Give $100, Get $100</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#DDD6FE">Share the GoFox advantage with fellow revenue leaders in your network</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <p style="margin:0 0 16px;font-family:Arial;font-size:14.5px;line-height:1.6;color:#334155">Hi {{first_name}}, as one of our top champions at {{company_name}}, you are invited to join the GoFox VIP Advocate circle. Every peer you introduce who completes a 15-minute walkthrough gets a $100 gift card — and you receive $100 credit too.</p>
  <div style="border:1.5px solid #DDD6FE;border-radius:10px;background:#FAF5FF;padding:14px;text-align:center;margin:18px 0 22px">
    <div style="font-family:Arial;font-size:11.5px;color:#6B21A8;font-weight:600">Your Unique Referral Link:</div>
    <div style="font-family:monospace;font-size:13.5px;font-weight:700;color:#581C87;margin-top:4px">{{referral_url}}</div>
  </div>
  <div style="text-align:center">${button('Copy & Share My Referral Link', '{{referral_url}}', '#7C3AED')}</div>
</td></tr>`),
    plain: 'Give $100, Get $100 with the GoFox Advocate Program.\n\nYour unique link: {{referral_url}}',
  },
  {
    slug: 'black-friday-flash',
    name: 'Black Friday & Cyber Week Mega Sale (50% OFF)',
    category: 'Promotional',
    subject: 'BLACK FRIDAY: 50% OFF Everything (Ends at Midnight) ⚡',
    previewText: 'Our biggest event of the year is live. Do not miss this once-a-year pricing.',
    description: 'High-impact high-contrast dark holiday design with pulsing badges and immediate checkout trigger.',
    accent: '#DC2626',
    html: wrap(`
<tr><td style="background:#000000;padding:42px 36px;text-align:center;color:#ffffff">
  <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#DC2626;color:#ffffff;font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1px">CYBER WEEK SPECIAL</div>
  <h1 style="margin:14px 0 6px;font-family:Arial;font-size:40px;letter-spacing:-1px">50% OFF GOFOX PRO</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#94A3B8">Strictly limited to the first 100 enterprise organizations</p>
</td></tr>
<tr><td style="padding:32px 36px;text-align:center">
  <p style="margin:0 0 18px;font-family:Arial;font-size:15px;line-height:1.6;color:#334155">Hi {{first_name}}, our annual Black Friday doorbuster is officially live. Lock in unlimited automations, native email sequencing, and white-label client portals for half the price.</p>
  <div style="background:#FEF2F2;border:2px dashed #EF4444;border-radius:12px;padding:16px;margin-bottom:24px">
    <div style="font-family:monospace;font-size:24px;font-weight:800;color:#991B1B;letter-spacing:4px">CYBER50-NOW</div>
    <div style="font-family:Arial;font-size:11px;color:#7F1D1D;margin-top:4px">Offer expires Sunday at 11:59 PM PST</div>
  </div>
  <div style="text-align:center">${button('Claim 50% Off Black Friday Pass', '{{checkout_url}}?code=CYBER50-NOW', '#DC2626')}</div>
</td></tr>`),
    plain: 'Black Friday 50% Off GoFox Pro.\n\nCode: CYBER50-NOW\n\nShop: {{checkout_url}}',
  },
  {
    slug: 'cart-abandon-recovery',
    name: 'Cart Abandonment Recovery & Instant Checkout',
    category: 'E-Commerce',
    subject: 'You left something behind in your cart, {{first_name}} 🛒',
    previewText: 'We saved your reserved items for the next 24 hours.',
    description: 'High-converting retail abandoned cart notification with item preview table and instant 1-click checkout.',
    accent: '#059669',
    html: wrap(`
<tr><td style="padding:36px 36px 10px;text-align:center">
  <div style="font-size:38px;margin-bottom:8px">🛍️</div>
  <h1 style="margin:0 0 8px;font-family:Arial;font-size:24px;color:#1E293B">Your cart is waiting for you</h1>
  <p style="margin:0 auto;max-width:420px;font-family:Arial;font-size:14px;color:#64748B">Hi {{first_name}}, we noticed you did not finish placing your order. We have reserved your items for 24 hours.</p>
</td></tr>
<tr><td style="padding:20px 36px">
  <table role="presentation" width="100%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:20px">
    <tr>
      <td width="56" style="font-size:28px;vertical-align:middle">📦</td>
      <td style="font-family:Arial;padding-left:12px">
        <div style="font-size:14px;font-weight:700;color:#1E293B">{{cart_item_name}}</div>
        <div style="font-size:12px;color:#64748B">Qty: {{cart_qty}} · Selected tier: {{cart_variant}}</div>
      </td>
      <td align="right" style="font-family:Arial;font-size:16px;font-weight:800;color:#059669">{{cart_total}}</td>
    </tr>
  </table>
  <div style="text-align:center">${button('Complete Your Order in 1 Click', '{{cart_checkout_url}}', '#059669')}</div>
</td></tr>`),
    plain: 'Hi {{first_name}},\n\nYour cart is waiting. Finish your order: {{cart_checkout_url}}',
  },
  {
    slug: 'case-study-spotlight',
    name: 'Customer Success Story & Social Proof Spotlight',
    category: 'Case Studies',
    subject: 'How {{case_study_company}} scaled inbound pipeline by 340% 🚀',
    previewText: 'A detailed walkthrough of their automated lead routing playbook and conversion metrics.',
    description: 'Authoritative case study format with client quotation block, metric breakdown, and full PDF download.',
    accent: '#4F46E5',
    html: wrap(`
<tr><td style="background:#312E81;padding:36px 36px;color:#ffffff">
  <div style="font-family:Arial;font-size:11px;font-weight:800;letter-spacing:1px;color:#A5B4FC;text-transform:uppercase">CUSTOMER SUCCESS SPOTLIGHT</div>
  <h1 style="margin:12px 0 6px;font-family:Arial;font-size:26px">How {{case_study_company}} scaled revenue 3.4x</h1>
  <p style="margin:0;font-family:Arial;font-size:14px;color:#C7D2FE">Inside the automated sales development playbook behind their fastest growth quarter.</p>
</td></tr>
<tr><td style="padding:30px 36px">
  <table role="presentation" width="100%" style="border-left:4px solid #4F46E5;background:#EEF2FF;border-radius:0 10px 10px 0;padding:16px;margin-bottom:20px">
    <tr><td style="font-family:Georgia,serif;font-style:italic;font-size:14.5px;line-height:1.6;color:#312E81">“Switching our sales team to GoFox eliminated 4 hours of manual CRM logging per rep every single day. Our response times dropped from 2 hours to 90 seconds.”</td></tr>
    <tr><td style="font-family:Arial;font-style:normal;font-size:12px;font-weight:700;color:#4338CA;padding-top:8px">— Sarah Jenkins, VP Revenue Operations at {{case_study_company}}</td></tr>
  </table>
  <div style="text-align:center">${button('Read Full Customer Breakdown (PDF)', '{{case_study_url}}', '#4F46E5')}</div>
</td></tr>`),
    plain: 'How {{case_study_company}} scaled 3.4x.\n\nRead case study: {{case_study_url}}',
  },
]

export const EMAIL_CATEGORIES = [
  'All',
  ...Array.from(new Set(EMAIL_PRESETS.map((preset) => preset.category))),
]
