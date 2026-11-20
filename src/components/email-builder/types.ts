// GoFox Email Builder - Document Model and Types

export interface EmailDocument {
  schemaVersion: number
  settings: DocumentSettings
  sections: Section[]
}

export interface DocumentSettings {
  width: number
  backgroundColor: string
  contentBackground: string
  fontFamily?: string
  preheader?: string
}

export interface Section {
  id: string
  type: 'section'
  columns: Column[]
  styles?: SectionStyles
}

export interface Column {
  id: string
  width: number
  blocks: Block[]
  styles?: ColumnStyles
}

export interface Block {
  id: string
  type: BlockType
  content: BlockContent
  styles?: BlockStyles
}

export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'social'
  | 'video'
  | 'logo'
  | 'html'
  | 'custom-html'
  | 'hero'
  | 'features'
  | 'pricing'
  | 'testimonial'
  | 'coupon'
  | 'metrics'
  | 'product'
  | 'footer'
  | 'navbar'

export interface BlockContent {
  text?: string
  html?: string
  url?: string
  alt?: string
  width?: number
  height?: number
  src?: string
  caption?: string
  level?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  fontSize?: number
  fontFamily?: string
  alignment?: 'left' | 'center' | 'right'
  link?: string
  items?: SocialItem[] | MetricItem[]
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  padding?: number
  margin?: number
  thickness?: number
  spacing?: number
  iconStyle?: 'outline' | 'filled'
  iconColor?: string
  iconSize?: number
  price?: string
  period?: string
  features?: string[]
  author?: string
  role?: string
  code?: string
  videoUrl?: string
  placeholder?: string
  buttonText?: string
  buttonUrl?: string
}

export interface MetricItem {
  text: string
  label: string
}

export interface SocialItem {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'youtube' | 'website'
  url: string
  text?: string
  label?: string
}

export interface SectionStyles {
  backgroundColor?: string
  padding?: number
  margin?: number
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  backgroundImage?: string
}

export interface ColumnStyles {
  backgroundColor?: string
  padding?: number
  borderRight?: string
  borderLeft?: string
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

export interface BlockStyles {
  color?: string
  backgroundColor?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
  padding?: number
  margin?: number
  border?: string
  borderRadius?: number
  width?: number
  height?: number
  maxWidth?: string
  objectFit?: 'cover' | 'contain' | 'fill'
  borderColor?: string
  borderWidth?: number
  borderLeft?: string
  borderRight?: string
  borderBottom?: string
  borderTop?: string
}

export interface LibraryBlock {
  id: string
  type: BlockType
  category: 'basic' | 'layout' | 'marketing' | 'advanced'
  label: string
  description: string
  icon: string
  defaultContent: BlockContent
  defaultStyles?: BlockStyles
}

export interface LayoutPreset {
  id: string
  label: string
  columns: number[]
  description: string
}

export interface SavedBlock {
  id: string
  name: string
  block: Block
  thumbnail?: string
  createdAt: string
}

export interface PersonalizationVariable {
  key: string
  label: string
  description?: string
}

export interface BuilderState {
  document: EmailDocument
  selectedId: string | null
  selectedType: 'section' | 'column' | 'block' | null
  mode: 'design' | 'code' | 'plain'
  device: 'desktop' | 'tablet' | 'mobile'
  preview: boolean
  history: EmailDocument[]
  historyIndex: number
  unsaved: boolean
  saving: boolean
}

export interface DragItem {
  type: 'library' | 'canvas'
  blockType?: BlockType
  blockId?: string
  sourceId?: string
  sectionId?: string
  columnId?: string
  index?: number
  data?: Block
}
