import { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { Session } from '../lib/store'
import { streamChatCompletion, AVAILABLE_MODELS } from '../lib/openrouter'
import { getActiveTools, buildChatSystemPrompt, executeAgentTool } from '../lib/agent'
import type { Message } from '../types'

const BUILTIN_SKILL_META: Record<string, { name: string; description: string; accent: string; prompt: string | null }> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types',            accent: 'bg-blue-500',    prompt: 'Extract and list all key clauses from this document, organized by type.' },
  identify_risks:      { name: 'Identify Risks',      description: 'Flag risky or unusual clauses',    accent: 'bg-red-500',     prompt: 'Identify all risks and flag any concerning clauses in this document.' },
  summarize_document:  { name: 'Summarize',           description: 'Executive summary',                accent: 'bg-emerald-500', prompt: 'Generate a complete structured summary of this document including parties, obligations, and key dates.' },
  search_document:     { name: 'Search Document',     description: 'Find a specific term',             accent: 'bg-violet-500',  prompt: null },
  compare_to_standard: { name: 'Compare to Standard', description: 'Check against market practice',   accent: 'bg-amber-500',   prompt: 'Compare the main clauses of this document to standard market practice.' },
}

export default function Sidebar() {
  const {
    sessions, activeSessionId, createSession, deleteSession,
    setActiveSession, setSettingsOpen, settings, theme, setTheme,
    isStreaming, addMessage, appendToLastMessage, setStreaming,
    getActiveDocument, activeMessages, panelMode
  } = useAppStore()

  const [hoveredId, setHoveredId]     = useState<string | null>(null)
  const [skillsOpen, setSkillsOpen]   = useState(true)
  const [searchSkillOpen, setSearchSkillOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const doc = getActiveDocument()
  const noDoc = !doc || panelMode !== 'chat'
  const activeBuiltIns = settings.builtInSkills.filter(s => s.enabled)
  const customSkills   = settings.customSkills
  const hasSkills      = activeBuiltIns.length > 0 || customSkills.length > 0

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    window.electronAPI?.storeSet('theme', next)
  }

  async function runSkill(prompt: string) {
    if (isStreaming || !doc) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now(), mode: panelMode }
    addMessage(userMsg)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), mode: panelMode })
    setStreaming(true)
    const systemPrompt = buildChatSystemPrompt(doc, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills)
    await streamChatCompletion(
      settings.openrouterApiKey,
      settings.selectedModel || AVAILABLE_MODELS[0].id,
      [...activeMessages(), userMsg],
      systemPrompt,
      getActiveTools(settings),
      {
        onChunk: c => appendToLastMessage(c),
        onToolCall: async (name, input) => executeAgentTool(name, input, doc),
        onDone: () => setStreaming(false),
        onError: err => { appendToLastMessage(`\n\n> *Error: ${err}*`); setStreaming(false) }
      }
    )
  }

  function submitSearch() {
    if (!searchQuery.trim()) return
    runSkill(`Search the document for: "${searchQuery.trim()}"`)
    setSearchQuery('')
    setSearchSkillOpen(false)
  }

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col bg-c-sidebar border-r border-c-border2 h-full">

      {/* Title bar */}
      <div className="drag-region h-11 flex items-center px-4 flex-shrink-0">
        <div className="w-16 flex-shrink-0" />
        <span className="text-c-text font-semibold text-sm tracking-wide">OpenCowork</span>
      </div>

      {/* New Chat */}
      <div className="no-drag px-3 pb-2 flex-shrink-0">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-c-text hover:bg-c-elevated transition-colors"
        >
          New Chat
        </button>
      </div>

      {/* Scrollable middle: sessions + skills */}
      <div className="flex-1 overflow-y-auto no-drag">

        {/* Sessions */}
        <div className="px-2 space-y-0.5 pb-2">
          {sessions.length > 0 && (
            <p className="text-[11px] font-medium text-c-text3 uppercase tracking-wider px-2 py-2">
              Recent
            </p>
          )}
          {sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              isHovered={hoveredId === session.id}
              onSelect={() => setActiveSession(session.id)}
              onDelete={() => deleteSession(session.id)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          ))}
        </div>

        {/* Skills section */}
        {hasSkills && (
          <div className="px-2 pt-1 pb-2">

            {/* Divider + header */}
            <div className="border-t border-c-border2 pt-3 mb-1">
              <button
                onClick={() => setSkillsOpen(v => !v)}
                className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-c-elevated transition-colors group"
              >
                <p className="text-[11px] font-semibold text-c-text3 uppercase tracking-wider group-hover:text-c-text2 transition-colors">
                  Skills
                </p>
                <span className="text-[10px] text-c-text4 group-hover:text-c-text3 transition-colors">
                  {skillsOpen ? '▾' : '▸'}
                </span>
              </button>
            </div>

            {skillsOpen && (
              <div className="space-y-0.5 mt-0.5">

                {/* Built-in skills */}
                {activeBuiltIns.map(skill => {
                  const meta = BUILTIN_SKILL_META[skill.id]
                  if (!meta) return null

                  // Search skill — shows inline input
                  if (meta.prompt === null) {
                    return (
                      <div key={skill.id}>
                        <button
                          onClick={() => setSearchSkillOpen(v => !v)}
                          disabled={noDoc || isStreaming}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group disabled:opacity-40 disabled:cursor-not-allowed ${
                            searchSkillOpen
                              ? 'bg-c-elevated text-c-text'
                              : 'text-c-text2 hover:bg-c-surface hover:text-c-text'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.accent}`} />
                          <span className="flex-1 min-w-0 text-sm truncate text-left">{meta.name}</span>
                          {!noDoc && !isStreaming && (
                            <span className="text-[9px] text-c-text4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {searchSkillOpen ? '▴' : '▾'}
                            </span>
                          )}
                        </button>
                        {searchSkillOpen && !noDoc && (
                          <div className="mx-2 mt-1 mb-1 space-y-1.5">
                            <input
                              autoFocus
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitSearch()
                                if (e.key === 'Escape') setSearchSkillOpen(false)
                              }}
                              placeholder="Search term…"
                              className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-1.5 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
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
                      </div>
                    )
                  }

                  return (
                    <button
                      key={skill.id}
                      onClick={() => runSkill(meta.prompt!)}
                      disabled={noDoc || isStreaming}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-c-text2 hover:bg-c-surface hover:text-c-text transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.accent}`} />
                      <span className="flex-1 min-w-0 text-sm truncate text-left">{meta.name}</span>
                      {!noDoc && !isStreaming && (
                        <span className="text-[9px] text-c-text4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          Run
                        </span>
                      )}
                    </button>
                  )
                })}

                {/* Custom skills */}
                {customSkills.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-c-text4">Custom</p>
                    </div>
                    {customSkills.map(skill => (
                      <button
                        key={skill.id}
                        onClick={() => runSkill(`Apply the "${skill.name}" skill: ${skill.instructions}`)}
                        disabled={noDoc || isStreaming}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-c-text2 hover:bg-c-surface hover:text-c-text transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-indigo-500" />
                        <span className="flex-1 min-w-0 text-sm truncate text-left">{skill.name}</span>
                        {!noDoc && !isStreaming && (
                          <span className="text-[9px] text-c-text4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            Run
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {/* No doc hint */}
                {noDoc && panelMode === 'chat' && (
                  <p className="text-[10px] text-c-text4 px-3 py-1">
                    Upload a document to run skills.
                  </p>
                )}

              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="no-drag border-t border-c-border2 px-2 py-2 flex-shrink-0 space-y-0.5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
        >
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
        >
          Settings
          {!settings.openrouterApiKey && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

    </div>
  )
}

function SessionItem({
  session, isActive, isHovered, onSelect, onDelete, onMouseEnter, onMouseLeave
}: {
  session: Session
  isActive: boolean
  isHovered: boolean
  onSelect: () => void
  onDelete: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-c-elevated text-c-text' : 'text-c-text2 hover:bg-c-surface'
      }`}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="flex-1 min-w-0 text-sm truncate">{session.name}</span>
      {(isHovered || isActive) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 text-xs text-c-text3 hover:text-red-500 transition-colors px-1"
        >
          ×
        </button>
      )}
    </div>
  )
}
