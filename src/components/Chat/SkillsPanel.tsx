import { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { streamChatCompletion, resolveModel } from '../../lib/openrouter'
import { getActiveTools, buildChatSystemPrompt, executeAgentTool } from '../../lib/agent'
import type { Message } from '../../types'

interface SkillMeta {
  name: string
  description: string
  accent: string
  prompt: string | null
}

const BUILTIN_SKILL_META: Record<string, SkillMeta> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types by category',       accent: 'bg-primary',    prompt: 'Extract and list all key clauses from this document, organized by type.' },
  identify_risks:      { name: 'Identify Risks',      description: 'Flag risky or unusual clauses',           accent: 'bg-red-500',     prompt: 'Identify all risks and flag any concerning or unusual clauses in this document.' },
  summarize_document:  { name: 'Summarize',           description: 'Executive summary of the document',       accent: 'bg-emerald-500', prompt: 'Generate a complete structured summary of this document including parties, obligations, and key dates.' },
  search_document:     { name: 'Search Document',     description: 'Find a specific term or concept',         accent: 'bg-violet-500',  prompt: null },
  compare_to_standard: { name: 'Compare to Standard', description: 'Check clauses against market practice',   accent: 'bg-amber-500',   prompt: 'Compare the main clauses of this document to standard market practice and flag any deviations.' },
}

function SkillCard({
  name, description, accent, disabled, isStreaming, children, onClick
}: {
  name: string
  description: string
  accent: string
  disabled: boolean
  isStreaming: boolean
  children?: React.ReactNode
  onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`group rounded-xl border border-c-border bg-c-surface transition-all overflow-hidden ${
        !disabled && !isStreaming ? 'hover:border-c-text4 hover:shadow-sm cursor-pointer' : 'opacity-50 cursor-not-allowed'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!disabled && !isStreaming && onClick ? onClick : undefined}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        {/* Accent dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${accent}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[12px] font-semibold text-c-text truncate">{name}</p>
            {onClick && hovered && !disabled && !isStreaming && (
              <span className="text-[10px] text-c-text4 flex-shrink-0">Run →</span>
            )}
          </div>
          <p className="text-[10px] text-c-text4 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function SkillsPanel() {
  const {
    settings, isStreaming, mcpTools,
    addMessage, appendToLastMessage, setStreaming,
    getActiveDocument, getActiveDocuments, activeMessages, panelMode
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen]   = useState(false)

  const doc = getActiveDocument()
  const noDoc = !doc
  const activeBuiltIns = settings.builtInSkills.filter(s => s.enabled)
  const customSkills   = settings.customSkills

  async function runSkill(prompt: string) {
    if (isStreaming || !doc) return
    const docs = getActiveDocuments()
    const history = activeMessages()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now(), mode: panelMode }
    addMessage(userMsg)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), mode: panelMode })
    setStreaming(true)
    const systemPrompt = buildChatSystemPrompt(docs, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills)
    const { model, baseUrl } = resolveModel(settings)
    await streamChatCompletion(
      settings.openrouterApiKey,
      model,
      [...history, userMsg],
      systemPrompt,
      getActiveTools(settings, mcpTools),
      {
        onChunk: c => appendToLastMessage(c),
        onToolCall: async (name, input) => executeAgentTool(name, input, docs),
        onDone: () => setStreaming(false),
        onError: err => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      },
      { baseUrl }
    )
  }

  function submitSearch() {
    if (!searchQuery.trim()) return
    runSkill(`Search the document for: "${searchQuery.trim()}"`)
    setSearchQuery('')
    setSearchOpen(false)
  }

  const hasSkills = activeBuiltIns.length > 0 || customSkills.length > 0

  return (
    <div className="w-[220px] flex-shrink-0 bg-c-sidebar border-r border-c-border flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border flex-shrink-0">
        <div>
          <p className="text-[11px] font-semibold text-c-text">Skills</p>
          <p className="text-[10px] text-c-text4 mt-0.5">
            {activeBuiltIns.length + customSkills.length} active
          </p>
        </div>
      </div>

      {/* No doc hint */}
      {noDoc && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-c-elevated border border-c-border">
          <p className="text-[10px] text-c-text4 leading-relaxed">
            Upload a document to run skills on it.
          </p>
        </div>
      )}

      {/* Skill cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">

        {!hasSkills && (
          <p className="text-[11px] text-c-text4 px-1 py-2">
            Enable skills in Settings → Skills.
          </p>
        )}

        {/* Built-in skills */}
        {activeBuiltIns.map(skill => {
          const meta = BUILTIN_SKILL_META[skill.id]
          if (!meta) return null

          if (meta.prompt === null) {
            return (
              <SkillCard
                key={skill.id}
                name={meta.name}
                description={meta.description}
                accent={meta.accent}
                disabled={noDoc}
                isStreaming={isStreaming}
                onClick={() => setSearchOpen(v => !v)}
              >
                {searchOpen && (
                  <div className="px-3 pb-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitSearch(); if (e.key === 'Escape') setSearchOpen(false) }}
                      placeholder="Enter term to search…"
                      className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-1.5 text-[11px] text-c-text placeholder-c-text4 outline-none focus:border-ring transition-colors"
                    />
                    <button
                      onClick={submitSearch}
                      disabled={!searchQuery.trim()}
                      className="w-full py-1 rounded-lg text-[11px] font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Search
                    </button>
                  </div>
                )}
              </SkillCard>
            )
          }

          return (
            <SkillCard
              key={skill.id}
              name={meta.name}
              description={meta.description}
              accent={meta.accent}
              disabled={noDoc}
              isStreaming={isStreaming}
              onClick={() => runSkill(meta.prompt!)}
            />
          )
        })}

        {/* Custom skills */}
        {customSkills.length > 0 && (
          <>
            <div className="pt-2 pb-1">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-c-text4 px-1">Custom</p>
            </div>
            {customSkills.map(skill => (
              <SkillCard
                key={skill.id}
                name={skill.name}
                description={skill.instructions}
                accent="bg-indigo-500"
                disabled={noDoc}
                isStreaming={isStreaming}
                onClick={() => runSkill(`Apply the "${skill.name}" skill: ${skill.instructions}`)}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-c-border flex-shrink-0">
        <p className="text-[10px] text-c-text4">
          Manage in{' '}
          <span className="text-c-text3 font-medium">Settings → Skills</span>
        </p>
      </div>
    </div>
  )
}
