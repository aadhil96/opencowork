import { create } from 'zustand'
import type { Document, Message, Settings, PanelMode } from '../types'

export interface Session {
  id: string
  name: string
  messages: Message[]
  documentId: string | null
  createdAt: number
  updatedAt: number
}

interface AppState {
  sessions: Session[]
  activeSessionId: string | null
  documents: Record<string, Document>
  panelMode: PanelMode
  showDocPanel: boolean
  isStreaming: boolean
  settings: Settings
  settingsOpen: boolean
  showSkillsPanel: boolean
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void

  // Session actions
  createSession: () => string
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  setActiveSession: (id: string) => void

  // Message actions (operate on active session)
  addMessage: (msg: Message) => void
  appendToLastMessage: (chunk: string) => void
  clearMessages: () => void

  // Document actions
  setSessionDocument: (doc: Document) => void
  getActiveDocument: () => Document | null
  removeDocument: () => void

  // UI
  setPanelMode: (mode: PanelMode) => void
  setShowDocPanel: (show: boolean) => void
  setStreaming: (val: boolean) => void
  setSettings: (s: Partial<Settings>) => void
  setSettingsOpen: (open: boolean) => void
  setShowSkillsPanel: (show: boolean) => void

  // Selectors
  activeSession: () => Session | null
  activeMessages: () => Message[]
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
  activeSubAgentId: 'general_counsel'
}

function makeSession(): Session {
  return {
    id: crypto.randomUUID(),
    name: 'New Chat',
    messages: [],
    documentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

const initialSession = makeSession()

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [initialSession],
  activeSessionId: initialSession.id,
  documents: {},
  panelMode: 'chat',
  showDocPanel: true,
  isStreaming: false,
  settings: defaultSettings,
  settingsOpen: false,
  showSkillsPanel: true,
  theme: 'light',
  setTheme: (t) => {
    const html = document.documentElement
    if (t === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
    set({ theme: t })
  },

  createSession: () => {
    const s = makeSession()
    set(state => ({ sessions: [s, ...state.sessions], activeSessionId: s.id }))
    return s.id
  },

  deleteSession: (id) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== id)
      if (sessions.length === 0) {
        const s = makeSession()
        return { sessions: [s], activeSessionId: s.id }
      }
      const activeSessionId =
        state.activeSessionId === id ? sessions[0].id : state.activeSessionId
      return { sessions, activeSessionId }
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

  setSessionDocument: (doc) => {
    set(state => {
      const id = state.activeSessionId
      return {
        documents: { ...state.documents, [doc.id]: doc },
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, documentId: doc.id, name: doc.name, updatedAt: Date.now() } : s
        )
      }
    })
  },

  getActiveDocument: () => {
    const { sessions, activeSessionId, documents } = get()
    const session = sessions.find(s => s.id === activeSessionId)
    if (!session?.documentId) return null
    return documents[session.documentId] ?? null
  },

  removeDocument: () => {
    set(state => {
      const id = state.activeSessionId
      return {
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, documentId: null, updatedAt: Date.now() } : s
        ),
        showDocPanel: false
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

  setPanelMode: (mode) => set({ panelMode: mode }),
  setShowDocPanel: (show) => set({ showDocPanel: show }),
  setStreaming: (val) => set({ isStreaming: val }),
  setSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setShowSkillsPanel: (show) => set({ showSkillsPanel: show })
}))
