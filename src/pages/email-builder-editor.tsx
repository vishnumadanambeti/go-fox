import { useCallback, useEffect, useState } from 'react'
import { patch, post, type Row } from '../lib/api'
import { useApp, useFetch } from '../lib/app-context'
import { useNavigate } from '../lib/router'
import { Button, ErrorState, FormRow, Modal, Spinner } from '../components/ui'
import { EmailBuilder } from '../components/email-builder/EmailBuilder'
import { isEmailDocument } from '../components/email-builder/document-model'
import { emailDocumentFromHtml } from '../components/email-builder/html-import'
import type { BuilderMode, EmailDocument } from '../components/email-builder/types'

function documentForTemplate(record: Row): EmailDocument {
  const rawDocument = record.document_json
  if (typeof rawDocument === 'string' && rawDocument.trim()) {
    try {
      const document = JSON.parse(rawDocument) as unknown
      if (
        isEmailDocument(document) &&
        (document.sections.length > 0 || !String(record.html ?? record.body ?? '').trim())
      ) {
        return document
      }
    } catch {
      // Older records may contain invalid JSON; keep their saved HTML below instead of discarding it.
    }
  }

  return emailDocumentFromHtml(String(record.html ?? record.body ?? ''))
}

export function EmailBuilderEditor({ id }: { id: string }) {
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch<{ record: Row }>(
    `/api/resources/email_templates/${id}`
  )
  const record = data?.record
  const [document, setDocument] = useState<EmailDocument | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [category, setCategory] = useState('General')
  const [status, setStatus] = useState('draft')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!record) return
    setName(String(record.name ?? 'Untitled email'))
    setSubject(String(record.subject ?? ''))
    setPreviewText(String(record.preview_text ?? ''))
    setCategory(String(record.category ?? 'General'))
    setStatus(String(record.status ?? 'draft'))
    setDocument(documentForTemplate(record))
  }, [record])

  const persist = useCallback(
    async (
      nextDocument: EmailDocument,
      html: string,
      plainText: string,
      builder: BuilderMode = 'design',
      nextStatus = status
    ) => {
      await patch(`/api/resources/email_templates/${id}`, {
        name: name.trim() || 'Untitled email',
        subject,
        preview_text: previewText,
        category,
        html,
        body: html,
        plain_text: plainText,
        builder,
        status: nextStatus,
        document_json: JSON.stringify(nextDocument),
      })
      setDocument(nextDocument)
      setStatus(nextStatus)
    },
    [category, id, name, previewText, status, subject]
  )

  const autoSave = useCallback(
    async (nextDocument: EmailDocument, html: string, plainText: string, builder: BuilderMode) => {
      await persist(nextDocument, html, plainText, builder)
    },
    [persist]
  )

  const save = useCallback(
    async (nextDocument: EmailDocument, html: string, plainText: string, builder: BuilderMode) => {
      try {
        await persist(nextDocument, html, plainText, builder)
        toast('Email template saved.', 'good')
      } catch (saveError) {
        toast(saveError instanceof Error ? saveError.message : 'Could not save the template.', 'bad')
        throw saveError
      }
    },
    [persist, toast]
  )

  const publish = useCallback(
    async (nextDocument: EmailDocument, html: string, plainText: string, builder: BuilderMode) => {
      if (!subject.trim()) throw new Error('Add a subject line before publishing.')
      const hasBlocks = nextDocument.sections.some((section) =>
        section.columns.some((column) => column.blocks.length)
      )
      if (!hasBlocks && !(builder === 'plain' && plainText.trim())) {
        throw new Error('Add at least one content block before publishing.')
      }
      try {
        await persist(nextDocument, html, plainText, builder, 'active')
        toast('Template published and ready for Campaign Studio.', 'good')
      } catch (publishError) {
        toast(
          publishError instanceof Error ? publishError.message : 'Could not publish the template.',
          'bad'
        )
        throw publishError
      }
    },
    [persist, subject, toast]
  )

  const sendTest = useCallback(
    async (to: string) => {
      const result = await post<{ message?: string }>(`/api/templates/${id}/test`, { to })
      toast(result.message ?? `Test email sent to ${to}.`, 'good')
    },
    [id, toast]
  )

  if (loading || !document) return <Spinner label="Loading email template" />
  if (error || !record) {
    return <ErrorState message={error?.message ?? 'Template not found'} onRetry={reload} />
  }

  return (
    <>
      <EmailBuilder
        id={id}
        name={name}
        onNameChange={setName}
        subject={subject}
        onSubjectChange={setSubject}
        status={status}
        initialDocument={document}
        initialHtml={String(record.html ?? record.body ?? '')}
        initialPlainText={String(record.plain_text ?? '')}
        initialMode={record.builder === 'code' || record.builder === 'plain' ? record.builder : 'design'}
        onSave={save}
        onAutoSave={autoSave}
        onPublish={publish}
        onSendTest={sendTest}
        onBack={() => navigate('/marketing/emails')}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Email settings"
        footer={
          <>
            <Button size="sm" onClick={() => setSettingsOpen(false)}>Close</Button>
            <Button size="sm" variant="primary" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow label="Template name">
            <input className="gx-input" value={name} onChange={(event) => setName(event.target.value)} />
          </FormRow>
          <FormRow label="Subject line">
            <input
              className="gx-input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="A subject your customer will open"
            />
          </FormRow>
          <FormRow label="Preview text">
            <input
              className="gx-input"
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder="One short line of context"
            />
          </FormRow>
          <FormRow label="Category">
            <select className="gx-select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {['Transactional', 'Onboarding', 'Promotional', 'E-Commerce', 'Behavioral', 'Newsletter', 'Events', 'Sales', 'Corporate', 'Education', 'Seasonal', 'Customer Success', 'General'].map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </FormRow>
          <p className="text-[11px] text-muted">Save the template to persist these settings.</p>
        </div>
      </Modal>
    </>
  )
}
