import { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { AVAILABLE_MODELS } from '../../lib/openrouter'
import type { BuiltInSkillSetting, CustomSkill, McpServerConfig, Playbook } from '../../types'
import { JURISDICTIONS } from '../../lib/jurisdictions'

const FREE_MODELS = AVAILABLE_MODELS.filter(m => m.id.endsWith(':free'))
const PAID_MODELS  = AVAILABLE_MODELS.filter(m => !m.id.endsWith(':free'))

const BUILTIN_SKILL_INFO: Record<string, { name: string; description: string }> = {
  extract_clauses:     { name: 'Extract Clauses',     description: 'Pull out clause types like indemnification, termination, or payment terms' },
  identify_risks:      { name: 'Identify Risks',      description: 'Scan the document for risky or unfavorable clauses with severity levels' },
  summarize_document:  { name: 'Summarize Document',  description: 'Generate a structured executive summary with parties, obligations, and key dates' },
  search_document:     { name: 'Search Document',     description: 'Find specific terms, concepts, or phrases within the document' },
  compare_to_standard: { name: 'Compare to Standard', description: 'Compare a clause against market standard or typical commercial practice' },
}

type Section = 'appearance' | 'ai' | 'legal' | 'playbooks' | 'skills' | 'mcp'

const NAV: { id: Section; label: string; sub: string }[] = [
  { id: 'appearance', label: 'Appearance',     sub: 'Theme' },
  { id: 'ai',         label: 'AI Provider',    sub: 'API key & model' },
  { id: 'legal',      label: 'Legal Settings', sub: 'Jurisdiction & instructions' },
  { id: 'playbooks',  label: 'Playbooks',      sub: 'Negotiation positions' },
  { id: 'skills',     label: 'Skills',         sub: 'Agent tools & custom skills' },
  { id: 'mcp',        label: 'MCP Servers',    sub: 'External agent tools' },
]

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex flex-shrink-0 w-9 h-5 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${on ? 'bg-primary' : 'bg-input'}`}
    >
      <span
        className={`pointer-events-none block w-4 h-4 bg-background rounded-full shadow-sm ring-0 transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

export default function SettingsModal() {
  const { settings, setSettings, setSettingsOpen, theme, setTheme, connectMcp, mcpStatus } = useAppStore()

  const [section, setSection]        = useState<Section>('appearance')
  const [apiKey, setApiKey]          = useState(settings.openrouterApiKey)
  const [model, setModel]            = useState(settings.selectedModel)
  const [jurisdiction, setJurisdict] = useState(settings.jurisdiction || 'General / International')
  const [systemExtra, setExtra]      = useState(settings.systemPromptExtra)
  const [showKey, setShowKey]        = useState(false)
  const [saved, setSaved]            = useState(false)
  const [baseUrl, setBaseUrl]        = useState(settings.baseUrl)
  const [customModel, setCustomModel] = useState(settings.customModel)
  const [tavilyKey, setTavilyKey]    = useState(settings.tavilyApiKey)

  // MCP servers
  const [mcpServers, setMcpServers]  = useState<McpServerConfig[]>(settings.mcpServers ?? [])
  const [addingServer, setAddingServer] = useState(false)
  const [srvName, setSrvName]        = useState('')
  const [srvCommand, setSrvCommand]  = useState('')
  const [srvArgs, setSrvArgs]        = useState('')
  const [connecting, setConnecting]  = useState(false)

  // Skills state
  const [builtInSkills, setBuiltInSkills] = useState<BuiltInSkillSetting[]>(settings.builtInSkills)
  const [customSkills, setCustomSkills]   = useState<CustomSkill[]>(settings.customSkills)
  const [addingSkill, setAddingSkill]     = useState(false)
  const [newSkillName, setNewSkillName]   = useState('')
  const [newSkillInstructions, setNewSkillInstructions] = useState('')

  // Playbooks state
  const [playbooks, setPlaybooks]           = useState<Playbook[]>(settings.playbooks ?? [])
  const [activePlaybookId, setActivePlaybook] = useState<string>(settings.activePlaybookId ?? '')
  const [editingPlaybookId, setEditingPlaybookId] = useState<string | null>(null)
  const [newPlaybookName, setNewPlaybookName] = useState('')
  const [ruleClause, setRuleClause]         = useState('')
  const [rulePosition, setRulePosition]     = useState('')

  function addPlaybook() {
    const name = newPlaybookName.trim()
    if (!name) return
    const pb: Playbook = { id: crypto.randomUUID(), name, rules: [] }
    setPlaybooks(prev => [...prev, pb])
    setNewPlaybookName('')
    setEditingPlaybookId(pb.id)
  }
  function removePlaybook(id: string) {
    setPlaybooks(prev => prev.filter(p => p.id !== id))
    if (activePlaybookId === id) setActivePlaybook('')
    if (editingPlaybookId === id) setEditingPlaybookId(null)
  }
  function addRule(playbookId: string) {
    const clause = ruleClause.trim(); const position = rulePosition.trim()
    if (!clause || !position) return
    setPlaybooks(prev => prev.map(p => p.id === playbookId
      ? { ...p, rules: [...p.rules, { id: crypto.randomUUID(), clause, position }] }
      : p))
    setRuleClause(''); setRulePosition('')
  }
  function removeRule(playbookId: string, ruleId: string) {
    setPlaybooks(prev => prev.map(p => p.id === playbookId
      ? { ...p, rules: p.rules.filter(r => r.id !== ruleId) }
      : p))
  }

  async function save() {
    setSettings({ openrouterApiKey: apiKey, selectedModel: model, systemPromptExtra: systemExtra, jurisdiction, builtInSkills, customSkills, baseUrl, customModel, tavilyApiKey: tavilyKey, mcpServers, playbooks, activePlaybookId })
    if (window.electronAPI) {
      await window.electronAPI.storeSet('openrouterApiKey', apiKey)
      await window.electronAPI.storeSet('selectedModel', model)
      await window.electronAPI.storeSet('systemPromptExtra', systemExtra)
      await window.electronAPI.storeSet('jurisdiction', jurisdiction)
      await window.electronAPI.storeSet('builtInSkills', builtInSkills)
      await window.electronAPI.storeSet('customSkills', customSkills)
      await window.electronAPI.storeSet('baseUrl', baseUrl)
      await window.electronAPI.storeSet('customModel', customModel)
      await window.electronAPI.storeSet('tavilyApiKey', tavilyKey)
      await window.electronAPI.storeSet('mcpServers', mcpServers)
      await window.electronAPI.storeSet('playbooks', playbooks)
      await window.electronAPI.storeSet('activePlaybookId', activePlaybookId)
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setSettingsOpen(false) }, 1200)
  }

  function handleTheme(t: 'light' | 'dark') {
    setTheme(t)
    window.electronAPI?.storeSet('theme', t)
  }

  function toggleBuiltIn(id: string, enabled: boolean) {
    setBuiltInSkills(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
  }

  function addCustomSkill() {
    if (!newSkillName.trim() || !newSkillInstructions.trim()) return
    setCustomSkills(prev => [...prev, { id: crypto.randomUUID(), name: newSkillName.trim(), instructions: newSkillInstructions.trim() }])
    setNewSkillName('')
    setNewSkillInstructions('')
    setAddingSkill(false)
  }

  function removeCustomSkill(id: string) {
    setCustomSkills(prev => prev.filter(s => s.id !== id))
  }

  function addServer() {
    if (!srvName.trim() || !srvCommand.trim()) return
    const args = srvArgs.trim() ? srvArgs.trim().split(/\s+/) : []
    setMcpServers(prev => [...prev, { id: crypto.randomUUID(), name: srvName.trim(), command: srvCommand.trim(), args, enabled: true }])
    setSrvName(''); setSrvCommand(''); setSrvArgs(''); setAddingServer(false)
  }

  function removeServer(id: string) {
    setMcpServers(prev => prev.filter(s => s.id !== id))
  }

  function toggleServer(id: string, enabled: boolean) {
    setMcpServers(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
  }

  // Persist the current server list and (re)connect, loading their tools.
  async function connectNow() {
    setConnecting(true)
    setSettings({ mcpServers })
    await window.electronAPI?.storeSet('mcpServers', mcpServers)
    await connectMcp()
    setConnecting(false)
  }

  const keySet = apiKey.trim().length > 0
  const enabledCount = builtInSkills.filter(s => s.enabled).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}
    >
      <div
        className="bg-c-bg border border-c-border rounded-lg w-full max-w-[680px] shadow-lg animate-fade-in flex flex-col overflow-hidden"
        style={{ height: '540px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-c-border flex-shrink-0">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-c-text">Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your provider, jurisdiction, and agent tools.</p>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            aria-label="Close"
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-c-text"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar */}
          <div className="w-52 bg-c-sidebar border-r border-c-border flex-shrink-0 flex flex-col py-4 px-3">
            <p className="px-2 mb-3 text-[10px] font-semibold uppercase tracking-widest text-c-text4">
              Configuration
            </p>
            <nav className="space-y-0.5">
              {NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                    section === item.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-c-text3 hover:text-c-text2 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-[13px] ${section === item.id ? 'font-semibold' : 'font-medium'}`}>
                      {item.label}
                    </p>
                    {item.id === 'skills' && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                        {enabledCount + customSkills.length}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-c-text4 mt-0.5 font-normal">{item.sub}</p>
                </button>
              ))}
            </nav>
            <div className="mt-auto px-2">
              <p className="text-[10px] text-c-text4">OpenCowork v1.0</p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-7 space-y-6">

              {/* ── Appearance ─────────────────────────────── */}
              {section === 'appearance' && (
                <div>
                  <p className="text-c-text font-semibold text-sm mb-0.5">Theme</p>
                  <p className="text-c-text4 text-xs mb-4">Choose how OpenCowork looks on your screen.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTheme('light')}
                      className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                        theme === 'light' ? 'border-primary' : 'border-c-border hover:border-c-text4'
                      }`}
                    >
                      <div className="bg-white px-3 pt-3 pb-2">
                        <div className="flex gap-1.5 mb-2">
                          <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
                          <div className="w-6 h-1.5 bg-gray-100 rounded-full" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full" />
                          <div className="w-4/5 h-1.5 bg-gray-100 rounded-full" />
                          <div className="w-3/5 h-1.5 bg-gray-100 rounded-full" />
                        </div>
                      </div>
                      <div className={`px-3 py-2 ${theme === 'light' ? 'bg-primary/[0.06]' : 'bg-c-surface'}`}>
                        <p className={`text-xs font-semibold ${theme === 'light' ? 'text-primary' : 'text-c-text2'}`}>Light</p>
                      </div>
                      {theme === 'light' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleTheme('dark')}
                      className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                        theme === 'dark' ? 'border-primary' : 'border-c-border hover:border-c-text4'
                      }`}
                    >
                      <div className="bg-[#1a1a1a] px-3 pt-3 pb-2">
                        <div className="flex gap-1.5 mb-2">
                          <div className="w-10 h-1.5 bg-[#3a3a3a] rounded-full" />
                          <div className="w-6 h-1.5 bg-[#2a2a2a] rounded-full" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full" />
                          <div className="w-4/5 h-1.5 bg-[#2a2a2a] rounded-full" />
                          <div className="w-3/5 h-1.5 bg-[#2a2a2a] rounded-full" />
                        </div>
                      </div>
                      <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-primary/[0.06]' : 'bg-c-surface'}`}>
                        <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-primary' : 'text-c-text2'}`}>Dark</p>
                      </div>
                      {theme === 'dark' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── AI Provider ─────────────────────────────── */}
              {section === 'ai' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-c-text font-semibold text-sm flex items-center gap-2">
                        OpenRouter API Key
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${keySet ? 'bg-emerald-500' : 'bg-c-text4'}`} />
                      </p>
                      <button
                        onClick={() => window.electronAPI?.openExternal('https://openrouter.ai/keys')}
                        className="text-[11px] text-primary hover:text-foreground transition-colors"
                      >
                        Get a free key →
                      </button>
                    </div>
                    <p className="text-c-text4 text-xs mb-3">Stored locally. Only sent to openrouter.ai.</p>
                    <div className="flex items-center border border-input bg-transparent rounded-md px-3 gap-2 focus-within:ring-1 focus-within:ring-ring transition-colors">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-or-…"
                        className="flex-1 bg-transparent py-3 text-sm text-c-text placeholder-c-text4 outline-none"
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="text-xs text-c-text3 hover:text-c-text2 transition-colors flex-shrink-0 px-1"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {!keySet && (
                      <p className="text-[11px] text-amber-500 mt-2">An API key is required to use AI features.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">AI Model</p>
                    <p className="text-c-text4 text-xs mb-3">Free models need no credits. Paid models require OpenRouter balance.</p>
                    <select
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                    >
                      <optgroup label="Free Models">
                        {FREE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </optgroup>
                      <optgroup label="Paid Models">
                        {PAID_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">
                      Local / Custom Endpoint
                      <span className="text-c-text4 font-normal ml-1.5 text-[11px]">optional</span>
                    </p>
                    <p className="text-c-text4 text-xs mb-3">
                      Point to an OpenAI-compatible server (Ollama, LM Studio, self-hosted). When set, this
                      overrides the model above and your documents never leave your machine.
                    </p>
                    <input
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                    />
                    {baseUrl.trim() && (
                      <input
                        value={customModel}
                        onChange={e => setCustomModel(e.target.value)}
                        placeholder="Model name, e.g. llama3.1"
                        className="w-full mt-2 border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                      />
                    )}
                  </div>

                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">
                      Web Search Key
                      <span className="text-c-text4 font-normal ml-1.5 text-[11px]">optional</span>
                    </p>
                    <p className="text-c-text4 text-xs mb-3">
                      Add a <span className="text-c-text3">Tavily</span> key for real case-law / web results.
                      Without one, search falls back to DuckDuckGo's limited free API.
                    </p>
                    <input
                      type="password"
                      value={tavilyKey}
                      onChange={e => setTavilyKey(e.target.value)}
                      placeholder="tvly-…"
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                    />
                  </div>
                </>
              )}

              {/* ── Legal Settings ──────────────────────────── */}
              {section === 'legal' && (
                <>
                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">Legal Jurisdiction</p>
                    <p className="text-c-text4 text-xs mb-3">
                      The AI applies laws and standards from this jurisdiction when analyzing documents.
                    </p>
                    <select
                      value={jurisdiction}
                      onChange={e => setJurisdict(e.target.value)}
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                    >
                      {JURISDICTIONS.map(group => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-[11px] text-c-text4 mt-2">
                      Currently: <span className="text-c-text3 font-medium">{jurisdiction}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">
                      Custom Instructions
                      <span className="text-c-text4 font-normal ml-1.5 text-[11px]">optional</span>
                    </p>
                    <p className="text-c-text4 text-xs mb-3">
                      Added to every request — focus areas, tone, or clauses to always watch for.
                    </p>
                    <textarea
                      value={systemExtra}
                      onChange={e => setExtra(e.target.value)}
                      placeholder="e.g. Always flag arbitration clauses. Highlight indemnification risks."
                      rows={4}
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors leading-relaxed"
                    />
                    <p className="text-[11px] text-c-text4 mt-1.5">{systemExtra.trim().length} characters</p>
                  </div>
                </>
              )}

              {/* ── Playbooks ───────────────────────────────── */}
              {section === 'playbooks' && (
                <>
                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">Negotiation Playbooks</p>
                    <p className="text-c-text4 text-xs mb-3">
                      Codify your firm's positions per clause. Set one active, then use
                      <span className="text-c-text3"> "Review vs Playbook"</span> in the chat to check a document against it
                      (Complies / Deviates / Silent + suggested redline).
                    </p>

                    {/* Active selector */}
                    <select
                      value={activePlaybookId}
                      onChange={e => setActivePlaybook(e.target.value)}
                      className="w-full border border-input bg-transparent rounded-md px-3 py-3 text-sm text-c-text outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors mb-3"
                    >
                      <option value="">No active playbook</option>
                      {playbooks.map(p => <option key={p.id} value={p.id}>{p.name} ({p.rules.length} rules)</option>)}
                    </select>

                    {/* Playbook list */}
                    {playbooks.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {playbooks.map(pb => {
                          const isOpen = editingPlaybookId === pb.id
                          const isActive = activePlaybookId === pb.id
                          return (
                            <div key={pb.id} className="rounded-lg border border-c-border bg-c-surface overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-2.5">
                                <button
                                  onClick={() => setEditingPlaybookId(isOpen ? null : pb.id)}
                                  className="flex flex-1 items-center gap-2 min-w-0 text-left"
                                >
                                  <span className={`text-c-text4 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                                  <span className="text-sm font-medium text-c-text truncate">{pb.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{pb.rules.length} rules</span>
                                  {isActive && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Active</span>}
                                </button>
                                <button
                                  onClick={() => removePlaybook(pb.id)}
                                  className="text-xs text-c-text4 hover:text-destructive transition-colors flex-shrink-0"
                                >
                                  Remove
                                </button>
                              </div>

                              {isOpen && (
                                <div className="border-t border-c-border px-3 py-2.5 space-y-2">
                                  {pb.rules.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground">No positions yet. Add one below.</p>
                                  )}
                                  {pb.rules.map(r => (
                                    <div key={r.id} className="flex items-start gap-2 rounded-md bg-c-bg border border-c-border px-2.5 py-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-c-text">{r.clause}</p>
                                        <p className="text-[11px] text-muted-foreground">{r.position}</p>
                                      </div>
                                      <button
                                        onClick={() => removeRule(pb.id, r.id)}
                                        className="text-c-text4 hover:text-destructive text-base leading-none flex-shrink-0"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                  {/* Add rule */}
                                  <div className="flex flex-col gap-2 pt-1">
                                    <input
                                      value={ruleClause}
                                      onChange={e => setRuleClause(e.target.value)}
                                      placeholder="Clause, e.g. Limitation of Liability"
                                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                                    />
                                    <textarea
                                      value={rulePosition}
                                      onChange={e => setRulePosition(e.target.value)}
                                      placeholder="Position, e.g. Liability must be capped at 12 months' fees; reject uncapped liability."
                                      rows={2}
                                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors leading-relaxed"
                                    />
                                    <button
                                      onClick={() => addRule(pb.id)}
                                      disabled={!ruleClause.trim() || !rulePosition.trim()}
                                      className="self-end inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                      Add position
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {playbooks.length === 0 && (
                      <div className="border border-dashed border-c-border rounded-lg px-4 py-5 text-center mb-3">
                        <p className="text-xs text-muted-foreground">No playbooks yet. Create one to encode your negotiation positions.</p>
                      </div>
                    )}

                    {/* New playbook */}
                    <div className="flex gap-2">
                      <input
                        value={newPlaybookName}
                        onChange={e => setNewPlaybookName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addPlaybook() }}
                        placeholder="New playbook name, e.g. SaaS Buy-Side"
                        className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                      />
                      <button
                        onClick={addPlaybook}
                        disabled={!newPlaybookName.trim()}
                        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Create
                      </button>
                    </div>
                    <p className="text-[11px] text-c-text4 mt-2">Remember to <span className="text-c-text3">Save changes</span> below to persist playbooks.</p>
                  </div>
                </>
              )}

              {/* ── Skills ──────────────────────────────────── */}
              {section === 'skills' && (
                <>
                  {/* Built-in skills */}
                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">Built-in Skills</p>
                    <p className="text-c-text4 text-xs mb-3">
                      Toggle which tools the agent can use when analyzing documents.
                    </p>
                    <div className="border border-c-border rounded-lg divide-y divide-c-border overflow-hidden">
                      {builtInSkills.map(skill => {
                        const info = BUILTIN_SKILL_INFO[skill.id]
                        if (!info) return null
                        return (
                          <div key={skill.id} className="flex items-center gap-3 px-4 py-3 bg-c-surface">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-c-text">{info.name}</p>
                              <p className="text-xs text-c-text4 mt-0.5 truncate">{info.description}</p>
                            </div>
                            <Toggle on={skill.enabled} onChange={v => toggleBuiltIn(skill.id, v)} />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Custom skills */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-c-text font-semibold text-sm">Custom Skills</p>
                      {!addingSkill && (
                        <button
                          onClick={() => setAddingSkill(true)}
                          className="text-[11px] text-primary hover:text-foreground transition-colors font-medium"
                        >
                          + Add skill
                        </button>
                      )}
                    </div>
                    <p className="text-c-text4 text-xs mb-3">
                      Add your own capabilities — the agent will follow these instructions when relevant.
                    </p>

                    {/* Existing custom skills */}
                    {customSkills.length > 0 && (
                      <div className="border border-c-border rounded-lg divide-y divide-c-border overflow-hidden mb-3">
                        {customSkills.map(skill => (
                          <div key={skill.id} className="flex items-start gap-3 px-4 py-3 bg-c-surface">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-c-text">{skill.name}</p>
                              <p className="text-xs text-c-text4 mt-0.5 line-clamp-2">{skill.instructions}</p>
                            </div>
                            <button
                              onClick={() => removeCustomSkill(skill.id)}
                              className="flex-shrink-0 text-xs text-c-text4 hover:text-red-500 transition-colors mt-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {customSkills.length === 0 && !addingSkill && (
                      <div className="border border-dashed border-c-border rounded-lg px-4 py-5 text-center mb-3">
                        <p className="text-xs text-c-text4">No custom skills yet.</p>
                        <p className="text-xs text-c-text4 mt-0.5">Add one to extend what the agent can do.</p>
                      </div>
                    )}

                    {/* Add skill form */}
                    {addingSkill && (
                      <div className="border border-c-border rounded-lg p-4 bg-c-surface space-y-3">
                        <div>
                          <p className="text-xs font-medium text-c-text mb-1.5">Skill name</p>
                          <input
                            autoFocus
                            value={newSkillName}
                            onChange={e => setNewSkillName(e.target.value)}
                            placeholder="e.g. GDPR Compliance Check"
                            className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-c-text mb-1.5">Instructions</p>
                          <textarea
                            value={newSkillInstructions}
                            onChange={e => setNewSkillInstructions(e.target.value)}
                            placeholder="Describe what the agent should do with this skill…"
                            rows={3}
                            className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors leading-relaxed"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setAddingSkill(false); setNewSkillName(''); setNewSkillInstructions('') }}
                            className="px-3 py-1.5 text-xs text-c-text3 hover:text-c-text transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addCustomSkill}
                            disabled={!newSkillName.trim() || !newSkillInstructions.trim()}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            Add skill
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── MCP Servers ─────────────────────────────── */}
              {section === 'mcp' && (
                <>
                  <div>
                    <p className="text-c-text font-semibold text-sm mb-0.5">MCP Servers</p>
                    <p className="text-c-text4 text-xs mb-3">
                      Connect Model Context Protocol servers to extend the agent with external tools
                      (legal databases, clause libraries, file access, etc.). Servers run locally over stdio.
                    </p>

                    {mcpServers.length > 0 && (
                      <div className="border border-c-border rounded-lg divide-y divide-c-border overflow-hidden mb-3">
                        {mcpServers.map(srv => (
                          <div key={srv.id} className="flex items-start gap-3 px-4 py-3 bg-c-surface">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-c-text">{srv.name}</p>
                              <p className="text-xs text-c-text4 mt-0.5 truncate">
                                {srv.command} {(srv.args ?? []).join(' ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Toggle on={srv.enabled !== false} onChange={v => toggleServer(srv.id, v)} />
                              <button
                                onClick={() => removeServer(srv.id)}
                                className="text-xs text-c-text4 hover:text-red-500 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {mcpServers.length === 0 && !addingServer && (
                      <div className="border border-dashed border-c-border rounded-lg px-4 py-5 text-center mb-3">
                        <p className="text-xs text-c-text4">No MCP servers configured.</p>
                      </div>
                    )}

                    {addingServer ? (
                      <div className="border border-c-border rounded-lg p-4 bg-c-surface space-y-2.5">
                        <input
                          autoFocus
                          value={srvName}
                          onChange={e => setSrvName(e.target.value)}
                          placeholder="Name, e.g. filesystem"
                          className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                        />
                        <input
                          value={srvCommand}
                          onChange={e => setSrvCommand(e.target.value)}
                          placeholder="Command, e.g. npx"
                          className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                        />
                        <input
                          value={srvArgs}
                          onChange={e => setSrvArgs(e.target.value)}
                          placeholder="Arguments, e.g. -y @modelcontextprotocol/server-filesystem /docs"
                          className="w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setAddingServer(false); setSrvName(''); setSrvCommand(''); setSrvArgs('') }}
                            className="px-3 py-1.5 text-xs text-c-text3 hover:text-c-text transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addServer}
                            disabled={!srvName.trim() || !srvCommand.trim()}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            Add server
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingServer(true)}
                        className="text-[11px] text-primary hover:text-foreground transition-colors font-medium"
                      >
                        + Add server
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={connectNow}
                        disabled={connecting}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                      >
                        {connecting ? 'Connecting…' : 'Connect / Refresh'}
                      </button>
                      {mcpStatus && <p className="text-[11px] text-c-text4">{mcpStatus}</p>}
                    </div>
                    <p className="text-[11px] text-c-text4 mt-2">
                      Connected tools become available to the agent in Document Chat.
                    </p>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-c-border flex-shrink-0 bg-c-sidebar">
          <button
            onClick={() => setSettingsOpen(false)}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md border border-input bg-background text-c-text hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className={`inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              saved ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
