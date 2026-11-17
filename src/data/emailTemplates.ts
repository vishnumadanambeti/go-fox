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
]

export const EMAIL_CATEGORIES = [
  'All',
  ...Array.from(new Set(EMAIL_PRESETS.map((preset) => preset.category))),
]
