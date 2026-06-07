import { useAppStore } from '../../lib/store'
import { useFileUpload } from '../../lib/useFileUpload'
import type { PanelMode, Document } from '../../types'
import { streamChatCompletion, AVAILABLE_MODELS } from '../../lib/openrouter'
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
  doc, onReplace, onRemove, isReplacing
}: {
  doc: Document
  onReplace: () => void
  onRemove: () => void
  isReplacing: boolean
}) {
  const words = doc.content.trim() ? doc.content.trim().split(/\s+/).filter(Boolean).length : 0

  return (
    <div className="w-full max-w-xl mx-auto mb-8 animate-fade-in">
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
              onClick={onReplace}
              disabled={isReplacing}
              className="px-2.5 py-1 rounded-lg text-xs text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors disabled:opacity-50"
            >
              {isReplacing ? 'Loading…' : 'Replace'}
            </button>
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
  const { getActiveDocument, removeDocument } = useAppStore()
  const { openFile, isLoading } = useFileUpload()
  const doc = getActiveDocument()

  const starters = mode === 'research'
    ? RESEARCH_STARTERS
    : doc
      ? CHAT_STARTERS
      : CHAT_STARTERS_NO_DOC

  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-6 max-w-2xl mx-auto w-full">

      {/* Document info card */}
      {mode === 'chat' && doc && (
        <DocumentInfoCard
          doc={doc}
          onReplace={openFile}
          onRemove={removeDocument}
          isReplacing={isLoading}
        />
      )}

      {/* Heading */}
      <div className="text-center mb-8 w-full">
        <h2 className="text-c-text text-2xl font-semibold mb-2">
          {mode === 'research'
            ? 'Legal Research'
            : doc
              ? 'Contract Analysis'
              : 'Legal Assistant'}
        </h2>
        <p className="text-c-text3 text-sm">
          {mode === 'research'
            ? 'Ask anything about law, contracts, compliance, or legal concepts.'
            : doc
              ? `"${doc.name}" is loaded. Ask anything about the document.`
              : 'Ask a legal question or attach a document using the paperclip button below.'}
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
    addMessage, appendToLastMessage, setStreaming,
    settings, getActiveDocument, activeMessages, isStreaming
  } = useAppStore()

  async function run() {
    if (isStreaming) return
    const doc = getActiveDocument()

    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: question, timestamp: Date.now(), mode }
    addMessage(userMsg)
    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant' as const, content: '', timestamp: Date.now(), mode }
    addMessage(assistantMsg)
    setStreaming(true)

    const autoAgentId = mode === 'chat' ? detectSubAgent(question, doc?.name) : undefined
    const systemPrompt = mode === 'chat'
      ? buildChatSystemPrompt(doc, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, autoAgentId)
      : buildResearchSystemPrompt(settings.jurisdiction, settings.systemPromptExtra)

    await streamChatCompletion(
      settings.openrouterApiKey,
      settings.selectedModel || AVAILABLE_MODELS[0].id,
      [...activeMessages(), userMsg],
      systemPrompt,
      mode === 'chat' ? getActiveTools(settings) : [],
      {
        onChunk: (chunk: string) => appendToLastMessage(chunk),
        onToolCall: async (name: string, input: Record<string, unknown>) => executeAgentTool(name, input, doc),
        onDone: () => setStreaming(false),
        onError: (err: string) => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      }
    )
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
