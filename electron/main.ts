import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import Store from 'electron-store'

const store = new Store()

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

// Open a file dialog and return file content
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
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'document'
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const buffer = readFileSync(filePath)

  return {
    path: filePath,
    name: fileName,
    ext,
    data: buffer.toString('base64')
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
