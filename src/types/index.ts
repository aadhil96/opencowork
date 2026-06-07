export interface Document {
  id: string
  name: string
  ext: string
  path: string
  size: number
  content: string
  rawData: string
  extractionError?: string
  loadedAt: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  mode: 'chat' | 'research'
}

export interface AgentTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface BuiltInSkillSetting {
  id: string
  enabled: boolean
}

export interface CustomSkill {
  id: string
  name: string
  instructions: string
}

export interface Settings {
  openrouterApiKey: string
  selectedModel: string
  systemPromptExtra: string
  jurisdiction: string
  builtInSkills: BuiltInSkillSetting[]
  customSkills: CustomSkill[]
  activeSubAgentId: string
}

export interface SubAgent {
  id: string
  name: string
  role: string
  description: string
  accent: string
  systemPrompt: string
}

export type PanelMode = 'chat' | 'research'

export interface RiskFlag {
  severity: 'high' | 'medium' | 'low'
  clause: string
  reason: string
}
