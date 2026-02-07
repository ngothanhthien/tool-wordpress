import { ref } from 'vue'
import type { SyncProgress } from '~/entities/Post.schema'

export function useWordPressSync() {
  const syncing = ref(false)
  const progress = ref<SyncProgress>({ status: 'idle' })

  const sync = async (onProgress?: (progress: SyncProgress) => void) => {
    if (syncing.value) return

    syncing.value = true
    progress.value = { status: 'started', message: 'Starting sync...' }
    onProgress?.(progress.value)

    try {
      const response = await fetch('/api/sync/wordpress/posts', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonStr = line.trim().slice(6)
              const data = JSON.parse(jsonStr) as SyncProgress
              progress.value = data
              onProgress?.(data)

              if (data.status === 'complete' || data.status === 'error') {
                syncing.value = false
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', line, e)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      const errorProgress: SyncProgress = { status: 'error', message: error.message || 'Unknown error occurred' }
      progress.value = errorProgress
      onProgress?.(errorProgress)
      syncing.value = false
    } finally {
      syncing.value = false
    }
  }

  return { syncing, progress, sync }
}
