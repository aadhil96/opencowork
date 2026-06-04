import { useEffect } from 'react'
import { useAppStore } from './lib/store'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import SettingsModal from './components/Settings/SettingsModal'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ path: string; name: string; ext: string; data: string } | null>
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
      const savedTheme      = ((await window.electronAPI.storeGet('theme')) as string) || 'light'
      setSettings({ openrouterApiKey: apiKey, selectedModel, systemPromptExtra })
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
