import { useAppStore } from '../../lib/store'
import type { Document } from '../../types'

async function extractDocxText(base64: string): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
  return result.value
}

export default function ChatHeader() {
  const {
    panelMode, setPanelMode, showDocPanel, setShowDocPanel,
    setSessionDocument, getActiveDocument, clearMessages, activeSession
  } = useAppStore()

  const doc = getActiveDocument()
  const session = activeSession()

  async function handleOpenFile() {
    if (!window.electronAPI) return
    const file = await window.electronAPI.openFile()
    if (!file) return

    let content = ''
    if (file.ext === 'txt') {
      content = atob(file.data)
    } else if (file.ext === 'docx' || file.ext === 'doc') {
      content = await extractDocxText(file.data)
    } else if (file.ext === 'pdf') {
      content = '[PDF — text extraction in progress. Ask the AI to analyze this document.]'
    }

    const newDoc: Document = {
      id: crypto.randomUUID(),
      name: file.name,
      ext: file.ext,
      path: file.path,
      content,
      rawData: file.data,
      loadedAt: Date.now()
    }
    setSessionDocument(newDoc)
    setShowDocPanel(true)
  }

  return (
    <div className="drag-region flex-shrink-0 h-11 flex items-center px-4 border-b border-c-border2 bg-c-bg">
      <div className="no-drag flex items-center gap-1 bg-c-elevated rounded-lg p-1">
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

      <div className="no-drag flex items-center gap-1 ml-auto">
        {panelMode === 'chat' && (
          <button
            onClick={handleOpenFile}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              doc
                ? 'text-blue-500 hover:bg-c-elevated'
                : 'text-c-text3 hover:text-c-text hover:bg-c-elevated'
            }`}
          >
            {doc ? doc.name.slice(0, 20) + (doc.name.length > 20 ? '…' : '') : 'Attach'}
          </button>
        )}

        {doc && panelMode === 'chat' && (
          <button
            onClick={() => setShowDocPanel(!showDocPanel)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              showDocPanel
                ? 'text-blue-500 bg-c-elevated'
                : 'text-c-text3 hover:bg-c-elevated'
            }`}
          >
            {showDocPanel ? 'Hide doc' : 'Show doc'}
          </button>
        )}

        {session && session.messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="px-2.5 py-1.5 rounded-lg text-xs text-c-text3 hover:text-c-text hover:bg-c-elevated transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
