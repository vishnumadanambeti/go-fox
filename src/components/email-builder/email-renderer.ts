// GoFox Email Builder - Email-Safe HTML Renderer

import type { EmailDocument, Block, BlockContent, BlockStyles, Column, Section } from './types'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(value: unknown): string {
  const url = String(value ?? '').trim()
  if (/^\{\{[\w.-]+\}\}$/.test(url)) return url
  try {
    const parsed = new URL(url)
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return url
  } catch {
    return '#'
  }
  return '#'
}

function safeCssValue(value: unknown): string {
  return String(value ?? '').replace(/[;"'<>\r\n]/g, '').trim()
}

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|form|svg|math|link)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data):[\s\S]*?\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*(?:javascript|vbscript|data):[^\s>]*/gi, '$1="#"')
    .replace(/url\(\s*(['"]?)\s*(?:javascript|vbscript|data):[^)]*\)/gi, 'none')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/@import[^;]+;?/gi, '')
}

export function renderEmailHTML(document: EmailDocument): string {
  const { settings, sections } = document
  const width = Math.max(320, Math.min(800, Number(settings.width) || 600))
  const backgroundColor = safeCssValue(settings.backgroundColor || '#F5F7FB')
  const contentBackground = safeCssValue(settings.contentBackground || '#FFFFFF')

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${backgroundColor}; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; max-width: 100%; height: auto; }
    a { text-decoration: none; color: inherit; }
    @media only screen and (max-width: 600px) {
      .mobile-full { width: 100% !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${backgroundColor};">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" class="mobile-full" width="${width}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${width}px;background-color:${contentBackground};margin:0 auto;">
`

  sections.forEach((section) => {
    html += renderSection(section)
  })

  html += `
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return sanitizeEmailHtml(html)
}

function renderSection(section: Section): string {
  const padding = Math.max(0, Math.min(120, Number(section.styles?.padding) || 20))
  const backgroundColor = safeCssValue(section.styles?.backgroundColor || 'transparent')
  let html = `
          <tr>
            <td style="padding:${padding}px;background-color:${backgroundColor}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
`

  section.columns.forEach((column) => {
    html += renderColumn(column)
  })

  html += `
                </tr>
              </table>
            </td>
          </tr>
`

  return html
}

function renderColumn(column: Column): string {
  const widthPercent = Math.max(1, Math.min(100, Number(column.width) || 100))
  const columnStyles = column.styles
  let html = `
                  <td class="mobile-stack" width="${widthPercent}%" valign="${columnStyles?.verticalAlign || 'top'}" style="padding:${Math.max(0, Number(columnStyles?.padding) || 10)}px;${columnStyles?.backgroundColor ? `background-color:${safeCssValue(columnStyles.backgroundColor)};` : ''}${columnStyles?.borderRight ? `border-right:${safeCssValue(columnStyles.borderRight)};` : ''}${columnStyles?.borderLeft ? `border-left:${safeCssValue(columnStyles.borderLeft)};` : ''}">
`

  column.blocks.forEach((block: Block) => {
    html += renderBlock(block)
  })

  html += `
                  </td>
`

  return html
}

function renderBlock(block: Block): string {
  const { type, content, styles } = block

  switch (type) {
    case 'heading':
      return renderHeading(content, styles)
    case 'text':
      return renderText(content, styles)
    case 'image':
      return renderImage(content, styles)
    case 'button':
      return renderButton(content, styles)
    case 'divider':
      return renderDivider(content, styles)
    case 'spacer':
      return renderSpacer(content)
    case 'social':
      return renderSocial(content, styles)
    case 'video':
      return renderVideo(content, styles)
    case 'logo':
      return renderImage(content, styles)
    case 'hero':
      return renderHero(content, styles)
    case 'features':
      return renderFeatures(content, styles)
    case 'pricing':
      return renderPricing(content, styles)
    case 'testimonial':
      return renderTestimonial(content, styles)
    case 'coupon':
      return renderCoupon(content, styles)
    case 'metrics':
      return renderMetrics(content, styles)
    case 'product':
      return renderProduct(content, styles)
    case 'footer':
      return renderFooter(content, styles)
    case 'navbar':
      return renderNavbar(content, styles)
    case 'countdown':
      return renderCountdown(content, styles)
    case 'progress-bar':
    case 'progress-circle':
      return renderProgress(content, styles)
    case 'accordion':
      return renderAccordion(content, styles)
    case 'image-gallery':
      return renderImageGallery(content, styles)
    case 'table':
      return renderDataTable(content, styles)
    case 'code-block':
      return renderCodeBlock(content, styles)
    case 'custom-html':
      return sanitizeEmailHtml(content.html || '')
    default:
      return ''
  }
}

function renderStyleAttributes(styles: BlockStyles): string {
  const parts: string[] = []
  if (styles.color) parts.push(`color: ${safeCssValue(styles.color)}`)
  if (styles.backgroundColor) parts.push(`background-color: ${safeCssValue(styles.backgroundColor)}`)
  if (styles.fontSize) parts.push(`font-size: ${Math.max(1, Number(styles.fontSize))}px`)
  if (styles.fontFamily) parts.push(`font-family: ${safeCssValue(styles.fontFamily)}`)
  if (styles.fontWeight) parts.push(`font-weight: ${Math.max(100, Math.min(900, Number(styles.fontWeight)))}`)
  if (styles.lineHeight) parts.push(`line-height: ${Math.max(0.5, Number(styles.lineHeight))}`)
  if (styles.letterSpacing) parts.push(`letter-spacing: ${Number(styles.letterSpacing)}px`)
  if (styles.textAlign) parts.push(`text-align: ${styles.textAlign}`)

  if (styles.paddingTop !== undefined || styles.paddingRight !== undefined || styles.paddingBottom !== undefined || styles.paddingLeft !== undefined) {
    const pt = styles.paddingTop ?? styles.padding ?? 0
    const pr = styles.paddingRight ?? styles.padding ?? 0
    const pb = styles.paddingBottom ?? styles.padding ?? 0
    const pl = styles.paddingLeft ?? styles.padding ?? 0
    parts.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`)
  } else if (styles.padding !== undefined) {
    parts.push(`padding: ${Math.max(0, Number(styles.padding))}px`)
  }

  if (styles.marginTop !== undefined || styles.marginRight !== undefined || styles.marginBottom !== undefined || styles.marginLeft !== undefined) {
    const mt = styles.marginTop ?? styles.margin ?? 0
    const mr = styles.marginRight ?? styles.margin ?? 0
    const mb = styles.marginBottom ?? styles.margin ?? 0
    const ml = styles.marginLeft ?? styles.margin ?? 0
    parts.push(`margin: ${mt}px ${mr}px ${mb}px ${ml}px`)
  } else if (styles.margin !== undefined) {
    parts.push(`margin: ${Math.max(0, Number(styles.margin))}px`)
  }

  if (styles.border) parts.push(`border: ${safeCssValue(styles.border)}`)
  if (styles.borderColor && styles.borderWidth) {
    const style = styles.borderStyle || 'solid'
    parts.push(`border: ${styles.borderWidth}px ${style} ${safeCssValue(styles.borderColor)}`)
  }
  if (styles.borderRadius) parts.push(`border-radius: ${Math.max(0, Number(styles.borderRadius))}px`)
  if (styles.width) parts.push(`width: ${Math.max(1, Number(styles.width))}px`)
  if (styles.height) parts.push(`height: ${Math.max(1, Number(styles.height))}px`)
  if (styles.maxWidth) parts.push(`max-width: ${safeCssValue(styles.maxWidth)}`)
  return parts.join('; ')
}

function renderHeading(content: BlockContent, styles?: BlockStyles): string {
  const level = Math.max(1, Math.min(6, Number(content.level) || 1))
  const align = content.alignment || styles?.textAlign || 'left'
  const text = escapeHtml(content.text || 'Heading')
  const style = renderStyleAttributes(styles || {})
  return `
                    <h${level} style="margin: 0; ${style} text-align: ${align};">${text}</h${level}>
`
}

function renderText(content: BlockContent, styles?: BlockStyles): string {
  const align = content.alignment || styles?.textAlign || 'left'
  const text = escapeHtml(content.text || '').replace(/\n/g, '<br>')
  const style = renderStyleAttributes(styles || {})
  return `
                    <p style="margin: 0; ${style} text-align: ${align};">${text}</p>
`
}

function renderImage(content: BlockContent, styles?: BlockStyles): string {
  const src = escapeHtml(safeUrl(content.src))
  const alt = escapeHtml(content.alt || '')
  const width = Math.max(1, Math.min(1200, Number(content.width) || 600))
  const align = content.alignment || 'center'
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" align="${align}" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="${style}">
                          <img src="${src}" alt="${alt}" width="${width}" style="display: block; max-width: 100%; height: auto;" />
                        </td>
                      </tr>
                    </table>
`
}

function renderButton(content: BlockContent, styles?: BlockStyles): string {
  const text = escapeHtml(content.text || 'Button')
  const url = escapeHtml(safeUrl(content.url))
  const align = content.alignment || 'center'
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" align="${align}" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="${style}">
                          <a href="${url}" style="display: inline-block; padding: 12px 24px; text-decoration: none;">${text}</a>
                        </td>
                      </tr>
                    </table>
`
}

function renderDivider(content: BlockContent, styles?: BlockStyles): string {
  const thickness = Math.max(1, Math.min(8, Number(content.thickness) || 1))
  const align = content.alignment || 'center'
  const color = (styles?.borderColor as string) || '#E7ECF3'
  const margin = styles?.margin || 24
  return `
                    <div style="border-top: ${thickness}px solid ${color}; margin: ${margin}px 0; text-align: ${align};"></div>
`
}

function renderSpacer(content: BlockContent): string {
  const height = Math.max(0, Math.min(600, Number(content.height) || 28))
  return `
                    <div style="height: ${height}px; line-height: ${height}px; font-size: ${height}px;">&nbsp;</div>
`
}

function renderSocial(content: BlockContent, styles?: BlockStyles): string {
  const items = (content.items || []).filter(
    (item): item is import('./types').SocialItem => 'platform' in item && 'url' in item
  )
  const align = content.alignment || 'center'
  const style = renderStyleAttributes(styles || {})
  let links = items
    .map((item) => `<a href="${escapeHtml(safeUrl(item.url))}" style="color: ${safeCssValue(styles?.color || '#FF6B00')}; text-decoration: none; margin: 0 8px;">${escapeHtml(item.text || item.label || item.platform)}</a>`)
    .join(' · ')
  return `
                    <p style="margin: 0; ${style} text-align: ${align};">${links}</p>
`
}

function renderVideo(content: BlockContent, styles?: BlockStyles): string {
  const url = escapeHtml(safeUrl(content.videoUrl))
  const text = escapeHtml(content.text || 'Watch video')
  const align = content.alignment || 'center'
  const style = renderStyleAttributes(styles || {})
  return `
                    <a href="${url}" style="display: block; ${style} text-align: ${align}; text-decoration: none;">${text}</a>
`
}

function renderHero(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        <td align="center" style="padding: 36px 30px;">
                          <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; color: #FF6B00; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">${escapeHtml(content.text || 'ANNOUNCEMENT')}</div>
                          <h1 style="font-family: Arial, sans-serif; font-size: 28px; color: #FFFFFF; margin: 12px 0 10px;">${escapeHtml(content.caption || 'Headline')}</h1>
                          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #94A3B8; margin: 0 0 20px;">${escapeHtml(content.placeholder || 'Description')}</p>
                          <table role="presentation" align="center">
                            <tr>
                              <td style="background-color: #FF6B00; border-radius: 8px;">
                                <a href="${escapeHtml(safeUrl(content.buttonUrl))}" style="display: inline-block; padding: 12px 28px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none;">${escapeHtml(content.buttonText || 'CTA')}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
`
}

function renderFeatures(content: BlockContent, styles?: BlockStyles): string {
  const features = content.features || []
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        ${features.map((f: string) => `
                        <td width="50%" style="padding: 16px; vertical-align: top;">
                          <div style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1E293B;">${escapeHtml(f)}</div>
                        </td>
                        `).join('')}
                      </tr>
                    </table>
`
}

function renderPricing(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        <td align="center" style="padding: 24px;">
                          <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; color: #C2410C; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(content.text || 'PLAN')}</div>
                          <div style="font-family: Arial, sans-serif; font-size: 36px; font-weight: 800; color: #1E293B; margin: 8px 0;">${escapeHtml(content.price || '$0')}<span style="font-size: 14px; font-weight: normal; color: #64748B;">${escapeHtml(content.period || '')}</span></div>
                          <p style="font-family: Arial, sans-serif; font-size: 12.5px; color: #64748B; margin: 0 0 16px;">${escapeHtml(content.placeholder || '')}</p>
                          <table role="presentation" align="center">
                            <tr>
                              <td style="background-color: #FF6B00; border-radius: 8px;">
                                <a href="${escapeHtml(safeUrl(content.buttonUrl))}" style="display: inline-block; padding: 10px 24px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #FFFFFF; text-decoration: none;">${escapeHtml(content.buttonText || 'CTA')}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
`
}

function renderTestimonial(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        <td style="padding: 18px 22px;">
                          <p style="font-family: Georgia, serif; font-style: italic; font-size: 14.5px; line-height: 1.6; color: #065F46; margin: 0;">${escapeHtml(content.text || '')}</p>
                          <div style="font-family: Arial, sans-serif; font-style: normal; font-size: 12px; font-weight: 700; color: #047857; margin-top: 8px;">${escapeHtml(content.author || '')} — ${escapeHtml(content.role || '')}</div>
                        </td>
                      </tr>
                    </table>
`
}

function renderCoupon(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <div style="${style} text-align: center;">
                      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; color: #9A3412; letter-spacing: 1px; text-transform: uppercase;">${content.text || 'VOUCHER'}</div>
                      <div style="font-family: monospace; font-size: 24px; font-weight: 800; color: #C2410C; letter-spacing: 3px; margin: 8px 0;">${escapeHtml(content.code || 'CODE')}</div>
                      <div style="font-family: Arial, sans-serif; font-size: 11px; color: #78350F;">${escapeHtml(content.placeholder || '')}</div>
                    </div>
`
}

function renderMetrics(content: BlockContent, styles?: BlockStyles): string {
  const items = (content.items || []).filter(
    (item): item is import('./types').MetricItem => 'text' in item && 'label' in item
  )
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        ${items.map((item: any) => `
                        <td width="33%" align="center" style="font-family: Arial, sans-serif; border-right: 1px solid #E2E8F0;">
                          <div style="font-size: 22px; font-weight: 800; color: #FF6B00;">${escapeHtml(item.text || '0')}</div>
                          <div style="font-size: 11px; color: #64748B;">${escapeHtml(item.label || '')}</div>
                        </td>
                        `).join('')}
                      </tr>
                    </table>
`
}

function renderProduct(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        <td width="56" style="font-size: 26px;">📦</td>
                        <td style="font-family: Arial, sans-serif;">
                          <div style="font-size: 14px; font-weight: 700; color: #17243A;">${escapeHtml(content.text || 'Product')}</div>
                          <div style="font-size: 12px; color: #667085;">${escapeHtml(content.placeholder || '')}</div>
                          <div style="font-size: 14px; font-weight: 700; color: #17243A; margin-top: 4px;">${escapeHtml(content.price || '$0')}</div>
                        </td>
                      </tr>
                    </table>
`
}

function renderFooter(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <div style="${style}">
                      <span style="font-family: Arial, sans-serif;">${escapeHtml(content.text || '')}</span> · <a href="{{unsubscribe_url}}" style="color: inherit;">${escapeHtml(content.placeholder || 'Unsubscribe')}</a>
                    </div>
`
}

function renderNavbar(content: BlockContent, styles?: BlockStyles): string {
  const links = (content.items || []).filter(
    (item): item is import('./types').SocialItem => 'platform' in item && 'url' in item
  )
  const items = links.length
    ? links
        .map(
          (item) =>
            `<a href="${escapeHtml(safeUrl(item.url))}" style="color:#475467;text-decoration:none;padding-left:12px">${escapeHtml(item.text || item.label || item.platform)}</a>`
        )
        .join('')
    : ''

  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${renderStyleAttributes(styles || {})}">
                      <tr>
                        <td style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#172033">${escapeHtml(content.text || 'GoFox')}</td>
                        <td align="right" style="font-family:Arial,sans-serif;font-size:12px">${items}</td>
                      </tr>
                    </table>
`
}

function renderCountdown(content: BlockContent, styles?: BlockStyles): string {
  const deadline = content.datetime
    ? new Date(content.datetime).toLocaleDateString()
    : 'the deadline'
  return `
                    <div style="${renderStyleAttributes(styles || {})};text-align:center">
                      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700">${escapeHtml(content.text || 'Offer ends')}</div>
                      <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;margin-top:6px">${escapeHtml(deadline)}</div>
                    </div>
`
}

function renderProgress(content: BlockContent, styles?: BlockStyles): string {
  const percentage = Math.max(0, Math.min(100, Number(content.percentage) || 0))
  const label = escapeHtml(content.text || `${percentage}% complete`)
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${renderStyleAttributes(styles || {})}">
                      <tr><td style="font-family:Arial,sans-serif;font-size:13px;padding-bottom:6px">${label}</td></tr>
                      <tr><td style="background:#E7ECF3;height:10px;font-size:0;line-height:0">
                        <table role="presentation" width="${percentage}%" cellpadding="0" cellspacing="0"><tr><td style="height:10px;background:#FF6B00;font-size:0;line-height:0">&nbsp;</td></tr></table>
                      </td></tr>
                    </table>
`
}

function renderAccordion(content: BlockContent, styles?: BlockStyles): string {
  const items = (content.items || []).filter(
    (item): item is import('./types').FAQItem => 'question' in item && 'answer' in item
  )
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${renderStyleAttributes(styles || {})}">
                      ${items.map((item) => `
                      <tr><td style="padding:12px 0;border-bottom:1px solid #E7ECF3;font-family:Arial,sans-serif">
                        <strong style="font-size:14px;color:#172033">${escapeHtml(item.question)}</strong>
                        <div style="padding-top:6px;font-size:13px;line-height:1.5;color:#475467">${escapeHtml(item.answer)}</div>
                      </td></tr>`).join('')}
                    </table>
`
}

function renderImageGallery(content: BlockContent, styles?: BlockStyles): string {
  const images = content.images || []
  const columns = Math.max(1, Math.min(4, Number(content.columns) || 3))
  const cells = images.map((image) => `
                        <td width="${100 / columns}%" style="padding:4px;vertical-align:top">
                          <img src="${escapeHtml(safeUrl(image.src))}" alt="${escapeHtml(image.alt)}" width="100%" style="display:block;width:100%;height:auto">
                        </td>`)
  const rows: string[] = []
  for (let index = 0; index < cells.length; index += columns) {
    rows.push(`<tr>${cells.slice(index, index + columns).join('')}</tr>`)
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${renderStyleAttributes(styles || {})}">${rows.join('')}</table>`
}

function renderDataTable(content: BlockContent, styles?: BlockStyles): string {
  const headers = content.headers || []
  const rows = content.rows || []
  const header = headers.length
    ? `<tr>${headers.map((value) => `<th align="left" style="padding:8px;border:1px solid #E7ECF3;font-family:Arial,sans-serif;font-size:12px">${escapeHtml(value)}</th>`).join('')}</tr>`
    : ''
  const body = rows.map((row) =>
    `<tr>${row.map((value) => `<td style="padding:8px;border:1px solid #E7ECF3;font-family:Arial,sans-serif;font-size:12px">${escapeHtml(value)}</td>`).join('')}</tr>`
  ).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${renderStyleAttributes(styles || {})}">${header}${body}</table>`
}

function renderCodeBlock(content: BlockContent, styles?: BlockStyles): string {
  return `
                    <pre style="${renderStyleAttributes(styles || {})};white-space:pre-wrap;word-break:break-word;font-family:monospace">${escapeHtml(content.text || content.code || '')}</pre>
`
}

export function generatePlainText(document: EmailDocument): string {
  const text: string[] = []
  document.sections.forEach((section) => {
    section.columns.forEach((column) => {
      column.blocks.forEach((block) => {
        switch (block.type) {
          case 'heading':
          case 'text':
          case 'testimonial':
            text.push(block.content.text || '')
            if (block.type === 'testimonial' && block.content.author) {
              text.push(`— ${block.content.author}${block.content.role ? `, ${block.content.role}` : ''}`)
            }
            break
          case 'button':
            text.push(`${block.content.text || 'Link'}: ${safeUrl(block.content.url)}`)
            break
          case 'hero':
            text.push(
              [block.content.text, block.content.caption, block.content.placeholder, block.content.buttonText && `${block.content.buttonText}: ${safeUrl(block.content.buttonUrl)}`]
                .filter(Boolean)
                .join('\n')
            )
            break
          case 'pricing':
            text.push(`${block.content.text}: ${block.content.price}${block.content.period}`)
            break
          case 'footer':
            text.push(`${block.content.text || ''}\nUnsubscribe: {{unsubscribe_url}}`)
            break
          case 'image':
          case 'logo':
            if (block.content.alt) text.push(`[Image: ${block.content.alt}]`)
            break
          case 'social':
          case 'navbar':
            text.push(
              (block.content.items || [])
                .filter((item): item is import('./types').SocialItem => 'platform' in item && 'url' in item)
                .map((item) => `${item.text || item.label || item.platform}: ${safeUrl(item.url)}`)
                .join('\n')
            )
            break
          case 'video':
            text.push(`${block.content.text || 'Watch video'}: ${safeUrl(block.content.videoUrl)}`)
            break
          case 'features':
            text.push((block.content.features || []).map((item) => `• ${item}`).join('\n'))
            break
          case 'accordion':
            text.push(
              (block.content.items || [])
                .filter((item): item is import('./types').FAQItem => 'question' in item && 'answer' in item)
                .map((item) => `${item.question}\n${item.answer}`)
                .join('\n\n')
            )
            break
          case 'table':
            text.push([block.content.headers, ...(block.content.rows || [])].map((row) => row?.join(' | ') ?? '').join('\n'))
            break
          case 'custom-html':
            text.push((block.content.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
            break
          case 'coupon':
            text.push(`${block.content.text || 'Discount'}: ${block.content.code || ''}`)
            break
          case 'product':
            text.push(`${block.content.text || 'Product'}\n${block.content.placeholder || ''}\n${block.content.price || ''}`)
            break
          case 'countdown':
            text.push(`${block.content.text || 'Offer ends'}: ${block.content.datetime || ''}`)
            break
          case 'progress-bar':
          case 'progress-circle':
            text.push(block.content.text || `${block.content.percentage || 0}% complete`)
            break
          case 'metrics':
            text.push(
              (block.content.items || [])
                .filter((item): item is import('./types').MetricItem => 'text' in item && 'label' in item)
                .map((item) => `${item.text} ${item.label}`)
                .join('\n')
            )
            break
        }
      })
    })
  })
  return text.filter(Boolean).join('\n\n').trim()
}
