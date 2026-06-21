import type { Document, SearchSource } from '../types'
import { executeAgentTool } from './agent'
import { useAppStore } from './store'

// Tools whose activity we surface in the UI (Perplexity-style search cards).
const SEARCH_TOOLS = new Set(['web_search', 'legal_search', 'verify_citation'])

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// Parse the markdown-ish result strings our search tools return (web-search,
// CourtListener legal-search, verify-citation) into structured source cards.
// We extract each URL and use the nearest preceding **bold** as its title —
// which lands on the result/case name for all of our known formats.
export function parseSources(text: string): SearchSource[] {
  const sources: SearchSource[] = []
  const seen = new Set<string>()
  const urlRe = /(https?:\/\/[^\s)\]]+)/g
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[1].replace(/[.,;)]+$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    const before = text.slice(0, m.index)
    const bolds = [...before.matchAll(/\*\*(.+?)\*\*/g)]
    // Skip section-label bolds like "Sources:" / "Answer (Tavily):".
    const meaningful = bolds.filter(b => !/^(sources?|answer)\b/i.test(b[1].trim()))
    const title = (meaningful.length ? meaningful[meaningful.length - 1][1] : domainOf(url)).trim()
    sources.push({ title, url })
  }
  return sources
}

// Wraps executeAgentTool so search tools also emit UI activity onto the current
// assistant message: a "searching" card first, then parsed sources when done.
// Returns the same string the model expects, so the agent loop is unaffected.
export function makeTrackedToolCall(docs: Document[]) {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    const tracked = SEARCH_TOOLS.has(name)
    let activityId: string | null = null

    if (tracked) {
      activityId = crypto.randomUUID()
      const query = name === 'verify_citation' ? String(input.citation ?? '') : String(input.query ?? '')
      useAppStore.getState().addSearchActivity({ id: activityId, tool: name, query, status: 'searching', sources: [] })
    }

    try {
      const result = await executeAgentTool(name, input, docs)
      const text = typeof result === 'string' ? result : String(result)

      if (tracked && activityId) {
        const sources = parseSources(text)
        const verified = name === 'verify_citation' ? /^\s*VERIFIED/i.test(text) : undefined
        useAppStore.getState().updateSearchActivity(activityId, { status: 'done', sources, verified })
      }

      return text
    } catch (err) {
      // Settle the activity (otherwise the card spins forever) and hand the error
      // back to the model as text so the turn keeps going instead of aborting.
      const message = `Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`
      if (tracked && activityId) {
        useAppStore.getState().updateSearchActivity(activityId, { status: 'error', sources: [] })
      }
      return message
    }
  }
}
