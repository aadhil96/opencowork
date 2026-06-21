import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../lib/store'
import { JURISDICTIONS, shortJurisdictionLabel } from '../../lib/jurisdictions'

// Compact "Legal sources" button modeled on Spellbook's chat-input toolbar.
// Shows the current jurisdiction; clicking opens a grouped popover. The
// selection persists to electron-store immediately so it travels with the
// next request without needing to open Settings.
export default function JurisdictionPicker() {
  const { settings, setSettings } = useAppStore()
  const current = settings.jurisdiction || 'General / International'

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape so the popover doesn't trap the user.
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

  function choose(j: string) {
    setSettings({ jurisdiction: j })
    window.electronAPI?.storeSet('jurisdiction', j)
    setOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title={`Jurisdiction: ${current}. Click to change.`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${
          open ? 'bg-c-elevated text-c-text' : 'text-c-text3 hover:text-c-text hover:bg-c-elevated'
        }`}
      >
        <ScaleIcon />
        <span className="font-medium">{shortJurisdictionLabel(current)}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-30 w-[280px] max-h-[360px] overflow-y-auto bg-c-bg border border-c-border rounded-xl shadow-2xl animate-fade-in">
          <div className="px-3 py-2 border-b border-c-border sticky top-0 bg-c-bg">
            <p className="text-[11px] font-semibold text-c-text">Legal sources</p>
            <p className="text-[10px] text-c-text4">Applied to every request in this chat</p>
          </div>
          {JURISDICTIONS.map(g => (
            <div key={g.group} className="py-1">
              <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-c-text4">{g.group}</p>
              {g.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => choose(opt)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                    opt === current ? 'bg-accent text-primary font-medium' : 'text-c-text2 hover:bg-c-elevated'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScaleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 21h14M6 8l6-5 6 5M3 14l3-6 3 6a3 3 0 0 1-6 0zM15 14l3-6 3 6a3 3 0 0 1-6 0z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
