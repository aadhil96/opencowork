import { create } from 'zustand'
import type { AgentTool, Document, McpToolInfo, Message, Project, Settings, PanelMode, SearchActivity } from '../types'
import { mcpToolsToAgentTools } from './agent'

export interface Session {
  id: string
  name: string
  messages: Message[]
  documentIds: string[]
  // null = ungrouped (top-level "Recent"); otherwise belongs to a Project.
  projectId: string | null
  createdAt: number
  updatedAt: number
}

interface AppState {
  sessions: Session[]
  activeSessionId: string | null
  // Projects: when activeProjectId is set, the sidebar scopes to that project
  // and new sessions inherit its instructions + documents.
  projects: Project[]
  activeProjectId: string | null
  documents: Record<string, Document>
  panelMode: PanelMode
  showDocPanel: boolean
  isStreaming: boolean
  abortController: AbortController | null
  settings: Settings
  settingsOpen: boolean
  showSkillsPanel: boolean
  theme: 'light' | 'dark'
  mcpTools: AgentTool[]
  mcpStatus: string
  connectMcp: () => Promise<void>
  setTheme: (t: 'light' | 'dark') => void

  // Session actions
  createSession: () => string
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  setActiveSession: (id: string) => void

  // Project actions
  createProject: (name: string) => string
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  updateProjectInstructions: (id: string, instructions: string) => void
  addDocumentToProject: (projectId: string, doc: Document) => void
  removeDocumentFromProject: (projectId: string, docId: string) => void
  setActiveProject: (id: string | null) => void
  getActiveProject: () => Project | null

  // Message actions (operate on active session)
  addMessage: (msg: Message) => void
  appendToLastMessage: (chunk: string) => void
  clearMessages: () => void

  // Search activity (Perplexity-style) — attached to the last assistant message
  addSearchActivity: (activity: SearchActivity) => void
  updateSearchActivity: (activityId: string, patch: Partial<SearchActivity>) => void

  // Document actions
  addSessionDocument: (doc: Document) => void
  getActiveDocument: () => Document | null
  getActiveDocuments: () => Document[]
  removeDocument: (docId: string) => void

  // UI
  setPanelMode: (mode: PanelMode) => void
  setShowDocPanel: (show: boolean) => void
  setStreaming: (val: boolean) => void
  startStreaming: (controller: AbortController) => void
  stopStreaming: () => void
  setSettings: (s: Partial<Settings>) => void
  setSettingsOpen: (open: boolean) => void
  setShowSkillsPanel: (show: boolean) => void

  // Selectors
  activeSession: () => Session | null
  activeMessages: () => Message[]

  // Persistence
  hydrate: (data: {
    sessions?: Session[] | null
    documents?: Record<string, Document> | null
    activeSessionId?: string | null
    projects?: Project[] | null
    activeProjectId?: string | null
  }) => void
}

const defaultSettings: Settings = {
  openrouterApiKey: '',
  selectedModel: 'openai/gpt-oss-120b:free',
  systemPromptExtra: '',
  jurisdiction: 'General / International',
  builtInSkills: [
    { id: 'extract_clauses',     enabled: true },
    { id: 'identify_risks',      enabled: true },
    { id: 'summarize_document',  enabled: true },
    { id: 'search_document',     enabled: true },
    { id: 'compare_to_standard', enabled: true },
  ],
  customSkills: [],
  activeSubAgentId: 'auto',
  baseUrl: '',
  customModel: '',
  tavilyApiKey: '',
  mcpServers: [],
  playbooks: [],
  activePlaybookId: ''
}

// Drop any Document not referenced by some session OR project — prevents
// removed or orphaned attachments (each up to 50 MB of base64) from
// accumulating forever.
function pruneOrphanDocs(
  sessions: Session[],
  projects: Project[],
  documents: Record<string, Document>
): Record<string, Document> {
  const live = new Set<string>()
  for (const s of sessions) for (const id of s.documentIds) live.add(id)
  for (const p of projects) for (const id of p.documentIds) live.add(id)
  let changed = false
  const next: Record<string, Document> = {}
  for (const [id, doc] of Object.entries(documents)) {
    if (live.has(id)) next[id] = doc
    else changed = true
  }
  return changed ? next : documents
}

function makeSession(projectId: string | null = null): Session {
  return {
    id: crypto.randomUUID(),
    name: 'New Chat',
    messages: [],
    documentIds: [],
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function makeProject(name: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    instructions: '',
    documentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

const initialSession = makeSession()

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [initialSession],
  activeSessionId: initialSession.id,
  projects: [],
  activeProjectId: null,
  documents: {},
  panelMode: 'chat',
  showDocPanel: true,
  isStreaming: false,
  abortController: null,
  settings: defaultSettings,
  settingsOpen: false,
  showSkillsPanel: true,
  theme: 'light',
  mcpTools: [],
  mcpStatus: '',

  connectMcp: async () => {
    if (!window.electronAPI?.mcpConnect) return
    const servers = get().settings.mcpServers ?? []
    const res = await window.electronAPI.mcpConnect(servers) as { tools: McpToolInfo[]; error?: string }
    const all = res.tools ?? []
    const tools = mcpToolsToAgentTools(all)
    const errors = all.filter(t => t.name === '__error__')
    const serverCount = new Set(all.map(t => t.serverId)).size
    const status = res.error
      ? `Error: ${res.error}`
      : errors.length
        ? `${tools.length} tool(s); ${errors.map(e => `${e.serverName} failed: ${e.description}`).join('; ')}`
        : tools.length
          ? `${tools.length} tool(s) from ${serverCount} server(s)`
          : servers.length ? 'No tools discovered' : ''
    set({ mcpTools: tools, mcpStatus: status })
  },

  setTheme: (t) => {
    const html = document.documentElement
    if (t === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
    set({ theme: t })
  },

  createSession: () => {
    // New chats inherit the currently-active project scope.
    const s = makeSession(get().activeProjectId)
    set(state => ({ sessions: [s, ...state.sessions], activeSessionId: s.id }))
    return s.id
  },

  deleteSession: (id) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== id)
      const base = sessions.length === 0 ? [makeSession(state.activeProjectId)] : sessions
      const activeSessionId = sessions.length === 0
        ? base[0].id
        : state.activeSessionId === id ? base[0].id : state.activeSessionId
      return { sessions: base, activeSessionId, documents: pruneOrphanDocs(base, state.projects, state.documents) }
    })
  },

  renameSession: (id, name) => {
    set(state => ({
      sessions: state.sessions.map(s => s.id === id ? { ...s, name } : s)
    }))
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  addMessage: (msg) => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s =>
          s.id === id
            ? { ...s, messages: [...s.messages, msg], updatedAt: Date.now() }
            : s
        )
      }
    })
  },

  appendToLastMessage: (chunk) => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s => {
          if (s.id !== id) return s
          const msgs = [...s.messages]
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              content: msgs[msgs.length - 1].content + chunk
            }
          }
          return { ...s, messages: msgs }
        })
      }
    })
  },

  clearMessages: () => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, messages: [], updatedAt: Date.now() } : s
        )
      }
    })
  },

  addSearchActivity: (activity) => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s => {
          if (s.id !== id) return s
          const msgs = [...s.messages]
          // Attach to the most recent assistant message (the streaming placeholder).
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], searches: [...(msgs[i].searches ?? []), activity] }
              break
            }
          }
          return { ...s, messages: msgs }
        })
      }
    })
  },

  updateSearchActivity: (activityId, patch) => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s => {
          if (s.id !== id) return s
          const msgs = [...s.messages]
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i]
            if (m.role === 'assistant' && m.searches?.some(a => a.id === activityId)) {
              msgs[i] = { ...m, searches: m.searches.map(a => a.id === activityId ? { ...a, ...patch } : a) }
              break
            }
          }
          return { ...s, messages: msgs }
        })
      }
    })
  },

  addSessionDocument: (doc) => {
    set(state => {
      const id = state.activeSessionId
      return {
        documents: { ...state.documents, [doc.id]: doc },
        sessions: state.sessions.map(s => {
          if (s.id !== id) return s
          // Name the session after its first document while it's still untitled.
          const name = s.name === 'New Chat' && s.documentIds.length === 0 ? doc.name : s.name
          return { ...s, documentIds: [...s.documentIds, doc.id], name, updatedAt: Date.now() }
        })
      }
    })
  },

  getActiveDocument: () => {
    return get().getActiveDocuments()[0] ?? null
  },

  getActiveDocuments: () => {
    const { sessions, activeSessionId, projects, documents } = get()
    const session = sessions.find(s => s.id === activeSessionId)
    if (!session) return []
    // Project documents come first, then session-specific ones. Dedupe by id
    // so a doc that exists in both places appears once.
    const project = session.projectId ? projects.find(p => p.id === session.projectId) : null
    const ids = [...(project?.documentIds ?? []), ...session.documentIds]
    const seen = new Set<string>()
    const out: Document[] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const doc = documents[id]
      if (doc) out.push(doc)
    }
    return out
  },

  removeDocument: (docId) => {
    set(state => {
      const id = state.activeSessionId
      const sessions = state.sessions.map(s =>
        s.id === id ? { ...s, documentIds: s.documentIds.filter(d => d !== docId), updatedAt: Date.now() } : s
      )
      const active = sessions.find(s => s.id === id)
      return {
        sessions,
        documents: pruneOrphanDocs(sessions, state.projects, state.documents),
        showDocPanel: active && active.documentIds.length > 0 ? state.showDocPanel : false
      }
    })
  },

  activeSession: () => {
    const { sessions, activeSessionId } = get()
    return sessions.find(s => s.id === activeSessionId) ?? null
  },

  activeMessages: () => {
    const { sessions, activeSessionId, panelMode } = get()
    const session = sessions.find(s => s.id === activeSessionId)
    return (session?.messages ?? []).filter(m => m.mode === panelMode)
  },

  // ── Projects ────────────────────────────────────────────
  createProject: (name) => {
    const p = makeProject(name.trim() || 'New project')
    set(state => ({ projects: [p, ...state.projects], activeProjectId: p.id }))
    return p.id
  },

  deleteProject: (id) => {
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      // Orphan the project's sessions rather than delete them — safer default.
      sessions: state.sessions.map(s => s.projectId === id ? { ...s, projectId: null } : s),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      documents: pruneOrphanDocs(
        state.sessions.map(s => s.projectId === id ? { ...s, projectId: null } : s),
        state.projects.filter(p => p.id !== id),
        state.documents
      )
    }))
  },

  renameProject: (id, name) => {
    set(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, name, updatedAt: Date.now() } : p)
    }))
  },

  updateProjectInstructions: (id, instructions) => {
    set(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, instructions, updatedAt: Date.now() } : p)
    }))
  },

  addDocumentToProject: (projectId, doc) => {
    set(state => ({
      documents: { ...state.documents, [doc.id]: doc },
      projects: state.projects.map(p =>
        p.id === projectId ? { ...p, documentIds: [...p.documentIds, doc.id], updatedAt: Date.now() } : p
      )
    }))
  },

  removeDocumentFromProject: (projectId, docId) => {
    set(state => {
      const projects = state.projects.map(p =>
        p.id === projectId ? { ...p, documentIds: p.documentIds.filter(d => d !== docId), updatedAt: Date.now() } : p
      )
      return { projects, documents: pruneOrphanDocs(state.sessions, projects, state.documents) }
    })
  },

  setActiveProject: (id) => {
    // Switching scope: try to pick the project's most recent session, else
    // create a fresh one so the user lands somewhere usable.
    set(state => {
      if (id === null) return { activeProjectId: null }
      const projectSessions = state.sessions
        .filter(s => s.projectId === id)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      if (projectSessions.length > 0) {
        return { activeProjectId: id, activeSessionId: projectSessions[0].id }
      }
      const s = makeSession(id)
      return { activeProjectId: id, activeSessionId: s.id, sessions: [s, ...state.sessions] }
    })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find(p => p.id === activeProjectId) ?? null
  },

  setPanelMode: (mode) => set({ panelMode: mode }),
  setShowDocPanel: (show) => set({ showDocPanel: show }),
  setStreaming: (val) => set(val ? { isStreaming: true } : { isStreaming: false, abortController: null }),
  startStreaming: (controller) => set({ isStreaming: true, abortController: controller }),
  stopStreaming: () => {
    get().abortController?.abort()
    set({ isStreaming: false, abortController: null })
  },
  setSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setShowSkillsPanel: (show) => set({ showSkillsPanel: show }),

  hydrate: (data) => {
    const raw = data.sessions && data.sessions.length > 0 ? data.sessions : null
    if (!raw) { markHydrated(); return }
    // Migrate legacy single-document sessions (documentId) to documentIds[],
    // and backfill projectId for pre-projects sessions.
    const sessions = raw.map(s => {
      const legacy = s as Session & { documentId?: string | null }
      const documentIds = legacy.documentIds ?? (legacy.documentId ? [legacy.documentId] : [])
      // Any search left mid-flight by a previous session can't still be running —
      // settle it so it doesn't render a stuck spinner.
      const messages = s.messages.map(m =>
        m.searches?.some(a => a.status === 'searching')
          ? { ...m, searches: m.searches.map(a => a.status === 'searching' ? { ...a, status: 'done' as const } : a) }
          : m
      )
      return { ...s, messages, documentIds, projectId: s.projectId ?? null }
    })
    const projects = data.projects ?? []
    // If the persisted activeProjectId no longer exists (renamed/deleted), clear it.
    const activeProjectId =
      data.activeProjectId && projects.some(p => p.id === data.activeProjectId)
        ? data.activeProjectId
        : null
    const activeSessionId =
      data.activeSessionId && sessions.some(s => s.id === data.activeSessionId)
        ? data.activeSessionId
        : sessions[0].id
    set({ sessions, projects, documents: data.documents ?? {}, activeSessionId, activeProjectId })
    markHydrated()
  }
}))

// ── Persistence ─────────────────────────────────────────────────────────────
// We write to electron-store on a steady tick, not on every state change, so
// streaming chunks (which fire dozens of state updates per second) don't cause
// us to re-serialize the full session tree + base64 documents to disk repeatedly.
//
// Documents are written separately and only when the document set actually
// changes (add/remove). A loaded 30 MB PDF base64 would otherwise be rewritten
// on every persist tick — heavy and pointless since the bytes never change.
let hydrated = false
function markHydrated() { hydrated = true }

const SESSIONS_TICK_MS = 2000
let lastSavedSessionsJson = ''
let lastSavedProjectsJson = ''
let lastSavedActiveId: string | null | undefined = undefined
let lastSavedActiveProjectId: string | null | undefined = undefined
let lastSavedDocuments: Record<string, Document> | null = null

setInterval(() => {
  if (!hydrated || !window.electronAPI) return
  const state = useAppStore.getState()

  // Sessions: write only if the JSON changed since the last write.
  const sessionsJson = JSON.stringify(state.sessions)
  if (sessionsJson !== lastSavedSessionsJson) {
    window.electronAPI.storeSet('sessions', state.sessions)
    lastSavedSessionsJson = sessionsJson
  }
  const projectsJson = JSON.stringify(state.projects)
  if (projectsJson !== lastSavedProjectsJson) {
    window.electronAPI.storeSet('projects', state.projects)
    lastSavedProjectsJson = projectsJson
  }
  if (state.activeSessionId !== lastSavedActiveId) {
    window.electronAPI.storeSet('activeSessionId', state.activeSessionId)
    lastSavedActiveId = state.activeSessionId
  }
  if (state.activeProjectId !== lastSavedActiveProjectId) {
    window.electronAPI.storeSet('activeProjectId', state.activeProjectId)
    lastSavedActiveProjectId = state.activeProjectId
  }
  // Documents: only write when the *set* of doc ids changed. Document content
  // is immutable once loaded, so we don't need to diff bodies.
  if (lastSavedDocuments === null || !sameDocSet(lastSavedDocuments, state.documents)) {
    window.electronAPI.storeSet('documents', state.documents)
    lastSavedDocuments = state.documents
  }
}, SESSIONS_TICK_MS)

function sameDocSet(a: Record<string, Document>, b: Record<string, Document>): boolean {
  const ak = Object.keys(a), bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) if (!(k in b)) return false
  return true
}
