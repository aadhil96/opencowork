import type { Message, AgentTool, Settings } from '../types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// Max agent rounds (tool call → result → next request) before forcing a stop.
const MAX_TOOL_ROUNDS = 6

export const AVAILABLE_MODELS = [
  // Free models
  { id: 'openai/gpt-oss-120b:free',               label: 'GPT OSS 120B (Free)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',  label: 'Llama 3.1 8B (Free)' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free',  label: 'Llama 3.2 3B (Free)' },
  { id: 'mistralai/mistral-7b-instruct:free',      label: 'Mistral 7B (Free)' },
  { id: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1 (Free)' },
  { id: 'google/gemma-2-9b-it:free',               label: 'Gemma 2 9B (Free)' },
  // Paid models
  { id: 'anthropic/claude-3.5-sonnet',  label: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-haiku',     label: 'Claude 3 Haiku' },
  { id: 'openai/gpt-4o',               label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini',          label: 'GPT-4o Mini' },
  { id: 'google/gemini-pro-1.5',       label: 'Gemini Pro 1.5' },
  { id: 'mistralai/mistral-large',     label: 'Mistral Large' }
]

// Resolve which model + endpoint to use. A configured custom baseUrl (Ollama,
// LM Studio, self-hosted) takes precedence over the OpenRouter model picker.
export function resolveModel(settings: Settings): { model: string; baseUrl?: string } {
  if (settings.baseUrl?.trim()) {
    return { model: settings.customModel?.trim() || 'local-model', baseUrl: settings.baseUrl.trim() }
  }
  return { model: settings.selectedModel || AVAILABLE_MODELS[0].id }
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onToolCall?: (name: string, input: Record<string, unknown>) => Promise<string>
  onDone: () => void
  onError: (err: string) => void
}

type ApiMessage = {
  role: string
  content: string | null
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

type ToolCall = { id: string; name: string; args: string }

function buildApiMessages(messages: Message[], systemPrompt: string): ApiMessage[] {
  const result: ApiMessage[] = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    // Skip empty assistant placeholders — they're UI-only and some providers reject them.
    if (m.role === 'assistant' && m.content === '') continue
    result.push({ role: m.role, content: m.content })
  }
  return result
}

function makeRequestBody(
  model: string,
  messages: ApiMessage[],
  tools: AgentTool[]
): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, stream: true, max_tokens: 4096 }
  if (tools.length > 0) { body.tools = tools; body.tool_choice = 'auto' }
  return body
}

// Streams one response. Returns any tool calls the model emitted (empty if it answered directly).
async function streamOnce(
  apiKey: string,
  model: string,
  baseUrl: string,
  messages: ApiMessage[],
  tools: AgentTool[],
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<{ toolCalls: ToolCall[]; error?: string }> {

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      // Local servers (Ollama/LM Studio) ignore auth; send a placeholder so the header is well-formed.
      Authorization: `Bearer ${apiKey || 'local'}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://opencowork.app',
      'X-Title': 'OpenCowork'
    },
    body: JSON.stringify(makeRequestBody(model, messages, tools)),
    signal
  })

  if (!response.ok) {
    const err = await response.text()
    return { toolCalls: [], error: `API error ${response.status}: ${err}` }
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  // Tool calls arrive as deltas keyed by index — name in the first delta, arguments streamed after.
  const byIndex: Record<number, ToolCall> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') break

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) onChunk(delta.content)

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            const cur = byIndex[idx] ?? (byIndex[idx] = { id: '', name: '', args: '' })
            if (tc.id) cur.id = tc.id
            if (tc.function?.name) cur.name += tc.function.name
            if (tc.function?.arguments) cur.args += tc.function.arguments
          }
        }
      } catch { /* skip malformed lines */ }
    }
  }

  const toolCalls = Object.keys(byIndex)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => byIndex[Number(k)])
    .filter(tc => tc.name)
  toolCalls.forEach((tc, i) => { if (!tc.id) tc.id = `call_${i}` })

  return { toolCalls }
}

// Non-streaming, short completion that turns the first user message + assistant
// response into a 3-6 word session title for the sidebar. Cheap and best-effort:
// failures return null so the caller falls back to the existing placeholder name.
export async function generateTitle(
  apiKey: string,
  model: string,
  userMessage: string,
  assistantResponse: string,
  options?: { baseUrl?: string }
): Promise<string | null> {
  const baseUrl = options?.baseUrl?.trim() || OPENROUTER_BASE
  const isLocal = baseUrl !== OPENROUTER_BASE
  if (!apiKey && !isLocal) return null

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey || 'local'}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://opencowork.app',
        'X-Title': 'OpenCowork'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You write very short chat titles. Output ONLY the title — 3 to 6 words, no quotes, no trailing punctuation, no preamble. Describe the conversation topic.' },
          { role: 'user', content: `User: ${userMessage.slice(0, 600)}\n\nAssistant: ${assistantResponse.slice(0, 800)}\n\nTitle:` }
        ],
        max_tokens: 24,
        temperature: 0.3,
        stream: false
      })
    })
    if (!res.ok) return null
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) return null
    // Sanitize: strip wrapping quotes/asterisks, trailing punctuation, collapse whitespace, length cap.
    const cleaned = raw
      .replace(/^[\s"'`*_]+|[\s"'`*_.]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 60)
    return cleaned || null
  } catch {
    return null
  }
}

export async function streamChatCompletion(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  tools: AgentTool[],
  callbacks: StreamCallbacks,
  options?: { signal?: AbortSignal; baseUrl?: string }
): Promise<void> {
  const baseUrl = options?.baseUrl?.trim() || OPENROUTER_BASE
  const isLocal = baseUrl !== OPENROUTER_BASE

  // OpenRouter requires a key; local/self-hosted endpoints don't.
  if (!apiKey && !isLocal) {
    callbacks.onError('No OpenRouter API key configured. Open Settings to add your key.')
    return
  }

  try {
    const apiMessages = buildApiMessages(messages, systemPrompt)
    const canUseTools = tools.length > 0 && !!callbacks.onToolCall

    // Agentic loop: keep streaming until the model answers without requesting a tool.
    let answered = false
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { toolCalls, error } = await streamOnce(
        apiKey, model, baseUrl, apiMessages, canUseTools ? tools : [], callbacks.onChunk, options?.signal
      )
      if (error) { callbacks.onError(error); return }
      if (toolCalls.length === 0 || !callbacks.onToolCall) { answered = true; break }

      // Record the assistant's tool request, then run each tool and append its result.
      apiMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args || '{}' }
        }))
      })

      for (const tc of toolCalls) {
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(tc.args || '{}') } catch { /* keep empty */ }
        const result = await callbacks.onToolCall(tc.name, parsed)
        apiMessages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
    }

    // If we exhausted the tool-round budget while the model was still calling
    // tools, force one final pass WITHOUT tools so it synthesizes an actual
    // answer instead of ending on an empty, tool-only turn.
    if (!answered) {
      const { error } = await streamOnce(
        apiKey, model, baseUrl, apiMessages, [], callbacks.onChunk, options?.signal
      )
      if (error) { callbacks.onError(error); return }
    }

    callbacks.onDone()
  } catch (err) {
    // Aborts (user pressed Stop) are a graceful end, not an error.
    if (err instanceof Error && err.name === 'AbortError') { callbacks.onDone(); return }
    callbacks.onError(err instanceof Error ? err.message : 'Network error')
  }
}
