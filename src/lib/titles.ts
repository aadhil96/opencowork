import { useAppStore } from './store'
import { generateTitle, resolveModel } from './openrouter'

// Generate a short, descriptive title for the session after its first turn
// has finished streaming. Fire-and-forget; safe to call from any send path.
// Skipped if the assistant response is empty or contains the error marker.
export async function maybeGenerateSessionTitle(
  sessionId: string,
  userMessage: string
): Promise<void> {
  const state = useAppStore.getState()
  const session = state.sessions.find(s => s.id === sessionId)
  if (!session) return

  const lastAssistant = [...session.messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant?.content || lastAssistant.content.includes('*Error:')) return

  const { model, baseUrl } = resolveModel(state.settings)
  const title = await generateTitle(
    state.settings.openrouterApiKey,
    model,
    userMessage,
    lastAssistant.content,
    { baseUrl }
  )
  if (title) useAppStore.getState().renameSession(sessionId, title)
}
