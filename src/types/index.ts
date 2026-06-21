export interface Document {
  id: string
  name: string
  ext: string
  path: string
  size: number
  content: string
  html?: string
  rawData: string
  extractionError?: string
  loadedAt: number
}

// A single source surfaced by a web/legal search, shown as a Perplexity-style card.
export interface SearchSource {
  title: string
  url: string
  snippet?: string
}

// One search the agent ran during a turn (web_search / legal_search / verify_citation).
// Rendered above the assistant answer so the user can see what was searched and cited.
export interface SearchActivity {
  id: string
  tool: 'web_search' | 'legal_search' | 'verify_citation' | string
  query: string
  status: 'searching' | 'done' | 'error'
  sources: SearchSource[]
  // For verify_citation: whether CourtListener confirmed the cite.
  verified?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  mode: 'chat' | 'research'
  // Search activity captured during this assistant turn (web/legal lookups).
  searches?: SearchActivity[]
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

// A Project groups related chat sessions and shares context (instructions +
// documents) across all of them, so a multi-week matter doesn't bleed into
// ad-hoc chats. Sessions without a project (projectId: null) are ungrouped.
export interface Project {
  id: string
  name: string
  instructions: string
  documentIds: string[]
  createdAt: number
  updatedAt: number
}

// A Playbook codifies a firm's negotiation positions per clause (Spellbook-style).
// When a playbook is active, the agent reviews documents against these positions
// and flags deviations.
export interface PlaybookRule {
  id: string
  clause: string      // e.g. "Limitation of Liability"
  position: string    // the firm's preferred / acceptable / unacceptable stance
}

export interface Playbook {
  id: string
  name: string
  rules: PlaybookRule[]
}

export interface McpServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
}

export interface McpToolInfo {
  serverId: string
  serverName: string
  name: string
  description: string
  inputSchema: unknown
}

export interface Settings {
  openrouterApiKey: string
  selectedModel: string
  systemPromptExtra: string
  jurisdiction: string
  builtInSkills: BuiltInSkillSetting[]
  customSkills: CustomSkill[]
  activeSubAgentId: string
  // Custom OpenAI-compatible endpoint (Ollama / LM Studio / self-hosted). Empty = OpenRouter.
  baseUrl: string
  customModel: string
  // Optional Tavily key for real web-search results.
  tavilyApiKey: string
  // User-configured MCP servers (extend the agent with external tools).
  mcpServers: McpServerConfig[]
  // Negotiation playbooks + which one is active ('' = none).
  playbooks: Playbook[]
  activePlaybookId: string
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
