import { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { Session } from '../lib/store'
import { streamChatCompletion, AVAILABLE_MODELS } from '../lib/openrouter'
import { getActiveTools, buildChatSystemPrompt, executeAgentTool } from '../lib/agent'
import type { Message, BuiltInSkillSetting, CustomSkill } from '../types'

const BUILTIN_SKILL_META: Record<string, { name: string; description: string; accent: string; prompt: string | null }> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types by category',       accent: 'bg-blue-500',    prompt: 'Extract and list all key clauses from this document, organized by type.' },
  identify_risks:      { name: 'Identify Risks',      description: 'Flag risky or unusual clauses',           accent: 'bg-red-500',     prompt: 'Identify all risks and flag any concerning clauses in this document.' },
  summarize_document:  { name: 'Summarize',           description: 'Generate executive summary',              accent: 'bg-emerald-500', prompt: 'Generate a complete structured summary of this document including parties, obligations, and key dates.' },
  search_document:     { name: 'Search Document',     description: 'Find a specific term or concept',         accent: 'bg-violet-500',  prompt: null },
  compare_to_standard: { name: 'Compare to Standard', description: 'Compare clauses to market practice',      accent: 'bg-amber-500',   prompt: 'Compare the main clauses of this document to standard market practice.' },
}

// ── Skills flyout panel ─────────────────────────────────────────────────────

function SkillsFlyout({ onClose, onRun }: {
  onClose: () => void
  onRun: (prompt: string) => void
}) {
  const { settings, setSettings } = useAppStore()

  const [builtIns, setBuiltIns]               = useState<BuiltInSkillSetting[]>(settings.builtInSkills)
  const [customs, setCustoms]                 = useState<CustomSkill[]>(settings.customSkills)
  const [adding, setAdding]                   = useState(false)
  const [newName, setNewName]                 = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [searchQuery, setSearchQuery]         = useState('')
  const [searchOpen, setSearchOpen]           = useState(false)

  function toggleBuiltIn(id: string) {
    const updated = builtIns.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    setBuiltIns(updated)
    setSettings({ builtInSkills: updated })
    window.electronAPI?.storeSet('builtInSkills', updated)
  }

  function addCustom() {
    if (!newName.trim() || !newInstructions.trim()) return
    const updated = [...customs, { id: crypto.randomUUID(), name: newName.trim(), instructions: newInstructions.trim() }]
    setCustoms(updated)
    setSettings({ customSkills: updated })
    window.electronAPI?.storeSet('customSkills', updated)
    setNewName('')
    setNewInstructions('')
    setAdding(false)
  }

  function removeCustom(id: string) {
    const updated = customs.filter(s => s.id !== id)
    setCustoms(updated)
    setSettings({ customSkills: updated })
    window.electronAPI?.storeSet('customSkills', updated)
  }

  const enabledCount = builtIns.filter(s => s.enabled).length + customs.length

  return (
    <>
    {/* Backdrop — clicking outside the panel closes it */}
    <div className="fixed inset-0 z-40 no-drag" onClick={onClose} />
    <div
      className="fixed z-50 top-0 left-[260px] h-full w-[300px] bg-c-bg border-r border-c-border shadow-xl flex flex-col animate-fade-in no-drag"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-c-border flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-c-text">Skills</p>
          <p className="text-[10px] text-c-text4 mt-0.5">{enabledCount} active</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-c-text4 hover:text-c-text3 hover:bg-c-elevated text-lg transition-colors"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Built-in skills */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-c-text4 mb-2">Built-in</p>
          <div className="space-y-1">
            {builtIns.map(skill => {
              const meta = BUILTIN_SKILL_META[skill.id]
              if (!meta) return null

              if (meta.prompt === null) {
                return (
                  <div key={skill.id} className="border border-c-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.accent}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-c-text">{meta.name}</p>
                        <p className="text-[10px] text-c-text4 mt-0.5">{meta.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setSearchOpen(v => !v)}
                          className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          {searchOpen ? 'Close' : 'Run'}
                        </button>
                        <Toggle on={skill.enabled} onChange={() => toggleBuiltIn(skill.id)} />
                      </div>
                    </div>
                    {searchOpen && (
                      <div className="px-3 pb-3 space-y-1.5 border-t border-c-border pt-2">
                        <input
                          autoFocus
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && searchQuery.trim()) {
                              onRun(`Search the document for: "${searchQuery.trim()}"`)
                              setSearchQuery('')
                              setSearchOpen(false)
                              onClose()
                            }
                            if (e.key === 'Escape') setSearchOpen(false)
                          }}
                          placeholder="Enter search term…"
                          className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-1.5 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (!searchQuery.trim()) return
                            onRun(`Search the document for: "${searchQuery.trim()}"`)
                            setSearchQuery('')
                            setSearchOpen(false)
                            onClose()
                          }}
                          disabled={!searchQuery.trim()}
                          className="w-full py-1 rounded-lg text-[11px] font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 transition-all"
                        >
                          Search
                        </button>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={skill.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-c-border">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.accent}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-c-text">{meta.name}</p>
                    <p className="text-[10px] text-c-text4 mt-0.5">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { onRun(meta.prompt!); onClose() }}
                      className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      Run
                    </button>
                    <Toggle on={skill.enabled} onChange={() => toggleBuiltIn(skill.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-c-border" />

        {/* Custom skills */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-c-text4">Custom</p>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors font-medium"
              >
                + Add
              </button>
            )}
          </div>

          {/* Existing custom skills */}
          {customs.length > 0 && (
            <div className="space-y-1 mb-3">
              {customs.map(skill => (
                <div key={skill.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-c-border">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-indigo-500 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-c-text">{skill.name}</p>
                    <p className="text-[10px] text-c-text4 mt-0.5 line-clamp-2">{skill.instructions}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <button
                      onClick={() => { onRun(`Apply the "${skill.name}" skill: ${skill.instructions}`); onClose() }}
                      className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => removeCustom(skill.id)}
                      className="text-[10px] text-c-text4 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {customs.length === 0 && !adding && (
            <div className="border border-dashed border-c-border rounded-xl px-4 py-4 text-center mb-2">
              <p className="text-[11px] text-c-text4">No custom skills yet.</p>
              <p className="text-[10px] text-c-text4 mt-0.5">Click + Add to create one.</p>
            </div>
          )}

          {/* Add form */}
          {adding && (
            <div className="border border-c-border rounded-xl p-3 space-y-2.5">
              <div>
                <p className="text-[10px] font-medium text-c-text mb-1">Skill name</p>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. GDPR Compliance Check"
                  className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-2 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] font-medium text-c-text mb-1">Instructions</p>
                <textarea
                  value={newInstructions}
                  onChange={e => setNewInstructions(e.target.value)}
                  placeholder="Describe what the agent should do…"
                  rows={3}
                  className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-2 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 resize-none transition-colors leading-relaxed"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAdding(false); setNewName(''); setNewInstructions('') }}
                  className="flex-1 py-1.5 rounded-lg text-[11px] text-c-text3 hover:text-c-text border border-c-border hover:bg-c-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustom}
                  disabled={!newName.trim() || !newInstructions.trim()}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Add skill
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-500' : 'bg-c-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const {
    sessions, activeSessionId, createSession, deleteSession,
    setActiveSession, setSettingsOpen, settings,
    theme, setTheme, isStreaming, addMessage, appendToLastMessage,
    setStreaming, getActiveDocument, activeMessages, panelMode
  } = useAppStore()

  const [hoveredId, setHoveredId]       = useState<string | null>(null)
  const [skillsOpen, setSkillsOpen]     = useState(false)

  const doc   = getActiveDocument()
  const noDoc = !doc || panelMode !== 'chat'
  const totalSkills = settings.builtInSkills.filter(s => s.enabled).length + settings.customSkills.length

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

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto no-drag px-2 space-y-0.5 pb-2">
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

      {/* Bottom actions */}
      <div className="no-drag border-t border-c-border2 px-2 py-2 flex-shrink-0 space-y-0.5">

        {/* Skills entry point */}
        <button
          onClick={() => setSkillsOpen(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
            skillsOpen
              ? 'bg-c-elevated text-c-text'
              : 'text-c-text3 hover:text-c-text hover:bg-c-elevated'
          }`}
        >
          <span>Skills</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
            skillsOpen ? 'bg-c-input text-c-text2' : 'bg-c-elevated text-c-text4'
          }`}>
            {totalSkills}
          </span>
        </button>

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

      {/* Skills flyout */}
      {skillsOpen && (
        <SkillsFlyout
          onClose={() => setSkillsOpen(false)}
          onRun={prompt => {
            if (!noDoc) runSkill(prompt)
            setSkillsOpen(false)
          }}
        />
      )}

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
