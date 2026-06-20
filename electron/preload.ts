import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  webSearch: (query: string) => ipcRenderer.invoke('web-search', query),
  legalSearch: (query: string, court?: string) => ipcRenderer.invoke('legal-search', query, court),
  verifyCitation: (citation: string) => ipcRenderer.invoke('verify-citation', citation),
  exportDocument: (args: { defaultName: string; format: 'docx' | 'md' | 'txt'; content: string }) =>
    ipcRenderer.invoke('export-document', args),
  mcpConnect: (configs: unknown) => ipcRenderer.invoke('mcp-connect', configs),
  mcpCallTool: (server: string, name: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp-call-tool', server, name, args)
})
