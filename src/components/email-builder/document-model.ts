// GoFox Email Builder - Document Model Operations

import type {
  EmailDocument,
  Section,
  Block,
  BlockContent,
  LibraryBlock,
} from './types'

export function createEmptyDocument(): EmailDocument {
  return {
    schemaVersion: 1,
    settings: {
      width: 600,
      backgroundColor: '#F5F7FB',
      contentBackground: '#FFFFFF',
      fontFamily: 'Arial, sans-serif',
    },
    sections: [],
  }
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function addSection(document: EmailDocument, columnWidths: number[] = [100]): EmailDocument {
  const section: Section = {
    id: generateId('section'),
    type: 'section',
    columns: columnWidths.map((width) => ({
      id: generateId('column'),
      width,
      blocks: [],
    })),
  }
  return {
    ...document,
    sections: [...document.sections, section],
  }
}

export function removeSection(document: EmailDocument, sectionId: string): EmailDocument {
  return {
    ...document,
    sections: document.sections.filter((s) => s.id !== sectionId),
  }
}

export function updateSection(document: EmailDocument, sectionId: string, updates: Partial<Section>): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, ...updates } : section
    ),
  }
}

export function reorderSections(document: EmailDocument, fromIndex: number, toIndex: number): EmailDocument {
  const sections = [...document.sections]
  const [moved] = sections.splice(fromIndex, 1)
  sections.splice(toIndex, 0, moved)
  return {
    ...document,
    sections,
  }
}

export function addBlockToColumn(
  document: EmailDocument,
  sectionId: string,
  columnId: string,
  block: Block
): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        columns: section.columns.map((column) => {
          if (column.id !== columnId) return column
          return {
            ...column,
            blocks: [...column.blocks, block],
          }
        }),
      }
    }),
  }
}

export function removeBlock(document: EmailDocument, blockId: string): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.filter((b) => b.id !== blockId),
      })),
    })),
  }
}

export function updateBlock(
  document: EmailDocument,
  blockId: string,
  updates: Partial<Block>
): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === blockId ? { ...block, ...updates } : block
        ),
      })),
    })),
  }
}

export function updateBlockContent(
  document: EmailDocument,
  blockId: string,
  content: Partial<BlockContent>
): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === blockId
            ? { ...block, content: { ...block.content, ...content } }
            : block
        ),
      })),
    })),
  }
}

export function updateBlockStyles(
  document: EmailDocument,
  blockId: string,
  styles: Partial<Block['styles']>
): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === blockId
            ? { ...block, styles: { ...block.styles, ...styles } }
            : block
        ),
      })),
    })),
  }
}

export function moveBlock(
  document: EmailDocument,
  blockId: string,
  targetSectionId: string,
  targetColumnId: string,
  targetIndex: number
): EmailDocument {
  let movedBlock: Block | null = null

  // Remove block from original location
  const sectionsWithoutBlock = document.sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => {
      const blockIndex = column.blocks.findIndex((b) => b.id === blockId)
      if (blockIndex !== -1) {
        movedBlock = column.blocks[blockIndex]
        return {
          ...column,
          blocks: column.blocks.filter((b) => b.id !== blockId),
        }
      }
      return column
    }),
  }))

  if (!movedBlock) return document

  // Add block to new location
  return {
    ...document,
    sections: sectionsWithoutBlock.map((section) => {
      if (section.id !== targetSectionId) return section
      return {
        ...section,
        columns: section.columns.map((column) => {
          if (column.id !== targetColumnId) return column
          const newBlocks = [...column.blocks]
          newBlocks.splice(targetIndex, 0, movedBlock!)
          return {
            ...column,
            blocks: newBlocks,
          }
        }),
      }
    }),
  }
}

export function reorderBlocks(
  document: EmailDocument,
  sectionId: string,
  columnId: string,
  fromIndex: number,
  toIndex: number
): EmailDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== sectionId) return section
      return {
        ...section,
        columns: section.columns.map((column) => {
          if (column.id !== columnId) return column
          const blocks = [...column.blocks]
          const [moved] = blocks.splice(fromIndex, 1)
          blocks.splice(toIndex, 0, moved)
          return {
            ...column,
            blocks,
          }
        }),
      }
    }),
  }
}

export function duplicateBlock(document: EmailDocument, blockId: string): EmailDocument {
  let blockToDuplicate: Block | null = null
  let location: { sectionId: string; columnId: string; index: number } | null = null

  document.sections.forEach((section) => {
    section.columns.forEach((column) => {
      const index = column.blocks.findIndex((b) => b.id === blockId)
      if (index !== -1) {
        blockToDuplicate = column.blocks[index]
        location = { sectionId: section.id, columnId: column.id, index }
      }
    })
  })

  if (!blockToDuplicate || !location) return document

  const targetBlock: Block = blockToDuplicate
  const newBlock: Block = {
    ...JSON.parse(JSON.stringify(targetBlock)),
    id: generateId(targetBlock.type),
  }

  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== location!.sectionId) return section
      return {
        ...section,
        columns: section.columns.map((column) => {
          if (column.id !== location!.columnId) return column
          const blocks = [...column.blocks]
          blocks.splice(location!.index + 1, 0, newBlock)
          return {
            ...column,
            blocks,
          }
        }),
      }
    }),
  }
}

export function findBlock(document: EmailDocument, blockId: string): Block | null {
  for (const section of document.sections) {
    for (const column of section.columns) {
      const block = column.blocks.find((b) => b.id === blockId)
      if (block) return block
    }
  }
  return null
}

export function findBlockLocation(
  document: EmailDocument,
  blockId: string
): { sectionId: string; columnId: string; index: number } | null {
  for (const section of document.sections) {
    for (const column of section.columns) {
      const index = column.blocks.findIndex((b) => b.id === blockId)
      if (index !== -1) {
        return { sectionId: section.id, columnId: column.id, index }
      }
    }
  }
  return null
}

export function createBlockFromLibrary(libraryBlock: LibraryBlock): Block {
  return {
    id: generateId(libraryBlock.type),
    type: libraryBlock.type,
    content: { ...libraryBlock.defaultContent },
    styles: libraryBlock.defaultStyles ? { ...libraryBlock.defaultStyles } : undefined,
  }
}
