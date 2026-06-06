import { useState } from 'react'
import { useAppStore } from './store'
import type { Document } from '../types'
import type { OpenFileResult } from '../App'

export function useFileUpload() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setSessionDocument, setShowDocPanel } = useAppStore()

  async function openFile() {
    if (!window.electronAPI) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.openFile()
      if (!result) return

      if ('error' in result) {
        setError(result.error)
        return
      }

      const file = result as OpenFileResult
      const newDoc: Document = {
        id: crypto.randomUUID(),
        name: file.name,
        ext: file.ext,
        path: file.path,
        size: file.size,
        content: file.content,
        rawData: file.data,
        extractionError: file.extractionError,
        loadedAt: Date.now()
      }
      setSessionDocument(newDoc)
      setShowDocPanel(true)
    } catch {
      setError('Failed to open file.')
    } finally {
      setIsLoading(false)
    }
  }

  return { openFile, isLoading, error }
}
