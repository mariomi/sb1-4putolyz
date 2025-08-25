import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = 'https://xqsjyvqikrvibyluynwv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p5dnFpa3J2aWJ5bHV5bnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzIzOTgsImV4cCI6MjA2ODUwODM5OH0.rfBsX1s-3dJcr7hvd9x3hHW7WZPJpT-SMYrMfiG8fgc'

// Create Supabase client with better error handling
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-react'
    }
  }
})

// NOTE: Avoid creating a second Supabase client in the browser to prevent
// multiple GoTrueClient instances (which cause warnings and inconsistent
// auth behavior). In production the service role client should only be used
// on the server. For the browser, reuse the primary `supabase` client.
export const supabaseAdmin = supabase

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      console.error('Supabase connection test failed:', error)
      return false
    }
    console.log('Supabase connection test successful')
    return true
  } catch (err) {
    console.error('Supabase connection test error:', err)
    return false
  }
}