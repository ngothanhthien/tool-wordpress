export interface GenerateProductRequest {
  urls: string[]
}

export interface ApiResponse<T> {
  data: T
  error: string | null
  message: string
}
