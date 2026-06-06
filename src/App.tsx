import { useEffect } from 'react'
import { useAppStore } from './lib/store'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import SettingsModal from './components/Settings/SettingsModal'

export interface OpenFileResult {
  path: string
  name: string
  ext: string
  size: number
  data: string
  content: string
  extractionError?: string
}

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<OpenFileResult | { error: string } | null>
      storeGet: (key: string) => Promise<unknown>
      storeSet: (key: string, value: unknown) => Promise<void>
      storeDelete: (key: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
    }
  }
}

export default function App() {
  const { setSettings, settingsOpen, setTheme } = useAppStore()

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) return
      const apiKey          = ((await window.electronAPI.storeGet('openrouterApiKey')) as string) || ''
      const selectedModel   = ((await window.electronAPI.storeGet('selectedModel')) as string)    || 'anthropic/claude-3.5-sonnet'
      const systemPromptExtra = ((await window.electronAPI.storeGet('systemPromptExtra')) as string) || ''
      const jurisdiction    = ((await window.electronAPI.storeGet('jurisdiction')) as string)     || 'General / International'
      const savedTheme      = ((await window.electronAPI.storeGet('theme')) as string) || 'light'
      const builtInSkills   = (await window.electronAPI.storeGet('builtInSkills')) as import('./types').BuiltInSkillSetting[] | null
      const customSkills    = (await window.electronAPI.storeGet('customSkills'))    as import('./types').CustomSkill[] | null
      setSettings({
        openrouterApiKey: apiKey, selectedModel, systemPromptExtra, jurisdiction,
        ...(builtInSkills ? { builtInSkills } : {}),
        ...(customSkills  ? { customSkills  } : {}),
      })
      setTheme(savedTheme as 'light' | 'dark')
    }
    load()
  }, [setSettings, setTheme])

  return (
    <div className="flex h-screen bg-c-bg text-c-text font-sans overflow-hidden select-none">
      <Sidebar />
      <MainArea />
      {settingsOpen && <SettingsModal />}
    </div>
  )
}
