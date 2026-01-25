import type { SupabaseClient } from '@supabase/supabase-js'

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResult {
  success: boolean
  message: string
}

export class AuthRepository {
  constructor(private supabase: SupabaseClient) {}

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: true,
      message: 'Đăng nhập thành công',
    }
  }
}
