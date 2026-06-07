import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, basename, extname } from 'path'
import { readFileSync, statSync } from 'fs'
import Store from 'electron-store'
import mammoth from 'mammoth'
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
  let extractionError: string | undefined

  try {
    if (ext === 'txt') {
      content = buffer.toString('utf-8')
    } else if (ext === 'docx' || ext === 'doc') {
      const res = await mammoth.extractRawText({ buffer })
      content = res.value.trim()
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
    extractionError
  }
})

// Store settings
ipcMain.handle('store-get', (_event, key: string) => store.get(key))
ipcMain.handle('store-set', (_event, key: string, value: unknown) => store.set(key, value))
ipcMain.handle('store-delete', (_event, key: string) => store.delete(key))

// Open external links safely
ipcMain.handle('open-external', (_event, url: string) => {
  if (url.startsWith('https://')) shell.openExternal(url)
})

// Web search via DuckDuckGo Instant Answer API (no API key required)
ipcMain.handle('web-search', async (_event, query: string) => {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'OpenCowork/1.0 Legal Research' } })
    const data = await res.json() as {
      Abstract?: string
      AbstractText?: string
      Answer?: string
      AnswerType?: string
      Definition?: string
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
      Results?: Array<{ Text?: string; FirstURL?: string }>
    }

    const sections: string[] = []

    if (data.Answer) sections.push(`**Direct Answer:** ${data.Answer}`)
    if (data.AbstractText) sections.push(`**Summary:** ${data.AbstractText}`)
    if (data.Definition) sections.push(`**Definition:** ${data.Definition}`)

    const topics = (data.RelatedTopics ?? [])
      .flatMap(t => t.Topics ? t.Topics : [t])
      .filter(t => t.Text)
      .slice(0, 6)
      .map(t => `- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ''}`)

    if (topics.length > 0) sections.push(`**Related:**\n${topics.join('\n')}`)

    const results = (data.Results ?? []).slice(0, 3).map(r => `- ${r.Text} ${r.FirstURL ?? ''}`)
    if (results.length > 0) sections.push(`**Results:**\n${results.join('\n')}`)

    return sections.length > 0
      ? sections.join('\n\n')
      : 'No results found for that query. Try a more specific legal term.'
  } catch (e) {
    return `Web search failed: ${(e as Error).message}`
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
