import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, basename, extname } from 'path'
import { readFileSync, writeFileSync, statSync } from 'fs'
import Store from 'electron-store'
import mammoth from 'mammoth'
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
// pdf-parse is CJS — loaded via createRequire so it runs in Node.js context (main process)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse')

const store = new Store()
const MAX_FILE_BYTES = 50 * 1024 * 1024

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Legal Documents', extensions: ['pdf', 'docx', 'doc', 'txt'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Word Documents', extensions: ['docx', 'doc'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const fileName = basename(filePath)
  const ext = extname(fileName).slice(1).toLowerCase()

  let stat
  try { stat = statSync(filePath) } catch { return { error: 'Cannot access file.' } }
  if (stat.size > MAX_FILE_BYTES) return { error: 'File exceeds 50 MB limit.' }

  const buffer = readFileSync(filePath)
  let content = ''
  let html: string | undefined
  let extractionError: string | undefined

  try {
    if (ext === 'txt') {
      content = buffer.toString('utf-8')
    } else if (ext === 'docx' || ext === 'doc') {
      // Raw text feeds the AI; HTML drives a formatted preview pane.
      const [textRes, htmlRes] = await Promise.all([
        mammoth.extractRawText({ buffer }),
        mammoth.convertToHtml({ buffer })
      ])
      content = textRes.value.trim()
      html = htmlRes.value
    } else if (ext === 'pdf') {
      const res = await pdfParse(buffer)
      content = res.text.trim()
    }
  } catch (err) {
    extractionError = err instanceof Error ? err.message : String(err)
  }

  return {
    path: filePath,
    name: fileName,
    ext,
    size: stat.size,
    data: buffer.toString('base64'),
    content,
    html,
    extractionError
  }
})

// Export an assistant analysis/memo to a file the user picks (DOCX / Markdown / TXT).
ipcMain.handle('export-document', async (_event, args: { defaultName: string; format: 'docx' | 'md' | 'txt'; content: string }) => {
  const { defaultName, format, content } = args
  const result = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.${format}`,
    filters: [
      format === 'docx' ? { name: 'Word Document', extensions: ['docx'] }
      : format === 'md' ? { name: 'Markdown', extensions: ['md'] }
      : { name: 'Text', extensions: ['txt'] }
    ]
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  try {
    if (format === 'docx') {
      const buf = await Packer.toBuffer(markdownToDocx(content))
      writeFileSync(result.filePath, buf)
    } else {
      writeFileSync(result.filePath, content, 'utf-8')
    }
    return { path: result.filePath }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// Minimal markdown → docx: headings, bullets, and plain paragraphs with inline marks stripped.
function markdownToDocx(md: string): DocxDocument {
  const stripInline = (s: string) => s.replace(/\*\*|\*|`|__|~~/g, '')
  const paragraphs = md.split('\n').map(line => {
    const t = line.trimEnd()
    if (/^#{1,3}\s/.test(t)) {
      const level = t.match(/^(#{1,3})/)![1].length
      return new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        children: [new TextRun(stripInline(t.replace(/^#{1,3}\s/, '')))]
      })
    }
    if (/^[-*]\s/.test(t)) {
      return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(stripInline(t.replace(/^[-*]\s/, '')))] })
    }
    return new Paragraph({ children: [new TextRun(stripInline(t))] })
  })
  return new DocxDocument({ sections: [{ children: paragraphs }] })
}

// Store settings
ipcMain.handle('store-get', (_event, key: string) => store.get(key))
ipcMain.handle('store-set', (_event, key: string, value: unknown) => store.set(key, value))
ipcMain.handle('store-delete', (_event, key: string) => store.delete(key))

// Open external links safely
ipcMain.handle('open-external', (_event, url: string) => {
  if (url.startsWith('https://')) shell.openExternal(url)
})

// Web search. Tavily (real results, good for legal topics) when a key is
// configured; otherwise falls back to scraping DuckDuckGo's HTML interface for
// real results. The previous DDG Instant Answer API endpoint only returned
// Wikipedia-style "instant answers" — basically useless for current-news
// queries — so the model would silently get nothing and respond from training
// (cutoff-date data).
async function searchWithTavily(query: string, key: string): Promise<string | null> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      // Tavily now prefers Bearer auth; we also keep `api_key` in the body as
      // a safety net for older accounts.
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'advanced',
      max_results: 6,
      include_answer: true
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`[web-search] Tavily ${res.status}: ${body.slice(0, 200)}`)
    return null
  }
  const data = await res.json() as {
    answer?: string
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  const sections: string[] = []
  if (data.answer) sections.push(`**Answer (Tavily):** ${data.answer}`)
  const results = (data.results ?? []).map(
    r => `- **${r.title ?? 'Result'}** — ${(r.content ?? '').slice(0, 280)}\n  ${r.url ?? ''}`
  )
  if (results.length > 0) sections.push(`**Sources:**\n${results.join('\n')}`)
  return sections.length > 0 ? sections.join('\n\n') : null
}

// Scrapes DuckDuckGo's no-JS HTML interface. This returns *real* search
// results (titles + URLs + snippets), unlike the Instant Answer JSON API.
// Best-effort: result order and selectors are not guaranteed stable, but the
// /html endpoint has been around for years and rarely changes.
async function searchWithDuckDuckGo(query: string): Promise<string | null> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      // DDG's HTML version requires a real-looking UA or it returns a robot-check page.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Accept': 'text/html'
    }
  })
  if (!res.ok) {
    console.warn(`[web-search] DuckDuckGo HTML ${res.status}`)
    return null
  }
  const html = await res.text()
  if (html.includes('anomaly') || html.length < 500) {
    console.warn('[web-search] DuckDuckGo returned anomaly/empty page')
    return null
  }

  // Extract title + URL + snippet from each result block. The HTML version
  // uses class names like `result__a` (title link) and `result__snippet`.
  const blockRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  const decode = (s: string) => s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
  const cleanUrl = (u: string) => {
    // DDG sometimes wraps results in /l/?uddg=ENCODED — unwrap when present.
    try {
      if (u.startsWith('//')) u = 'https:' + u
      if (u.startsWith('/l/?') || u.includes('duckduckgo.com/l/?')) {
        const m = u.match(/[?&]uddg=([^&]+)/)
        if (m) return decodeURIComponent(m[1])
      }
    } catch { /* keep original */ }
    return u
  }

  const items: string[] = []
  let match: RegExpExecArray | null
  while ((match = blockRe.exec(html)) !== null && items.length < 6) {
    const [, rawUrl, rawTitle, rawSnippet] = match
    const title = decode(rawTitle)
    const url = cleanUrl(rawUrl)
    const snippet = decode(rawSnippet)
    if (title && url) items.push(`- **${title}**\n  ${snippet}\n  ${url}`)
  }

  if (items.length === 0) return null
  return `**Sources (DuckDuckGo):**\n${items.join('\n\n')}`
}

ipcMain.handle('web-search', async (_event, query: string) => {
  if (!query?.trim()) return 'No search query provided.'

  const tavilyKey = (store.get('tavilyApiKey') as string | undefined)?.trim()
  const trail: string[] = []

  if (tavilyKey) {
    try {
      const result = await searchWithTavily(query, tavilyKey)
      if (result) return result
      trail.push('Tavily returned no results')
    } catch (e) {
      console.warn('[web-search] Tavily threw:', e)
      trail.push(`Tavily error: ${(e as Error).message}`)
    }
  } else {
    trail.push('No Tavily key configured — using DuckDuckGo')
  }

  try {
    const ddg = await searchWithDuckDuckGo(query)
    if (ddg) return ddg
    trail.push('DuckDuckGo returned no parseable results')
  } catch (e) {
    console.warn('[web-search] DuckDuckGo threw:', e)
    trail.push(`DuckDuckGo error: ${(e as Error).message}`)
  }

  // All providers failed — surface the trail so the model (and user) can see why.
  return `Web search returned no results for "${query}". Diagnostics: ${trail.join('; ')}. Tell the user the search failed rather than answering from memory.`
})

// ── Verified legal search (CourtListener) ───────────────────────────────────
// CourtListener is a free, public US case-law database. Unlike a general web
// search, results here are real, citable cases — which means the model has a
// trustworthy source to anchor citations against and cannot fabricate cites
// that pass the verify_citation check. (UK/EU coverage is limited; we surface
// that limitation in the deep-research system prompt.)
const CL_BASE = 'https://www.courtlistener.com'
const CL_HEADERS = { 'User-Agent': 'OpenCowork/1.0 (legal-research)' }

type CLResult = {
  caseName?: string
  citation?: string[]
  absolute_url?: string
  snippet?: string
  court?: string
  dateFiled?: string
}

function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, '') }

ipcMain.handle('legal-search', async (_event, query: string, court?: string) => {
  if (!query?.trim()) return 'No search query provided.'
  try {
    const params = new URLSearchParams({ q: query, type: 'o', format: 'json' })
    if (court?.trim()) params.set('court', court.trim())
    const res = await fetch(`${CL_BASE}/api/rest/v3/search/?${params}`, { headers: CL_HEADERS })
    if (!res.ok) return `CourtListener API error ${res.status} — verification source unavailable. Do NOT cite cases without an alternate verified source.`
    const data = await res.json() as { results?: CLResult[] }
    const results = (data.results ?? []).slice(0, 6)
    if (results.length === 0) {
      return `No verified cases found for: "${query}". Do NOT invent a citation — try a different query or tell the user no verified source was located.`
    }
    return `Verified CourtListener results for "${query}":\n\n` + results.map((r, i) => {
      const cite = (r.citation && r.citation[0]) ?? '(no reporter citation)'
      const url = r.absolute_url ? `${CL_BASE}${r.absolute_url}` : ''
      return `${i + 1}. **${r.caseName ?? 'Unknown case'}** — ${cite}\n   Court: ${r.court ?? 'Unknown'} · Filed: ${r.dateFiled ?? 'Unknown'}\n   Source: ${url}\n   ${stripHtml(r.snippet ?? '').slice(0, 280)}`
    }).join('\n\n')
  } catch (e) {
    return `Legal search failed: ${(e as Error).message}. Treat any citation in this response as UNVERIFIED.`
  }
})

ipcMain.handle('verify-citation', async (_event, citation: string) => {
  if (!citation?.trim()) return 'No citation provided to verify.'
  try {
    // Quote the citation so CourtListener matches the literal reporter cite.
    const q = encodeURIComponent(`"${citation.trim()}"`)
    const res = await fetch(`${CL_BASE}/api/rest/v3/search/?q=${q}&type=o&format=json`, { headers: CL_HEADERS })
    if (!res.ok) return `Verification API error ${res.status} — citation "${citation}" is UNVERIFIED.`
    const data = await res.json() as { results?: CLResult[] }
    const hit = (data.results ?? [])[0]
    if (!hit) {
      return `UNVERIFIED: no case matching "${citation}" was found in CourtListener. Do NOT cite this in your response — search again with legal_search or remove the citation.`
    }
    const cites = (hit.citation ?? []).join('; ') || '(no reporter citation)'
    const url = hit.absolute_url ? `${CL_BASE}${hit.absolute_url}` : ''
    return `VERIFIED: "${hit.caseName}" — ${cites}\nCourt: ${hit.court ?? 'Unknown'} · Filed: ${hit.dateFiled ?? 'Unknown'}\nSource: ${url}`
  } catch (e) {
    return `Verification failed: ${(e as Error).message}. Treat "${citation}" as UNVERIFIED.`
  }
})

// ── MCP (Model Context Protocol) client ─────────────────────────────────────
// Connects to user-configured MCP servers over stdio, discovers their tools,
// and proxies tool calls. Tools are exposed to the agent namespaced as
// `mcp__<server>__<tool>` so they never collide with the built-in legal tools.
type McpServerConfig = { id: string; name: string; command: string; args?: string[]; env?: Record<string, string>; enabled?: boolean }
// `serverId` routes calls back to the right client; `serverName` is the
// user-facing label. We never use the display name as a routing key — two
// servers with the same name would silently collide.
type McpToolInfo = { serverId: string; serverName: string; name: string; description: string; inputSchema: unknown }

const mcpClients = new Map<string, Client>()

async function disconnectMcp(): Promise<void> {
  for (const client of mcpClients.values()) {
    try { await client.close() } catch { /* ignore */ }
  }
  mcpClients.clear()
}

async function connectMcp(configs: McpServerConfig[]): Promise<McpToolInfo[]> {
  await disconnectMcp()
  const discovered: McpToolInfo[] = []

  for (const cfg of configs) {
    if (cfg.enabled === false || !cfg.command?.trim()) continue
    try {
      const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        ...(cfg.env ? { env: cfg.env } : {})
      })
      const client = new Client({ name: 'opencowork', version: '1.0.0' }, { capabilities: {} })
      await client.connect(transport)
      mcpClients.set(cfg.id, client)

      const res = await client.listTools()
      for (const t of res.tools) {
        discovered.push({
          serverId: cfg.id,
          serverName: cfg.name,
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema
        })
      }
    } catch (err) {
      // Surface the failure as a pseudo-tool so the UI can show what went wrong.
      discovered.push({
        serverId: cfg.id,
        serverName: cfg.name,
        name: '__error__',
        description: err instanceof Error ? err.message : String(err),
        inputSchema: {}
      })
    }
  }

  return discovered
}

ipcMain.handle('mcp-connect', async (_event, configs: McpServerConfig[]) => {
  try {
    return { tools: await connectMcp(configs ?? []) }
  } catch (err) {
    return { tools: [], error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('mcp-call-tool', async (_event, serverId: string, name: string, args: Record<string, unknown>) => {
  const client = mcpClients.get(serverId)
  if (!client) return `MCP server "${serverId}" is not connected.`
  try {
    const result = await client.callTool({ name, arguments: args })
    const content = (result.content as Array<{ type: string; text?: string }> | undefined) ?? []
    const text = content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n')
    const body = text || JSON.stringify(result.content ?? result)
    // Bug #6 follow-up: MCP servers signal tool failures via `isError`, not by
    // throwing. If we ignored this the model would treat errors as successes.
    return result.isError ? `MCP tool error: ${body}` : body
  } catch (err) {
    return `MCP tool error: ${err instanceof Error ? err.message : String(err)}`
  }
})

app.on('before-quit', () => { void disconnectMcp() })

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
