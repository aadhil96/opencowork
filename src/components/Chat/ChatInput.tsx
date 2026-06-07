import { useRef, useState } from 'react'
import { useAppStore } from '../../lib/store'
import { streamChatCompletion, AVAILABLE_MODELS } from '../../lib/openrouter'
import { getActiveTools, buildChatSystemPrompt, buildResearchSystemPrompt, executeAgentTool, detectSubAgent } from '../../lib/agent'
import { useFileUpload } from '../../lib/useFileUpload'
import type { Message } from '../../types'

const QUICK_ACTIONS = [
  { label: 'Summarize',     prompt: 'Summarize this document using the summarize_document tool.' },
  { label: 'Flag Risks',    prompt: 'Identify all risks from a general perspective using the identify_risks tool.' },
  { label: 'Key Clauses',   prompt: 'Extract indemnification, termination, and payment clauses.' },
  { label: 'Plain English', prompt: 'Rewrite the main obligations in plain, easy-to-understand English.' }
]

const DOC_BADGE_COLORS: Record<string, string> = {
  pdf:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  doc:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  txt:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function PaperclipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

export default function ChatInput() {
  const {
    addMessage, appendToLastMessage, setStreaming, isStreaming,
    settings, getActiveDocument, activeMessages, panelMode,
    renameSession, activeSession, removeDocument
  } = useAppStore()

  const { openFile, isLoading: isUploading } = useFileUpload()

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
    const autoAgentId = panelMode === 'chat'
      ? detectSubAgent(text, currentDoc?.name)
      : undefined
    const systemPrompt = panelMode === 'chat'
      ? buildChatSystemPrompt(currentDoc, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, autoAgentId)
      : buildResearchSystemPrompt(settings.jurisdiction, settings.systemPromptExtra)

    await streamChatCompletion(
      settings.openrouterApiKey,
      settings.selectedModel || AVAILABLE_MODELS[0].id,
      [...activeMessages(), userMsg],
      systemPrompt,
      panelMode === 'chat' ? getActiveTools(settings) : [],
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

      {/* Quick actions (doc loaded) */}
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

      {/* Document attachment chip */}
      {panelMode === 'chat' && (
        <div className="mb-2 flex items-center gap-2 min-h-[28px]">
          {isUploading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-c-surface border border-c-border animate-pulse">
              <span className="text-[11px] text-c-text3">Processing document…</span>
            </div>
          ) : doc ? (
            <div className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-c-surface border border-c-border max-w-full min-w-0 animate-fade-in">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase flex-shrink-0 ${DOC_BADGE_COLORS[doc.ext.toLowerCase()] ?? DOC_BADGE_COLORS.txt}`}>
                {doc.ext.toUpperCase()}
              </span>
              <span className="text-[12px] text-c-text2 truncate min-w-0 flex-1">{doc.name}</span>
              <button
                onClick={openFile}
                disabled={isUploading}
                title="Replace document"
                className="text-[10px] text-c-text4 hover:text-c-text3 px-1.5 py-0.5 rounded hover:bg-c-elevated transition-colors flex-shrink-0"
              >
                Replace
              </button>
              <button
                onClick={removeDocument}
                title="Remove document"
                className="text-c-text4 hover:text-red-400 transition-colors text-base leading-none flex-shrink-0 pr-0.5"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={openFile}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-c-text4 hover:text-c-text3 hover:bg-c-surface border border-dashed border-c-border transition-colors"
            >
              <PaperclipIcon />
              Attach document
            </button>
          )}
        </div>
      )}

      {/* Input box */}
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
              : doc
                ? `Ask about "${doc.name}"…`
                : 'Ask a legal question…'
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
