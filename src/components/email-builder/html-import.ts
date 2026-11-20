import { createEmptyDocument, generateId } from './document-model'
import { sanitizeEmailHtml } from './email-renderer'
import type { Block, EmailDocument } from './types'

export function emailDocumentFromHtml(source: string): EmailDocument {
  const html = source.trim()
  if (!html) return createEmptyDocument()

  const body = html
    .replace(/^[\s\S]*?<body\b[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '')
    .trim()
  const content = sanitizeEmailHtml(body || html)
  if (!content) return createEmptyDocument()

  const block: Block = {
    id: generateId('custom-html'),
    type: 'custom-html',
    content: { html: content },
  }

  return {
    ...createEmptyDocument(),
    sections: [
      {
        id: generateId('section'),
        type: 'section',
        columns: [{ id: generateId('column'), width: 100, blocks: [block] }],
      },
    ],
  }
}
