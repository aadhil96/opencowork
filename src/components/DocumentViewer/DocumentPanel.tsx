import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../lib/store'

function usePdfBlobUrl(rawData: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!rawData) { setUrl(null); return }
    const binary = atob(rawData)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current)
    prevUrl.current = blobUrl
    setUrl(blobUrl)
    return () => { URL.revokeObjectURL(blobUrl) }
  }, [rawData])

  return url
}

export default function DocumentPanel() {
  const { getActiveDocuments, setShowDocPanel } = useAppStore()
  const docs = getActiveDocuments()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Selected tab, falling back to the first doc if the selection was removed.
  const doc = docs.find(d => d.id === selectedId) ?? docs[0] ?? null
  const isPdf = doc?.ext === 'pdf'
  const pdfUrl = usePdfBlobUrl(isPdf && doc ? doc.rawData : null)

  if (!doc) return null

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
    )
  }

  // Returns HTML with only our own <mark> tags; all document-derived text is escaped
  // first so untrusted content can never inject markup.
  function highlight(text: string) {
    if (!search.trim()) return escapeHtml(text)
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.split(new RegExp(`(${escaped})`, 'gi')).map((part) =>
      part.toLowerCase() === search.toLowerCase()
        ? `<mark class="bg-yellow-300/60 rounded">${escapeHtml(part)}</mark>`
        : escapeHtml(part)
    ).join('')
  }

  return (
    <div className="flex flex-col h-full bg-c-surface">
      {/* Tabs — only shown when more than one document is loaded */}
      {docs.length > 1 && (
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-c-border2 flex-shrink-0 overflow-x-auto">
          {docs.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              title={d.name}
              className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors flex-shrink-0 max-w-[140px] truncate ${
                d.id === doc.id ? 'bg-c-elevated text-c-text' : 'text-c-text3 hover:text-c-text hover:bg-c-elevated/50'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-b border-c-border2 flex-shrink-0 h-11">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search in document…"
          className="flex-1 bg-c-elevated border border-c-border rounded-lg px-3 py-1.5 text-xs text-c-text placeholder-c-text4 outline-none focus:border-c-text4 transition-colors"
        />
        <button
          onClick={() => setShowDocPanel(false)}
          className="px-2.5 py-1.5 rounded-lg text-xs text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors flex-shrink-0"
        >
          Close
        </button>
      </div>

      <div className="px-4 py-2 border-b border-c-border2 flex-shrink-0">
        <p className="text-xs font-medium text-c-text truncate">{doc.name}</p>
        <p className="text-[11px] text-c-text3">
          {doc.content.split(/\s+/).length.toLocaleString()} words
        </p>
      </div>

      <div className="flex-1 overflow-hidden overflow-y-auto">
        {isPdf && pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-full border-none block" title={doc.name} />
        ) : doc.html && !search.trim() ? (
          // Formatted DOCX preview. mammoth produces escaped, semantic HTML, so it's safe to render.
          // Falls back to the highlighted plain-text view while a search term is active.
          <div className="p-5">
            <div className="doc-html" dangerouslySetInnerHTML={{ __html: doc.html }} />
          </div>
        ) : (
          <div className="p-5">
            <div
              className="doc-content"
              dangerouslySetInnerHTML={{ __html: highlight(doc.content) }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
