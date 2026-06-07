import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '../../lib/store'
import type { Message } from '../../types'

export default function ChatMessages() {
  const { activeMessages, isStreaming } = useAppStore()
  const messages = activeMessages()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="py-6 space-y-0">
      {messages.map((msg, idx) => (
        <MessageRow
          key={msg.id}
          msg={msg}
          isLast={idx === messages.length - 1}
          isStreaming={isStreaming}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageRow({ msg, isLast, isStreaming }: {
  msg: Message
  isLast: boolean
  isStreaming: boolean
}) {
  const isUser = msg.role === 'user'
  const isEmpty = msg.content === '' && isStreaming && isLast && !isUser

  if (isUser) {
    return (
      <div className="px-4 py-3 animate-fade-in">
        <div className="max-w-3xl mx-auto flex justify-end">
          <div className="max-w-[75%] px-4 py-3 bg-c-bubble rounded-2xl rounded-tr-sm text-[15px] text-c-text leading-[1.6] whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 animate-fade-in">
      <div className="max-w-3xl mx-auto flex gap-4">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-c-elevated border border-c-border flex items-center justify-center text-[10px] font-semibold text-c-text3 mt-0.5">
          AI
        </div>
        <div className="flex-1 min-w-0">
          {isEmpty ? (
            <span className="cursor-blink text-c-text3 text-sm">Thinking</span>
          ) : (
            <div className={`msg-content ${isStreaming && isLast ? 'cursor-blink' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
          {!isEmpty && msg.content && (
            <button
              onClick={() => navigator.clipboard.writeText(msg.content)}
              className="mt-2 text-xs text-c-text3 hover:text-c-text2 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
