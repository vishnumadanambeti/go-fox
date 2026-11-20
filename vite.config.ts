import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The cloud preview proxy reaches the dev server through its own hostname.
// Only that exact host is allowed, alongside loopback for local checks.
const previewHost = process.env.PREVIEW_HOST

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Sites caps each uploaded asset at 1 MB, so vendor code is split into its own files
        // instead of being inlined into the application entry chunk.
        manualChunks(id: string) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons'
          if (id.includes('node_modules/@xyflow')) return 'vendor-flow'
          if (id.includes('node_modules/@dnd-kit')) return 'vendor-dnd'
          if (id.includes('node_modules/grapesjs')) return 'vendor-grapes'
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-motion'
          return undefined
        },
      },
    },
  },
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    port: 3001,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: [previewHost, 'localhost', '127.0.0.1'].filter((host): host is string => Boolean(host)),
  },
})
