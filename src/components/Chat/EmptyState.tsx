import type { PanelMode } from '../../types'
import { useAppStore } from '../../lib/store'
import { streamChatCompletion, AVAILABLE_MODELS } from '../../lib/openrouter'
import { LEGAL_TOOLS, buildChatSystemPrompt, buildResearchSystemPrompt, executeAgentTool } from '../../lib/agent'

const RESEARCH_STARTERS = [
  'What is a standard liability cap in SaaS contracts?',
  'Explain the difference between indemnification and warranty',
  'When is a non-compete clause enforceable?',
  'Key elements of a valid force majeure clause?'
]

const CHAT_STARTERS = [
  'Summarize this contract and identify the parties',
  'What are the key obligations of each party?',
  'Flag any unusual or risky clauses',
  'Explain the termination conditions in plain English'
]

export default function EmptyState({ mode }: { mode: PanelMode }) {
  const { getActiveDocument } = useAppStore()
  const doc = getActiveDocument()
  const starters = mode === 'research' ? RESEARCH_STARTERS : CHAT_STARTERS
  const showStarters = mode === 'research' || !!doc

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-c-text text-2xl font-semibold mb-2">
          {mode === 'research' ? 'Legal Research' : 'Contract Analysis'}
        </h2>
        <p className="text-c-text3 text-sm max-w-sm">
          {mode === 'research'
            ? 'Ask anything about law, contracts, compliance, or legal concepts.'
            : doc
            ? `"${doc.name}" is loaded. Ask anything about the document.`
            : 'Attach a document above to start reviewing, or ask a general legal question.'}
        </p>
      </div>

      {showStarters && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
          {starters.map(q => (
            <StarterCard key={q} question={q} mode={mode} />
          ))}
        </div>
      )}
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

    const systemPrompt = mode === 'chat'
      ? buildChatSystemPrompt(doc, settings.systemPromptExtra)
      : buildResearchSystemPrompt(settings.systemPromptExtra)

    await streamChatCompletion(
      settings.openrouterApiKey,
      settings.selectedModel || AVAILABLE_MODELS[0].id,
      [...activeMessages(), userMsg],
      systemPrompt,
      mode === 'chat' ? LEGAL_TOOLS : [],
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
