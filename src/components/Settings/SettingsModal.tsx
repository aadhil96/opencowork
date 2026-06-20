import { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { AVAILABLE_MODELS } from '../../lib/openrouter'
import type { BuiltInSkillSetting, CustomSkill, McpServerConfig } from '../../types'
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

type Section = 'appearance' | 'ai' | 'legal' | 'skills' | 'mcp'

const NAV: { id: Section; label: string; sub: string }[] = [
  { id: 'appearance', label: 'Appearance',     sub: 'Theme' },
  { id: 'ai',         label: 'AI Provider',    sub: 'API key & model' },
  { id: 'legal',      label: 'Legal Settings', sub: 'Jurisdiction & instructions' },
  { id: 'skills',     label: 'Skills',         sub: 'Agent tools & custom skills' },
  { id: 'mcp',        label: 'MCP Servers',    sub: 'External agent tools' },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${on ? 'bg-blue-500' : 'bg-c-border'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-4' : ''}`}
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

  async function save() {
    setSettings({ openrouterApiKey: apiKey, selectedModel: model, systemPromptExtra: systemExtra, jurisdiction, builtInSkills, customSkills, baseUrl, customModel, tavilyApiKey: tavilyKey, mcpServers })
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}
    >
      <div
        className="bg-c-bg border border-c-border rounded-2xl w-full max-w-[680px] shadow-2xl animate-fade-in flex flex-col overflow-hidden"
        style={{ height: '540px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border flex-shrink-0">
          <span className="text-c-text font-semibold text-sm tracking-tight">Settings</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-c-text4 hover:text-c-text3 hover:bg-c-elevated text-xl leading-none transition-colors"
          >
            ×
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
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                    section === item.id
                      ? 'bg-c-elevated text-c-text shadow-sm'
                      : 'text-c-text3 hover:text-c-text2 hover:bg-c-elevated/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-[13px] ${section === item.id ? 'font-semibold' : 'font-medium'}`}>
                      {item.label}
                    </p>
                    {item.id === 'skills' && (
                      <span className="text-[10px] text-c-text4 bg-c-elevated px-1.5 py-0.5 rounded-md">
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
                      className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                        theme === 'light' ? 'border-blue-500' : 'border-c-border hover:border-c-text4'
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
                      <div className={`px-3 py-2 ${theme === 'light' ? 'bg-blue-500/[0.06]' : 'bg-c-surface'}`}>
                        <p className={`text-xs font-semibold ${theme === 'light' ? 'text-blue-600' : 'text-c-text2'}`}>Light</p>
                      </div>
                      {theme === 'light' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleTheme('dark')}
                      className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                        theme === 'dark' ? 'border-blue-500' : 'border-c-border hover:border-c-text4'
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
                      <div className={`px-3 py-2 ${theme === 'dark' ? 'bg-blue-500/[0.06]' : 'bg-c-surface'}`}>
                        <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-blue-500' : 'text-c-text2'}`}>Dark</p>
                      </div>
                      {theme === 'dark' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
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
                        className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
                      >
                        Get a free key →
                      </button>
                    </div>
                    <p className="text-c-text4 text-xs mb-3">Stored locally. Only sent to openrouter.ai.</p>
                    <div className="flex items-center bg-c-input border border-c-border rounded-xl px-3 gap-2 focus-within:border-c-text4 transition-colors">
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
                      className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text outline-none focus:border-c-text4 transition-colors"
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
                      className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                    />
                    {baseUrl.trim() && (
                      <input
                        value={customModel}
                        onChange={e => setCustomModel(e.target.value)}
                        placeholder="Model name, e.g. llama3.1"
                        className="w-full mt-2 bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
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
                      className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
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
                      className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text outline-none focus:border-c-text4 transition-colors"
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
                      className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 resize-none transition-colors leading-relaxed"
                    />
                    <p className="text-[11px] text-c-text4 mt-1.5">{systemExtra.trim().length} characters</p>
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
                    <div className="border border-c-border rounded-xl divide-y divide-c-border overflow-hidden">
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
                          className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors font-medium"
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
                      <div className="border border-c-border rounded-xl divide-y divide-c-border overflow-hidden mb-3">
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
                      <div className="border border-dashed border-c-border rounded-xl px-4 py-5 text-center mb-3">
                        <p className="text-xs text-c-text4">No custom skills yet.</p>
                        <p className="text-xs text-c-text4 mt-0.5">Add one to extend what the agent can do.</p>
                      </div>
                    )}

                    {/* Add skill form */}
                    {addingSkill && (
                      <div className="border border-c-border rounded-xl p-4 bg-c-surface space-y-3">
                        <div>
                          <p className="text-xs font-medium text-c-text mb-1.5">Skill name</p>
                          <input
                            autoFocus
                            value={newSkillName}
                            onChange={e => setNewSkillName(e.target.value)}
                            placeholder="e.g. GDPR Compliance Check"
                            className="w-full bg-c-input border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-c-text mb-1.5">Instructions</p>
                          <textarea
                            value={newSkillInstructions}
                            onChange={e => setNewSkillInstructions(e.target.value)}
                            placeholder="Describe what the agent should do with this skill…"
                            rows={3}
                            className="w-full bg-c-input border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 resize-none transition-colors leading-relaxed"
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
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                      <div className="border border-c-border rounded-xl divide-y divide-c-border overflow-hidden mb-3">
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
                      <div className="border border-dashed border-c-border rounded-xl px-4 py-5 text-center mb-3">
                        <p className="text-xs text-c-text4">No MCP servers configured.</p>
                      </div>
                    )}

                    {addingServer ? (
                      <div className="border border-c-border rounded-xl p-4 bg-c-surface space-y-2.5">
                        <input
                          autoFocus
                          value={srvName}
                          onChange={e => setSrvName(e.target.value)}
                          placeholder="Name, e.g. filesystem"
                          className="w-full bg-c-input border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                        />
                        <input
                          value={srvCommand}
                          onChange={e => setSrvCommand(e.target.value)}
                          placeholder="Command, e.g. npx"
                          className="w-full bg-c-input border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
                        />
                        <input
                          value={srvArgs}
                          onChange={e => setSrvArgs(e.target.value)}
                          placeholder="Arguments, e.g. -y @modelcontextprotocol/server-filesystem /docs"
                          className="w-full bg-c-input border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
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
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            Add server
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingServer(true)}
                        className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors font-medium"
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
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-c-text text-c-bg hover:opacity-80 disabled:opacity-40 transition-all"
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
            className="px-4 py-2 text-sm text-c-text3 hover:text-c-text rounded-lg hover:bg-c-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-c-text text-c-bg hover:opacity-80'
            }`}
          >
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
