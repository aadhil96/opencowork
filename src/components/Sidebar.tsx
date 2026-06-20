import { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { Session } from '../lib/store'
import { streamChatCompletion, resolveModel } from '../lib/openrouter'
import { maybeGenerateSessionTitle } from '../lib/titles'
import { getActiveTools, buildChatSystemPrompt, executeAgentTool } from '../lib/agent'
import type { Message, BuiltInSkillSetting, CustomSkill } from '../types'

const BUILTIN_SKILL_META: Record<string, { name: string; description: string; accent: string; prompt: string | null }> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types by category',       accent: 'bg-blue-500',    prompt: 'Extract and list all key clauses from this document, organized by type.' },
  identify_risks:      { name: 'Identify Risks',      description: 'Flag risky or unusual clauses',           accent: 'bg-red-500',     prompt: 'Identify all risks and flag any concerning clauses in this document.' },
  summarize_document:  { name: 'Summarize',           description: 'Generate executive summary',              accent: 'bg-emerald-500', prompt: 'Generate a complete structured summary of this document including parties, obligations, and key dates.' },
  search_document:     { name: 'Search Document',     description: 'Find a specific term or concept',         accent: 'bg-violet-500',  prompt: null },
  compare_to_standard: { name: 'Compare to Standard', description: 'Compare clauses to market practice',      accent: 'bg-amber-500',   prompt: 'Compare the main clauses of this document to standard market practice.' },
}

// ── Skills modal ────────────────────────────────────────────────────────────
// Centered popup window. Bigger typography, document-required hint, per-skill
// inline input (not a shared `searchOpen` flag), clearer disabled state.

function SkillsFlyout({ onClose, onRun }: {
  onClose: () => void
  onRun: (prompt: string) => void
}) {
  const { settings, setSettings, getActiveDocument, setSettingsOpen } = useAppStore()
  const hasDoc = !!getActiveDocument()

  const [builtIns, setBuiltIns]               = useState<BuiltInSkillSetting[]>(settings.builtInSkills)
  const [customs, setCustoms]                 = useState<CustomSkill[]>(settings.customSkills)
  const [adding, setAdding]                   = useState(false)
  const [newName, setNewName]                 = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  // Per-skill inline input (only the skill being interacted with shows its input).
  const [activeInputSkillId, setActiveInputSkillId] = useState<string | null>(null)
  const [activeInputValue, setActiveInputValue]     = useState('')

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

  function runSkillSearch() {
    const q = activeInputValue.trim()
    if (!q || !hasDoc) return
    onRun(`Search the document for: "${q}"`)
    setActiveInputValue('')
    setActiveInputSkillId(null)
    onClose()
  }

  const enabledBuiltIn = builtIns.filter(s => s.enabled).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm no-drag"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-c-bg border border-c-border rounded-xl w-full max-w-[420px] shadow-xl animate-fade-in flex flex-col overflow-hidden"
        style={{ maxHeight: '75vh' }}
      >
        {/* Header — single line, minimal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border flex-shrink-0">
          <p className="text-sm font-semibold text-c-text">Skills</p>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-c-text4 hover:text-c-text2 hover:bg-c-elevated text-base leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* No-doc hint — compact inline strip */}
        {!hasDoc && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 flex-shrink-0">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Attach a document to run skills.
            </p>
          </div>
        )}

        {/* Scrollable body — tight padding, compact rows */}
        <div className="flex-1 overflow-y-auto px-3 py-2">

          {/* Built-in section */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-c-text4 px-1 py-2">Built-in</p>
          <div className="space-y-0.5">
            {builtIns.map(skill => {
              const meta = BUILTIN_SKILL_META[skill.id]
              if (!meta) return null
              const isInputSkill = meta.prompt === null
              const showInput = activeInputSkillId === skill.id
              const disabled = !skill.enabled
              const canRun = hasDoc && !disabled

              return (
                <div key={skill.id}>
                  <div className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-c-elevated/60 transition-colors ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-c-text truncate">{meta.name}</p>
                      <p className="text-[11px] text-c-text4 truncate">{meta.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!canRun) return
                        if (isInputSkill) {
                          setActiveInputSkillId(showInput ? null : skill.id)
                          setActiveInputValue('')
                        } else {
                          onRun(meta.prompt!)
                          onClose()
                        }
                      }}
                      disabled={!canRun}
                      title={!hasDoc ? 'Attach a document first' : disabled ? 'Disabled' : ''}
                      className="px-2 py-1 rounded text-[11px] font-medium text-blue-500 hover:bg-blue-500/10 disabled:text-c-text4 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                    >
                      {isInputSkill && showInput ? 'Close' : 'Run'}
                    </button>
                    <Toggle on={skill.enabled} onChange={() => toggleBuiltIn(skill.id)} />
                  </div>

                  {/* Inline input for skills that need an argument */}
                  {isInputSkill && showInput && (
                    <div className="px-2 pb-2 flex gap-1.5">
                      <input
                        autoFocus
                        value={activeInputValue}
                        onChange={e => setActiveInputValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') runSkillSearch()
                          if (e.key === 'Escape') setActiveInputSkillId(null)
                        }}
                        placeholder="Enter search term…"
                        className="flex-1 bg-c-input border border-c-border rounded-md px-2.5 py-1.5 text-[12px] text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                      />
                      <button
                        onClick={runSkillSearch}
                        disabled={!activeInputValue.trim() || !hasDoc}
                        className="px-3 rounded-md text-[11px] font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        Search
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Custom section */}
          <div className="flex items-center justify-between px-1 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-c-text4">Custom</p>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="text-[11px] text-blue-500 hover:text-blue-400 font-medium transition-colors"
              >
                + Add
              </button>
            )}
          </div>

          {/* Add form — compact */}
          {adding && (
            <div className="border border-c-border rounded-lg bg-c-surface p-2.5 space-y-2 mb-1 animate-fade-in">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Skill name"
                className="w-full bg-c-input border border-c-border rounded-md px-2.5 py-1.5 text-[12px] text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
              />
              <textarea
                value={newInstructions}
                onChange={e => setNewInstructions(e.target.value)}
                placeholder="Instructions for the agent…"
                rows={2}
                className="w-full bg-c-input border border-c-border rounded-md px-2.5 py-1.5 text-[12px] text-c-text placeholder-c-text4 outline-none focus:border-c-text4 resize-none transition-colors leading-relaxed"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => { setAdding(false); setNewName(''); setNewInstructions('') }}
                  className="px-2.5 py-1 text-[11px] text-c-text3 hover:text-c-text rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustom}
                  disabled={!newName.trim() || !newInstructions.trim()}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Custom rows */}
          {customs.length > 0 ? (
            <div className="space-y-0.5">
              {customs.map(skill => (
                <div
                  key={skill.id}
                  className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-c-elevated/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-c-text truncate">{skill.name}</p>
                    <p className="text-[11px] text-c-text4 truncate">{skill.instructions}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!hasDoc) return
                      onRun(`Apply the "${skill.name}" skill: ${skill.instructions}`)
                      onClose()
                    }}
                    disabled={!hasDoc}
                    title={!hasDoc ? 'Attach a document first' : ''}
                    className="px-2 py-1 rounded text-[11px] font-medium text-blue-500 hover:bg-blue-500/10 disabled:text-c-text4 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => removeCustom(skill.id)}
                    title="Remove skill"
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-c-text4 hover:text-red-500 transition-all"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : !adding && (
            <p className="text-[11px] text-c-text4 px-2 py-3 text-center">No custom skills yet.</p>
          )}
        </div>

        {/* Footer — minimal */}
        <div className="px-4 py-2 border-t border-c-border flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-c-text4">
            {enabledBuiltIn}/{builtIns.length} active · {customs.length} custom
          </p>
          <button
            onClick={() => { onClose(); setSettingsOpen(true) }}
            className="text-[10px] text-c-text3 hover:text-c-text2 transition-colors"
          >
            Settings →
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      title={on ? 'Enabled' : 'Disabled'}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-500' : 'bg-c-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const {
    sessions, activeSessionId, createSession, deleteSession,
    setActiveSession, setSettingsOpen, settings,
    theme, setTheme, isStreaming, addMessage, appendToLastMessage,
    setStreaming, startStreaming, getActiveDocument, getActiveDocuments, activeMessages, panelMode, mcpTools, activeSession,
    projects, activeProjectId, createProject, setActiveProject, renameProject, deleteProject, getActiveProject
  } = useAppStore()

  const [hoveredId, setHoveredId]       = useState<string | null>(null)
  const [skillsOpen, setSkillsOpen]     = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName]   = useState('')
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)

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
    const docs = getActiveDocuments()
    // First-turn capture for LLM-based session titling.
    const session = activeSession()
    const firstTurnSessionId = session && session.messages.length === 0 ? session.id : null
    const history = activeMessages()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now(), mode: panelMode }
    addMessage(userMsg)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), mode: panelMode })
    const controller = new AbortController()
    startStreaming(controller)
    const activeProject = getActiveProject()
    const systemPrompt = buildChatSystemPrompt(docs, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, undefined, activeProject?.instructions, activeProject?.name)
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
      { signal: controller.signal, baseUrl }
    )

    if (firstTurnSessionId) maybeGenerateSessionTitle(firstTurnSessionId, prompt)
  }

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col bg-c-sidebar border-r border-c-border2 h-full">

      {/* Title bar */}
      <div className="drag-region h-11 flex items-center px-4 flex-shrink-0">
        <div className="w-16 flex-shrink-0" />
        <span className="text-c-text font-semibold text-sm tracking-wide">OpenCowork</span>
      </div>

      {/* New Chat + New Project */}
      <div className="no-drag px-3 pb-2 flex-shrink-0 space-y-0.5">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-c-text hover:bg-c-elevated transition-colors"
        >
          <PlusIcon /> New chat
        </button>
        <button
          onClick={() => setCreatingProject(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
        >
          <FolderIcon /> New project
        </button>
        {creatingProject && (
          <div className="px-1 pt-1.5">
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newProjectName.trim()) {
                  createProject(newProjectName.trim())
                  setNewProjectName(''); setCreatingProject(false)
                }
                if (e.key === 'Escape') { setCreatingProject(false); setNewProjectName('') }
              }}
              onBlur={() => { if (!newProjectName.trim()) setCreatingProject(false) }}
              placeholder="Project name…"
              className="w-full bg-c-input border border-c-border rounded-lg px-2.5 py-1.5 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Scrollable area: scope selector + projects + sessions filtered to scope */}
      <div className="flex-1 overflow-y-auto no-drag px-2 space-y-0.5 pb-2">

        {/* Scope: All chats */}
        <button
          onClick={() => setActiveProject(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
            activeProjectId === null ? 'bg-c-elevated text-c-text' : 'text-c-text3 hover:text-c-text hover:bg-c-surface'
          }`}
        >
          <InboxIcon /> All chats
          <span className="ml-auto text-[10px] text-c-text4">{sessions.length}</span>
        </button>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-c-text4 uppercase tracking-widest px-3 pt-3 pb-1">Projects</p>
            {projects.map(p => {
              const count = sessions.filter(s => s.projectId === p.id).length
              const isActive = p.id === activeProjectId
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? 'bg-c-elevated text-c-text' : 'text-c-text2 hover:bg-c-surface'
                  }`}
                  onClick={() => setActiveProject(p.id)}
                >
                  <FolderIcon />
                  {renamingProjectId === p.id ? (
                    <input
                      autoFocus
                      defaultValue={p.name}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim()
                          if (v) renameProject(p.id, v)
                          setRenamingProjectId(null)
                        }
                        if (e.key === 'Escape') setRenamingProjectId(null)
                      }}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (v) renameProject(p.id, v)
                        setRenamingProjectId(null)
                      }}
                      className="flex-1 min-w-0 bg-c-input border border-c-border rounded px-1.5 py-0.5 text-[12px] outline-none focus:border-c-text4"
                    />
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-[13px] truncate">{p.name}</span>
                      <span className="text-[10px] text-c-text4">{count}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingProjectId(p.id) }}
                        title="Rename"
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-c-text4 hover:text-c-text3 px-1 transition-opacity"
                      >
                        ✎
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"? Its sessions will become ungrouped.`)) deleteProject(p.id) }}
                        title="Delete project"
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-c-text4 hover:text-red-500 px-1 transition-opacity"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* Sessions in current scope */}
        {(() => {
          const scoped = activeProjectId === null
            ? sessions
            : sessions.filter(s => s.projectId === activeProjectId)
          const project = projects.find(p => p.id === activeProjectId)
          return (
            <>
              <p className="text-[10px] font-semibold text-c-text4 uppercase tracking-widest px-3 pt-3 pb-1">
                {project ? `Chats in ${project.name}` : 'Recent'}
              </p>
              {scoped.length === 0 && (
                <p className="text-[11px] text-c-text4 px-3 py-2">No chats yet. Start one with "New chat" above.</p>
              )}
              {scoped.map(session => (
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
            </>
          )
        })()}
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function InboxIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
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
