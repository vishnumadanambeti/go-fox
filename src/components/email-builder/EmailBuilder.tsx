// GoFox Email Builder - World-Class Visual Email Editor with dnd-kit
// Production Implementation: Linear / Stripe / Unlayer grade UI/UX

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
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
  MoveUp,
  MoveDown,
  Bookmark,
  GripVertical,
  AlignCenter,
} from 'lucide-react'
import type {
  EmailDocument,
  Block,
  LibraryBlock,
  BuilderState,
  DragItem,
  Section,
  Column,
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
} from './document-model'
import { LIBRARY_BLOCKS, LAYOUT_PRESETS } from './library-blocks'
import { renderEmailHTML, generatePlainText } from './email-renderer'
import { Button, Modal, cx } from '../ui'

export interface EmailBuilderProps {
  id?: string
  name?: string
  onNameChange?: (name: string) => void
  status?: string
  initialDocument?: EmailDocument
  onSave?: (document: EmailDocument, html: string, plainText: string) => Promise<void>
  onPublish?: () => Promise<void>
  onBack?: () => void
  onSendTest?: (to: string, html: string) => Promise<void>
  onSwitchClassic?: () => void
  onOpenSettings?: () => void
}

const CRM_TOKENS = [
  { label: 'First Name', token: '{{first_name}}', example: 'Alex' },
  { label: 'Last Name', token: '{{last_name}}', example: 'Morgan' },
  { label: 'Full Name', token: '{{fullName}}', example: 'Alex Morgan' },
  { label: 'Email Address', token: '{{email}}', example: 'alex@example.com' },
  { label: 'Company Name', token: '{{company}}', example: 'Acme Corp' },
  { label: 'Phone Number', token: '{{phone}}', example: '+1 (555) 019-2834' },
  { label: 'Sender Name', token: '{{sender_name}}', example: 'Vishnu' },
  { label: 'Unsubscribe Link', token: '{{unsubscribe_url}}', example: 'https://gofox.io/unsub' },
]

export function EmailBuilder({
  id: _id,
  name = 'Untitled Template',
  onNameChange,
  status = 'draft',
  initialDocument,
  onSave,
  onPublish,
  onBack,
  onSendTest,
  onSwitchClassic,
  onOpenSettings,
}: EmailBuilderProps) {
  // Main Builder State
  const [state, setState] = useState<BuilderState>(() => {
    const doc = initialDocument && initialDocument.sections ? initialDocument : createEmptyDocument()
    return {
      document: doc,
      selectedId: null,
      selectedType: null,
      mode: 'design',
      device: 'desktop',
      preview: false,
      history: [doc],
      historyIndex: 0,
      unsaved: false,
      saving: false,
    }
  })

  // UI Panels
  const [activeTab, setActiveTab] = useState<'content' | 'columns' | 'blocks'>('content')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [propertiesTab, setPropertiesTab] = useState<'content' | 'styles' | 'ai'>('content')

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false)
  const [savedBlocks, setSavedBlocks] = useState<Block[]>([])

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragItem, setDragItem] = useState<DragItem | null>(null)

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // History Management
  const pushToHistory = useCallback((document: EmailDocument) => {
    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1)
      newHistory.push(document)
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

  // Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Ctrl+S (Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault()
        redo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

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
      setState((prev) => ({ ...prev, document: newDocument, unsaved: true }))
    },
    [state.document]
  )

  const handleUpdateBlockStyles = useCallback(
    (blockId: string, styles: Partial<Block['styles']>) => {
      const newDocument = updateBlockStyles(state.document, blockId, styles)
      setState((prev) => ({ ...prev, document: newDocument, unsaved: true }))
    },
    [state.document]
  )

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      const newDoc = removeSection(state.document, sectionId)
      pushToHistory(newDoc)
      setState((prev) => ({ ...prev, selectedId: null, selectedType: null }))
    },
    [state.document, pushToHistory]
  )

  // Selection
  const handleSelect = useCallback((id: string, type: 'section' | 'column' | 'block') => {
    setState((prev) => ({ ...prev, selectedId: id, selectedType: type }))
  }, [])

  // Drag Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    setDragItem(active.data.current as DragItem)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setDragItem(null)

      if (!over) return

      const activeData = active.data.current as DragItem
      const overData = over.data.current as DragItem

      // Library block dropped onto canvas column
      if (activeData?.type === 'library' && activeData.blockType && overData?.type === 'canvas') {
        const libraryBlock = LIBRARY_BLOCKS.find((b) => b.type === activeData.blockType)
        if (libraryBlock && overData.sectionId && overData.columnId) {
          handleAddBlock(libraryBlock, overData.sectionId, overData.columnId)
        }
      }

      // Block moved within canvas
      if (activeData?.type === 'canvas' && overData?.type === 'canvas' && activeData.blockId) {
        if (overData.sectionId && overData.columnId) {
          const newDocument = moveBlock(
            state.document,
            activeData.blockId,
            overData.sectionId,
            overData.columnId,
            overData.index || 0
          )
          pushToHistory(newDocument)
        }
      }
    },
    [state.document, handleAddBlock, pushToHistory]
  )

  // Save Handler
  const handleSave = useCallback(async () => {
    if (!onSave) return
    setState((prev) => ({ ...prev, saving: true }))
    try {
      const html = renderEmailHTML(state.document)
      const plainText = generatePlainText(state.document)
      await onSave(state.document, html, plainText)
      setState((prev) => ({ ...prev, saving: false, unsaved: false }))
    } catch (error) {
      console.error('Save failed:', error)
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [state.document, onSave])

  // Test Email Handler
  const handleSendTest = useCallback(async () => {
    if (!onSendTest || !testEmail.trim()) return
    setSendingTest(true)
    try {
      const html = renderEmailHTML(state.document)
      await onSendTest(testEmail.trim(), html)
      setTestOpen(false)
      setTestEmail('')
    } catch (error) {
      console.error('Test email failed:', error)
    } finally {
      setSendingTest(false)
    }
  }, [state.document, testEmail, onSendTest])

  // Insert CRM token into currently selected block
  const handleInsertToken = (token: string) => {
    if (state.selectedId && state.selectedType === 'block') {
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F7FB] font-sans text-ink">
      {/* 1. TOP TOOLBAR */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 shadow-xs z-30">
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

          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 font-bold text-white shadow-sm text-[13px]">
              GF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => onNameChange?.(e.target.value)}
                  placeholder="Template Name..."
                  className="rounded px-1 text-[13.5px] font-bold text-ink hover:bg-surface-2 focus:bg-surface focus:outline-none focus:ring-1 focus:ring-orange-500 max-w-[220px] truncate"
                />
                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-orange-600 uppercase">
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
                {state.unsaved ? (
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
          </div>
        </div>

        {/* Center: Personalize Dropdown + Mode Switcher + Device Preview */}
        <div className="flex items-center gap-2.5">
          {/* Personalize Token Dropdown */}
          <div className="relative">
            <button
              onClick={() => setTokenMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
            >
              <Sparkles size={13} className="text-orange-500" />
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
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-orange-500/10 hover:text-orange-600 transition"
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
              onClick={() => setState((prev) => ({ ...prev, mode: 'design' }))}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'design'
                  ? 'bg-surface text-orange-600 shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <Palette size={13} />
              <span>Design</span>
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, mode: 'code' }))}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'code'
                  ? 'bg-surface text-orange-600 shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <Code2 size={13} />
              <span>HTML</span>
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, mode: 'plain' }))}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition',
                state.mode === 'plain'
                  ? 'bg-surface text-orange-600 shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              <FileText size={13} />
              <span>Plain text</span>
            </button>
          </div>

          {/* Device Controls (Desktop / Tablet / Mobile) */}
          {state.mode === 'design' && (
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'desktop' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'desktop' ? 'bg-surface text-orange-600 shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Desktop View (600px)"
              >
                <Monitor size={14} />
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'tablet' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'tablet' ? 'bg-surface text-orange-600 shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Tablet View (768px)"
              >
                <Tablet size={14} />
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, device: 'mobile' }))}
                className={cx(
                  'rounded-md p-1.5 transition',
                  state.device === 'mobile' ? 'bg-surface text-orange-600 shadow-xs' : 'text-muted hover:text-ink'
                )}
                title="Mobile View (390px)"
              >
                <Smartphone size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Right: History + Actions + Save + Publish */}
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
          >
            <Eye size={13} className="text-muted" />
            <span>Preview</span>
          </button>

          {/* Send Test */}
          <button
            onClick={() => setTestOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 transition"
          >
            <Send size={13} className="text-muted" />
            <span>Send test</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => void handleSave()}
            disabled={state.saving}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2 disabled:opacity-50 transition"
          >
            <Save size={13} />
            <span>{state.saving ? 'Saving…' : 'Save'}</span>
          </button>

          {/* Publish / Ready for Campaign */}
          {onPublish && (
            <button
              onClick={() => void onPublish()}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-700 transition"
            >
              <Rocket size={13} />
              <span>Publish</span>
            </button>
          )}

          {onSwitchClassic && (
            <button
              onClick={onSwitchClassic}
              className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-ink transition"
              title="Switch to Classic Editor"
            >
              Classic Editor
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

      {/* 2. MODE: CODE / HTML VIEW */}
      {state.mode === 'code' && (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-900 text-slate-100 p-4 font-mono text-[12px]">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-3">
            <span className="text-slate-400">Generated Email-Safe HTML (Read-only output)</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedHTML)
              }}
              className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
            >
              <Copy size={12} />
              <span>Copy HTML</span>
            </button>
          </div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap select-all">{generatedHTML}</pre>
        </div>
      )}

      {/* 3. MODE: PLAIN TEXT VIEW */}
      {state.mode === 'plain' && (
        <div className="flex min-h-0 flex-1 flex-col bg-surface p-6 font-mono text-[13px] text-ink">
          <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
            <span className="text-muted text-[12px] font-sans">Plain-Text Alternative Version</span>
            <button
              onClick={() => navigator.clipboard.writeText(generatedPlainText)}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface"
            >
              <Copy size={12} />
              <span>Copy Text</span>
            </button>
          </div>
          <textarea
            readOnly
            value={generatedPlainText}
            rows={15}
            className="w-full flex-1 rounded-xl border border-line bg-surface-2 p-4 text-[13px] focus:outline-none"
          />
        </div>
      )}

      {/* 4. MODE: VISUAL DESIGN WORKSPACE (3-PANEL LAYOUT) */}
      {state.mode === 'design' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* LEFT PANEL: CONTENT LIBRARY */}
            {!leftPanelCollapsed && (
              <aside className="flex h-full w-[310px] shrink-0 flex-col border-r border-line bg-surface z-20">
                {/* 3 Tabs: CONTENT | COLUMNS | BLOCKS */}
                <div className="flex border-b border-line bg-surface-2/40">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      activeTab === 'content'
                        ? 'border-orange-600 text-orange-600 bg-surface'
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
                        ? 'border-orange-600 text-orange-600 bg-surface'
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
                        ? 'border-orange-600 text-orange-600 bg-surface'
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
                          className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-[12px] placeholder:text-muted focus:border-orange-500 focus:outline-none"
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
                              ? 'bg-orange-600 text-white'
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
                          className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-orange-500 hover:shadow-xs transition group"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-ink group-hover:text-orange-600">
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
                                className="h-full rounded bg-orange-500/20 group-hover:bg-orange-500/40 transition"
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
                              className="rounded bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white"
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
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#EEF1F5] p-6">
              {/* Outer Centered Document Container */}
              <div
                className={cx(
                  'mx-auto transition-all duration-300',
                  state.device === 'mobile'
                    ? 'w-[390px] rounded-3xl border-8 border-slate-800 bg-white shadow-2xl p-2'
                    : state.device === 'tablet'
                    ? 'w-[720px] rounded-xl shadow-lg bg-white'
                    : 'w-[600px] rounded-lg shadow-sm bg-white'
                )}
                style={{
                  backgroundColor: state.document.settings.contentBackground || '#FFFFFF',
                  minHeight: '480px',
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
                    <div className="flex size-14 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 mb-3">
                      <Layout size={28} />
                    </div>
                    <h3 className="text-[16px] font-bold text-ink">Your email canvas is empty</h3>
                    <p className="mt-1 max-w-xs text-[12px] text-muted">
                      Click below to add your first layout section or pick any content block from the left.
                    </p>
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => handleAddSection([100])}
                        className="rounded-xl bg-orange-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-700"
                      >
                        + 1 Column Section
                      </button>
                      <button
                        onClick={() => handleAddSection([50, 50])}
                        className="rounded-xl border border-line bg-surface px-4 py-2 text-[12px] font-semibold text-ink shadow-xs hover:bg-surface-2"
                      >
                        + 2 Column (50/50)
                      </button>
                    </div>
                  </div>
                ) : (
                  <SortableContext
                    items={state.document.sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
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
                          onRemoveBlock={handleRemoveBlock}
                          onDuplicateBlock={handleDuplicateBlock}
                          onMoveBlockUpDown={handleMoveBlockUpDown}
                          onSaveAsReusableBlock={handleSaveAsReusableBlock}
                          onUpdateBlockContent={handleUpdateBlockContent}
                          onAddBlock={handleAddBlock}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}

                {/* Add Section Quick Button at bottom */}
                {state.document.sections.length > 0 && (
                  <div className="p-4 text-center border-t border-line/40 bg-surface-2/20">
                    <button
                      onClick={() => handleAddSection([100])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-orange-500/40 bg-orange-500/5 px-3 py-1.5 text-[11.5px] font-semibold text-orange-600 hover:bg-orange-500/10 transition"
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
              <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-line bg-surface z-20">
                {/* 3 Tabs: CONTENT | STYLES | GOFOX AI */}
                <div className="flex border-b border-line bg-surface-2/40">
                  <button
                    onClick={() => setPropertiesTab('content')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      propertiesTab === 'content'
                        ? 'border-orange-600 text-orange-600 bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setPropertiesTab('styles')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      propertiesTab === 'styles'
                        ? 'border-orange-600 text-orange-600 bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    Styles
                  </button>
                  <button
                    onClick={() => setPropertiesTab('ai')}
                    className={cx(
                      'flex-1 py-3 text-center text-[11.5px] font-bold tracking-wider uppercase transition border-b-2',
                      propertiesTab === 'ai'
                        ? 'border-orange-600 text-orange-600 bg-surface'
                        : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Sparkles size={12} className="text-orange-500" />
                      AI
                    </span>
                  </button>
                  <button
                    onClick={() => setRightPanelCollapsed(true)}
                    className="px-2.5 text-muted hover:text-ink"
                    title="Collapse properties"
                  >
                    <X size={14} />
                  </button>
                </div>

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
                                  className="w-full rounded-lg border border-line bg-surface p-2 text-[12.5px] focus:border-orange-500 focus:outline-none"
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
                                className="w-full rounded-lg border border-line bg-surface p-2 text-[12.5px] focus:border-orange-500 focus:outline-none"
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
                      {propertiesTab === 'styles' && (
                        <div className="space-y-4">
                          {/* Font Size */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">
                              Font Size: {selectedBlock.styles?.fontSize || 14}px
                            </label>
                            <input
                              type="range"
                              min={10}
                              max={48}
                              value={selectedBlock.styles?.fontSize || 14}
                              onChange={(e) =>
                                handleUpdateBlockStyles(selectedBlock.id, { fontSize: Number(e.target.value) })
                              }
                              className="w-full"
                            />
                          </div>

                          {/* Text Color */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">Text Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedBlock.styles?.color || '#172033'}
                                onChange={(e) =>
                                  handleUpdateBlockStyles(selectedBlock.id, { color: e.target.value })
                                }
                                className="size-8 rounded border border-line cursor-pointer"
                              />
                              <input
                                type="text"
                                value={selectedBlock.styles?.color || '#172033'}
                                onChange={(e) =>
                                  handleUpdateBlockStyles(selectedBlock.id, { color: e.target.value })
                                }
                                className="flex-1 rounded-lg border border-line bg-surface p-1.5 text-[12px] font-mono"
                              />
                            </div>
                          </div>

                          {/* Background Color */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">Background Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedBlock.styles?.backgroundColor || '#FFFFFF'}
                                onChange={(e) =>
                                  handleUpdateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })
                                }
                                className="size-8 rounded border border-line cursor-pointer"
                              />
                              <input
                                type="text"
                                value={selectedBlock.styles?.backgroundColor || '#FFFFFF'}
                                onChange={(e) =>
                                  handleUpdateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })
                                }
                                className="flex-1 rounded-lg border border-line bg-surface p-1.5 text-[12px] font-mono"
                              />
                            </div>
                          </div>

                          {/* Text Alignment */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">Alignment</label>
                            <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
                              {(['left', 'center', 'right'] as const).map((align) => (
                                <button
                                  key={align}
                                  onClick={() =>
                                    handleUpdateBlockStyles(selectedBlock.id, { textAlign: align })
                                  }
                                  className={cx(
                                    'flex-1 py-1 rounded text-center capitalize text-[11px] font-semibold transition',
                                    selectedBlock.styles?.textAlign === align
                                      ? 'bg-surface text-orange-600 shadow-xs'
                                      : 'text-muted hover:text-ink'
                                  )}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Padding & Margin */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">Padding (px)</label>
                            <input
                              type="number"
                              value={selectedBlock.styles?.padding ?? 12}
                              onChange={(e) =>
                                handleUpdateBlockStyles(selectedBlock.id, { padding: Number(e.target.value) })
                              }
                              className="w-full rounded-lg border border-line bg-surface p-1.5 text-[12px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11.5px] font-semibold text-ink mb-1">Border Radius (px)</label>
                            <input
                              type="number"
                              value={selectedBlock.styles?.borderRadius ?? 6}
                              onChange={(e) =>
                                handleUpdateBlockStyles(selectedBlock.id, { borderRadius: Number(e.target.value) })
                              }
                              className="w-full rounded-lg border border-line bg-surface p-1.5 text-[12px]"
                            />
                          </div>
                        </div>
                      )}

                      {/* TAB 3: GOFOX AI ASSISTANT */}
                      {propertiesTab === 'ai' && (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-[12px]">
                            <div className="flex items-center gap-1.5 font-bold text-orange-600">
                              <Sparkles size={14} />
                              <span>GoFox AI Content Engine</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted">
                              Transform your copy instantly for higher conversions.
                            </p>
                          </div>

                          <div className="space-y-2 pt-1">
                            <button
                              onClick={() => {
                                if (selectedBlock.type === 'heading') {
                                  handleUpdateBlockContent(selectedBlock.id, {
                                    text: 'Boost Your Growth With GoFox Enterprise CRM 🚀',
                                  })
                                } else if (selectedBlock.type === 'button') {
                                  handleUpdateBlockContent(selectedBlock.id, {
                                    text: 'Claim Your Free Access Now →',
                                  })
                                } else {
                                  handleUpdateBlockContent(selectedBlock.id, {
                                    text: 'We are excited to share our latest product enhancements designed to help your team close deals faster.',
                                  })
                                }
                              }}
                              className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-left text-[12px] font-semibold text-ink hover:border-orange-500 hover:text-orange-600 transition"
                            >
                              <Sparkles size={13} className="text-orange-500" />
                              <span>✨ Polish & Professionalize</span>
                            </button>

                            <button
                              onClick={() => {
                                if (selectedBlock.type === 'button') {
                                  handleUpdateBlockContent(selectedBlock.id, {
                                    text: 'Get 50% Off — Ends Midnight',
                                  })
                                } else {
                                  handleUpdateBlockContent(selectedBlock.id, {
                                    text: 'Limited time: unlock priority access to high-yield pipeline workflows today.',
                                  })
                                }
                              }}
                              className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-left text-[12px] font-semibold text-ink hover:border-orange-500 hover:text-orange-600 transition"
                            >
                              <span>🔥 High-Converting Urgency</span>
                            </button>

                            <button
                              onClick={() => {
                                handleUpdateBlockContent(selectedBlock.id, {
                                  text: 'Simple. Fast. Scalable CRM.',
                                })
                              }}
                              className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-left text-[12px] font-semibold text-ink hover:border-orange-500 hover:text-orange-600 transition"
                            >
                              <span>✂️ Make Concise & Punchy</span>
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
              <div className="rounded-xl border border-orange-500 bg-white p-3 shadow-2xl flex items-center gap-2 text-ink text-[12px] font-bold">
                <GripVertical size={14} className="text-orange-500" />
                <span className="capitalize">{dragItem.blockType} Block</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 5. FULL PREVIEW MODAL */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Full Email Preview"
        wide
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] text-muted">Previewing live responsive email HTML</span>
            <Button size="sm" onClick={() => setPreviewOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-inner">
            <iframe
              title="Email Preview"
              srcDoc={generatedHTML}
              className="h-[520px] w-full border-0"
              sandbox=""
            />
          </div>
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
            <Button size="sm" variant="primary" onClick={handleSendTest} loading={sendingTest}>
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
              className="w-full rounded-xl border border-line bg-surface p-2.5 text-[12.5px] focus:border-orange-500 focus:outline-none"
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
  sectionIndex: _sectionIndex,
  selectedId,
  selectedType,
  onSelect,
  onRemoveSection,
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
  onRemoveBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onMoveBlockUpDown: (id: string, direction: 'up' | 'down') => void
  onSaveAsReusableBlock: (id: string) => void
  onUpdateBlockContent: (id: string, content: Partial<Block['content']>) => void
  onAddBlock: (libraryBlock: LibraryBlock, sectionId?: string, columnId?: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: section.id,
    data: {
      type: 'canvas' as const,
      sectionId: section.id,
    },
  })

  const isSelected = selectedId === section.id && selectedType === 'section'

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative group/sec transition-all',
        isSelected ? 'ring-2 ring-orange-500 bg-orange-500/5' : 'hover:ring-1 hover:ring-orange-300',
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
        <span {...attributes} {...listeners} className="cursor-grab text-muted hover:text-ink p-1">
          <GripVertical size={13} />
        </span>
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
  const { setNodeRef } = useSortable({
    id: column.id,
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
      className="min-h-[64px] rounded-lg transition"
    >
      {column.blocks.length === 0 ? (
        <div
          onClick={(e) => {
            e.stopPropagation()
            // Click adds heading by default
            const headingBlock = LIBRARY_BLOCKS.find((b) => b.type === 'heading')
            if (headingBlock) onAddBlock(headingBlock, sectionId, column.id)
          }}
          className="flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed border-line/80 text-[11.5px] font-medium text-muted hover:border-orange-500 hover:text-orange-600 hover:bg-orange-500/5 cursor-pointer transition"
        >
          + Add block here
        </div>
      ) : (
        <SortableContext items={column.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {column.blocks.map((block) => (
              <CanvasBlockComponent
                key={block.id}
                block={block}
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
        </SortableContext>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Canvas Block Component (dnd-kit Sortable + Inline Editing)
   -------------------------------------------------------------------------- */
function CanvasBlockComponent({
  block,
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
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: block.id,
    data: {
      type: 'canvas' as const,
      blockId: block.id,
      sectionId,
      columnId,
    },
  })

  const isSelected = selectedId === block.id && selectedType === 'block'

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative group/block rounded-lg transition-all',
        isSelected
          ? 'ring-2 ring-orange-500 bg-orange-500/5'
          : 'hover:ring-1 hover:ring-orange-400/60',
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
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-slate-900 text-white shadow-xl px-2 py-0.5 z-30 animate-in fade-in zoom-in-95 text-[11px]">
          <span {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-white p-1">
            <GripVertical size={12} />
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMoveBlockUpDown(block.id, 'up')
            }}
            className="text-slate-300 hover:text-white p-1"
            title="Move Up"
          >
            <MoveUp size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMoveBlockUpDown(block.id, 'down')
            }}
            className="text-slate-300 hover:text-white p-1"
            title="Move Down"
          >
            <MoveDown size={12} />
          </button>
          <div className="h-3 w-px bg-slate-700" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicateBlock(block.id)
            }}
            className="text-slate-300 hover:text-white p-1"
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSaveAsReusableBlock(block.id)
            }}
            className="text-slate-300 hover:text-white p-1"
            title="Save as Component"
          >
            <Bookmark size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveBlock(block.id)
            }}
            className="text-rose-400 hover:text-rose-300 p-1"
            title="Delete Block"
          >
            <Trash2 size={12} />
          </button>
        </div>
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
          className={cx('outline-none focus:ring-1 focus:ring-orange-400 rounded px-1', sizeClass)}
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
          className="outline-none focus:ring-1 focus:ring-orange-400 rounded px-1 text-[14px] leading-relaxed text-slate-700"
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
            className="outline-none focus:ring-2 focus:ring-orange-300 shadow-sm"
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
        <div style={{ textAlign: styles?.textAlign || 'center' }} className="flex justify-center gap-3 py-2 text-[12px] font-semibold text-orange-600">
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
          <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-1">
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
          <button className="rounded-lg bg-orange-600 px-5 py-2 font-bold text-white shadow-md text-[13px]">
            {content.buttonText || 'Get Started Now'}
          </button>
        </div>
      )

    case 'coupon':
      return (
        <div className="rounded-xl border-2 border-dashed border-orange-500 bg-orange-50/50 p-4 text-center">
          <div className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">SPECIAL DISCOUNT CODE</div>
          <div className="my-1.5 font-mono text-[22px] font-black text-orange-700 tracking-widest">
            {content.code || 'GOFOX2026'}
          </div>
          <div className="text-[11px] text-muted">Use code at checkout to claim your 20% discount.</div>
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
          <div>© 2026 GoFox Technologies Inc. · 1200 Market Street, San Francisco, CA</div>
          <div className="mt-1">
            <span className="text-orange-600 underline cursor-pointer">Unsubscribe</span> · <span className="underline cursor-pointer">Privacy Policy</span>
          </div>
        </div>
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
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `lib-${block.id}`,
    data: {
      type: 'library' as const,
      blockType: block.type,
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAdd}
      className={cx(
        'group flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center cursor-pointer transition hover:border-orange-500 hover:shadow-xs hover:bg-orange-500/5',
        isDragging && 'opacity-40'
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 group-hover:scale-110 transition">
        <BlockIcon name={block.icon} />
      </div>
      <div className="mt-2 text-[12px] font-semibold text-ink group-hover:text-orange-600">
        {block.label}
      </div>
      <div className="text-[10px] text-muted line-clamp-1">{block.description}</div>
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
