import { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { Session } from '../lib/store'
import { streamChatCompletion, resolveModel } from '../lib/openrouter'
import { maybeGenerateSessionTitle } from '../lib/titles'
import { getActiveTools, buildChatSystemPrompt, resolveSubAgentId } from '../lib/agent'
import { makeTrackedToolCall } from '../lib/toolActivity'
import type { Message, BuiltInSkillSetting, CustomSkill } from '../types'

const BUILTIN_SKILL_META: Record<string, { name: string; description: string; accent: string; prompt: string | null }> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types by category',       accent: 'bg-primary',    prompt: 'Extract and list all key clauses from this document, organized by type.' },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 no-drag"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-c-bg border border-c-border rounded-lg w-full max-w-[420px] shadow-lg animate-fade-in flex flex-col overflow-hidden"
        style={{ maxHeight: '75vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border flex-shrink-0">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-c-text">Skills</h2>
            <p className="text-sm text-muted-foreground">Run a tool on the attached document, or add your own.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-c-text"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Document-required notice — shadcn alert */}
        {!hasDoc && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-c-border bg-muted/40 px-3 py-2.5">
            <span className="mt-px flex-shrink-0 text-muted-foreground"><InfoIcon /></span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Attach a document to run skills. You can still enable or disable them below.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-2 py-2">

          {/* Built-in skills */}
          <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Built-in</p>
          <div className="space-y-0.5">
            {builtIns.map(skill => {
              const meta = BUILTIN_SKILL_META[skill.id]
              if (!meta) return null
              const isInputSkill = meta.prompt === null
              const showInput = activeInputSkillId === skill.id
              const canRun = hasDoc && skill.enabled

              return (
                <div key={skill.id}>
                  <div
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
                    title={!hasDoc ? 'Attach a document first' : !skill.enabled ? 'Enable this skill to run it' : ''}
                    className={`group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                      canRun ? 'cursor-pointer hover:bg-accent' : 'opacity-55'
                    }`}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <SkillIcon id={skill.id} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-c-text">{meta.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                    {canRun && (
                      <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        {isInputSkill ? (showInput ? 'Close' : 'Search') : 'Run'}
                        <ChevronRightIcon />
                      </span>
                    )}
                    <Toggle on={skill.enabled} onChange={() => toggleBuiltIn(skill.id)} />
                  </div>

                  {/* Inline input for skills that take an argument */}
                  {isInputSkill && showInput && (
                    <div className="flex gap-2 px-2.5 pb-2 pt-1 pl-[3.25rem]">
                      <input
                        autoFocus
                        value={activeInputValue}
                        onChange={e => setActiveInputValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') runSkillSearch()
                          if (e.key === 'Escape') setActiveInputSkillId(null)
                        }}
                        placeholder="Enter search term…"
                        className="h-8 flex-1 rounded-md border border-input bg-transparent px-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                      />
                      <button
                        onClick={runSkillSearch}
                        disabled={!activeInputValue.trim() || !hasDoc}
                        className="inline-flex h-8 flex-shrink-0 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Search
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Custom skills */}
          <div className="flex items-center justify-between px-2 pb-1 pt-4">
            <p className="text-xs font-medium text-muted-foreground">Custom</p>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-c-text2 hover:text-c-text transition-colors"
              >
                <PlusMiniIcon /> Add
              </button>
            )}
          </div>

          {/* Add form */}
          {adding && (
            <div className="mx-1 mb-1 space-y-2 rounded-lg border border-c-border bg-c-surface p-3 animate-fade-in">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Skill name"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              />
              <textarea
                value={newInstructions}
                onChange={e => setNewInstructions(e.target.value)}
                placeholder="Instructions for the agent…"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setAdding(false); setNewName(''); setNewInstructions('') }}
                  className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-c-text3 hover:bg-accent hover:text-c-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustom}
                  disabled={!newName.trim() || !newInstructions.trim()}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Add skill
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
                  onClick={() => {
                    if (!hasDoc) return
                    onRun(`Apply the "${skill.name}" skill: ${skill.instructions}`)
                    onClose()
                  }}
                  title={!hasDoc ? 'Attach a document first' : ''}
                  className={`group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                    hasDoc ? 'cursor-pointer hover:bg-accent' : 'opacity-55'
                  }`}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <SparkleIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-c-text">{skill.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{skill.instructions}</p>
                  </div>
                  {hasDoc && (
                    <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Run<ChevronRightIcon />
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeCustom(skill.id) }}
                    title="Remove skill"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          ) : !adding && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No custom skills yet.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-c-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {enabledBuiltIn}/{builtIns.length} active · {customs.length} custom
          </p>
          <button
            onClick={() => { onClose(); setSettingsOpen(true) }}
            className="inline-flex items-center gap-1 text-xs font-medium text-c-text3 hover:text-c-text transition-colors"
          >
            Settings <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Skill icons (lucide-style, 16px, monochrome) ────────────────────────────
function iconProps(size = 16) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
}

function InfoIcon() {
  return (
    <svg {...iconProps(15)}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg {...iconProps(13)}><polyline points="9 18 15 12 9 6" /></svg>
  )
}

function PlusMiniIcon() {
  return (
    <svg {...iconProps(13)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  )
}

function SparkleIcon() {
  return (
    <svg {...iconProps(15)}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /></svg>
  )
}

function EditIcon() {
  return (
    <svg {...iconProps(14)}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  )
}

function TrashIcon() {
  return (
    <svg {...iconProps(14)}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
  )
}

function SkillIcon({ id }: { id: string }) {
  switch (id) {
    case 'extract_clauses':
      return <svg {...iconProps(15)}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
    case 'identify_risks':
      return <svg {...iconProps(15)}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    case 'summarize_document':
      return <svg {...iconProps(15)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
    case 'search_document':
      return <svg {...iconProps(15)}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
    case 'compare_to_standard':
      return <svg {...iconProps(15)}><line x1="12" y1="3" x2="12" y2="21" /><path d="M5 7l-3 6h6l-3-6z" /><path d="M19 7l-3 6h6l-3-6z" /><line x1="8" y1="21" x2="16" y2="21" /></svg>
    default:
      return <SparkleIcon />
  }
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={e => { e.stopPropagation(); onChange() }}
      title={on ? 'Enabled' : 'Disabled'}
      className={`relative inline-flex w-9 h-5 items-center rounded-full transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${on ? 'bg-primary' : 'bg-input'}`}
    >
      <span className={`pointer-events-none block w-4 h-4 bg-background rounded-full shadow-sm transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const {
    sessions, activeSessionId, createSession, deleteSession, renameSession,
    setActiveSession, setSettingsOpen, settings,
    theme, setTheme, isStreaming, addMessage, appendToLastMessage,
    setStreaming, startStreaming, getActiveDocument, getActiveDocuments, activeMessages, panelMode, mcpTools, activeSession,
    projects, activeProjectId, createProject, setActiveProject, renameProject, deleteProject, getActiveProject
  } = useAppStore()

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
    const agentId = resolveSubAgentId(settings.activeSubAgentId, prompt, docs.map(d => d.name).join(' '))
    const activePlaybook = settings.playbooks?.find(p => p.id === settings.activePlaybookId) ?? null
    const systemPrompt = buildChatSystemPrompt(docs, settings.jurisdiction, settings.systemPromptExtra, settings.customSkills, agentId, activeProject?.instructions, activeProject?.name, activePlaybook)
    const { model, baseUrl } = resolveModel(settings)
    await streamChatCompletion(
      settings.openrouterApiKey,
      model,
      [...history, userMsg],
      systemPrompt,
      getActiveTools(settings, mcpTools),
      {
        onChunk: c => appendToLastMessage(c),
        onToolCall: makeTrackedToolCall(docs),
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
              className="w-full border border-input bg-transparent rounded-md px-2.5 py-1.5 text-xs text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
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
                      className="h-7 flex-1 min-w-0 border border-input bg-transparent rounded-md px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                      <div className="ml-auto flex items-center">
                        {/* Session count by default; clear action buttons on hover */}
                        <span className="px-1 text-[11px] tabular-nums text-c-text4 group-hover:hidden">{count}</span>
                        <div className="hidden items-center gap-0.5 group-hover:flex">
                          <button
                            onClick={e => { e.stopPropagation(); setRenamingProjectId(p.id) }}
                            title="Rename project"
                            aria-label="Rename project"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-c-text3 hover:bg-accent hover:text-c-text transition-colors"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"? Its sessions will become ungrouped (not deleted).`)) deleteProject(p.id) }}
                            title="Delete project"
                            aria-label="Delete project"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-c-text3 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
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
                  onSelect={() => setActiveSession(session.id)}
                  onRename={(name) => renameSession(session.id, name)}
                  onDelete={() => deleteSession(session.id)}
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
  session, isActive, onSelect, onRename, onDelete
}: {
  session: Session
  isActive: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)

  const rowClass = `group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
    isActive ? 'bg-c-elevated text-c-text' : 'text-c-text2 hover:bg-c-surface'
  }`

  if (editing) {
    return (
      <div className={rowClass}>
        <input
          autoFocus
          defaultValue={session.name}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value.trim()
              if (v) onRename(v)
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={e => {
            const v = e.target.value.trim()
            if (v) onRename(v)
            setEditing(false)
          }}
          className="h-7 flex-1 min-w-0 border border-input bg-transparent rounded-md px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    )
  }

  return (
    <div className={`${rowClass} cursor-pointer`} onClick={onSelect}>
      <span className="flex-1 min-w-0 text-sm truncate">{session.name}</span>
      <div className="ml-auto hidden flex-shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          title="Rename chat"
          aria-label="Rename chat"
          className="flex h-6 w-6 items-center justify-center rounded-md text-c-text3 hover:bg-accent hover:text-c-text transition-colors"
        >
          <EditIcon />
        </button>
        <button
          onClick={e => { e.stopPropagation(); if (confirm(`Delete chat "${session.name}"?`)) onDelete() }}
          title="Delete chat"
          aria-label="Delete chat"
          className="flex h-6 w-6 items-center justify-center rounded-md text-c-text3 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
