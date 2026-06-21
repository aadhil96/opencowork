import { useAppStore } from '../../lib/store'

function DocTypeBadge({ ext }: { ext: string }) {
  const styles: Record<string, string> = {
    pdf:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    doc:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    txt:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  }
  const cls = styles[ext.toLowerCase()] ?? styles.txt
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase flex-shrink-0 ${cls}`}>
      {ext.toUpperCase()}
    </span>
  )
}

export default function ChatHeader() {
  const {
    showDocPanel, setShowDocPanel,
    getActiveDocument, getActiveDocuments, clearMessages, activeSession, removeDocument
  } = useAppStore()

  const doc = getActiveDocument()
  const docs = getActiveDocuments()
  const session = activeSession()

  return (
    <div className="drag-region flex-shrink-0 h-11 flex items-center px-4 border-b border-c-border2 bg-c-bg gap-3">

      {/* Right controls */}
      <div className="no-drag flex items-center gap-1.5 ml-auto min-w-0">

        {/* Loaded document badge */}
        {doc && (
          <>
            <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-c-surface border border-c-border min-w-0 max-w-[260px]">
              <DocTypeBadge ext={doc.ext} />
              <span className="text-c-text2 text-xs truncate min-w-0">{doc.name}</span>
              {docs.length > 1 && (
                <span className="text-c-text4 text-[10px] flex-shrink-0">+{docs.length - 1}</span>
              )}
              <button
                onClick={() => removeDocument(doc.id)}
                title="Remove document"
                className="text-c-text4 hover:text-red-400 text-base leading-none ml-0.5 flex-shrink-0 transition-colors"
              >
                ×
              </button>
            </div>

            <button
              onClick={() => setShowDocPanel(!showDocPanel)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0 ${
                showDocPanel
                  ? 'text-primary bg-c-elevated'
                  : 'text-c-text3 hover:bg-c-elevated'
              }`}
            >
              {showDocPanel ? 'Hide docs' : 'Show docs'}
            </button>
          </>
        )}

        {session && session.messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="px-2.5 py-1.5 rounded-lg text-xs text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
