import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

const users = [
  { email: 'admin@admin.com', password: 'password', role: 'admin' },
  { email: 'user@user.com', password: 'password', role: 'user' },
]

for (const u of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { role: u.role },
  })

  if (error) {
    console.error(`Create user failed for ${u.email}:`, error.message)
    continue
  }
}
