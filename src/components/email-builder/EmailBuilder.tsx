// GoFox Email Builder - World-Class Visual Email Editor with dnd-kit
// Production Implementation: Linear / Stripe / Unlayer grade UI/UX

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { move } from '@dnd-kit/helpers'
import {
  ArrowLeft,
  Save,
  Undo,
  Redo,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Send,
  Settings2,
  Plus,
  X,
  Copy,
  Trash2,
  Sparkles,
  Type,
  Palette,
  Layout,
  Layers,
  Search,
  Check,
  ChevronDown,
  ExternalLink,
  Code2,
  FileText,
  Rocket,
  Mail,
  MoveUp,
  MoveDown,
  Bookmark,
  GripVertical,
  AlignCenter,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type {
  EmailDocument,
  Block,
  LibraryBlock,
  BuilderState,
  DragItem,
  Section,
  Column,
  FAQItem,
  BuilderMode,
} from './types'
import {
  createEmptyDocument,
  addSection,
  addBlockToColumn,
  removeBlock,
  updateBlockContent,
  updateBlockStyles,
  moveBlock,
  duplicateBlock,
  findBlock,
  createBlockFromLibrary,
  removeSection,
  duplicateSection,
  isEmailDocument,
} from './document-model'
import { LIBRARY_BLOCKS, LAYOUT_PRESETS } from './library-blocks'
import { emailDocumentFromHtml } from './html-import'
import { renderEmailHTML, generatePlainText, sanitizeEmailHtml } from './email-renderer'
import { Button, Modal, cx } from '../ui'

export interface EmailBuilderProps {
  id?: string
  name?: string
  onNameChange?: (name: string) => void
  subject?: string
  onSubjectChange?: (subject: string) => void
  status?: string
  initialDocument?: EmailDocument
  initialHtml?: string
  initialPlainText?: string
  initialMode?: BuilderMode
  onSave?: (document: EmailDocument, html: string, plainText: string, mode: BuilderMode) => Promise<void>
  onAutoSave?: (document: EmailDocument, html: string, plainText: string, mode: BuilderMode) => Promise<void>
  onPublish?: (document: EmailDocument, html: string, plainText: string, mode: BuilderMode) => Promise<void>
  onBack?: () => void
  onSendTest?: (to: string, html: string) => Promise<void>
  onOpenSettings?: () => void
}

const CRM_TOKENS = [
  { label: 'First Name', token: '{{first_name}}' },
  { label: 'Last Name', token: '{{last_name}}' },
  { label: 'Full Name', token: '{{full_name}}' },
  { label: 'Email Address', token: '{{email}}' },
  { label: 'Company Name', token: '{{company_name}}' },
  { label: 'Phone Number', token: '{{phone}}' },
  { label: 'Owner Name', token: '{{owner_name}}' },
  { label: 'Deal Name', token: '{{deal_name}}' },
  { label: 'Meeting Link', token: '{{meeting_link}}' },
  { label: 'Unsubscribe Link', token: '{{unsubscribe_url}}' },
]

interface EditSnapshot {
  document: EmailDocument
  mode: BuilderMode
  codeDraft: string
  codeDirty: boolean
  plainTextDraft: string
  plainTextEdited: boolean
  name: string
  subject: string
}

type LocalEditDraft = EditSnapshot & { version: 1 }

function sameEditSnapshot(left: EditSnapshot, right: EditSnapshot): boolean {
  return (
    left.document === right.document &&
    left.mode === right.mode &&
    left.codeDraft === right.codeDraft &&
    left.codeDirty === right.codeDirty &&
    left.plainTextDraft === right.plainTextDraft &&
    left.plainTextEdited === right.plainTextEdited &&
    left.name === right.name &&
    left.subject === right.subject
  )
}

function isLocalEditDraft(value: unknown): value is LocalEditDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    draft.version === 1 &&
    isEmailDocument(draft.document) &&
    (draft.mode === 'design' || draft.mode === 'code' || draft.mode === 'plain') &&
    typeof draft.codeDraft === 'string' &&
    typeof draft.codeDirty === 'boolean' &&
    typeof draft.plainTextDraft === 'string' &&
    typeof draft.plainTextEdited === 'boolean' &&
    typeof draft.name === 'string' &&
    typeof draft.subject === 'string'
  )
}

function readLocalEditDraft(id?: string): { draft: LocalEditDraft | null; error: string | null } {
  if (!id || typeof window === 'undefined') return { draft: null, error: null }
  const key = `gofox-email-builder-draft:${id}`
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : 'Local draft recovery is unavailable.',
    }
  }
  if (!raw) return { draft: null, error: null }

  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      return {
        draft: null,
        error: error instanceof Error ? error.message : 'A malformed local draft could not be removed.',
      }
    }
    return { draft: null, error: 'A malformed local recovery draft was discarded.' }
  }

  if (!isLocalEditDraft(value)) {
    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      return {
        draft: null,
        error: error instanceof Error ? error.message : 'An invalid local draft could not be removed.',
      }
    }
    return { draft: null, error: 'An invalid local recovery draft was discarded.' }
  }
  return { draft: value, error: null }
}

export function EmailBuilder({
  id: _id,
  name = 'Untitled Template',
  onNameChange,
  subject = '',
  onSubjectChange,
  status = 'draft',
  initialDocument,
  initialHtml,
  initialPlainText,
  initialMode = 'design',
  onSave,
  onAutoSave,
  onPublish,
  onBack,
  onSendTest,
  onOpenSettings,
}: EmailBuilderProps) {
  const [recovery] = useState(() => readLocalEditDraft(_id))
  const recoveredDraft = recovery.draft
  // Main Builder State
  const [state, setState] = useState<BuilderState>(() => {
    const doc =
      recoveredDraft?.document ??
      (initialDocument && initialDocument.sections ? initialDocument : createEmptyDocument())
    return {
      document: doc,
      selectedId: null,
      selectedType: null,
      mode: recoveredDraft?.mode ?? initialMode,
      device: 'desktop',
      preview: false,
      history: [doc],
      historyIndex: 0,
      unsaved: Boolean(recoveredDraft),
      saving: false,
    }
  })

  // UI Panels
  const [activeTab, setActiveTab] = useState<'content' | 'columns' | 'blocks'>('content')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  )
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  )
  const [propertiesTab, setPropertiesTab] = useState<'content' | 'style' | 'layout' | 'responsive' | 'advanced'>('content')
  const [paddingLinked, setPaddingLinked] = useState(true)
  const [marginLinked, setMarginLinked] = useState(true)
  const [canvasZoom, setCanvasZoom] = useState(100)
  const [operationError, setOperationError] = useState<string | null>(recovery.error)
  const editBatchRef = useRef<{ group: string; updatedAt: number } | null>(null)
  const { ref: setCanvasRootRef } = useDroppable({
    id: 'email-canvas-root',
    type: 'canvas-root',
    accept: 'email-library-block',
    collisionPriority: 1,
    data: { type: 'canvas', isCanvasRoot: true } satisfies DragItem,
  })

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false)
  const [savedBlocks, setSavedBlocks] = useState<Block[]>([])
  const [codeDraft, setCodeDraft] = useState(
    recoveredDraft?.codeDraft ?? (initialMode === 'code' ? initialHtml ?? '' : '')
  )
  const [codeDirty, setCodeDirty] = useState(recoveredDraft?.codeDirty ?? false)
  const [plainTextDraft, setPlainTextDraft] = useState(
    recoveredDraft?.plainTextDraft ?? initialPlainText ?? ''
  )
  const [plainTextEdited, setPlainTextEdited] = useState(
    recoveredDraft?.plainTextEdited ?? (initialMode === 'plain' && Boolean(initialPlainText?.trim()))
  )
  const latestEditRef = useRef<EditSnapshot>({
    document: state.document,
    mode: state.mode,
    codeDraft,
    codeDirty,
    plainTextDraft,
    plainTextEdited,
    name,
    subject,
  })
  latestEditRef.current = {
    document: state.document,
    mode: state.mode,
    codeDraft,
    codeDirty,
    plainTextDraft,
    plainTextEdited,
    name,
    subject,
  }
  const failedAutoSaveRef = useRef<EditSnapshot | null>(null)

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const codeEditorRef = useRef<HTMLTextAreaElement>(null)
  const plainTextEditorRef = useRef<HTMLTextAreaElement>(null)

  // History Management
  const pushToHistory = useCallback((document: EmailDocument, group?: string) => {
    const now = Date.now()
    const previousEdit = editBatchRef.current
    const coalesce =
      Boolean(group) &&
      previousEdit !== null &&
      previousEdit?.group === group &&
      now - previousEdit.updatedAt < 700
    editBatchRef.current = group ? { group, updatedAt: now } : null

    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1)
      if (coalesce && prev.historyIndex > 0) {
        newHistory[newHistory.length - 1] = document
      } else {
        newHistory.push(document)
      }
      return {
        ...prev,
        document,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        unsaved: true,
      }
    })
  }, [])

  const undo = useCallback(() => {
    editBatchRef.current = null
    setState((prev) => {
      if (prev.historyIndex > 0) {
        const nextIndex = prev.historyIndex - 1
        return {
          ...prev,
          document: prev.history[nextIndex],
          historyIndex: nextIndex,
          unsaved: true,
        }
      }
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    editBatchRef.current = null
    setState((prev) => {
      if (prev.historyIndex < prev.history.length - 1) {
        const nextIndex = prev.historyIndex + 1
        return {
          ...prev,
          document: prev.history[nextIndex],
          historyIndex: nextIndex,
          unsaved: true,
        }
      }
      return prev
    })
  }, [])

  // Document Operations
  const handleAddSection = useCallback(
    (columnWidths: number[]) => {
      const newDocument = addSection(state.document, columnWidths)
      pushToHistory(newDocument)
    },
    [state.document, pushToHistory]
  )

  const handleAddBlock = useCallback(
    (libraryBlock: LibraryBlock, sectionId?: string, columnId?: string) => {
      let targetSectionId = sectionId
      let targetColumnId = columnId

      // If not specified, append to first section and column, or create a new section
      let doc = state.document
      if (!targetSectionId || !targetColumnId) {
        if (doc.sections.length === 0) {
          doc = addSection(doc, [100])
        }
        targetSectionId = doc.sections[doc.sections.length - 1].id
        targetColumnId = doc.sections[doc.sections.length - 1].columns[0].id
      }

      const block = createBlockFromLibrary(libraryBlock)
      const newDocument = addBlockToColumn(doc, targetSectionId, targetColumnId, block)
      pushToHistory(newDocument)
      setState((prev) => ({ ...prev, selectedId: block.id, selectedType: 'block' }))
    },
    [state.document, pushToHistory]
  )

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      const newDocument = removeBlock(state.document, blockId)
      pushToHistory(newDocument)
      setState((prev) => ({
        ...prev,
        selectedId: null,
        selectedType: null,
      }))
    },
    [state.document, pushToHistory]
  )

  const handleDuplicateBlock = useCallback(
    (blockId: string) => {
      const newDocument = duplicateBlock(state.document, blockId)
      pushToHistory(newDocument)
    },
    [state.document, pushToHistory]
  )

  const handleMoveBlockUpDown = useCallback(
    (blockId: string, direction: 'up' | 'down') => {
      const doc = state.document
      for (const section of doc.sections) {
        for (const col of section.columns) {
          const idx = col.blocks.findIndex((b) => b.id === blockId)
          if (idx !== -1) {
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1
            if (targetIdx >= 0 && targetIdx < col.blocks.length) {
              const newDoc = moveBlock(doc, blockId, section.id, col.id, targetIdx)
              pushToHistory(newDoc)
            }
            return
          }
        }
      }
    },
    [state.document, pushToHistory]
  )

  const handleSaveAsReusableBlock = useCallback(
    (blockId: string) => {
      const block = findBlock(state.document, blockId)
      if (block) {
        setSavedBlocks((prev) => [...prev, JSON.parse(JSON.stringify(block))])
      }
    },
    [state.document]
  )

  const handleUpdateBlockContent = useCallback(
    (blockId: string, content: Partial<Block['content']>) => {
      const newDocument = updateBlockContent(state.document, blockId, content)
      pushToHistory(newDocument, `content:${blockId}`)
    },
    [state.document, pushToHistory]
  )

  const handleUpdateBlockStyles = useCallback(
    (blockId: string, styles: Partial<Block['styles']>) => {
      const newDocument = updateBlockStyles(state.document, blockId, styles)
      pushToHistory(newDocument, `styles:${blockId}`)
    },
    [state.document, pushToHistory]
  )

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      const newDoc = removeSection(state.document, sectionId)
      pushToHistory(newDoc)
      setState((prev) => ({ ...prev, selectedId: null, selectedType: null }))
    },
    [state.document, pushToHistory]
  )

  const handleDuplicateSection = useCallback(
    (sectionId: string) => {
      const newDocument = duplicateSection(state.document, sectionId)
      if (newDocument === state.document) return
      const duplicatedSection = newDocument.sections.find(
        (section) => section.id !== sectionId &&
          state.document.sections.every((existing) => existing.id !== section.id)
      )
      pushToHistory(newDocument)
      if (duplicatedSection) {
        setState((prev) => ({
          ...prev,
          selectedId: duplicatedSection.id,
          selectedType: 'section',
        }))
      }
    },
    [state.document, pushToHistory]
  )

  // Selection
  const handleSelect = useCallback((id: string, type: 'section' | 'column' | 'block') => {
    setState((prev) => ({ ...prev, selectedId: id, selectedType: type }))
  }, [])

  // Drag Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const source = event.operation.source
    if (!source) return
    setActiveId(String(source.id))
    setDragItem(source.data as DragItem)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const source = event.operation.source
      const target = event.operation.target
      const activeData = source?.data as DragItem | undefined
      const overData = target?.data as DragItem | undefined
      setActiveId(null)
      setDragItem(null)
      if (
        activeData?.type === 'library' &&
        window.matchMedia('(max-width: 767px)').matches
      ) {
        setLeftPanelCollapsed(true)
      }

      if (event.canceled || !source || !target || !activeData || !overData) return

      if (activeData.type === 'library' && activeData.blockType) {
        const libraryBlock = LIBRARY_BLOCKS.find((block) => block.type === activeData.blockType)
        if (!libraryBlock) return

        let nextDocument = state.document
        if (nextDocument.sections.length === 0) nextDocument = addSection(nextDocument, [100])
        const targetSection =
          nextDocument.sections.find((section) => section.id === overData.sectionId) ??
          nextDocument.sections[nextDocument.sections.length - 1]
        const targetColumn =
          targetSection.columns.find((column) => column.id === overData.columnId) ??
          targetSection.columns[0]
        if (!targetColumn) return

        const block = createBlockFromLibrary(libraryBlock)
        nextDocument = addBlockToColumn(nextDocument, targetSection.id, targetColumn.id, block)
        if (overData.index !== undefined) {
          nextDocument = moveBlock(nextDocument, block.id, targetSection.id, targetColumn.id, overData.index)
        }
        pushToHistory(nextDocument)
        setState((prev) => ({ ...prev, selectedId: block.id, selectedType: 'block' }))
        return
      }

      if (
        activeData.type === 'canvas' &&
        activeData.sectionId &&
        !activeData.blockId &&
        isSortable(source) &&
        isSortable(target)
      ) {
        const reorderedIds = move(state.document.sections.map((section) => section.id), event)
        const sectionsById = new Map(state.document.sections.map((section) => [section.id, section]))
        const sections = reorderedIds
          .map((sectionId) => sectionsById.get(String(sectionId)))
          .filter((section): section is Section => Boolean(section))
        if (sections.some((section, index) => section.id !== state.document.sections[index]?.id)) {
          pushToHistory({ ...state.document, sections })
        }
        return
      }

      if (activeData.type === 'canvas' && activeData.blockId && isSortable(source)) {
        if (overData.blockId && isSortable(target)) {
          const blockIdsByColumn: Record<string, string[]> = {}
          const blocksById = new Map<string, Block>()
          for (const section of state.document.sections) {
            for (const column of section.columns) {
              blockIdsByColumn[column.id] = column.blocks.map((block) => {
                blocksById.set(block.id, block)
                return block.id
              })
            }
          }

          const reorderedBlockIds = move(blockIdsByColumn, event)
          const sections = state.document.sections.map((section) => ({
            ...section,
            columns: section.columns.map((column) => ({
              ...column,
              blocks: (reorderedBlockIds[column.id] ?? [])
                .map((blockId) => blocksById.get(String(blockId)))
                .filter((block): block is Block => Boolean(block)),
            })),
          }))
          const changed = sections.some((section, sectionIndex) =>
            section.columns.some((column, columnIndex) =>
              column.blocks.some((block, blockIndex) =>
                block.id !== state.document.sections[sectionIndex]?.columns[columnIndex]?.blocks[blockIndex]?.id
              )
            )
          )
          if (changed) pushToHistory({ ...state.document, sections })
          return
        }

        const targetSection =
          state.document.sections.find((section) => section.id === overData.sectionId) ??
          state.document.sections[state.document.sections.length - 1]
        const targetColumn =
          targetSection?.columns.find((column) => column.id === overData.columnId) ??
          targetSection?.columns[0]
        if (!targetSection || !targetColumn) return
        const nextDocument = moveBlock(
          state.document,
          activeData.blockId,
          targetSection.id,
          targetColumn.id,
          overData.index ?? targetColumn.blocks.length
        )
        if (nextDocument !== state.document) pushToHistory(nextDocument)
      }
    },
    [state.document, handleAddBlock, pushToHistory]
  )

  // Save Handler
  const handleSave = useCallback(async () => {
    if (!onSave) return
    const snapshot = latestEditRef.current
    setOperationError(null)
    setState((prev) => ({ ...prev, saving: true }))
    const documentToSave =
      snapshot.mode === 'code' && snapshot.codeDirty
        ? emailDocumentFromHtml(snapshot.codeDraft)
        : snapshot.document
    const html =
      snapshot.mode === 'code'
        ? sanitizeEmailHtml(snapshot.codeDraft.trim() || renderEmailHTML(documentToSave))
        : renderEmailHTML(documentToSave)
    const plainText = snapshot.plainTextEdited
      ? snapshot.plainTextDraft
      : generatePlainText(documentToSave)
    try {
      await onSave(documentToSave, html, plainText, snapshot.mode)
      const unchanged = sameEditSnapshot(snapshot, latestEditRef.current)
      failedAutoSaveRef.current = null
      setState((prev) => {
        if (!unchanged) return { ...prev, saving: false }
        const nextHistory = prev.history.slice(0, prev.historyIndex + 1)
        if (documentToSave !== prev.document) nextHistory.push(documentToSave)
        return {
          ...prev,
          document: documentToSave,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
          saving: false,
          unsaved: !unchanged,
        }
      })
      if (unchanged && snapshot.mode === 'code') {
        setCodeDraft(html)
        setCodeDirty(false)
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The template could not be saved.')
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [onSave])

  useEffect(() => {
    if (!onAutoSave || !state.unsaved || state.saving) return
    const snapshot = { ...latestEditRef.current }
    if (
      failedAutoSaveRef.current &&
      sameEditSnapshot(snapshot, failedAutoSaveRef.current)
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      const documentToSave =
        snapshot.mode === 'code' && snapshot.codeDirty
          ? emailDocumentFromHtml(snapshot.codeDraft)
          : snapshot.document
      const html =
        snapshot.mode === 'code'
          ? sanitizeEmailHtml(snapshot.codeDraft.trim() || renderEmailHTML(documentToSave))
          : renderEmailHTML(documentToSave)
      const plainText = snapshot.plainTextEdited
        ? snapshot.plainTextDraft
        : generatePlainText(documentToSave)

      setOperationError(null)
      setState((prev) => ({ ...prev, saving: true }))
      void onAutoSave(documentToSave, html, plainText, snapshot.mode)
        .then(() => {
          const unchanged = sameEditSnapshot(snapshot, latestEditRef.current)
          failedAutoSaveRef.current = null
          setState((prev) => {
            if (!unchanged) return { ...prev, saving: false }
            const nextHistory = prev.history.slice(0, prev.historyIndex + 1)
            if (documentToSave !== prev.document) nextHistory.push(documentToSave)
            return {
              ...prev,
              document: documentToSave,
              history: nextHistory,
              historyIndex: nextHistory.length - 1,
              saving: false,
              unsaved: false,
            }
          })
          if (unchanged && snapshot.mode === 'code') {
            setCodeDraft(html)
            setCodeDirty(false)
          }
        })
        .catch((error: unknown) => {
          failedAutoSaveRef.current = snapshot
          setOperationError(
            error instanceof Error ? error.message : 'The template could not be saved automatically.'
          )
          setState((prev) => ({ ...prev, saving: false }))
        })
    }, 800)

    return () => window.clearTimeout(timeout)
  }, [
    codeDirty,
    codeDraft,
    name,
    onAutoSave,
    plainTextDraft,
    plainTextEdited,
    state.document,
    state.mode,
    state.saving,
    state.unsaved,
    subject,
  ])

  useEffect(() => {
    if (!state.unsaved) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [state.unsaved])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (!event.shiftKey && event.key.toLowerCase() === 's') {
          event.preventDefault()
          void handleSave()
        }
        return
      }

      if (!event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (
        (event.shiftKey && event.key.toLowerCase() === 'z') ||
        (!event.shiftKey && event.key.toLowerCase() === 'y')
      ) {
        event.preventDefault()
        redo()
      } else if (!event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, redo, undo])

  const handlePublish = useCallback(async () => {
    if (!onPublish) return
    setOperationError(null)
    setState((prev) => ({ ...prev, saving: true }))
    const documentToPublish =
      state.mode === 'code' && codeDirty ? emailDocumentFromHtml(codeDraft) : state.document
    const html =
      state.mode === 'code'
        ? sanitizeEmailHtml(codeDraft.trim() || renderEmailHTML(documentToPublish))
        : renderEmailHTML(documentToPublish)
    const plainText = plainTextEdited ? plainTextDraft : generatePlainText(documentToPublish)
    try {
      await onPublish(documentToPublish, html, plainText, state.mode)
      setState((prev) => {
        const nextHistory = prev.history.slice(0, prev.historyIndex + 1)
        if (documentToPublish !== prev.document) nextHistory.push(documentToPublish)
        return {
          ...prev,
          document: documentToPublish,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
          unsaved: false,
        }
      })
      if (state.mode === 'code') setCodeDraft(html)
      setCodeDirty(false)
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The template could not be published.')
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [
    onPublish,
    state.document,
    state.mode,
    codeDirty,
    codeDraft,
    plainTextEdited,
    plainTextDraft,
  ])

  // Test Email Handler
  const handleSendTest = useCallback(async () => {
    if (!onSendTest || !testEmail.trim()) return
    setSendingTest(true)
    setOperationError(null)
    try {
      const documentToSend =
        state.mode === 'code' && codeDirty ? emailDocumentFromHtml(codeDraft) : state.document
      const html =
        state.mode === 'code'
          ? sanitizeEmailHtml(codeDraft.trim() || renderEmailHTML(documentToSend))
          : renderEmailHTML(documentToSend)
      const plainText = plainTextEdited ? plainTextDraft : generatePlainText(documentToSend)
      if (onSave) await onSave(documentToSend, html, plainText, state.mode)
      await onSendTest(testEmail.trim(), html)
      setState((prev) => ({ ...prev, document: documentToSend, unsaved: false }))
      setCodeDirty(false)
      setTestOpen(false)
      setTestEmail('')
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The test email could not be sent.')
    } finally {
      setSendingTest(false)
    }
  }, [
    state.document,
    state.mode,
    codeDirty,
    codeDraft,
    plainTextEdited,
    plainTextDraft,
    testEmail,
    onSave,
    onSendTest,
  ])

  // Insert CRM token into currently selected block
  const handleInsertToken = (token: string) => {
    if (state.mode === 'code') {
      const editor = codeEditorRef.current
      const start = editor?.selectionStart ?? codeDraft.length
      const end = editor?.selectionEnd ?? start
      const nextValue = `${codeDraft.slice(0, start)}${token}${codeDraft.slice(end)}`
      setCodeDraft(nextValue)
      setCodeDirty(true)
      setState((prev) => ({ ...prev, unsaved: true }))
      requestAnimationFrame(() => {
        editor?.focus()
        editor?.setSelectionRange(start + token.length, start + token.length)
      })
    } else if (state.mode === 'plain') {
      const editor = plainTextEditorRef.current
      const start = editor?.selectionStart ?? plainTextDraft.length
      const end = editor?.selectionEnd ?? start
      const nextValue = `${plainTextDraft.slice(0, start)}${token}${plainTextDraft.slice(end)}`
      setPlainTextDraft(nextValue)
      setPlainTextEdited(true)
      setState((prev) => ({ ...prev, unsaved: true }))
      requestAnimationFrame(() => {
        editor?.focus()
        editor?.setSelectionRange(start + token.length, start + token.length)
      })
    } else if (state.selectedId && state.selectedType === 'block') {
      const block = findBlock(state.document, state.selectedId)
      if (block) {
        if (block.content.text !== undefined) {
          handleUpdateBlockContent(block.id, { text: `${block.content.text} ${token}` })
        } else if (block.content.caption !== undefined) {
          handleUpdateBlockContent(block.id, { caption: `${block.content.caption} ${token}` })
        }
      }
    }
    setTokenMenuOpen(false)
  }

  // Filter library blocks
  const filteredBlocks = useMemo(() => {
    return LIBRARY_BLOCKS.filter((block) => {
      const matchesCategory = activeCategory === 'all' || block.category === activeCategory
      const matchesSearch =
        !searchQuery.trim() ||
        block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, searchQuery])

  // Selected Block
  const selectedBlock = useMemo(() => {
    if (!state.selectedId || state.selectedType !== 'block') return null
    return findBlock(state.document, state.selectedId)
  }, [state.document, state.selectedId, state.selectedType])

  // Generated HTML & Plain Text
  const generatedHTML = useMemo(() => renderEmailHTML(state.document), [state.document])
  const generatedPlainText = useMemo(() => generatePlainText(state.document), [state.document])
  useEffect(() => {
    if (!codeDirty && state.mode !== 'code') setCodeDraft(generatedHTML)
  }, [codeDirty, generatedHTML, state.mode])
  useEffect(() => {
    if (!codeDirty && state.mode === 'code' && !codeDraft.trim()) {
      setCodeDraft(initialHtml?.trim() || generatedHTML)
    }
  }, [codeDirty, codeDraft, generatedHTML, initialHtml, state.mode])
  useEffect(() => {
    if (!plainTextEdited) setPlainTextDraft(generatedPlainText)
  }, [generatedPlainText, plainTextEdited])
  const liveHTML = state.mode === 'code' ? codeDraft || generatedHTML : generatedHTML
  const livePlainText = plainTextEdited ? plainTextDraft : generatedPlainText
  const canSendTest = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())
  const switchMode = (mode: BuilderMode) => {
    if (mode === state.mode) return
    if (state.mode === 'code' && codeDirty) {
      pushToHistory(emailDocumentFromHtml(codeDraft))
      setCodeDirty(false)
    }
    if (mode === 'code') {
      setCodeDraft(generatedHTML)
      setCodeDirty(false)
    }
    setState((prev) => ({ ...prev, mode }))
  }

  useEffect(() => {
    if (!recoveredDraft) return
    onNameChange?.(recoveredDraft.name)
    onSubjectChange?.(recoveredDraft.subject)
  }, [onNameChange, onSubjectChange, recoveredDraft])

  useEffect(() => {
    if (!_id || typeof window === 'undefined') return
    const key = `gofox-email-builder-draft:${_id}`
    try {
      if (!state.unsaved) {
        window.localStorage.removeItem(key)
        return
      }
      const draft: LocalEditDraft = { ...latestEditRef.current, version: 1 }
      window.localStorage.setItem(key, JSON.stringify(draft))
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : 'The local recovery draft could not be stored.'
      )
    }
  }, [
    _id,
    codeDirty,
    codeDraft,
    name,
    plainTextDraft,
    plainTextEdited,
    state.document,
    state.mode,
    state.unsaved,
    subject,
  ])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F7FB] font-sans text-ink">
      {/* 1. TOP TOOLBAR */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-line bg-surface px-4 shadow-xs z-30">
        {/* Left: Back + Logo + Title */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink transition"
              title="Back to Email Templates"
            >
              <ArrowLeft size={15} />
            </button>
          )}

          <div className="flex shrink-0 items-center gap-2.5 px-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#142D4E] text-[#2CA6A4] shadow-sm text-[13px] font-bold">
              <Mail size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    onNameChange?.(e.target.value)
                    setState((prev) => ({ ...prev, unsaved: true }))
                  }}
                  placeholder="Template Name..."
                  className="rounded px-1.5 py-0.5 text-[13.5px] font-semibold text-[#142D4E] hover:bg-[#F7F9FC] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] max-w-[220px] truncate transition"
                />
                <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10.5px] font-medium text-[#2563EB] uppercase">
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
                {state.saving ? (
                  <span className="flex items-center gap-1 font-medium text-sky-600" role="status">
                    <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
                    Saving changes…
                  </span>
                ) : state.unsaved ? (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    All changes saved
                  </span>
                )}
              </div>
            </div>
            <label className="hidden min-w-0 items-center gap-2 border-l border-line pl-3 lg:flex">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Subject</span>
              <input
                aria-label="Email subject"
                type="text"
                value={subject}
                onChange={(event) => {
                  onSubjectChange?.(event.target.value)
                  setState((prev) => ({ ...prev, unsaved: true }))
                }}
                placeholder="Write an engaging subject"
                className="w-48 rounded px-1.5 py-1 text-[12px] text-ink hover:bg-surface-2 focus:bg-surface focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </label>
          </div>
        </div>

        {/* Center: Personalize Dropdown + Mode Switcher + Device Preview */}
        <div className="flex shrink-0 items-center gap-2.5 px-1">
          {/* Personalize Token Dropdown */}
          <div className="relative">
            <button
              onClick={() => setTokenMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
            >
              <Sparkles size={13} className="text-[#2563EB]" />
              <span>Personalize</span>
              <ChevronDown size={12} className="text-muted" />
            </button>

            {tokenMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">
                  Insert CRM Variable
                </div>
                <div className="divide-y divide-line/60">
                  {CRM_TOKENS.map((item) => (
                    <button
                      key={item.token}
                      onClick={() => handleInsertToken(item.token)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-blue-50/70 hover:text-[#2563EB] transition"
                    >
                      <span className="font-medium text-ink">{item.label}</span>
                      <code className="text-[10px] text-muted font-mono">{item.token}</code>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mode Switcher: Design | Code | Plain Text */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
            <button
              onClick={() => switchMode('design')}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'design'
                  ? 'bg-surface text-[#2563EB] shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <Palette size={13} />
              <span>Design</span>
            </button>
            <button
              onClick={() => switchMode('code')}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'code'
                  ? 'bg-surface text-[#2563EB] shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <Code2 size={13} />
              <span>HTML</span>
            </button>
            <button
              onClick={() => switchMode('plain')}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'plain'
                  ? 'bg-surface text-[#2563EB] shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <FileText size={13} />
              <span>Plain text</span>
            </button>
          </div>

          {/* Device Controls (Desktop: 640px / Tablet: 480px / Mobile: 375px) */}
          {state.mode === 'design' && (
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'desktop' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'desktop' ? 'bg-surface text-[#2563EB] shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Desktop View (640px)"
              >
                <Monitor size={14} />
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'tablet' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'tablet' ? 'bg-surface text-[#2563EB] shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Tablet View (480px)"
              >
                <Tablet size={14} />
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'mobile' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'mobile' ? 'bg-surface text-[#2563EB] shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Mobile View (375px)"
              >
                <Smartphone size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Right: History + Actions + Save + Publish */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={state.historyIndex <= 0}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={redo}
              disabled={state.historyIndex >= state.history.length - 1}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo size={14} />
            </button>
          </div>

          <div className="h-5 w-px bg-line mx-0.5" />

          {/* Preview Modal */}
          <button
            onClick={() => setPreviewOpen(true)}
            title="Preview this email"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
          >
            <Eye size={13} className="text-muted" />
            <span>Preview</span>
          </button>

          {/* Send Test */}
          <button
            onClick={() => setTestOpen(true)}
            disabled={!onSendTest}
            title={onSendTest ? 'Send a real test email' : 'Test email is unavailable'}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
          >
            <Send size={13} className="text-muted" />
            <span>Send test</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => void handleSave()}
            disabled={state.saving || !onSave}
            title="Save template (Ctrl+S)"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 disabled:opacity-50 transition"
          >
            <Save size={13} />
            <span>{state.saving ? 'Saving…' : 'Save'}</span>
          </button>

          {/* Publish / Ready for Campaign */}
          {onPublish && (
            <button
              onClick={() => void handlePublish()}
              disabled={state.saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50 transition"
            >
              <Rocket size={13} />
              <span>Publish</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition"
              title="Template Settings"
            >
              <Settings2 size={15} />
            </button>
          )}
        </div>
      </header>
      {operationError && (
        <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
          {operationError}
        </div>
      )}

      {/* 2. MODE: CODE / HTML VIEW */}
      {state.mode === 'code' && (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-slate-950 text-slate-100 xl:grid-cols-2">
          <section className="flex min-h-0 flex-col border-b border-slate-800 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
              <div>
                <h2 className="text-[13px] font-semibold">HTML source</h2>
                <p className="mt-0.5 text-[11px] text-slate-400">Edit markup with a sandboxed live preview.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCodeDraft(generatedHTML)
                    setCodeDirty(false)
                  }}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                >
                  Reset
                </button>
                <button
                  onClick={() => void navigator.clipboard.writeText(codeDraft || generatedHTML)}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                >
                  <Copy size={12} />
                  Copy HTML
                </button>
                <button
                  onClick={() => switchMode('design')}
                  className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                >
                  Apply to design
                </button>
              </div>
            </div>
            <textarea
              ref={codeEditorRef}
              aria-label="HTML source editor"
              spellCheck={false}
              value={codeDraft}
              onChange={(event) => {
                setCodeDraft(event.target.value)
                setCodeDirty(true)
                setState((prev) => ({ ...prev, unsaved: true }))
              }}
              className="min-h-[280px] flex-1 resize-none bg-slate-950 p-4 font-mono text-[12px] leading-6 text-slate-100 outline-none selection:bg-blue-500/30"
            />
          </section>
          <section className="flex min-h-[280px] min-w-0 flex-col bg-[#F3F5F9]">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">Live preview</h2>
                <p className="mt-0.5 text-[11px] text-muted">Updates as you edit the HTML.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">SANDBOXED</span>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <iframe
                title="Live HTML preview"
                srcDoc={sanitizeEmailHtml(codeDraft || generatedHTML)}
                sandbox=""
                className="h-full min-h-[240px] w-full rounded-lg border border-line bg-white shadow-sm"
              />
            </div>
          </section>
        </div>
      )}

      {/* 3. MODE: PLAIN TEXT VIEW */}
      {state.mode === 'plain' && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto bg-[#F3F5F9] p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">Plain-text message</h2>
                <p className="mt-1 text-[11px] text-muted">Write a focused message that works in every email client.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPlainTextDraft(generatedPlainText)
                    setPlainTextEdited(false)
                    setState((prev) => ({ ...prev, unsaved: true }))
                  }}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[11px] font-semibold text-ink hover:bg-surface-2"
                >
                  Reset from design
                </button>
                <button
                  onClick={() => void navigator.clipboard.writeText(livePlainText)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] font-semibold text-ink hover:bg-surface-2"
                >
                  <Copy size={13} />
                  Copy text
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/50 px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Insert</span>
              {CRM_TOKENS.slice(0, 4).map((token) => (
                <button
                  key={token.token}
                  onClick={() => handleInsertToken(token.token)}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-medium text-ink hover:border-[#2563EB] hover:text-[#2563EB]"
                >
                  {token.label}
                </button>
              ))}
            </div>
            <textarea
              ref={plainTextEditorRef}
              aria-label="Plain-text email editor"
              value={plainTextDraft}
              onChange={(event) => {
                setPlainTextDraft(event.target.value)
                setPlainTextEdited(true)
                setState((prev) => ({ ...prev, unsaved: true }))
              }}
              placeholder="Write your email message…"
              className="min-h-[250px] flex-1 resize-y bg-surface p-5 font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-muted"
            />
            <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[10px] text-muted">
              <span>{livePlainText.trim() ? livePlainText.trim().split(/\s+/).length : 0} words · {livePlainText.length} characters</span>
              <span>Personalization tokens are preserved when sent.</span>
            </div>
          </section>
          <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[14px] font-semibold text-ink">Live text preview</h2>
              <p className="mt-1 text-[11px] text-muted">A recipient-friendly preview of the message.</p>
            </div>
            <div className="flex-1 p-5">
              <div className="min-h-full whitespace-pre-wrap rounded-xl border border-line bg-[#FAFBFD] p-5 font-sans text-[13px] leading-6 text-slate-700">
                {livePlainText || <span className="text-muted">Your message preview will appear here.</span>}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 4. MODE: VISUAL DESIGN WORKSPACE (3-PANEL LAYOUT) */}
      {state.mode === 'design' && (
        <DragDropProvider
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {/* LEFT PANEL: CONTENT LIBRARY */}
            {!leftPanelCollapsed && (
              <aside className="z-20 flex h-full w-[min(310px,40vw)] shrink-0 flex-col border-r border-line bg-surface max-md:relative max-md:w-[min(220px,48vw)]">
                {/* CONTENT | COLUMNS | BLOCKS */}
                <div className="flex border-b border-line bg-surface-2/40">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      activeTab === 'content'
                        ? 'border-[#2563EB] text-[#2563EB] bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setActiveTab('columns')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      activeTab === 'columns'
                        ? 'border-[#2563EB] text-[#2563EB] bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    Columns
                  </button>
                  <button
                    onClick={() => setActiveTab('blocks')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      activeTab === 'blocks'
                        ? 'border-[#2563EB] text-[#2563EB] bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    Blocks
                  </button>
                  <button
                    onClick={() => setLeftPanelCollapsed(true)}
                    className="px-2.5 text-muted hover:text-ink"
                    title="Collapse sidebar"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* TAB 1: CONTENT LIBRARY */}
                {activeTab === 'content' && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {/* Search */}
                    <div className="p-3 border-b border-line">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search blocks…"
                          className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-[12px] placeholder:text-muted focus:border-[#2563EB] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Category Pills */}
                    <div className="flex gap-1 overflow-x-auto p-2 border-b border-line bg-surface-2/20">
                      {(['all', 'basic', 'marketing', 'advanced'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={cx(
                            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize whitespace-nowrap transition',
                            activeCategory === cat
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-surface text-muted border border-line hover:text-ink'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Draggable Block Cards Grid */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                        Click or drag into canvas
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {filteredBlocks.map((b) => (
                          <DraggableLibraryBlock
                            key={b.id}
                            block={b}
                            onAdd={() => handleAddBlock(b)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: COLUMNS / LAYOUT PRESETS */}
                {activeTab === 'columns' && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="text-[11.5px] font-bold text-ink mb-2">Column Layouts</div>
                    <p className="text-[11.5px] text-muted">
                      Select a column ratio to create a multi-column responsive section.
                    </p>

                    <div className="space-y-2.5 pt-2">
                      {LAYOUT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleAddSection(preset.columns)}
                          className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-[#2563EB] hover:shadow-xs transition group"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-ink group-hover:text-[#2563EB]">
                              {preset.label}
                            </span>
                            <span className="text-[10px] text-muted font-mono">
                              {preset.columns.map((c) => Math.round(c)).join(' / ')}%
                            </span>
                          </div>
                          {/* Schematic diagram of columns */}
                          <div className="flex h-7 w-full gap-1.5 rounded-lg bg-surface-2 p-1">
                            {preset.columns.map((w: number, idx: number) => (
                              <div
                                key={idx}
                                style={{ width: `${w}%` }}
                                className="h-full rounded bg-blue-500/20 group-hover:bg-blue-500/40 transition"
                              />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: SAVED / REUSABLE BLOCKS */}
                {activeTab === 'blocks' && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="text-[11.5px] font-bold text-ink">Saved Components</div>
                    <p className="text-[11.5px] text-muted">
                      Reusable templates and saved modules for multi-campaign consistency.
                    </p>

                    {savedBlocks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line p-6 text-center text-muted text-[12px]">
                        <Bookmark size={24} className="mx-auto mb-2 text-faint" />
                        <p className="font-medium text-ink">No saved components yet</p>
                        <p className="mt-1 text-[11px]">
                          Select any element on the canvas and click "Save as Component" to reuse it anytime.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedBlocks.map((b, idx) => (
                          <div
                            key={b.id || idx}
                            className="flex items-center justify-between rounded-xl border border-line bg-surface p-3"
                          >
                            <span className="text-[12px] font-semibold capitalize">{b.type} block</span>
                            <button
                              onClick={() => {
                                if (state.document.sections.length > 0) {
                                  const lastSec = state.document.sections[state.document.sections.length - 1]
                                  const newDoc = addBlockToColumn(
                                    state.document,
                                    lastSec.id,
                                    lastSec.columns[0].id,
                                    JSON.parse(JSON.stringify(b))
                                  )
                                  pushToHistory(newDoc)
                                }
                              }}
                              className="rounded bg-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-white"
                            >
                              Insert
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </aside>
            )}

            {/* EXPAND LEFT TOGGLE */}
            {leftPanelCollapsed && (
              <button
                onClick={() => setLeftPanelCollapsed(false)}
                className="absolute left-3 top-16 z-20 flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted shadow-sm hover:text-ink"
                title="Open Content Library"
              >
                <Layers size={15} />
              </button>
            )}

            {/* CENTER PANEL: EMAIL CANVAS WORKSPACE */}
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#EEF1F5] p-3 sm:p-6">
              <div
                className="mb-3 flex justify-end"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-1 rounded-lg border border-line bg-surface/95 p-0.5 shadow-sm">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    title="Zoom out"
                    disabled={canvasZoom <= 50}
                    onClick={() => setCanvasZoom((zoom) => Math.max(50, zoom - 10))}
                    className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Canvas zoom ${canvasZoom}%`}
                    title="Reset zoom"
                    onClick={() => setCanvasZoom(100)}
                    className="min-w-10 rounded-md px-1 py-1 text-[10px] font-semibold tabular-nums text-ink hover:bg-surface-2"
                  >
                    {canvasZoom}%
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    title="Zoom in"
                    disabled={canvasZoom >= 150}
                    onClick={() => setCanvasZoom((zoom) => Math.min(150, zoom + 10))}
                    className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>
              {/* Outer Centered Document Container */}
              <div
                ref={setCanvasRootRef}
                className={cx(
                  'mx-auto w-full transition-all duration-200 shadow-[0_2px_8px_rgba(20,45,78,0.06)] bg-white',
                  state.device === 'mobile'
                    ? 'max-w-[375px] rounded-[14px] border border-[#E5EAF1]'
                    : state.device === 'tablet'
                    ? 'max-w-[480px] rounded-[10px] border border-[#E5EAF1]'
                    : 'max-w-[640px] rounded-[8px] border border-[#E5EAF1]'
                )}
                style={{
                  backgroundColor: state.document.settings.contentBackground || '#FFFFFF',
                  minHeight: '480px',
                  zoom: canvasZoom / 100,
                }}
              >
                {/* Mobile Mockup Header Bar */}
                {state.device === 'mobile' && (
                  <div className="flex h-6 w-full items-center justify-between px-4 pb-2 border-b border-slate-200 text-[10px] text-slate-500 font-bold">
                    <span>9:41</span>
                    <div className="size-2 rounded-full bg-slate-400" />
                    <span>100%</span>
                  </div>
                )}

                {/* Empty Canvas Notice */}
                {state.document.sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                    <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-[#2563EB] mb-3">
                      <Layout size={28} />
                    </div>
                    <h3 className="text-[16px] font-bold text-ink">Your email canvas is empty</h3>
                    <p className="mt-1 max-w-xs text-[12px] text-muted">
                      Click below to add your first layout section or pick any content block from the left.
                    </p>
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => handleAddSection([100])}
                        className="rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#1D4ED8] transition"
                      >
                        + 1 Column Section
                      </button>
                      <button
                        onClick={() => handleAddSection([50, 50])}
                        className="rounded-xl border border-line bg-surface px-4 py-2 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
                      >
                        + 2 Column (50/50)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-line/40">
                    {state.document.sections.map((section, sIdx) => (
                      <CanvasSectionComponent
                        key={section.id}
                        section={section}
                        sectionIndex={sIdx}
                        selectedId={state.selectedId}
                        selectedType={state.selectedType}
                        onSelect={handleSelect}
                        onRemoveSection={handleRemoveSection}
                        onDuplicateSection={handleDuplicateSection}
                        onRemoveBlock={handleRemoveBlock}
                        onDuplicateBlock={handleDuplicateBlock}
                        onMoveBlockUpDown={handleMoveBlockUpDown}
                        onSaveAsReusableBlock={handleSaveAsReusableBlock}
                        onUpdateBlockContent={handleUpdateBlockContent}
                        onAddBlock={handleAddBlock}
                      />
                    ))}
                  </div>
                )}

                {/* Add Section Quick Button at bottom */}
                {state.document.sections.length > 0 && (
                  <div className="p-4 text-center border-t border-line/40 bg-surface-2/20">
                    <button
                      onClick={() => handleAddSection([100])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#2563EB]/40 bg-blue-50/50 px-3 py-1.5 text-[11.5px] font-semibold text-[#2563EB] hover:bg-blue-100/50 transition"
                    >
                      <Plus size={13} />
                      <span>Add Section Below</span>
                    </button>
                  </div>
                )}
              </div>
            </main>

            {/* EXPAND RIGHT TOGGLE */}
            {rightPanelCollapsed && (
              <button
                onClick={() => setRightPanelCollapsed(false)}
                className="absolute right-3 top-16 z-20 flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted shadow-sm hover:text-ink"
                title="Open Properties Panel"
              >
                <Settings2 size={15} />
              </button>
            )}

            {/* RIGHT PANEL: CONTEXTUAL PROPERTIES & STYLING */}
            {!rightPanelCollapsed && (
              <aside className="z-20 flex h-full w-[min(320px,40vw)] shrink-0 flex-col border-l border-[#E5EAF1] bg-white max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-[min(320px,85vw)] max-md:shadow-xl">
                {/* 5 Tabs: CONTENT | STYLE | LAYOUT | RESPONSIVE | ADVANCED */}
                <div className="flex border-b border-[#E5EAF1] bg-[#F7F9FC]">
                  {(['content', 'style', 'layout', 'responsive', 'advanced'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setPropertiesTab(tab)}
                      className={cx(
                        'flex-1 py-2.5 text-center text-[10px] font-bold tracking-wider uppercase transition border-b-2',
                        propertiesTab === tab
                          ? 'border-[#2563EB] text-[#2563EB] bg-white'
                          : 'border-transparent text-[#718096] hover:text-[#172B4D]'
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    onClick={() => setRightPanelCollapsed(true)}
                    className="px-2 text-[#718096] hover:text-[#172B4D]"
                    title="Collapse properties"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Sticky Header: Selected Block info */}
                {selectedBlock && (
                  <div className="flex items-center justify-between border-b border-[#E5EAF1] bg-white px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded bg-blue-50 text-[#2563EB] text-[11px] font-bold">
                        {selectedBlock.type.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-[#142D4E] capitalize">
                          {selectedBlock.type} Block
                        </div>
                        <div className="text-[10px] text-[#718096]">ID: {selectedBlock.id.slice(0, 8)}</div>
                      </div>
                    </div>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-[#2563EB] uppercase">
                      Active
                    </span>
                  </div>
                )}

                {/* PROPERTIES BODY */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {!selectedBlock ? (
                    <div className="py-12 text-center text-muted">
                      <Settings2 size={28} className="mx-auto mb-2 text-faint" />
                      <p className="text-[12px] font-semibold text-ink">No element selected</p>
                      <p className="mt-1 text-[11px] text-muted max-w-[200px] mx-auto">
                        Click on any block or section in the canvas to configure its content and styles.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* TAB 1: CONTENT SETTINGS */}
                      {propertiesTab === 'content' && (
                        <div className="space-y-3.5">
                          <div>
                            <span className="text-[11px] font-bold text-muted uppercase">Selected Block</span>
                            <div className="mt-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-semibold capitalize text-ink">
                              {selectedBlock.type}
                            </div>
                          </div>

                          {/* Heading text & level */}
                          {selectedBlock.type === 'heading' && (
                            <>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Heading Text</label>
                                <textarea
                                  value={selectedBlock.content.text || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { text: e.target.value })
                                  }
                                  rows={2}
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12.5px] focus:border-[#2563EB] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Heading Level</label>
                                <select
                                  value={selectedBlock.content.level || 1}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { level: Number(e.target.value) })
                                  }
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12px]"
                                >
                                  <option value={1}>H1 (Large Headline)</option>
                                  <option value={2}>H2 (Section Header)</option>
                                  <option value={3}>H3 (Subheader)</option>
                                </select>
                              </div>
                            </>
                          )}

                          {/* Text block */}
                          {selectedBlock.type === 'text' && (
                            <div>
                              <label className="block text-[11.5px] font-semibold text-ink mb-1">Paragraph Text</label>
                              <textarea
                                value={selectedBlock.content.text || ''}
                                onChange={(e) =>
                                  handleUpdateBlockContent(selectedBlock.id, { text: e.target.value })
                                }
                                rows={4}
                                className="w-full rounded-lg border border-line bg-surface p-2 text-[12.5px] focus:border-[#2563EB] focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Button block */}
                          {selectedBlock.type === 'button' && (
                            <>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Button Text</label>
                                <input
                                  type="text"
                                  value={selectedBlock.content.text || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { text: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Link Destination URL</label>
                                <input
                                  type="url"
                                  value={selectedBlock.content.url || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { url: e.target.value })
                                  }
                                  placeholder="https://example.com"
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12px]"
                                />
                              </div>
                            </>
                          )}

                          {/* Image block */}
                          {selectedBlock.type === 'image' && (
                            <>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Image URL</label>
                                <input
                                  type="text"
                                  value={selectedBlock.content.src || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { src: e.target.value })
                                  }
                                  placeholder="https://..."
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11.5px] font-semibold text-ink mb-1">Alt Text</label>
                                <input
                                  type="text"
                                  value={selectedBlock.content.alt || ''}
                                  onChange={(e) =>
                                    handleUpdateBlockContent(selectedBlock.id, { alt: e.target.value })
                                  }
                                  placeholder="Description for accessibility"
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12px]"
                                />
                              </div>
                            </>
                          )}

                          {selectedBlock.type === 'custom-html' && (
                            <div>
                              <label className="mb-1 block text-[11.5px] font-semibold text-ink">
                                Email-safe HTML
                              </label>
                              <textarea
                                value={selectedBlock.content.html || ''}
                                onChange={(event) =>
                                  handleUpdateBlockContent(selectedBlock.id, { html: event.target.value })
                                }
                                rows={12}
                                spellCheck={false}
                                className="w-full rounded-lg border border-line bg-surface p-2 font-mono text-[11px] focus:border-[#2563EB] focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Divider */}
                          {selectedBlock.type === 'divider' && (
                            <div>
                              <label className="block text-[11.5px] font-semibold text-ink mb-1">Thickness (px)</label>
                              <input
                                type="range"
                                min={1}
                                max={8}
                                value={selectedBlock.content.thickness || 1}
                                onChange={(e) =>
                                  handleUpdateBlockContent(selectedBlock.id, { thickness: Number(e.target.value) })
                                }
                                className="w-full"
                              />
                            </div>
                          )}

                          {/* Spacer */}
                          {selectedBlock.type === 'spacer' && (
                            <div>
                              <label className="block text-[11.5px] font-semibold text-ink mb-1">
                                Height: {selectedBlock.content.height || 28}px
                              </label>
                              <input
                                type="range"
                                min={8}
                                max={96}
                                value={selectedBlock.content.height || 28}
                                onChange={(e) =>
                                  handleUpdateBlockContent(selectedBlock.id, { height: Number(e.target.value) })
                                }
                                className="w-full"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: STYLES CONTROLS */}
                      {propertiesTab === 'style' && (
                        <div className="space-y-4">
                          {/* Typography */}
                          <div>
                            <div className="text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">Typography</div>
                            <div className="space-y-2.5">
                              <div>
                                <label className="block text-[11.5px] text-[#718096] mb-1">Font Family</label>
                                <select
                                  value={selectedBlock.styles?.fontFamily || 'Inter, sans-serif'}
                                  onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { fontFamily: e.target.value })}
                                  className="w-full rounded-[6px] border border-[#E5EAF1] bg-white p-1.5 text-[12px] text-[#172B4D]"
                                >
                                  <option value="Inter, sans-serif">Inter (Modern Sans)</option>
                                  <option value="Arial, Helvetica, sans-serif">Arial / Helvetica</option>
                                  <option value="Georgia, serif">Georgia (Editorial Serif)</option>
                                  <option value="'JetBrains Mono', monospace">JetBrains Mono (Code)</option>
                                  <option value="'Times New Roman', serif">Times New Roman</option>
                                </select>
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[11.5px] text-[#718096] mb-1">
                                  <span>Font Size</span>
                                  <span className="font-semibold text-[#142D4E]">{selectedBlock.styles?.fontSize || 14}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={11}
                                  max={48}
                                  value={selectedBlock.styles?.fontSize || 14}
                                  onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { fontSize: Number(e.target.value) })}
                                  className="w-full accent-[#2563EB]"
                                />
                              </div>

                              <div>
                                <label className="block text-[11.5px] text-[#718096] mb-1">Alignment</label>
                                <div className="flex rounded-[6px] border border-[#E5EAF1] bg-[#F7F9FC] p-0.5">
                                  {(['left', 'center', 'right'] as const).map((align) => (
                                    <button
                                      key={align}
                                      onClick={() => handleUpdateBlockStyles(selectedBlock.id, { textAlign: align })}
                                      className={cx(
                                        'flex-1 py-1 rounded-[4px] text-center capitalize text-[11px] font-semibold transition',
                                        (selectedBlock.styles?.textAlign || 'left') === align
                                          ? 'bg-white text-[#2563EB] shadow-xs'
                                          : 'text-[#718096] hover:text-[#172B4D]'
                                      )}
                                    >
                                      {align}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Colors */}
                          <div className="border-t border-[#E5EAF1] pt-3">
                            <div className="text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">Colors</div>
                            <div className="space-y-2.5">
                              <div>
                                <label className="block text-[11.5px] text-[#718096] mb-1">Text Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={selectedBlock.styles?.color || '#172B4D'}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { color: e.target.value })}
                                    className="size-7 rounded-[4px] border border-[#E5EAF1] cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={selectedBlock.styles?.color || '#172B4D'}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { color: e.target.value })}
                                    className="flex-1 rounded-[6px] border border-[#E5EAF1] bg-white p-1.5 text-[11.5px] font-mono text-[#172B4D]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11.5px] text-[#718096] mb-1">Background Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={selectedBlock.styles?.backgroundColor || '#FFFFFF'}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })}
                                    className="size-7 rounded-[4px] border border-[#E5EAF1] cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={selectedBlock.styles?.backgroundColor || '#FFFFFF'}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })}
                                    className="flex-1 rounded-[6px] border border-[#E5EAF1] bg-white p-1.5 text-[11.5px] font-mono text-[#172B4D]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Borders & Corners */}
                          <div className="border-t border-[#E5EAF1] pt-3">
                            <div className="text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">Borders & Corners</div>
                            <div className="space-y-2.5">
                              <div>
                                <div className="flex items-center justify-between text-[11.5px] text-[#718096] mb-1">
                                  <span>Border Radius</span>
                                  <span className="font-semibold text-[#142D4E]">{selectedBlock.styles?.borderRadius ?? 6}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={32}
                                  value={selectedBlock.styles?.borderRadius ?? 6}
                                  onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { borderRadius: Number(e.target.value) })}
                                  className="w-full accent-[#2563EB]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: LAYOUT CONTROLS */}
                      {propertiesTab === 'layout' && (
                        <div className="space-y-4">
                          {/* Linked Padding Box */}
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">
                              <span>Padding (px)</span>
                              <button
                                type="button"
                                onClick={() => setPaddingLinked((v) => !v)}
                                className={cx('text-[11px] font-medium transition', paddingLinked ? 'text-[#2563EB]' : 'text-[#718096]')}
                              >
                                {paddingLinked ? 'Linked' : 'Separate'}
                              </button>
                            </div>
                            {paddingLinked ? (
                              <input
                                type="number"
                                min={0}
                                max={80}
                                value={selectedBlock.styles?.padding ?? 12}
                                onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { padding: Number(e.target.value), paddingTop: undefined, paddingRight: undefined, paddingBottom: undefined, paddingLeft: undefined })}
                                className="w-full rounded-[6px] border border-[#E5EAF1] bg-white p-1.5 text-[12px] text-[#172B4D]"
                              />
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-[#718096]">Top</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.paddingTop ?? selectedBlock.styles?.padding ?? 12}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { paddingTop: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Right</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.paddingRight ?? selectedBlock.styles?.padding ?? 12}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { paddingRight: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Bottom</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.paddingBottom ?? selectedBlock.styles?.padding ?? 12}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { paddingBottom: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Left</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.paddingLeft ?? selectedBlock.styles?.padding ?? 12}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { paddingLeft: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Linked Margin Box */}
                          <div className="border-t border-[#E5EAF1] pt-3">
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">
                              <span>Margin (px)</span>
                              <button
                                type="button"
                                onClick={() => setMarginLinked((v) => !v)}
                                className={cx('text-[11px] font-medium transition', marginLinked ? 'text-[#2563EB]' : 'text-[#718096]')}
                              >
                                {marginLinked ? 'Linked' : 'Separate'}
                              </button>
                            </div>
                            {marginLinked ? (
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={selectedBlock.styles?.margin ?? 4}
                                onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { margin: Number(e.target.value), marginTop: undefined, marginRight: undefined, marginBottom: undefined, marginLeft: undefined })}
                                className="w-full rounded-[6px] border border-[#E5EAF1] bg-white p-1.5 text-[12px] text-[#172B4D]"
                              />
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-[#718096]">Top</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.marginTop ?? selectedBlock.styles?.margin ?? 4}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { marginTop: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Right</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.marginRight ?? selectedBlock.styles?.margin ?? 4}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { marginRight: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Bottom</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.marginBottom ?? selectedBlock.styles?.margin ?? 4}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { marginBottom: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[#718096]">Left</span>
                                  <input
                                    type="number"
                                    value={selectedBlock.styles?.marginLeft ?? selectedBlock.styles?.margin ?? 4}
                                    onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { marginLeft: Number(e.target.value) })}
                                    className="w-full rounded border border-[#E5EAF1] p-1 text-[11px]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 4: RESPONSIVE CONTROLS */}
                      {propertiesTab === 'responsive' && (
                        <div className="space-y-4">
                          <div className="text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">Device Visibility</div>
                          <div className="space-y-3">
                            <label className="flex items-center justify-between rounded-[8px] border border-[#E5EAF1] bg-[#F7F9FC] p-3 cursor-pointer">
                              <div className="flex items-center gap-2.5">
                                <Smartphone size={16} className="text-[#718096]" />
                                <div>
                                  <div className="text-[12px] font-semibold text-[#142D4E]">Hide on Mobile</div>
                                  <div className="text-[10.5px] text-[#718096]">Hides this block on viewports &lt; 480px</div>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBlock.styles?.hideOnMobile)}
                                onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { hideOnMobile: e.target.checked })}
                                className="size-4 rounded text-[#2563EB] focus:ring-[#2563EB]"
                              />
                            </label>

                            <label className="flex items-center justify-between rounded-[8px] border border-[#E5EAF1] bg-[#F7F9FC] p-3 cursor-pointer">
                              <div className="flex items-center gap-2.5">
                                <Monitor size={16} className="text-[#718096]" />
                                <div>
                                  <div className="text-[12px] font-semibold text-[#142D4E]">Hide on Desktop</div>
                                  <div className="text-[10.5px] text-[#718096]">Hides this block on viewports ≥ 480px</div>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBlock.styles?.hideOnDesktop)}
                                onChange={(e) => handleUpdateBlockStyles(selectedBlock.id, { hideOnDesktop: e.target.checked })}
                                className="size-4 rounded text-[#2563EB] focus:ring-[#2563EB]"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* TAB 5: ADVANCED CONTROLS */}
                      {propertiesTab === 'advanced' && (
                        <div className="space-y-4">
                          <div className="text-[11px] font-bold text-[#718096] uppercase tracking-wider mb-2">Metadata & Attributes</div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11.5px] text-[#718096] mb-1">Block ID (for jump links)</label>
                              <input
                                type="text"
                                value={selectedBlock.id}
                                readOnly
                                className="w-full rounded-[6px] border border-[#E5EAF1] bg-[#F7F9FC] p-1.5 font-mono text-[11px] text-[#718096]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateBlockStyles(selectedBlock.id, {
                                padding: 12,
                                margin: 4,
                                textAlign: 'left',
                                borderRadius: 6,
                                fontSize: 14,
                                color: '#172B4D',
                                backgroundColor: '#FFFFFF',
                              })}
                              className="w-full rounded-[6px] border border-[#E5EAF1] bg-white py-1.5 text-[11.5px] font-medium text-rose-600 hover:bg-rose-50 transition"
                            >
                              Reset Styles to Default
                            </button>
                          </div>
                        </div>
                      )}

                    </>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Dnd-kit Drag Overlay for smooth preview */}
          <DragOverlay>
            {activeId && dragItem?.type === 'library' && (
              <div className="rounded-xl border border-[#2563EB] bg-white p-3 shadow-2xl flex items-center gap-2 text-ink text-[12px] font-bold">
                <GripVertical size={14} className="text-[#2563EB]" />
                <span className="capitalize">{dragItem.blockType} Block</span>
              </div>
            )}
            {dragItem?.type === 'canvas' && dragItem.blockId && (
              <div className="rounded-lg border border-[#2563EB] bg-white px-4 py-3 text-[12px] font-semibold capitalize text-ink shadow-2xl">
                Moving {findBlock(state.document, dragItem.blockId)?.type ?? 'block'}
              </div>
            )}
          </DragOverlay>
        </DragDropProvider>
      )}

      {/* 5. FULL PREVIEW MODAL */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={state.mode === 'plain' ? 'Plain text preview' : 'Full Email Preview'}
        wide
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] text-muted">
              {state.mode === 'plain' ? 'Previewing the plain-text message' : 'Previewing live responsive email HTML'}
            </span>
            <Button size="sm" onClick={() => setPreviewOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {state.mode === 'plain' ? (
            <pre className="min-h-[320px] whitespace-pre-wrap rounded-xl border border-line bg-white p-6 font-sans text-[13px] leading-6 text-ink shadow-inner">
              {livePlainText || 'Your plain-text message is empty.'}
            </pre>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-inner">
              <iframe
                title="Email Preview"
                srcDoc={sanitizeEmailHtml(liveHTML)}
                className="h-[520px] w-full border-0"
                sandbox=""
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 6. SEND TEST EMAIL MODAL */}
      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Send Test Email"
        footer={
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSendTest}
              loading={sendingTest}
              disabled={!canSendTest || !onSendTest}
            >
              Send Test Email
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">
            Send a live test dispatch of this email design through your connected email account.
          </p>
          <div>
            <label className="block text-[12px] font-semibold text-ink mb-1">Recipient Address</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-line bg-surface p-2.5 text-[12.5px] focus:border-[#2563EB] focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Canvas Section Component (dnd-kit Sortable)
   -------------------------------------------------------------------------- */
function CanvasSectionComponent({
  section,
  sectionIndex,
  selectedId,
  selectedType,
  onSelect,
  onRemoveSection,
  onDuplicateSection,
  onRemoveBlock,
  onDuplicateBlock,
  onMoveBlockUpDown,
  onSaveAsReusableBlock,
  onUpdateBlockContent,
  onAddBlock,
}: {
  section: Section
  sectionIndex: number
  selectedId: string | null
  selectedType: 'section' | 'column' | 'block' | null
  onSelect: (id: string, type: 'section' | 'column' | 'block') => void
  onRemoveSection: (id: string) => void
  onDuplicateSection: (id: string) => void
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onMoveBlockUpDown: (id: string, direction: 'up' | 'down') => void
  onSaveAsReusableBlock: (id: string) => void
  onUpdateBlockContent: (id: string, content: Partial<Block['content']>) => void
  onAddBlock: (libraryBlock: LibraryBlock, sectionId?: string, columnId?: string) => void
}) {
  const { ref: setNodeRef, handleRef, isDragging, isDropTarget } = useSortable({
    id: section.id,
    index: sectionIndex,
    group: 'email-sections',
    type: 'email-section',
    accept: ['email-section', 'email-library-block', 'email-canvas-block'],
    data: {
      type: 'canvas' as const,
      sectionId: section.id,
      sectionIndex,
    },
  })

  const isSelected = selectedId === section.id && selectedType === 'section'

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative group/sec transition-all',
        isSelected ? 'ring-2 ring-[#2563EB] bg-blue-50/20' : isDropTarget ? 'ring-2 ring-[#2563EB]' : 'hover:ring-1 hover:ring-[#2563EB]/40',
        isDragging && 'opacity-40'
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(section.id, 'section')
      }}
      style={{
        backgroundColor: section.styles?.backgroundColor || 'transparent',
        padding: `${section.styles?.padding || 16}px`,
      }}
    >
      {/* Floating Section Toolbar on hover */}
      <div className="absolute right-2 top-2 hidden group-hover/sec:flex items-center gap-1 rounded-lg bg-surface border border-line shadow-md px-1.5 py-0.5 z-10 text-[11px]">
        <button
          ref={handleRef}
          type="button"
          aria-label={`Move section ${sectionIndex + 1}`}
          onClick={(event) => event.stopPropagation()}
          className="cursor-grab text-muted hover:text-ink p-1"
        >
          <GripVertical size={13} />
        </button>
        <button
          type="button"
          aria-label="Duplicate Section"
          title="Duplicate Section"
          onClick={(event) => {
            event.stopPropagation()
            onDuplicateSection(section.id)
          }}
          className="text-muted hover:text-ink p-1"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemoveSection(section.id)
          }}
          className="text-muted hover:text-rose-600 p-1"
          title="Delete Section"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Columns Container */}
      <div className="flex w-full gap-3">
        {section.columns.map((col) => (
          <CanvasColumnComponent
            key={col.id}
            column={col}
            sectionId={section.id}
            selectedId={selectedId}
            selectedType={selectedType}
            onSelect={onSelect}
            onRemoveBlock={onRemoveBlock}
            onDuplicateBlock={onDuplicateBlock}
            onMoveBlockUpDown={onMoveBlockUpDown}
            onSaveAsReusableBlock={onSaveAsReusableBlock}
            onUpdateBlockContent={onUpdateBlockContent}
            onAddBlock={onAddBlock}
          />
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Canvas Column Component
   -------------------------------------------------------------------------- */
function CanvasColumnComponent({
  column,
  sectionId,
  selectedId,
  selectedType,
  onSelect,
  onRemoveBlock,
  onDuplicateBlock,
  onMoveBlockUpDown,
  onSaveAsReusableBlock,
  onUpdateBlockContent,
  onAddBlock,
}: {
  column: Column
  sectionId: string
  selectedId: string | null
  selectedType: 'section' | 'column' | 'block' | null
  onSelect: (id: string, type: 'section' | 'column' | 'block') => void
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onMoveBlockUpDown: (id: string, direction: 'up' | 'down') => void
  onSaveAsReusableBlock: (id: string) => void
  onUpdateBlockContent: (id: string, content: Partial<Block['content']>) => void
  onAddBlock: (libraryBlock: LibraryBlock, sectionId?: string, columnId?: string) => void
}) {
  const { ref: setNodeRef, isDropTarget } = useDroppable({
    id: `email-column-${column.id}`,
    type: 'email-column',
    accept: ['email-library-block', 'email-canvas-block'],
    collisionPriority: 20,
    data: {
      type: 'canvas' as const,
      sectionId,
      columnId: column.id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ width: `${column.width}%` }}
      className={cx('min-h-[64px] rounded-lg transition', isDropTarget && 'bg-blue-50/50 ring-2 ring-inset ring-[#2563EB]')}
    >
      {column.blocks.length === 0 ? (
        <div
          onClick={(e) => {
            e.stopPropagation()
            // Click adds heading by default
            const headingBlock = LIBRARY_BLOCKS.find((b) => b.type === 'heading')
            if (headingBlock) onAddBlock(headingBlock, sectionId, column.id)
          }}
          className="flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed border-line/80 text-[11.5px] font-medium text-muted hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-blue-50/40 cursor-pointer transition"
        >
          + Add block here
        </div>
      ) : (
        <div className="space-y-1">
          {column.blocks.map((block, index) => (
            <CanvasBlockComponent
              key={block.id}
              block={block}
              index={index}
              sectionId={sectionId}
              columnId={column.id}
              selectedId={selectedId}
              selectedType={selectedType}
              onSelect={onSelect}
              onRemoveBlock={onRemoveBlock}
              onDuplicateBlock={onDuplicateBlock}
              onMoveBlockUpDown={onMoveBlockUpDown}
              onSaveAsReusableBlock={onSaveAsReusableBlock}
              onUpdateBlockContent={onUpdateBlockContent}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Canvas Block Component (dnd-kit Sortable + Inline Editing)
   -------------------------------------------------------------------------- */
function CanvasBlockComponent({
  block,
  index,
  sectionId,
  columnId,
  selectedId,
  selectedType,
  onSelect,
  onRemoveBlock,
  onDuplicateBlock,
  onMoveBlockUpDown,
  onSaveAsReusableBlock,
  onUpdateBlockContent,
}: {
  block: Block
  index: number
  sectionId: string
  columnId: string
  selectedId: string | null
  selectedType: 'section' | 'column' | 'block' | null
  onSelect: (id: string, type: 'section' | 'column' | 'block') => void
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onMoveBlockUpDown: (id: string, direction: 'up' | 'down') => void
  onSaveAsReusableBlock: (id: string) => void
  onUpdateBlockContent: (id: string, content: Partial<Block['content']>) => void
}) {
  const { ref: setNodeRef, handleRef, isDragging, isDropTarget } = useSortable({
    id: block.id,
    index,
    group: columnId,
    type: 'email-canvas-block',
    accept: ['email-canvas-block', 'email-library-block'],
    collisionPriority: 30,
    data: {
      type: 'canvas' as const,
      blockId: block.id,
      sectionId,
      columnId,
      index,
    },
  })

  const isSelected = selectedId === block.id && selectedType === 'block'

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative group/block rounded-[6px] transition-all',
        isSelected
          ? 'ring-2 ring-[#2563EB] bg-blue-50/20'
          : isDropTarget
            ? 'ring-2 ring-[#2563EB]'
            : 'hover:ring-1 hover:ring-[#2563EB]/60',
        isDragging && 'opacity-40'
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(block.id, 'block')
      }}
      style={{
        padding: `${block.styles?.padding ?? 8}px`,
        margin: `${block.styles?.margin ?? 4}px`,
      }}
    >
      {/* Floating Action Pill above selected block */}
      {isSelected && (
        <>
          {/* 4 Corner Selection Handles */}
          <span className="pointer-events-none absolute -top-1 -left-1 size-2 rounded-[2px] border border-[#2563EB] bg-white z-20" />
          <span className="pointer-events-none absolute -top-1 -right-1 size-2 rounded-[2px] border border-[#2563EB] bg-white z-20" />
          <span className="pointer-events-none absolute -bottom-1 -left-1 size-2 rounded-[2px] border border-[#2563EB] bg-white z-20" />
          <span className="pointer-events-none absolute -bottom-1 -right-1 size-2 rounded-[2px] border border-[#2563EB] bg-white z-20" />

          {/* Floating White Pill Action Toolbar */}
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[#E5EAF1] bg-white text-[#172B4D] shadow-[0_12px_24px_-4px_rgba(20,45,78,0.12)] px-2.5 py-1 z-30 animate-in fade-in zoom-in-95 text-[11px]">
            <button
              ref={handleRef}
              type="button"
              aria-label={`Move ${block.type} block`}
              onClick={(event) => event.stopPropagation()}
              className="cursor-grab text-[#718096] hover:text-[#172B4D] p-1"
            >
              <GripVertical size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveBlockUpDown(block.id, 'up')
              }}
              className="text-[#718096] hover:text-[#2563EB] p-1"
              title="Move Up"
            >
              <MoveUp size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveBlockUpDown(block.id, 'down')
              }}
              className="text-[#718096] hover:text-[#2563EB] p-1"
              title="Move Down"
            >
              <MoveDown size={12} />
            </button>
            <div className="h-3 w-px bg-[#E5EAF1]" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDuplicateBlock(block.id)
              }}
              className="text-[#718096] hover:text-[#2563EB] p-1"
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSaveAsReusableBlock(block.id)
              }}
              className="text-[#718096] hover:text-[#2563EB] p-1"
              title="Save as Component"
            >
              <Bookmark size={12} />
            </button>
            <div className="h-3 w-px bg-[#E5EAF1]" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveBlock(block.id)
              }}
              className="text-[#718096] hover:text-rose-600 p-1"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </>
      )}

      {/* In-Canvas Block Content Rendering */}
      <RenderCanvasBlock block={block} onUpdateContent={onUpdateBlockContent} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Render Individual Block Content with Direct In-line Editing
   -------------------------------------------------------------------------- */
function RenderCanvasBlock({
  block,
  onUpdateContent,
}: {
  block: Block
  onUpdateContent: (id: string, content: Partial<Block['content']>) => void
}) {
  const { type, content, styles } = block

  const inlineStyles: React.CSSProperties = {
    color: styles?.color || 'inherit',
    backgroundColor: styles?.backgroundColor || 'transparent',
    fontSize: styles?.fontSize ? `${styles.fontSize}px` : undefined,
    fontFamily: styles?.fontFamily || 'inherit',
    fontWeight: styles?.fontWeight || 'normal',
    textAlign: styles?.textAlign || 'left',
    lineHeight: styles?.lineHeight || 1.5,
    borderRadius: styles?.borderRadius ? `${styles.borderRadius}px` : undefined,
  }

  switch (type) {
    case 'heading': {
      const level = content.level || 1
      const sizeClass = level === 1 ? 'text-[24px] font-bold' : level === 2 ? 'text-[20px] font-bold' : 'text-[16px] font-bold'
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdateContent(block.id, { text: e.currentTarget.textContent || '' })}
          style={inlineStyles}
          className={cx('outline-none focus:ring-1 focus:ring-[#2563EB] rounded px-1', sizeClass)}
        >
          {content.text || 'Headline'}
        </div>
      )
    }

    case 'text':
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdateContent(block.id, { text: e.currentTarget.textContent || '' })}
          style={inlineStyles}
          className="outline-none focus:ring-1 focus:ring-[#2563EB] rounded px-1 text-[14px] leading-relaxed text-slate-700"
        >
          {content.text || 'Write your email body copy here…'}
        </div>
      )

    case 'button':
      return (
        <div style={{ textAlign: styles?.textAlign || 'left' }}>
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onUpdateContent(block.id, { text: e.currentTarget.textContent || '' })}
            style={{
              backgroundColor: styles?.backgroundColor || '#FF6B00',
              color: styles?.color || '#FFFFFF',
              borderRadius: `${styles?.borderRadius ?? 8}px`,
              padding: '10px 22px',
              display: 'inline-block',
              fontWeight: 700,
              fontSize: `${styles?.fontSize ?? 13}px`,
            }}
            className="outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm"
          >
            {content.text || 'Call to Action →'}
          </span>
        </div>
      )

    case 'image':
      return (
        <div style={{ textAlign: styles?.textAlign || 'center' }}>
          <img
            src={content.src || 'https://via.placeholder.com/600x300?text=Your+Image'}
            alt={content.alt || 'Email Image'}
            className="max-w-full h-auto rounded-lg mx-auto"
            style={{ borderRadius: `${styles?.borderRadius ?? 8}px` }}
          />
        </div>
      )

    case 'divider':
      return (
        <div
          style={{
            borderTop: `${content.thickness || 1}px solid ${styles?.borderColor || '#E7ECF3'}`,
            margin: '12px 0',
          }}
        />
      )

    case 'spacer':
      return <div style={{ height: `${content.height || 24}px` }} />

    case 'social':
      return (
        <div style={{ textAlign: styles?.textAlign || 'center' }} className="flex justify-center gap-3 py-2 text-[12px] font-semibold text-[#2563EB]">
          <span>Facebook</span> · <span>Instagram</span> · <span>LinkedIn</span> · <span>X</span>
        </div>
      )

    case 'hero':
      return (
        <div
          style={{
            backgroundColor: styles?.backgroundColor || '#1E293B',
            color: '#FFFFFF',
            borderRadius: '12px',
            padding: '28px 20px',
            textAlign: 'center',
          }}
        >
          <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider mb-1">
            {content.text || 'PRODUCT ANNOUNCEMENT'}
          </div>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onUpdateContent(block.id, { caption: e.currentTarget.textContent || '' })}
            className="text-[24px] font-extrabold text-white mb-2 outline-none"
          >
            {content.caption || 'Introducing GoFox CRM v2.0'}
          </div>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onUpdateContent(block.id, { placeholder: e.currentTarget.textContent || '' })}
            className="text-[13px] text-slate-300 max-w-sm mx-auto mb-4 outline-none"
          >
            {content.placeholder || 'Automate deals, deliver real-time email campaigns, and scale faster.'}
          </div>
          <button className="rounded-lg bg-[#2563EB] px-5 py-2 font-bold text-white shadow-md text-[13px]">
            {content.buttonText || 'Get Started Now'}
          </button>
        </div>
      )

    case 'coupon':
      return (
        <div className="rounded-xl border-2 border-dashed border-[#2563EB] bg-blue-50/50 p-4 text-center">
          <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider">SPECIAL DISCOUNT CODE</div>
          <div className="my-1.5 font-mono text-[22px] font-black text-[#1D4ED8] tracking-widest">
            {content.code || 'GOFOX2026'}
          </div>
          <div className="text-[11px] text-muted">{content.placeholder || 'Add offer details in the content settings.'}</div>
        </div>
      )

    case 'testimonial':
      return (
        <div className="rounded-xl border border-line bg-surface-2/40 p-4 italic text-[13.5px] text-slate-700">
          "{content.text || 'GoFox completely streamlined our sales pipeline in less than a week.'}"
          <div className="mt-2 font-sans not-italic text-[12px] font-bold text-ink">
            {content.author || 'Sarah Jenkins'} — <span className="text-muted font-normal">{content.role || 'VP Sales, Northwind'}</span>
          </div>
        </div>
      )

    case 'footer':
      return (
        <div className="py-4 text-center text-[11px] text-muted">
          <div>{content.text || 'Company name and mailing address'}</div>
          <div className="mt-1">
            <span className="text-[#2563EB] underline">{content.placeholder || 'Unsubscribe'}</span>
          </div>
        </div>
      )

    case 'pricing':
      return (
        <div
          className="rounded-xl border-2 border-[#2563EB] bg-white p-5 text-center"
          style={{ borderColor: styles?.borderColor || '#FF6B00', borderWidth: styles?.borderWidth || 2 }}
        >
          <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider mb-2">
            {content.text || 'PRO PLAN'}
          </div>
          <div className="text-[32px] font-extrabold text-slate-800 mb-1">
            {content.price || '$49'}
            <span className="text-[14px] font-normal text-slate-500">{content.period || '/mo'}</span>
          </div>
          <div className="text-[12px] text-slate-500 mb-4">{content.placeholder || 'Unlimited workflows & AI'}</div>
          <button className="rounded-lg bg-[#2563EB] px-5 py-2 font-bold text-white shadow-md text-[13px]">
            {content.buttonText || 'Get Started'}
          </button>
        </div>
      )

    case 'features':
      return (
        <div className="rounded-xl bg-slate-50 p-4">
          {(content.features || ['Feature 1', 'Feature 2']).map((f: string, i: number) => (
            <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
              <span className="text-[#2563EB] mt-0.5">✓</span>
              <span className="text-[13px] text-slate-700">{f}</span>
            </div>
          ))}
        </div>
      )

    case 'metrics':
      return (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-center justify-around">
            {(content.items || [{ text: '+100%', label: 'Growth' }]).map((item: any, i: number) => (
              <div key={i} className="text-center">
                <div className="text-[20px] font-extrabold text-[#2563EB]">{item.text || '0'}</div>
                <div className="text-[10px] text-slate-500">{item.label || 'Metric'}</div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'product':
      return (
        <div className="rounded-xl border border-slate-200 p-4 flex gap-3">
          <div className="size-14 rounded-lg bg-slate-100 flex items-center justify-center text-2xl">📦</div>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-slate-800">{content.text || 'Product Name'}</div>
            <div className="text-[11px] text-slate-500">{content.placeholder || 'Description'}</div>
            <div className="text-[14px] font-bold text-[#2563EB] mt-1">{content.price || '$49.00'}</div>
          </div>
        </div>
      )

    case 'navbar':
      return (
        <div className="flex items-center justify-between py-3 px-4 border-b border-slate-200">
          <div className="text-[16px] font-bold text-slate-800">{content.text || 'GoFox'}</div>
          <div className="flex gap-4 text-[12px] text-slate-600">
            {(content.items || []).map((item) => (
              'platform' in item ? (
                <span key={item.platform} className="hover:text-[#2563EB]">
                  {item.text || item.label || item.platform}
                </span>
              ) : null
            ))}
          </div>
        </div>
      )

    case 'countdown':
      return (
        <div className="rounded-lg p-4 text-center" style={inlineStyles}>
          <div className="text-[12px] font-semibold">{content.text || 'Offer ends'}</div>
          <div className="mt-1 text-[16px] font-bold">
            {content.datetime ? new Date(content.datetime).toLocaleString() : 'Set a deadline'}
          </div>
          <div className="mt-1 text-[10px] text-muted">Email clients show a fixed deadline, not a live timer.</div>
        </div>
      )

    case 'progress-bar':
    case 'progress-circle': {
      const progress = Math.max(0, Math.min(100, Number(content.percentage) || 0))
      return (
        <div className="rounded-lg p-4" style={inlineStyles}>
          <div className="mb-2 flex justify-between text-[12px]">
            <span>{content.text || 'Progress'}</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )
    }

    case 'accordion':
      return (
        <div className="space-y-2 rounded-lg p-4" style={inlineStyles}>
          {(content.items || [])
            .filter((item): item is FAQItem => 'question' in item && 'answer' in item)
            .map((item) => (
              <div key={item.question} className="border-b border-slate-200 pb-2 last:border-b-0">
                <div className="text-[13px] font-semibold">{item.question}</div>
                <div className="mt-1 text-[12px] text-slate-600">{item.answer}</div>
              </div>
            ))}
        </div>
      )

    case 'image-gallery':
      return (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, Number(content.columns) || 3))}, minmax(0, 1fr))` }}
        >
          {(content.images || []).map((image) => (
            <img key={`${image.src}-${image.alt}`} src={image.src} alt={image.alt} className="h-auto w-full rounded" />
          ))}
        </div>
      )

    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>{(content.headers || []).map((header) => <th key={header} className="border border-slate-200 p-2 text-left">{header}</th>)}</tr>
            </thead>
            <tbody>
              {(content.rows || []).map((row, index) => (
                <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-slate-200 p-2">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'code-block':
      return (
        <pre className="overflow-auto rounded-lg p-4 font-mono text-[12px]" style={inlineStyles}>
          {content.text || content.code || ''}
        </pre>
      )

    case 'logo':
      return (
        <div style={{ textAlign: styles?.textAlign || 'center' }}>
          <img
            src={content.src || 'https://via.placeholder.com/200x60?text=LOGO'}
            alt={content.alt || 'Logo'}
            className="max-w-full h-auto mx-auto"
            style={{ maxWidth: content.width || 200 }}
          />
        </div>
      )

    case 'custom-html':
      return (
        <iframe
          title="Custom email content preview"
          srcDoc={content.html || ''}
          sandbox=""
          tabIndex={-1}
          className="pointer-events-none h-[320px] w-full border-0 bg-white"
        />
      )

    default:
      return (
        <div className="rounded border border-line p-3 text-[12px] text-muted">
          {content.text || `${type} block`}
        </div>
      )
  }
}

/* --------------------------------------------------------------------------
   Draggable Content Library Block Card
   -------------------------------------------------------------------------- */
function DraggableLibraryBlock({
  block,
  onAdd,
}: {
  block: LibraryBlock
  onAdd: () => void
}) {
  const { ref: setNodeRef, handleRef, isDragging } = useDraggable({
    id: `lib-${block.id}`,
    type: 'email-library-block',
    data: {
      type: 'library' as const,
      blockType: block.type,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'group flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center transition hover:border-orange-500 hover:shadow-xs hover:bg-[#2563EB]/5',
        isDragging && 'opacity-40'
      )}
    >
      <div className="flex w-full items-center justify-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB] group-hover:scale-110 transition">
          <BlockIcon name={block.icon} />
        </div>
        <button
          ref={handleRef}
          type="button"
          aria-label={`Drag ${block.label} block`}
          title={`Drag ${block.label} to the canvas`}
          onClick={(event) => event.stopPropagation()}
          className="ml-auto cursor-grab rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <GripVertical size={14} />
        </button>
      </div>
      <div className="mt-2 text-[12px] font-semibold text-ink group-hover:text-[#2563EB]">
        {block.label}
      </div>
      <div className="text-[10px] text-muted line-clamp-1">{block.description}</div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-md px-2.5 py-1 text-[10px] font-semibold text-[#2563EB] hover:bg-[#2563EB]/10"
      >
        Add block
      </button>
    </div>
  )
}

function BlockIcon({ name }: { name: string }) {
  switch (name) {
    case 'Heading':
      return <Type size={16} />
    case 'Type':
      return <FileText size={16} />
    case 'Image':
      return <Palette size={16} />
    case 'MousePointer':
      return <Check size={16} />
    case 'Minus':
      return <AlignCenter size={16} />
    case 'MoveVertical':
      return <MoveDown size={16} />
    case 'Share2':
      return <ExternalLink size={16} />
    case 'Video':
      return <Code2 size={16} />
    case 'Sparkles':
      return <Sparkles size={16} />
    default:
      return <Layout size={16} />
  }
}
