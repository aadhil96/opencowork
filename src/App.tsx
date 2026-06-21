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
  html?: string
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
      webSearch: (query: string) => Promise<string>
      legalSearch: (query: string, court?: string) => Promise<string>
      verifyCitation: (citation: string) => Promise<string>
      exportDocument: (args: { defaultName: string; format: 'docx' | 'pptx' | 'md' | 'txt'; content: string }) =>
        Promise<{ path: string } | { canceled: true } | { error: string }>
      mcpConnect: (configs: import('./types').McpServerConfig[]) =>
        Promise<{ tools: import('./types').McpToolInfo[]; error?: string }>
      mcpCallTool: (server: string, name: string, args: Record<string, unknown>) => Promise<string>
    }
  }
}

export default function App() {
  const { setSettings, settingsOpen, setTheme, hydrate, connectMcp } = useAppStore()

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) return

      // Restore persisted chat history first, before anything triggers a save.
      const [savedSessions, savedDocuments, savedActiveId, savedProjects, savedActiveProjectId] = await Promise.all([
        window.electronAPI.storeGet('sessions'),
        window.electronAPI.storeGet('documents'),
        window.electronAPI.storeGet('activeSessionId'),
        window.electronAPI.storeGet('projects'),
        window.electronAPI.storeGet('activeProjectId'),
      ])
      hydrate({
        sessions: savedSessions as import('./lib/store').Session[] | null,
        documents: savedDocuments as Record<string, import('./types').Document> | null,
        activeSessionId: savedActiveId as string | null,
        projects: savedProjects as import('./types').Project[] | null,
        activeProjectId: savedActiveProjectId as string | null,
      })

      const apiKey          = ((await window.electronAPI.storeGet('openrouterApiKey')) as string) || ''
      const selectedModel   = ((await window.electronAPI.storeGet('selectedModel')) as string)    || 'openai/gpt-oss-120b:free'
      const systemPromptExtra = ((await window.electronAPI.storeGet('systemPromptExtra')) as string) || ''
      const jurisdiction    = ((await window.electronAPI.storeGet('jurisdiction')) as string)     || 'General / International'
      const savedTheme      = ((await window.electronAPI.storeGet('theme')) as string) || 'light'
      const builtInSkills    = (await window.electronAPI.storeGet('builtInSkills'))    as import('./types').BuiltInSkillSetting[] | null
      const customSkills     = (await window.electronAPI.storeGet('customSkills'))     as import('./types').CustomSkill[] | null
      const activeSubAgentId = ((await window.electronAPI.storeGet('activeSubAgentId')) as string) || 'auto'
      const baseUrl         = ((await window.electronAPI.storeGet('baseUrl')) as string)         || ''
      const customModel     = ((await window.electronAPI.storeGet('customModel')) as string)     || ''
      const tavilyApiKey    = ((await window.electronAPI.storeGet('tavilyApiKey')) as string)    || ''
      const mcpServers      = (await window.electronAPI.storeGet('mcpServers')) as import('./types').McpServerConfig[] | null
      const playbooks       = (await window.electronAPI.storeGet('playbooks')) as import('./types').Playbook[] | null
      const activePlaybookId = ((await window.electronAPI.storeGet('activePlaybookId')) as string) || ''
      setSettings({
        openrouterApiKey: apiKey, selectedModel, systemPromptExtra, jurisdiction, activeSubAgentId,
        baseUrl, customModel, tavilyApiKey, activePlaybookId,
        ...(mcpServers ? { mcpServers } : {}),
        ...(playbooks ? { playbooks } : {}),
        ...(builtInSkills ? { builtInSkills } : {}),
        ...(customSkills  ? { customSkills  } : {}),
      })
      setTheme(savedTheme as 'light' | 'dark')

      // Connect to any configured MCP servers and load their tools.
      if (mcpServers && mcpServers.length > 0) connectMcp()
    }
    load()
  }, [setSettings, setTheme, hydrate, connectMcp])

  return (
    <div className="flex h-screen bg-c-bg text-c-text font-sans overflow-hidden select-none">
      <Sidebar />
      <MainArea />
      {settingsOpen && <SettingsModal />}
    </div>
  )
}
