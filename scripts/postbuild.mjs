// Post-processes the build output for Freebuff Sites:
//  1. Bundles the Worker entry into a single ESM file (Sites uploads only the modules listed in
//     deploy.json, so split chunks would be missing at runtime and Cloudflare returns 10021).
//  2. Strips files the Sites uploader refuses (hidden files and source maps).
import { execFileSync } from 'node:child_process'
import { copyFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')

function clean(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name.startsWith('.') || name.endsWith('.map')) {
      rmSync(path, { recursive: true, force: true })
      continue
    }
    if (statSync(path).isDirectory()) clean(path)
  }
}

const entry = join(dist, 'gofox_crm', 'index.js')
const bundled = join(dist, 'worker.js')

try {
  execFileSync('bun', ['build', entry, '--outfile', bundled, '--format', 'esm', '--target', 'browser'], {
    stdio: 'inherit',
    cwd: root,
  })
} catch {
  // Fallback to esbuild if bun is not present in the environment
  const esbuild = await import('esbuild')
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: bundled,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
  })
}

clean(dist)
console.log('postbuild: dist/worker.js ready')

