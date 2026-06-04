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

function buildApiMessages(messages: Message[], systemPrompt: string) {
  const result: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt }
  ]
  for (const m of messages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((m.role as any) === 'tool') continue
    result.push({ role: m.role, content: m.content })
  }
  return result
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

  const body: Record<string, unknown> = {
    model,
    messages: buildApiMessages(messages, systemPrompt),
    stream: true,
    max_tokens: 4096
  }

  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://opencowork.app',
        'X-Title': 'OpenCowork'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const err = await response.text()
      callbacks.onError(`API error ${response.status}: ${err}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let toolCallBuffer: { id: string; name: string; args: string } | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          if (toolCallBuffer && callbacks.onToolCall) {
            const parsed = JSON.parse(toolCallBuffer.args || '{}')
            const result = await callbacks.onToolCall(toolCallBuffer.name, parsed)
            callbacks.onChunk(`\n\n*Tool result:* ${result}`)
          }
          callbacks.onDone()
          return
        }

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            callbacks.onChunk(delta.content)
          }

          if (delta.tool_calls?.[0]) {
            const tc = delta.tool_calls[0]
            if (tc.function?.name) {
              toolCallBuffer = { id: tc.id || '', name: tc.function.name, args: '' }
            }
            if (tc.function?.arguments && toolCallBuffer) {
              toolCallBuffer.args += tc.function.arguments
            }
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : 'Network error')
  }
}
