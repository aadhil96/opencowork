import { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { AVAILABLE_MODELS } from '../../lib/openrouter'

export default function SettingsModal() {
  const { settings, setSettings, setSettingsOpen, theme, setTheme } = useAppStore()
  const [apiKey, setApiKey] = useState(settings.openrouterApiKey)
  const [model, setModel] = useState(settings.selectedModel)
  const [systemExtra, setSystemExtra] = useState(settings.systemPromptExtra)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSettings({ openrouterApiKey: apiKey, selectedModel: model, systemPromptExtra: systemExtra })
    if (window.electronAPI) {
      await window.electronAPI.storeSet('openrouterApiKey', apiKey)
      await window.electronAPI.storeSet('selectedModel', model)
      await window.electronAPI.storeSet('systemPromptExtra', systemExtra)
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setSettingsOpen(false) }, 1200)
  }

  function handleTheme(t: 'light' | 'dark') {
    setTheme(t)
    window.electronAPI?.storeSet('theme', t)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}
    >
      <div className="bg-c-elevated border border-c-border rounded-2xl w-full max-w-[480px] shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-c-border">
          <h2 className="text-c-text font-semibold">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-xs text-c-text3 hover:text-c-text px-2 py-1 rounded-lg hover:bg-c-input transition-colors"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-3">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleTheme(t)}
                  className={`px-4 py-3 rounded-xl border transition-colors text-sm font-medium ${
                    theme === t
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                      : 'border-c-border text-c-text2 hover:border-c-text4 hover:bg-c-input'
                  }`}
                >
                  {t === 'light' ? 'Light' : 'Dark'}
                  {theme === t && <span className="ml-2 text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-c-text">OpenRouter API Key</label>
              <button
                onClick={() => window.electronAPI?.openExternal('https://openrouter.ai/keys')}
                className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
              >
                Get key →
              </button>
            </div>
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
                className="text-xs text-c-text3 hover:text-c-text2 transition-colors"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-c-text4 mt-2">
              Stored locally. Never sent anywhere except OpenRouter.
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-2">AI Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text outline-none focus:border-c-text4 transition-colors"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Custom instructions */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-2">
              Custom Instructions
              <span className="text-c-text3 font-normal ml-1 text-xs">(optional)</span>
            </label>
            <textarea
              value={systemExtra}
              onChange={e => setSystemExtra(e.target.value)}
              placeholder="e.g. Focus on UK law. Flag arbitration clauses. Use plain English."
              rows={3}
              className="w-full bg-c-input border border-c-border rounded-xl px-3 py-3 text-sm text-c-text placeholder-c-text4 outline-none focus:border-c-text4 resize-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-c-border">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 text-sm text-c-text3 hover:text-c-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-c-text text-c-bg hover:opacity-80'
            }`}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
