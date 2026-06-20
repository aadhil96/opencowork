import { useAppStore } from '../../lib/store'
import type { PanelMode, Document } from '../../types'
import { streamChatCompletion, resolveModel } from '../../lib/openrouter'
import { maybeGenerateSessionTitle } from '../../lib/titles'
import { getActiveTools, buildChatSystemPrompt, buildResearchSystemPrompt, executeAgentTool, detectSubAgent } from '../../lib/agent'

const RESEARCH_STARTERS = [
  'What is a standard liability cap in SaaS contracts?',
  'Explain the difference between indemnification and warranty',
  'When is a non-compete clause enforceable?',
  'Key elements of a valid force majeure clause?'
]

const CHAT_STARTERS_NO_DOC = [
  'What clauses should I watch for in an NDA?',
  'Explain the difference between indemnification and warranty',
  'What makes a non-compete clause enforceable?',
  'How does force majeure typically work?'
]

const CHAT_STARTERS = [
  'Summarize this contract and identify the parties',
  'What are the key obligations of each party?',
  'Flag any unusual or risky clauses',
  'Explain the termination conditions in plain English'
]

// Time-based greeting, Spellbook-style. No personalization yet — we don't have
// a name field in settings; once we do this can pick up settings.userName.
function greet(): string {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  return `Good ${part}, let's get to work`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function DocTypeBadge({ ext }: { ext: string }) {
  const styles: Record<string, string> = {
    pdf:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    doc:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    txt:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = styles[ext.toLowerCase()] ?? styles.txt
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase flex-shrink-0 ${cls}`}>
      {ext.toUpperCase()}
    </span>
  )
}

function DocumentInfoCard({
  doc, onRemove
}: {
  doc: Document
  onRemove: () => void
}) {
  const words = doc.content.trim() ? doc.content.trim().split(/\s+/).filter(Boolean).length : 0

  return (
    <div className="w-full max-w-xl mx-auto mb-3 animate-fade-in">
      <div className="bg-c-surface border border-c-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <DocTypeBadge ext={doc.ext} />
          <div className="flex-1 min-w-0">
            <p className="text-c-text font-medium text-sm truncate">{doc.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-c-text3 text-xs">
                {words > 0 ? `${words.toLocaleString()} words` : 'No text extracted'}
              </span>
              {doc.size > 0 && (
                <>
                  <span className="text-c-text4 text-xs">·</span>
                  <span className="text-c-text3 text-xs">{formatSize(doc.size)}</span>
                </>
              )}
              <span className="text-c-text4 text-xs">·</span>
              <span className={`text-xs font-medium ${
                doc.extractionError
                  ? 'text-amber-500'
                  : words > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-c-text3'
              }`}>
                {doc.extractionError ? 'Extraction failed' : words > 0 ? 'Ready' : 'No text layer'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRemove}
              className="px-2.5 py-1 rounded-lg text-xs text-c-text3 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>

        {doc.extractionError && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-900/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Text extraction failed. The AI cannot analyze this document's content. This often happens with scanned or image-only PDFs.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EmptyState({ mode }: { mode: PanelMode }) {
  const { getActiveDocuments, removeDocument } = useAppStore()
  const docs = getActiveDocuments()
  const doc = docs[0]

  const starters = mode === 'research'
    ? RESEARCH_STARTERS
    : doc
      ? CHAT_STARTERS
      : CHAT_STARTERS_NO_DOC

  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-6 max-w-2xl mx-auto w-full">

      {/* Document info cards — one per loaded document */}
      {mode === 'chat' && docs.length > 0 && (
        <div className="w-full mb-5">
          {docs.map(d => (
            <DocumentInfoCard key={d.id} doc={d} onRemove={() => removeDocument(d.id)} />
          ))}
        </div>
      )}

      {/* Heading — Spellbook-style time-based greeting */}
      <div className="text-center mb-8 w-full">
        <h2 className="text-c-text text-[28px] font-semibold mb-2 tracking-tight">
          {greet()}
        </h2>
        <p className="text-c-text3 text-sm">
          {mode === 'research'
            ? 'Ask anything about law, contracts, compliance, or legal concepts.'
            : doc
              ? `"${doc.name}" is loaded. Ask anything about the document.`
              : 'Ask a legal question, attach a contract, or run verified research.'}
        </p>
      </div>

      {/* Starter cards */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {starters.map(q => (
          <StarterCard key={q} question={q} mode={mode} />
        ))}
      </div>
    </div>
  )
}

function StarterCard({ question, mode }: { question: string; mode: PanelMode }) {
  const {
    addMessage, appendToLastMessage, setStreaming, startStreaming,
    settings, mcpTools, getActiveDocuments, activeMessages, isStreaming, activeSession, getActiveProject
  } = useAppStore()

  async function run() {
    if (isStreaming) return
    const docs = getActiveDocuments()

    // First-turn capture for LLM-based session titling.
    const session = activeSession()
    const firstTurnSessionId = session && session.messages.length === 0 ? session.id : null

    const history = activeMessages()
    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: question, timestamp: Date.now(), mode }
    addMessage(userMsg)
    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant' as const, content: '', timestamp: Date.now(), mode }
    addMessage(assistantMsg)
    const controller = new AbortController()
    startStreaming(controller)

    const autoAgentId = mode === 'chat' ? detectSubAgent(question, docs.map(d => d.name).join(' ')) : undefined
    const activeProject = getActiveProject()
    const systemPrompt = mode === 'chat'
      ? buildChatSystemPrompt(docs, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, autoAgentId, activeProject?.instructions, activeProject?.name)
      : buildResearchSystemPrompt(settings.jurisdiction, settings.systemPromptExtra)

    const { model, baseUrl } = resolveModel(settings)
    await streamChatCompletion(
      settings.openrouterApiKey,
      model,
      [...history, userMsg],
      systemPrompt,
      mode === 'chat' ? getActiveTools(settings, mcpTools) : [],
      {
        onChunk: (chunk: string) => appendToLastMessage(chunk),
        onToolCall: async (name: string, input: Record<string, unknown>) => executeAgentTool(name, input, docs),
        onDone: () => setStreaming(false),
        onError: (err: string) => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      },
      { signal: controller.signal, baseUrl }
    )

    if (firstTurnSessionId) maybeGenerateSessionTitle(firstTurnSessionId, question)
  }

  return (
    <button
      onClick={run}
      className="text-left px-4 py-3.5 rounded-xl border border-c-border hover:border-c-text4 hover:bg-c-elevated transition-colors text-sm text-c-text2 hover:text-c-text"
    >
      {question}
    </button>
  )
}
