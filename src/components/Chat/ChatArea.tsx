import { useAppStore } from '../../lib/store'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import ChatHeader from './ChatHeader'
import EmptyState from './EmptyState'

export default function ChatArea() {
  const { activeMessages, panelMode } = useAppStore()
  const messages = activeMessages()

  return (
    <div className="flex flex-col h-full bg-c-bg">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState mode={panelMode} />
        ) : (
          <ChatMessages />
        )}
      </div>
      <ChatInput />
    </div>
  )
}
