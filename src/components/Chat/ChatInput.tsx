import { useRef, useState } from 'react'
import { useAppStore } from '../../lib/store'
import { streamChatCompletion, AVAILABLE_MODELS } from '../../lib/openrouter'
import { LEGAL_TOOLS, buildChatSystemPrompt, buildResearchSystemPrompt, executeAgentTool } from '../../lib/agent'
import type { Message } from '../../types'

const QUICK_ACTIONS = [
  { label: 'Summarize',    prompt: 'Summarize this document using the summarize_document tool.' },
  { label: 'Flag Risks',   prompt: 'Identify all risks from a general perspective using the identify_risks tool.' },
  { label: 'Key Clauses',  prompt: 'Extract indemnification, termination, and payment clauses.' },
  { label: 'Plain English', prompt: 'Rewrite the main obligations in plain, easy-to-understand English.' }
]

export default function ChatInput() {
  const {
    addMessage, appendToLastMessage, setStreaming, isStreaming,
    settings, getActiveDocument, activeMessages, panelMode,
    renameSession, activeSession
  } = useAppStore()

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const doc = getActiveDocument()
  const showQuickActions = panelMode === 'chat' && !!doc

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  async function submit(text: string) {
    if (!text.trim() || isStreaming) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const session = activeSession()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now(), mode: panelMode }
    addMessage(userMsg)

    if (session && session.messages.length === 0 && session.name === 'New Chat') {
      renameSession(session.id, text.slice(0, 40) + (text.length > 40 ? '…' : ''))
    }

    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), mode: panelMode }
    addMessage(assistantMsg)
    setStreaming(true)

    const currentDoc = getActiveDocument()
    const systemPrompt = panelMode === 'chat'
      ? buildChatSystemPrompt(currentDoc, settings.systemPromptExtra)
      : buildResearchSystemPrompt(settings.systemPromptExtra)

    await streamChatCompletion(
      settings.openrouterApiKey,
      settings.selectedModel || AVAILABLE_MODELS[0].id,
      [...activeMessages(), userMsg],
      systemPrompt,
      panelMode === 'chat' ? LEGAL_TOOLS : [],
      {
        onChunk: (chunk) => appendToLastMessage(chunk),
        onToolCall: async (name, input) => executeAgentTool(name, input, currentDoc),
        onDone: () => setStreaming(false),
        onError: (err) => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      }
    )
  }

  return (
    <div className="flex-shrink-0 px-4 pb-6 pt-2 max-w-3xl mx-auto w-full">
      {showQuickActions && (
        <div className="flex gap-2 flex-wrap mb-3">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => submit(a.prompt)}
              disabled={isStreaming}
              className="px-3 py-1.5 rounded-full text-xs bg-c-elevated text-c-text2 hover:text-c-text hover:bg-c-input disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-c-border"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-end bg-c-input rounded-2xl border border-c-border focus-within:border-c-text4 transition-colors shadow-sm">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize() }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.trim()) }
          }}
          placeholder={
            panelMode === 'research'
              ? 'Ask a legal research question…'
              : doc ? `Ask about "${doc.name}"…` : 'Ask a legal question or attach a document…'
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent px-4 py-3.5 pr-20 text-[15px] text-c-text placeholder-c-text4 outline-none resize-none disabled:opacity-60 max-h-[200px] overflow-y-auto"
        />
        <button
          onClick={() => submit(input.trim())}
          disabled={!input.trim() || isStreaming}
          className="absolute right-3 bottom-2.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          {isStreaming ? 'Stop' : 'Send'}
        </button>
      </div>

      <p className="text-center text-[11px] text-c-text4 mt-2">
        {settings.selectedModel?.split('/')[1] ?? 'Select a model'} · ⏎ send · ⇧⏎ newline
      </p>
    </div>
  )
}
