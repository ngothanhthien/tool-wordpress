import { z } from 'zod'

/**
 * Schema for n8n_processes table
 * Tracks n8n workflow executions triggered by users
 */
export const n8nProcessSchema = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  process_name: z.string().default(''),
  n8n_workflow_id: z.string().min(1, 'Workflow ID is required'),
  n8n_execution_id: z.string().min(1, 'Execution ID is required'),
  status: z.string().min(1, 'Status is required'),
  error_message: z.string().nullable().default(null),
  input_payload: z.record(z.string(), z.any()).nullable().default(null),
  output_payload: z.record(z.string(), z.any()).nullable().default(null),
  started_at: z.coerce.date().nullable().default(null),
  finished_at: z.coerce.date().nullable().default(null),
  triggered_by: z.uuid().nullable().default(null),
})

export const n8nTriggerResponseSchema = z.object({
  execution_id: z.string().min(1, 'Execution ID is required'),
  workflow_id: z.string().min(1, 'Workflow ID is required'),
  name: z.string().min(1, 'Name is required'),
})

export type N8NProcess = z.output<typeof n8nProcessSchema>
export type N8NTriggerResponse = z.output<typeof n8nTriggerResponseSchema>

/**
 * Status values for n8n processes
 */
export const N8NProcessStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

/**
 * Form schema for creating a new n8n process trigger
 */
export const createN8NProcessFormSchema = z.object({
  process_name: z.string().min(1, 'Process name is required'),
  n8n_workflow_id: z.string().min(1, 'Workflow ID is required'),
  input_payload: z.record(z.string(), z.any()).optional(),
})

export type CreateN8NProcessForm = z.output<typeof createN8NProcessFormSchema>
