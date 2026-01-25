import type { SupabaseClient } from '@supabase/supabase-js'
import type { N8NProcess } from '~/entities/N8NProccess.schema'

export interface PaginationOptions {
  pageIndex: number
  pageSize: number
}

export interface FetchProcessesOptions {
  pagination: PaginationOptions
  filter?: string
  status?: string
  processName?: string
}

export interface FetchProcessesResult {
  data: N8NProcess[]
  total: number
  error?: string
}

export class N8NProcessRepository {
  constructor(private supabase: SupabaseClient) {}

  async fetchProcesses(options: FetchProcessesOptions): Promise<FetchProcessesResult> {
    const { pagination, filter } = options
    const from = pagination.pageIndex * pagination.pageSize
    const to = from + pagination.pageSize - 1

    let query = this.supabase
      .from('n8n_processes')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    // Apply global filter if provided (search all text fields except status)
    if (filter) {
      query = query.or(
        `process_name.ilike.%${filter}%,n8n_workflow_id.ilike.%${filter}%,n8n_execution_id.ilike.%${filter}%`,
      )
    }

    // Apply status filter if provided (using .eq() for exact match)
    if (options.status) {
      query = query.eq('status', options.status)
    }

    // Apply process_name filter if provided
    if (options.processName) {
      query = query.eq('process_name', options.processName)
    }

    const { data, error, count } = await query

    if (error) {
      return {
        data: [],
        total: 0,
        error: error.message,
      }
    }

    return {
      data: (data || []) as N8NProcess[],
      total: count || 0,
    }
  }
}
