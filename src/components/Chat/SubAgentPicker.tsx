import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../lib/store'
import { SUB_AGENTS } from '../../lib/agent'

// Picks which legal specialist handles the chat. 'auto' keyword-routes per
// message; any other value pins a specific persona. Persists immediately so the
// choice travels with the next request.
export default function SubAgentPicker() {
  const { settings, setSettings } = useAppStore()
  const current = settings.activeSubAgentId || 'auto'

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(id: string) {
    setSettings({ activeSubAgentId: id })
    window.electronAPI?.storeSet('activeSubAgentId', id)
    setOpen(false)
  }

  const currentAgent = SUB_AGENTS.find(a => a.id === current)
  const label = current === 'auto' ? 'Auto' : (currentAgent?.name ?? 'Auto')

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title={current === 'auto' ? 'Specialist: Auto (routed by topic). Click to pin one.' : `Specialist: ${label}. Click to change.`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
          open ? 'bg-c-elevated text-c-text' : 'text-c-text3 hover:text-c-text hover:bg-c-elevated'
        }`}
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${current === 'auto' ? 'bg-muted-foreground' : (currentAgent?.accent ?? 'bg-primary')}`} />
        <span className="font-medium max-w-[120px] truncate">{label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-30 w-[290px] max-h-[380px] overflow-y-auto bg-c-bg border border-c-border rounded-lg shadow-lg animate-fade-in">
          <div className="px-3 py-2 border-b border-c-border sticky top-0 bg-c-bg">
            <p className="text-[11px] font-semibold text-c-text">Specialist</p>
            <p className="text-[10px] text-c-text4">Who reviews — applied to the next message</p>
          </div>

          <button
            onClick={() => choose('auto')}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              current === 'auto' ? 'bg-accent' : 'hover:bg-c-elevated'
            }`}
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-c-text">Auto</p>
              <p className="truncate text-[10px] text-muted-foreground">Pick the best specialist by topic</p>
            </div>
          </button>

          <div className="border-t border-c-border" />

          {SUB_AGENTS.map(a => (
            <button
              key={a.id}
              onClick={() => choose(a.id)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                current === a.id ? 'bg-accent' : 'hover:bg-c-elevated'
              }`}
            >
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.accent}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-c-text">{a.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{a.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
