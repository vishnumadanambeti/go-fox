// GoFox Email Builder - Email-Safe HTML Renderer

import type { EmailDocument, Block, BlockContent, BlockStyles } from './types'

export function renderEmailHTML(document: EmailDocument): string {
  const { settings, sections } = document

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${settings.backgroundColor}; }
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${settings.backgroundColor};">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" width="${settings.width}" cellpadding="0" cellspacing="0" style="background-color: ${settings.contentBackground}; margin: 0 auto;">
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

  return html
}

function renderSection(section: any): string {
  let html = `
          <tr>
            <td style="padding: ${section.styles?.padding || 20}px; background-color: ${section.styles?.backgroundColor || 'transparent'};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
`

  section.columns.forEach((column: any) => {
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

function renderColumn(column: any): string {
  const widthPercent = column.width
  let html = `
                  <td width="${widthPercent}%" valign="${column.styles?.verticalAlign || 'top'}" style="padding: ${column.styles?.padding || 10}px; ${column.styles?.backgroundColor ? `background-color: ${column.styles.backgroundColor};` : ''} ${column.styles?.borderRight ? `border-right: ${column.styles.borderRight};` : ''} ${column.styles?.borderLeft ? `border-left: ${column.styles.borderLeft};` : ''}">
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
    case 'custom-html':
      return content.html || ''
    default:
      return ''
  }
}

function renderStyleAttributes(styles: BlockStyles): string {
  const parts: string[] = []
  if (styles.color) parts.push(`color: ${styles.color}`)
  if (styles.backgroundColor) parts.push(`background-color: ${styles.backgroundColor}`)
  if (styles.fontSize) parts.push(`font-size: ${styles.fontSize}px`)
  if (styles.fontFamily) parts.push(`font-family: ${styles.fontFamily}`)
  if (styles.fontWeight) parts.push(`font-weight: ${styles.fontWeight}`)
  if (styles.lineHeight) parts.push(`line-height: ${styles.lineHeight}`)
  if (styles.letterSpacing) parts.push(`letter-spacing: ${styles.letterSpacing}px`)
  if (styles.textAlign) parts.push(`text-align: ${styles.textAlign}`)
  if (styles.padding) parts.push(`padding: ${styles.padding}px`)
  if (styles.margin) parts.push(`margin: ${styles.margin}px`)
  if (styles.border) parts.push(`border: ${styles.border}`)
  if (styles.borderRadius) parts.push(`border-radius: ${styles.borderRadius}px`)
  if (styles.width) parts.push(`width: ${styles.width}px`)
  if (styles.height) parts.push(`height: ${styles.height}px`)
  if (styles.maxWidth) parts.push(`max-width: ${styles.maxWidth}`)
  return parts.join('; ')
}

function renderHeading(content: BlockContent, styles?: BlockStyles): string {
  const level = content.level || 1
  const align = content.alignment || 'left'
  const text = content.text || 'Heading'
  const style = renderStyleAttributes(styles || {})
  return `
                    <h${level} style="margin: 0; ${style} text-align: ${align};">${text}</h${level}>
`
}

function renderText(content: BlockContent, styles?: BlockStyles): string {
  const align = content.alignment || 'left'
  const text = content.text || ''
  const style = renderStyleAttributes(styles || {})
  return `
                    <p style="margin: 0; ${style} text-align: ${align};">${text}</p>
`
}

function renderImage(content: BlockContent, styles?: BlockStyles): string {
  const src = content.src || ''
  const alt = content.alt || ''
  const width = content.width || 600
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
  const text = content.text || 'Button'
  const url = content.url || '#'
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
  const thickness = content.thickness || 1
  const align = content.alignment || 'center'
  const color = (styles?.borderColor as string) || '#E7ECF3'
  const margin = styles?.margin || 24
  return `
                    <div style="border-top: ${thickness}px solid ${color}; margin: ${margin}px 0; text-align: ${align};"></div>
`
}

function renderSpacer(content: BlockContent): string {
  const height = content.height || 28
  return `
                    <div style="height: ${height}px; line-height: ${height}px; font-size: ${height}px;">&nbsp;</div>
`
}

function renderSocial(content: BlockContent, styles?: BlockStyles): string {
  const items = content.items || []
  const align = content.alignment || 'center'
  const style = renderStyleAttributes(styles || {})
  let links = items
    .map((item: any) => `<a href="${item.url}" style="color: ${styles?.color || '#FF6B00'}; text-decoration: none; margin: 0 8px;">${item.platform}</a>`)
    .join(' · ')
  return `
                    <p style="margin: 0; ${style} text-align: ${align};">${links}</p>
`
}

function renderVideo(content: BlockContent, styles?: BlockStyles): string {
  const url = content.videoUrl || '#'
  const text = content.text || '▶ Watch video'
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
                          <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; color: #FF6B00; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">${content.text || 'ANNOUNCEMENT'}</div>
                          <h1 style="font-family: Arial, sans-serif; font-size: 28px; color: #FFFFFF; margin: 12px 0 10px;">${content.caption || 'Headline'}</h1>
                          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #94A3B8; margin: 0 0 20px;">${content.placeholder || 'Description'}</p>
                          <table role="presentation" align="center">
                            <tr>
                              <td style="background-color: #FF6B00; border-radius: 8px;">
                                <a href="${(content.buttonUrl as string) || '#'}" style="display: inline-block; padding: 12px 28px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none;">${(content.buttonText as string) || 'CTA'}</a>
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
                          <div style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #1E293B;">${f}</div>
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
                          <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; color: #C2410C; letter-spacing: 1px; text-transform: uppercase;">${content.text || 'PLAN'}</div>
                          <div style="font-family: Arial, sans-serif; font-size: 36px; font-weight: 800; color: #1E293B; margin: 8px 0;">${content.price || '$0'}<span style="font-size: 14px; font-weight: normal; color: #64748B;">${content.period || ''}</span></div>
                          <p style="font-family: Arial, sans-serif; font-size: 12.5px; color: #64748B; margin: 0 0 16px;">${content.placeholder || ''}</p>
                          <table role="presentation" align="center">
                            <tr>
                              <td style="background-color: #FF6B00; border-radius: 8px;">
                                <a href="${(content.buttonUrl as string) || '#'}" style="display: inline-block; padding: 10px 24px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #FFFFFF; text-decoration: none;">${(content.buttonText as string) || 'CTA'}</a>
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
                          <p style="font-family: Georgia, serif; font-style: italic; font-size: 14.5px; line-height: 1.6; color: #065F46; margin: 0;">${content.text || ''}</p>
                          <div style="font-family: Arial, sans-serif; font-style: normal; font-size: 12px; font-weight: 700; color: #047857; margin-top: 8px;">${content.author || ''} — ${content.role || ''}</div>
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
                      <div style="font-family: monospace; font-size: 24px; font-weight: 800; color: #C2410C; letter-spacing: 3px; margin: 8px 0;">${content.code || 'CODE'}</div>
                      <div style="font-family: Arial, sans-serif; font-size: 11px; color: #78350F;">${content.placeholder || ''}</div>
                    </div>
`
}

function renderMetrics(content: BlockContent, styles?: BlockStyles): string {
  const items = content.items || []
  const style = renderStyleAttributes(styles || {})
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">
                      <tr>
                        ${items.map((item: any) => `
                        <td width="33%" align="center" style="font-family: Arial, sans-serif; border-right: 1px solid #E2E8F0;">
                          <div style="font-size: 22px; font-weight: 800; color: #FF6B00;">${item.text || '0'}</div>
                          <div style="font-size: 11px; color: #64748B;">${item.label || ''}</div>
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
                          <div style="font-size: 14px; font-weight: 700; color: #17243A;">${content.text || 'Product'}</div>
                          <div style="font-size: 12px; color: #667085;">${content.placeholder || ''}</div>
                          <div style="font-size: 14px; font-weight: 700; color: #17243A; margin-top: 4px;">${content.price || '$0'}</div>
                        </td>
                      </tr>
                    </table>
`
}

function renderFooter(content: BlockContent, styles?: BlockStyles): string {
  const style = renderStyleAttributes(styles || {})
  return `
                    <div style="${style}">
                      <span style="font-family: Arial, sans-serif;">${content.text || ''}</span> · <a href="{{unsubscribe_url}}" style="color: inherit;">${content.placeholder || 'Unsubscribe'}</a>
                    </div>
`
}

export function generatePlainText(document: EmailDocument): string {
  let text = ''
  document.sections.forEach((section) => {
    section.columns.forEach((column) => {
      column.blocks.forEach((block) => {
        switch (block.type) {
          case 'heading':
          case 'text':
          case 'testimonial':
            text += `${block.content.text || ''}\n\n`
            break
          case 'button':
            text += `[Link: ${block.content.text}] ${block.content.url}\n\n`
            break
          case 'pricing':
            text += `${block.content.text}: ${block.content.price}${block.content.period}\n\n`
            break
          case 'footer':
            text += `---\n${block.content.text}\nUnsubscribe: {{unsubscribe_url}}\n\n`
            break
        }
      })
    })
  })
  return text.trim()
}
