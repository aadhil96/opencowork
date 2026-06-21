import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { useAppStore } from '../../lib/store'
import { domainOf } from '../../lib/toolActivity'
import type { Message, SearchActivity, SearchSource } from '../../types'

export default function ChatMessages() {
  const { activeMessages, isStreaming } = useAppStore()
  const messages = activeMessages()
  const rootRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Jump straight to the latest message when a conversation is opened.
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  // Keep pinned to the bottom while streaming, but only if the user is already
  // near the bottom — never yank them down while they scroll up to re-read.
  useEffect(() => {
    const scroller = rootRef.current?.parentElement
    if (!scroller) return
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    const lastIsUser = messages[messages.length - 1]?.role === 'user'
    if (lastIsUser) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (distanceFromBottom < 160) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages])

  return (
    <div ref={rootRef} className="py-6 space-y-0">
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

// Models like gpt-oss cite tool results with tokens such as 【web_search†1】.
// Convert them to plain [N] markers (which line up with the numbered source
// cards) and drop any malformed/numberless ones, then tidy spacing.
function cleanCitations(text: string): string {
  return text
    .replace(/【[^】]*?†(\d+)】/g, ' [$1]')
    .replace(/【[^】]*?】/g, '')
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
}

function MessageRow({ msg, isLast, isStreaming }: {
  msg: Message
  isLast: boolean
  isStreaming: boolean
}) {
  const isUser = msg.role === 'user'
  const isEmpty = msg.content === '' && isStreaming && isLast && !isUser
  const [exportOpen, setExportOpen] = useState(false)
  // Assistant text may contain model citation tokens (【web_search†1】); normalize them.
  const displayContent = isUser ? msg.content : cleanCitations(msg.content)

  function exportAs(format: 'docx' | 'pptx' | 'md') {
    setExportOpen(false)
    const name = `OpenCowork-analysis-${new Date().toISOString().slice(0, 10)}`
    window.electronAPI?.exportDocument({ defaultName: name, format, content: displayContent })
  }

  if (isUser) {
    return (
      <div className="px-4 py-3 animate-fade-in">
        <div className="max-w-3xl mx-auto flex justify-end">
          <div className="max-w-[75%] px-4 py-3 bg-c-bubble rounded-xl rounded-tr-sm text-[15px] text-c-text leading-[1.6] whitespace-pre-wrap">
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
          {/* Perplexity-style search activity, shown above the answer */}
          <SearchActivityView searches={msg.searches} />
          {isEmpty ? (
            <span className="cursor-blink text-c-text3 text-sm">
              {msg.searches?.length ? 'Reviewing sources' : 'Thinking'}
            </span>
          ) : (
            <div className={`msg-content ${isStreaming && isLast ? 'cursor-blink' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                // rehype-raw renders the model's inline HTML (e.g. <br> in table
                // cells); rehype-sanitize then strips anything unsafe — important
                // because document text is untrusted and the CSP allows inline JS.
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  // Wrap tables so wide ones scroll horizontally instead of
                  // squeezing columns into vertical text.
                  table: ({ node, ...props }) => { void node; return (
                    <div className="md-table-wrap"><table {...props} /></div>
                  ) },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
          {!isEmpty && msg.content && (
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(displayContent)}
                className="text-xs text-c-text3 hover:text-c-text2 transition-colors"
              >
                Copy
              </button>
              <div className="relative">
                <button
                  onClick={() => setExportOpen(v => !v)}
                  className="text-xs text-c-text3 hover:text-c-text2 transition-colors"
                >
                  Export ▾
                </button>
                {exportOpen && (
                  <div className="absolute left-0 top-5 z-10 bg-c-elevated border border-c-border rounded-lg shadow-lg py-1 min-w-[130px]">
                    <button
                      onClick={() => exportAs('docx')}
                      className="w-full text-left px-3 py-1.5 text-xs text-c-text2 hover:bg-c-surface transition-colors"
                    >
                      Word (.docx)
                    </button>
                    <button
                      onClick={() => exportAs('pptx')}
                      className="w-full text-left px-3 py-1.5 text-xs text-c-text2 hover:bg-c-surface transition-colors"
                    >
                      PowerPoint (.pptx)
                    </button>
                    <button
                      onClick={() => exportAs('md')}
                      className="w-full text-left px-3 py-1.5 text-xs text-c-text2 hover:bg-c-surface transition-colors"
                    >
                      Markdown (.md)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Perplexity-style search activity ─────────────────────────────────────────

const TOOL_LABEL: Record<string, { searching: string; done: string }> = {
  web_search:      { searching: 'Searching the web',   done: 'Searched the web' },
  legal_search:    { searching: 'Searching case law',  done: 'Searched case law' },
  verify_citation: { searching: 'Verifying citation',  done: 'Verified citation' },
}

function SearchActivityView({ searches }: { searches?: SearchActivity[] }) {
  if (!searches || searches.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      {searches.map(act => <SearchBlock key={act.id} act={act} />)}
    </div>
  )
}

function SearchBlock({ act }: { act: SearchActivity }) {
  const label = (TOOL_LABEL[act.tool]?.[act.status === 'searching' ? 'searching' : 'done']) ?? 'Searching'
  const isVerify = act.tool === 'verify_citation'

  return (
    <div className="rounded-lg border border-c-border bg-c-surface/60 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex-shrink-0 text-muted-foreground">
          {act.status === 'searching' ? <Spinner /> : <SearchGlyph />}
        </span>
        <span className="flex-shrink-0 font-medium text-c-text">{label}</span>
        {act.query && (
          <span className="truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {act.query}
          </span>
        )}
        {isVerify && act.status === 'done' && (
          <span className={`ml-auto flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
            act.verified
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 text-destructive'
          }`}>
            {act.verified ? '✓ Verified' : '✕ Unverified'}
          </span>
        )}
      </div>

      {act.sources.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {act.sources.map((src, i) => <SourceCard key={src.url} src={src} index={i} />)}
        </div>
      )}

      {act.status === 'done' && act.sources.length === 0 && !isVerify && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">No sources returned.</p>
      )}

      {act.status === 'error' && (
        <p className="mt-1.5 text-[11px] text-destructive">Search failed — see the answer for details.</p>
      )}
    </div>
  )
}

function SourceCard({ src, index }: { src: SearchSource; index: number }) {
  const domain = domainOf(src.url)
  return (
    <button
      onClick={() => window.electronAPI?.openExternal(src.url)}
      title={src.url}
      className="group/card flex w-[170px] flex-shrink-0 flex-col gap-1.5 rounded-lg border border-c-border bg-c-bg px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-1.5">
        <Monogram domain={domain} />
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{domain}</span>
        <span className="flex-shrink-0 text-[10px] tabular-nums text-c-text4">{index + 1}</span>
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-snug text-c-text">{src.title}</p>
    </button>
  )
}

// Offline favicon stand-in: first letter of the domain on a muted tile. No
// external request — important for a legal tool (don't leak visited domains).
function Monogram({ domain }: { domain: string }) {
  const letter = (domain.replace(/^[^a-z0-9]+/i, '')[0] ?? '?').toUpperCase()
  return (
    <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm bg-muted text-[8px] font-bold uppercase text-muted-foreground">
      {letter}
    </span>
  )
}

function Spinner() {
  return (
    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-muted-foreground" />
  )
}

function SearchGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  )
}
