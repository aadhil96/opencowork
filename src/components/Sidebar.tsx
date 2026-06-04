import { useState } from 'react'
import { useAppStore } from '../lib/store'
import type { Session } from '../lib/store'

export default function Sidebar() {
  const {
    sessions, activeSessionId, createSession,
    deleteSession, setActiveSession, setSettingsOpen,
    settings, theme, setTheme
  } = useAppStore()

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    window.electronAPI?.storeSet('theme', next)
  }

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col bg-c-sidebar border-r border-c-border2 h-full">
      <div className="drag-region h-11 flex items-center px-4 flex-shrink-0">
        <div className="w-16 flex-shrink-0" />
        <span className="text-c-text font-semibold text-sm tracking-wide">OpenCowork</span>
      </div>

      <div className="no-drag px-3 pb-2 flex-shrink-0">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-c-text hover:bg-c-elevated transition-colors"
        >
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        {sessions.length > 0 && (
          <p className="text-[11px] font-medium text-c-text3 uppercase tracking-wider px-2 py-2">
            Recent
          </p>
        )}
        {sessions.map(session => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            isHovered={hoveredId === session.id}
            onSelect={() => setActiveSession(session.id)}
            onDelete={() => deleteSession(session.id)}
            onMouseEnter={() => setHoveredId(session.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        ))}
      </div>

      <div className="no-drag border-t border-c-border2 px-2 py-2 flex-shrink-0 space-y-0.5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
        >
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
        >
          Settings
          {!settings.openrouterApiKey && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>
      </div>
    </div>
  )
}

function SessionItem({
  session, isActive, isHovered, onSelect, onDelete, onMouseEnter, onMouseLeave
}: {
  session: Session
  isActive: boolean
  isHovered: boolean
  onSelect: () => void
  onDelete: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-c-elevated text-c-text' : 'text-c-text2 hover:bg-c-surface'
      }`}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="flex-1 min-w-0 text-sm truncate">{session.name}</span>
      {(isHovered || isActive) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 text-xs text-c-text3 hover:text-red-500 transition-colors px-1"
        >
          ×
        </button>
      )}
    </div>
  )
}
