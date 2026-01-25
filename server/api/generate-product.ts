import type { GenerateProductRequest, ApiResponse } from '@/types/api'
import type { N8NTriggerResponse, N8NProcess } from '~/entities/N8NProccess.schema'
import { serverSupabaseClient } from '#supabase/server'
import { N8NProcessesRepository } from '~/repositories/supabase/n8n'
import { N8NProcessStatus } from '~/entities/N8NProccess.schema'

export default defineEventHandler(async (event): Promise<ApiResponse<N8NProcess | null>> => {
  const body = await readBody(event) as GenerateProductRequest
  const supabase = await serverSupabaseClient(event)
  const { chatInput } = body

  if (!chatInput) {
    throw createError({
      statusCode: 400,
      statusMessage: 'chatInput is required',
    })
  }

  try {
    const id = crypto.randomUUID()

    const response = await $fetch('https://n8n.thiennt.app/webhook/generate/product', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.N8N_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: {
        chatInput,
        process_id: id,
      },
    }) as N8NTriggerResponse

    const { data: insertedData, error: insertError } = await new N8NProcessesRepository(supabase).create({
      id,
      process_name: response.name,
      n8n_workflow_id: response.workflow_id,
      n8n_execution_id: response.execution_id,
      status: N8NProcessStatus.RUNNING,
      input_payload: {
        chatInput,
      },
    })

    if (insertError) {
      console.error('Insert error:', insertError)
      return {
        data: null,
        error: 'Failed to insert product',
        message: 'Failed to generate product',
      }
    }

    return {
      data: insertedData,
      error: null,
      message: 'Product generated successfully',
    }
  } catch (error) {
    console.error(error)

    return {
      data: null,
      error: 'Something went wrong',
      message: 'Failed to generate product',
    }
  }
})
