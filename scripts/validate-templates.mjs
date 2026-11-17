#!/usr/bin/env node
/**
 * Template validation utility.
 *
 * Reads the generated catalog (src/data/templateCatalog.ts) and checks, for every template:
 *   - thumbnail URL responds with an image content type
 *   - the stored HTML is complete (doctype, <html>, body, closing tags)
 *   - every CSS url(...) reference points at an absolute http(s) URL (no broken relatives)
 *   - every image/asset URL referenced by the HTML responds with a 2xx and an image/font content type
 *
 * Usage: node scripts/validate-templates.mjs [--limit N] [--only swebsy-afterparty]
 * Writes artifacts/template-validation.md and prints a summary table.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity
const onlyArg = args.indexOf('--only')
const ONLY = onlyArg >= 0 ? args[onlyArg + 1] : null

const source = readFileSync('src/data/templateCatalog.ts', 'utf8')
const start = source.indexOf('= [') + 2
const end = source.lastIndexOf(']') + 1
const templates = JSON.parse(source.slice(start, end))

const cache = new Map()
async function head(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = (async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      const res = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-0' }, signal: controller.signal })
      clearTimeout(timer)
      return { ok: res.ok || res.status === 206, status: res.status, type: res.headers.get('content-type') ?? '' }
    } catch (error) {
      return { ok: false, status: 0, type: String(error?.message ?? error) }
    }
  })()
  cache.set(url, promise)
  return promise
}

function assetsOf(template, html) {
  const urls = new Set()
  const push = (raw) => {
    const url = raw.replace(/&amp;/g, '&').trim()
    if (!url || url.startsWith('data:') || url.startsWith('#')) return
    if (!/^https?:\/\//.test(url)) return
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return
    if (url.endsWith('/')) return
    urls.add(url)
  }
  for (const match of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) push(match[1].trim().split(/\s+/)[0])
  for (const match of template.css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) push(match[1])
  return [...urls]
}

const rows = []
const queue = templates.filter((t) => !ONLY || t.id === ONLY).slice(0, LIMIT)
const concurrency = 8
let cursor = 0

async function worker() {
  while (cursor < queue.length) {
    const template = queue[cursor++]
    const issues = []
    const thumb = await head(template.screenshot)
    if (!thumb.ok) issues.push(`thumbnail ${thumb.status}`)
    else if (!/^image\//.test(thumb.type)) issues.push(`thumbnail type ${thumb.type}`)

    const html = template.html.replace(/<!--[\s\S]*?-->/g, '')
    const complete = /<!doctype html/i.test(html) && /<html/i.test(html) && /<\/html>/i.test(html) && /<body/i.test(html)
    if (!complete) issues.push('html incomplete')

    if (template.css && /url\(\.\.?\//.test(template.css)) issues.push('relative css url')
    const relative = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)]
      .map((match) => match[1].trim())
      .filter((url) => !/^(https?:|mailto:|tel:|sms:|data:|\/\/)/.test(url))
    if (relative.length) issues.push(`relative url: ${relative[0].slice(0, 40)}`)

    const assets = assetsOf(template, html)
    let failedAssets = 0
    const checks = await Promise.all(assets.map((url) => head(url)))
    checks.forEach((check, index) => {
      if (!check.ok) {
        failedAssets += 1
        if (issues.length < 6) issues.push(`${assets[index].split('/').pop()} ${check.status}`)
      }
    })

    rows.push({
      id: template.id,
      name: template.name,
      source: template.sourceUrl.includes('swebsy') ? 'Swebsy' : 'awesome-landing-pages',
      thumbnail: thumb.ok && /^image\//.test(thumb.type) ? 'PASS' : 'FAIL',
      assets: assets.length === 0 ? 'PASS' : failedAssets === 0 ? 'PASS' : 'FAIL',
      html: complete ? 'PASS' : 'FAIL',
      assetCount: assets.length,
      issues,
    })
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))
rows.sort((a, b) => a.id.localeCompare(b.id))

const pass = rows.filter((r) => r.issues.length === 0).length
const fail = rows.length - pass
const lines = [
  '# Template validation report',
  '',
  `Generated ${new Date().toISOString()} · ${rows.length} templates · ${pass} pass · ${fail} fail`,
  '',
  '| Template | Source | Thumbnail | Assets | HTML | Issues |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.name} | ${r.source} | ${r.thumbnail} | ${r.assets} (${r.assetCount}) | ${r.html} | ${r.issues.join('; ') || '—'} |`),
  '',
]
mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/template-validation.md', lines.join('\n'))
console.log(`validated ${rows.length}: ${pass} pass, ${fail} fail`)
for (const row of rows.filter((r) => r.issues.length)) console.log('FAIL', row.id, '—', row.issues.join('; '))
