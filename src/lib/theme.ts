export type ThemeId =
  | 'signature'
  | 'gofox'
  | 'zoho'
  | 'salesforce'
  | 'hubspot'
  | 'midnight'
  | 'graphite'
  | 'ocean'
  | 'emerald'
  | 'purple'

export type Density = 'compact' | 'comfortable' | 'spacious'
export type Radius = 'sm' | 'md' | 'lg' | 'xl'
export type FontFamily = 'jakarta' | 'inter' | 'roboto' | 'system'
export type SidebarStyle = 'light' | 'dark' | 'navy'
export type ColorMode = 'light' | 'dark' | 'system'

export type ThemePreset = {
  id: ThemeId
  name: string
  subtitle: string
  accentColor: string
  accentHover: string
  accentSoft: string
  navyColor: string
  darkDefault?: boolean
  description: string
  palette: string[]
}

export type ThemeConfig = {
  themeId: ThemeId
  mode: ColorMode
  density: Density
  radius: Radius
  font: FontFamily
  sidebar: SidebarStyle
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'signature',
    name: 'GoFox Signature',
    subtitle: 'Original Enterprise SaaS',
    accentColor: '#FF7417',
    accentHover: '#F36609',
    accentSoft: '#FFF4EB',
    navyColor: '#152238',
    description: 'Crisp white canvas, deep navy typography, and refined GoFox orange high-converting accents.',
    palette: ['#FF7417', '#152238', '#FFFFFF', '#F8F9FB', '#059669'],
  },
  {
    id: 'zoho',
    name: 'Zoho Inspired',
    subtitle: 'Clean & Productive CRM',
    accentColor: '#2563EB',
    accentHover: '#1D4ED8',
    accentSoft: '#EFF6FF',
    navyColor: '#1E3A8A',
    description: 'Crisp white surfaces with subtle blue and orange accents for maximum data readability.',
    palette: ['#2563EB', '#F97316', '#FFFFFF', '#F4F6FA', '#10B981'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce Inspired',
    subtitle: 'Lightning Enterprise',
    accentColor: '#0176D3',
    accentHover: '#014486',
    accentSoft: '#EEF4FF',
    navyColor: '#032D60',
    description: 'Classic enterprise blue and high-contrast slate borders built for heavy CRM operations.',
    palette: ['#0176D3', '#032D60', '#FFFFFF', '#F3F5F9', '#2E844A'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot Inspired',
    subtitle: 'Marketing & Inbound',
    accentColor: '#FF5C35',
    accentHover: '#E04B28',
    accentSoft: '#FFF1EE',
    navyColor: '#2E475D',
    description: 'Vibrant coral accents with dark navy typography and warm, welcoming card surfaces.',
    palette: ['#FF5C35', '#2E475D', '#FFFFFF', '#F5F8FA', '#00A389'],
  },
  {
    id: 'midnight',
    name: 'Midnight Pro',
    subtitle: 'Dark Mode Specialist',
    accentColor: '#6366F1',
    accentHover: '#4F46E5',
    accentSoft: '#1E1B4B',
    navyColor: '#0F172A',
    darkDefault: true,
    description: 'Deep obsidian and indigo dark workspace engineered for reduced eye strain and modern aesthetics.',
    palette: ['#6366F1', '#0F172A', '#1E293B', '#090D16', '#38BDF8'],
  },
  {
    id: 'graphite',
    name: 'Graphite Enterprise',
    subtitle: 'Linear-Inspired Monolith',
    accentColor: '#A1A1AA',
    accentHover: '#E4E4E7',
    accentSoft: '#27272A',
    navyColor: '#18181B',
    darkDefault: true,
    description: 'Sophisticated charcoal, zinc, and silver palette with ultra-refined border lines.',
    palette: ['#E4E4E7', '#18181B', '#27272A', '#71717A', '#10B981'],
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    subtitle: 'Calm Strategic Intelligence',
    accentColor: '#0284C7',
    accentHover: '#0369A1',
    accentSoft: '#F0F9FF',
    navyColor: '#0C4A6E',
    description: 'Invigorating sky and deep ocean blues designed for high-focus pipelines and deals.',
    palette: ['#0284C7', '#0C4A6E', '#FFFFFF', '#F0F9FF', '#0D9488'],
  },
  {
    id: 'emerald',
    name: 'Emerald Workspace',
    subtitle: 'Revenue & Growth Engine',
    accentColor: '#059669',
    accentHover: '#047857',
    accentSoft: '#ECFDF5',
    navyColor: '#064E3B',
    description: 'Fresh botanical emerald and mint accents symbolizing revenue milestones and conversions.',
    palette: ['#059669', '#064E3B', '#FFFFFF', '#F2FBF7', '#3B82F6'],
  },
  {
    id: 'purple',
    name: 'Purple Innovation',
    subtitle: 'AI & Automation Suite',
    accentColor: '#7C3AED',
    accentHover: '#6D28D9',
    accentSoft: '#F5F3FF',
    navyColor: '#4C1D95',
    description: 'Creative violet and electric purple tailored for generative AI features and creative studios.',
    palette: ['#7C3AED', '#4C1D95', '#FFFFFF', '#FAF5FF', '#EC4899'],
  },
]

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  themeId: 'gofox',
  mode: 'light',
  density: 'comfortable',
  radius: 'lg',
  font: 'jakarta',
  sidebar: 'light',
}

const STORAGE_KEY = 'gofox:theme_engine_config'

export function loadSavedThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME_CONFIG
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>
    return {
      themeId: parsed.themeId ?? DEFAULT_THEME_CONFIG.themeId,
      mode: parsed.mode ?? DEFAULT_THEME_CONFIG.mode,
      density: parsed.density ?? DEFAULT_THEME_CONFIG.density,
      radius: parsed.radius ?? DEFAULT_THEME_CONFIG.radius,
      font: parsed.font ?? DEFAULT_THEME_CONFIG.font,
      sidebar: parsed.sidebar ?? DEFAULT_THEME_CONFIG.sidebar,
    }
  } catch {
    return DEFAULT_THEME_CONFIG
  }
}

export function saveThemeConfig(config: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* storage quota / blocked */
  }
}

export function applyThemeToDom(config: ThemeConfig): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Set data attributes
  root.setAttribute('data-theme', config.themeId)
  root.setAttribute('data-density', config.density)
  root.setAttribute('data-radius', config.radius)
  root.setAttribute('data-font', config.font)
  root.setAttribute('data-sidebar', config.sidebar)

  // Color mode resolution
  let isDark = false
  if (config.mode === 'dark') {
    isDark = true
  } else if (config.mode === 'system') {
    isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } else {
    // If theme preset is naturally dark (midnight or graphite) and mode is light, check preset
    const preset = THEME_PRESETS.find((p) => p.id === config.themeId)
    if (preset?.darkDefault && config.mode !== 'light') {
      isDark = true
    }
  }

  root.classList.toggle('dark', isDark)
}
