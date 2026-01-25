import type { SupabaseClient } from '@supabase/supabase-js'
import type { N8NProcess } from '~/entities/N8NProccess.schema'

export class N8NProcessesRepository {
  private tableName = 'n8n_processes'

  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new n8n process record
   */
  async create(data: {
    id: string
    process_name: string
    n8n_workflow_id: string
    n8n_execution_id: string
    status: string
    input_payload?: Record<string, any> | null
  }) {
    const { data: insertedData, error: insertError } = await this.supabase
      .from(this.tableName)
      .insert({
        id: data.id,
        process_name: data.process_name,
        n8n_workflow_id: data.n8n_workflow_id,
        n8n_execution_id: data.n8n_execution_id,
        status: data.status,
        input_payload: data.input_payload ?? null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('N8N process insert error:', insertError)
      return {
        data: null,
        error: insertError,
        message: 'Failed to create n8n process',
      }
    }

    return {
      data: insertedData as N8NProcess,
      error: null,
      message: 'N8N process created successfully',
    }
  }
}
