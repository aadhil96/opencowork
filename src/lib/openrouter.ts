import type { Message, AgentTool } from '../types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

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

function buildApiMessages(messages: Message[], systemPrompt: string): ApiMessage[] {
  const result: ApiMessage[] = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((m.role as any) === 'tool') continue
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

// Streams one response. Returns the tool call if the model invoked one, otherwise null.
async function streamOnce(
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  tools: AgentTool[],
  onChunk: (text: string) => void
): Promise<{ toolCall: { id: string; name: string; args: string } | null; error?: string }> {

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://opencowork.app',
      'X-Title': 'OpenCowork'
    },
    body: JSON.stringify(makeRequestBody(model, messages, tools))
  })

  if (!response.ok) {
    const err = await response.text()
    return { toolCall: null, error: `API error ${response.status}: ${err}` }
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let toolCall: { id: string; name: string; args: string } | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) onChunk(delta.content)

        if (delta.tool_calls?.[0]) {
          const tc = delta.tool_calls[0]
          if (tc.function?.name) {
            toolCall = { id: tc.id || 'call_0', name: tc.function.name, args: '' }
          }
          if (tc.function?.arguments && toolCall) {
            toolCall.args += tc.function.arguments
          }
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return { toolCall }
}

export async function streamChatCompletion(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  tools: AgentTool[],
  callbacks: StreamCallbacks
): Promise<void> {
  if (!apiKey) {
    callbacks.onError('No OpenRouter API key configured. Open Settings to add your key.')
    return
  }

  try {
    const apiMessages = buildApiMessages(messages, systemPrompt)

    // --- Round 1: initial request ---
    const round1 = await streamOnce(apiKey, model, apiMessages, tools, callbacks.onChunk)

    if (round1.error) { callbacks.onError(round1.error); return }

    // --- Tool call detected: execute and do a second request ---
    if (round1.toolCall && callbacks.onToolCall) {
      const tc = round1.toolCall
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(tc.args || '{}') } catch { /* keep empty */ }

      const toolResult = await callbacks.onToolCall(tc.name, parsed)

      // Build messages for round 2: add the assistant tool_call + the tool result
      const round2Messages: ApiMessage[] = [
        ...apiMessages,
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args || '{}' } }]
        },
        {
          role: 'tool',
          content: toolResult,
          tool_call_id: tc.id
        }
      ]

      // Stream the final answer (no tools — force a text response)
      const round2 = await streamOnce(apiKey, model, round2Messages, [], callbacks.onChunk)
      if (round2.error) { callbacks.onError(round2.error); return }
    }

    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : 'Network error')
  }
}
