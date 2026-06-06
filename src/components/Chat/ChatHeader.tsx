import { useAppStore } from '../../lib/store'
import { useFileUpload } from '../../lib/useFileUpload'

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
    panelMode, setPanelMode, showDocPanel, setShowDocPanel,
    getActiveDocument, clearMessages, activeSession, removeDocument
  } = useAppStore()
  const { openFile, isLoading, error } = useFileUpload()

  const doc = getActiveDocument()
  const session = activeSession()

  return (
    <div className="drag-region flex-shrink-0 h-11 flex items-center px-4 border-b border-c-border2 bg-c-bg gap-3">

      {/* Mode tabs */}
      <div className="no-drag flex items-center gap-1 bg-c-elevated rounded-lg p-1 flex-shrink-0">
        <button
          onClick={() => setPanelMode('chat')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            panelMode === 'chat'
              ? 'bg-c-bg text-c-text shadow-sm'
              : 'text-c-text3 hover:text-c-text'
          }`}
        >
          Document Chat
        </button>
        <button
          onClick={() => setPanelMode('research')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            panelMode === 'research'
              ? 'bg-c-bg text-c-text shadow-sm'
              : 'text-c-text3 hover:text-c-text'
          }`}
        >
          Legal Research
        </button>
      </div>

      {/* Right controls */}
      <div className="no-drag flex items-center gap-1.5 ml-auto min-w-0">

        {error && (
          <span className="text-xs text-red-500 max-w-[180px] truncate flex-shrink-0" title={error}>
            {error}
          </span>
        )}

        {panelMode === 'chat' && (
          <>
            {doc ? (
              /* Loaded document badge */
              <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-c-surface border border-c-border min-w-0 max-w-[260px]">
                <DocTypeBadge ext={doc.ext} />
                <button
                  onClick={openFile}
                  disabled={isLoading}
                  title="Click to replace document"
                  className="text-c-text2 hover:text-c-text text-xs truncate transition-colors disabled:opacity-50 min-w-0"
                >
                  {isLoading ? 'Processing…' : doc.name}
                </button>
                <button
                  onClick={removeDocument}
                  title="Remove document"
                  className="text-c-text4 hover:text-red-400 text-base leading-none ml-0.5 flex-shrink-0 transition-colors"
                >
                  ×
                </button>
              </div>
            ) : (
              /* No doc — upload trigger */
              <button
                onClick={openFile}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-c-text3 hover:text-c-text hover:bg-c-elevated border border-dashed border-c-border transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <span className="text-sm leading-none">+</span>
                {isLoading ? 'Processing…' : 'Upload document'}
              </button>
            )}

            {doc && (
              <button
                onClick={() => setShowDocPanel(!showDocPanel)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0 ${
                  showDocPanel
                    ? 'text-blue-500 bg-c-elevated'
                    : 'text-c-text3 hover:bg-c-elevated'
                }`}
              >
                {showDocPanel ? 'Hide doc' : 'Show doc'}
              </button>
            )}
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
