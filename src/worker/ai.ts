import type { Env } from './db'
import { jsonParse } from './db'

/**
 * AI provider abstraction.
 *
 * Credentials live only in Worker secrets, never in the client bundle and never in D1. The
 * integration row chooses *which* provider to use; the secret store supplies the key. When either
 * is missing the caller falls back to rules-based answers and says so, rather than pretending a
 * model answered.
 */

export type AiProviderId = 'openai' | 'anthropic' | 'azure-openai'

type ProviderSpec = {
  id: AiProviderId
  label: string
  secretName: string
  defaultModel: string
  endpoint: (env: Env) => string
  buildRequest: (args: BuildArgs) => { headers: Record<string, string>; body: unknown }
  readReply: (data: unknown) => string | null
}

type BuildArgs = {
  apiKey: string
  model: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export type ResolvedProvider = {
  id: AiProviderId
  label: string
  model: string
  apiKey: string
  spec: ProviderSpec
}

const openAiCompatible = (endpoint: string, extraHeaders: Record<string, string> = {}) => ({
  headers: { 'Content-Type': 'application/json', ...extraHeaders },
  endpoint,
})

const SPECS: Record<AiProviderId, ProviderSpec> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    secretName: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    endpoint: () => 'https://api.openai.com/v1/chat/completions',
    buildRequest: ({ apiKey, model, system, messages }) => ({
      headers: { ...openAiCompatible('', { Authorization: `Bearer ${apiKey}` }).headers },
      body: {
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature: 0.4,
        max_tokens: 700,
      },
    }),
    readReply: (data) => {
      const parsed = data as { choices?: { message?: { content?: string } }[] }
      return parsed.choices?.[0]?.message?.content?.trim() ?? null
    },
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    secretName: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-haiku-latest',
    endpoint: () => 'https://api.anthropic.com/v1/messages',
    buildRequest: ({ apiKey, model, system, messages }) => ({
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: { model, system, max_tokens: 700, messages },
    }),
    readReply: (data) => {
      const parsed = data as { content?: { type: string; text?: string }[] }
      const block = parsed.content?.find((part) => part.type === 'text')
      return block?.text?.trim() ?? null
    },
  },
  'azure-openai': {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    secretName: 'AZURE_OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    endpoint: (env) => {
      const base = String((env as unknown as { AZURE_OPENAI_ENDPOINT?: string }).AZURE_OPENAI_ENDPOINT ?? '').replace(/\/$/, '')
      return base ? `${base}/openai/deployments/${String((env as unknown as { AZURE_OPENAI_DEPLOYMENT?: string }).AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini')}/chat/completions?api-version=2024-06-01` : ''
    },
    buildRequest: ({ apiKey, system, messages }) => ({
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: { messages: [{ role: 'system', content: system }, ...messages], temperature: 0.4, max_tokens: 700 },
    }),
    readReply: (data) => {
      const parsed = data as { choices?: { message?: { content?: string } }[] }
      return parsed.choices?.[0]?.message?.content?.trim() ?? null
    },
  },
}

/** Reads the connected AI integration for this org and joins it with the Worker secret. */
export async function resolveProvider(env: Env, orgId: string): Promise<ResolvedProvider | null> {
  const rows = await env.DB.prepare(
    "SELECT provider, status, config FROM integrations WHERE org_id = ? AND status = 'connected' AND provider IN ('openai','anthropic','azure-openai')",
  )
    .bind(orgId)
    .all<{ provider: string; status: string; config: string | null }>()
  for (const row of rows.results ?? []) {
    const id = row.provider as AiProviderId
    const spec = SPECS[id]
    if (!spec) continue
    let apiKey = String((env as unknown as Record<string, unknown>)[spec.secretName] ?? '').trim()
    if (!apiKey) {
      // Keys entered in Connected Apps are stored server-side and were verified before saving.
      const token = await env.DB.prepare('SELECT access_token FROM integration_tokens WHERE org_id = ? AND provider = ?')
        .bind(orgId, id)
        .first<{ access_token: string }>()
      apiKey = String(token?.access_token ?? '').trim()
    }
    if (!apiKey) continue
    const config = jsonParse<Record<string, unknown>>(row.config ?? '{}', {})
    const model = String(config.model ?? spec.defaultModel)
    return { id, label: spec.label, model, apiKey, spec }
  }
  return null
}

/** Provider/model/secret status for the settings screen — never returns the key itself. */
export async function providerStatus(env: Env, orgId: string) {
  const rows = await env.DB.prepare(
    "SELECT provider, status, config FROM integrations WHERE org_id = ? AND provider IN ('openai','anthropic','azure-openai')",
  )
    .bind(orgId)
    .all<{ provider: string; status: string; config: string | null }>()
  const out = []
  for (const row of rows.results ?? []) {
    const spec = SPECS[row.provider as AiProviderId]
    const config = jsonParse<Record<string, unknown>>(row.config ?? '{}', {})
    const envKey = Boolean(spec && (env as unknown as Record<string, unknown>)[spec.secretName])
    let storedKey = false
    if (spec) {
      const token = await env.DB.prepare('SELECT id FROM integration_tokens WHERE org_id = ? AND provider = ?')
        .bind(orgId, row.provider)
        .first<{ id: string }>()
      storedKey = Boolean(token)
    }
    const keyPresent = envKey || storedKey
    out.push({
      provider: row.provider,
      label: spec?.label ?? row.provider,
      status: row.status,
      model: String(config.model ?? spec?.defaultModel ?? ''),
      secretName: spec?.secretName ?? '',
      secretPresent: keyPresent,
      keySource: envKey ? 'worker_secret' : storedKey ? 'connected_apps' : null,
      ready: row.status === 'connected' && Boolean(spec) && keyPresent,
    })
  }
  return out
}

export type AiResult = { ok: true; text: string; model: string; provider: string } | { ok: false; error: string; status: number }

/** Calls the provider with a hard timeout so a slow model can never hang a Worker request. */
export async function generateReply(
  env: Env,
  provider: ResolvedProvider,
  args: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; timeoutMs?: number },
): Promise<AiResult> {
  const endpoint = provider.spec.endpoint(env)
  if (!endpoint) return { ok: false, error: 'The provider endpoint is not configured.', status: 502 }
  const request = provider.spec.buildRequest({
    apiKey: provider.apiKey,
    model: provider.model,
    system: args.system,
    messages: args.messages,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 20_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      const reason =
        response.status === 401 ? 'the API key was rejected'
        : response.status === 429 ? 'the provider rate-limited the request'
        : response.status === 404 ? 'the model or deployment was not found'
        : `the provider returned ${response.status}`
      return { ok: false, error: `${provider.label}: ${reason}. ${text.slice(0, 160)}`.trim(), status: response.status }
    }
    const data = await response.json()
    const text = provider.spec.readReply(data)
    if (!text) return { ok: false, error: `${provider.label} returned an empty response.`, status: 502 }
    return { ok: true, text, model: provider.model, provider: provider.id }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      error: aborted ? `${provider.label} timed out after ${Math.round((args.timeoutMs ?? 20_000) / 1000)}s.` : `${provider.label} is unreachable: ${error instanceof Error ? error.message : 'unknown error'}.`,
      status: aborted ? 504 : 502,
    }
  } finally {
    clearTimeout(timer)
  }
}
