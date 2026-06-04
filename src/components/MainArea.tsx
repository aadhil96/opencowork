import { useAppStore } from '../lib/store'
import ChatArea from './Chat/ChatArea'
import DocumentPanel from './DocumentViewer/DocumentPanel'

export default function MainArea() {
  const { showDocPanel, getActiveDocument } = useAppStore()
  const doc = getActiveDocument()

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {doc && showDocPanel && (
        <div className="flex-[3] min-w-0 border-r border-c-border2">
          <DocumentPanel />
        </div>
      )}
      <div className={`flex flex-col min-w-0 ${doc && showDocPanel ? 'w-[380px] flex-shrink-0' : 'flex-1'}`}>
        <ChatArea />
      </div>
    </div>
  )
}
