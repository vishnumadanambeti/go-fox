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
  | 'countdown'
  | 'progress-bar'
  | 'accordion'
  | 'image-gallery'
  | 'table'
  | 'code-block'
  | 'progress-circle'

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
  items?: SocialItem[] | MetricItem[] | FAQItem[]
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
  datetime?: string
  percentage?: number
  headers?: string[]
  rows?: string[][]
  images?: { src: string; alt: string }[]
  columns?: number
  language?: string
  question?: string
  answer?: string
}

export interface MetricItem {
  text: string
  label: string
}

export interface FAQItem {
  question: string
  answer: string
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
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  padding?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  margin?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  border?: string
  borderRadius?: number
  width?: number
  height?: number
  maxWidth?: string
  objectFit?: 'cover' | 'contain' | 'fill'
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none'
  borderLeft?: string
  borderRight?: string
  borderBottom?: string
  borderTop?: string
  hideOnMobile?: boolean
  hideOnDesktop?: boolean
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
  mode: BuilderMode
  device: 'desktop' | 'tablet' | 'mobile'
  preview: boolean
  history: EmailDocument[]
  historyIndex: number
  unsaved: boolean
  saving: boolean
}

export type BuilderMode = 'design' | 'code' | 'plain'

export interface DragItem {
  type: 'library' | 'canvas'
  blockType?: BlockType
  blockId?: string
  sourceId?: string
  sectionId?: string
  sectionIndex?: number
  columnId?: string
  index?: number
  isCanvasRoot?: boolean
  data?: Block
}
