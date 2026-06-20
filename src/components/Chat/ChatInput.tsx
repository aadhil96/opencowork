import { useRef, useState } from 'react'
import { useAppStore } from '../../lib/store'
import { streamChatCompletion, resolveModel } from '../../lib/openrouter'
import { maybeGenerateSessionTitle } from '../../lib/titles'
import { getActiveTools, buildChatSystemPrompt, buildResearchSystemPrompt, buildDeepResearchSystemPrompt, executeAgentTool, detectSubAgent } from '../../lib/agent'
import { useFileUpload } from '../../lib/useFileUpload'
import JurisdictionPicker from './JurisdictionPicker'
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export default function ChatInput() {
  const {
    addMessage, appendToLastMessage, setStreaming, startStreaming, stopStreaming, isStreaming,
    settings, mcpTools, getActiveDocument, getActiveDocuments, activeMessages, panelMode,
    renameSession, activeSession, removeDocument, getActiveProject
  } = useAppStore()

  const { openFile, isLoading: isUploading } = useFileUpload()

  const [input, setInput] = useState('')
  // When on, the next message uses CourtListener-backed search + verify_citation
  // and a strict no-fabrication system prompt. Persists until toggled off.
  const [deepResearch, setDeepResearch] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const doc = getActiveDocument()
  const docs = getActiveDocuments()
  const showQuickActions = panelMode === 'chat' && !!doc && !deepResearch

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
    // First-turn capture: used after streaming to kick off LLM-based titling.
    const isFirstTurn = !!(session && session.messages.length === 0)
    const firstTurnSessionId = isFirstTurn ? session!.id : null
    // Snapshot the conversation before adding the new turn so we don't duplicate
    // the user message or send the empty assistant placeholder to the API.
    const history = activeMessages()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now(), mode: panelMode }
    addMessage(userMsg)

    if (session && session.messages.length === 0 && session.name === 'New Chat') {
      // Optimistic placeholder — replaced by the LLM-generated title after streaming.
      renameSession(session.id, text.slice(0, 40) + (text.length > 40 ? '…' : ''))
    }

    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), mode: panelMode }
    addMessage(assistantMsg)
    const controller = new AbortController()
    startStreaming(controller)

    const currentDocs = getActiveDocuments()
    const autoAgentId = panelMode === 'chat' && !deepResearch
      ? detectSubAgent(text, currentDocs.map(d => d.name).join(' '))
      : undefined
    const activeProject = getActiveProject()
    const systemPrompt = deepResearch
      ? buildDeepResearchSystemPrompt(settings.jurisdiction, settings.systemPromptExtra)
      : panelMode === 'chat'
        ? buildChatSystemPrompt(currentDocs, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, autoAgentId, activeProject?.instructions, activeProject?.name)
        : buildResearchSystemPrompt(settings.jurisdiction, settings.systemPromptExtra)

    const { model, baseUrl } = resolveModel(settings)
    await streamChatCompletion(
      settings.openrouterApiKey,
      model,
      [...history, userMsg],
      systemPrompt,
      // Deep Research forces legal_search + verify_citation tools regardless of skill toggles.
      deepResearch
        ? getActiveTools(settings, mcpTools, true)
        : panelMode === 'chat' ? getActiveTools(settings, mcpTools) : [],
      {
        onChunk: (chunk) => appendToLastMessage(chunk),
        onToolCall: async (name, input) => executeAgentTool(name, input, currentDocs),
        onDone: () => setStreaming(false),
        onError: (err) => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      },
      { signal: controller.signal, baseUrl }
    )

    // Replace the placeholder slice-of-the-first-message with a real LLM title.
    if (firstTurnSessionId) maybeGenerateSessionTitle(firstTurnSessionId, text)
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

      {/* Loaded-document chips — sit above the input box (Spellbook-style). */}
      {panelMode === 'chat' && docs.length > 0 && (
        <div className="mb-2 flex items-center gap-2 flex-wrap min-h-[28px]">
          {docs.map(d => (
            <div
              key={d.id}
              className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-c-surface border border-c-border min-w-0 max-w-[240px] animate-fade-in"
            >
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase flex-shrink-0 ${DOC_BADGE_COLORS[d.ext.toLowerCase()] ?? DOC_BADGE_COLORS.txt}`}>
                {d.ext.toUpperCase()}
              </span>
              <span className="text-[12px] text-c-text2 truncate min-w-0">{d.name}</span>
              <button
                onClick={() => removeDocument(d.id)}
                title="Remove document"
                className="text-c-text4 hover:text-red-400 transition-colors text-base leading-none flex-shrink-0 pr-0.5"
              >
                ×
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-c-surface border border-c-border animate-pulse">
              <span className="text-[11px] text-c-text3">Processing document…</span>
            </div>
          )}
        </div>
      )}

      {/* Input box: textarea on top, inline toolbar (attach / legal sources /
          deep research / send) along the bottom — Spellbook layout. */}
      <div className="relative flex flex-col bg-c-input rounded-2xl border border-c-border focus-within:border-c-text4 transition-colors shadow-sm">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize() }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.trim()) }
          }}
          placeholder={
            deepResearch
              ? 'Ask a legal research question — citations will be verified…'
              : doc
                ? `Ask about "${doc.name}"…`
                : 'Ask anything about a contract or legal topic…'
          }
          disabled={isStreaming}
          rows={1}
          className="bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-c-text placeholder-c-text4 outline-none resize-none disabled:opacity-60 max-h-[200px] overflow-y-auto"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          {/* Attach */}
          <button
            onClick={openFile}
            disabled={isUploading || panelMode !== 'chat'}
            title={panelMode !== 'chat' ? 'Attachments aren\'t used in research mode' : 'Attach a PDF, DOCX, or TXT'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-c-text3 hover:text-c-text hover:bg-c-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PaperclipIcon />
            <span>{docs.length > 0 ? 'Add files' : 'Attach files'}</span>
          </button>

          {/* Legal sources (jurisdiction) */}
          <JurisdictionPicker />

          {/* Deep Research toggle */}
          <button
            onClick={() => setDeepResearch(v => !v)}
            title="Verified citations via CourtListener (US case law). Strict citation discipline; will not fabricate cases."
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
              deepResearch
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'text-c-text3 hover:text-c-text hover:bg-c-elevated'
            }`}
          >
            <SearchIcon />
            <span className="font-medium">Deep Research</span>
          </button>

          <div className="flex-1" />

          {/* Send / Stop */}
          <button
            onClick={() => isStreaming ? stopStreaming() : submit(input.trim())}
            disabled={!isStreaming && !input.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>

      {/* Quick action chips — only when a doc is loaded and not in deep research */}
      {showQuickActions && (
        <div className="flex gap-2 flex-wrap mt-3 justify-center">
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

      <p className="text-center text-[11px] text-c-text4 mt-2">
        {deepResearch
          ? 'Verified citations via CourtListener · US case law'
          : `${settings.selectedModel?.split('/')[1] ?? 'Select a model'} · ⏎ send · ⇧⏎ newline`}
      </p>
    </div>
  )
}
