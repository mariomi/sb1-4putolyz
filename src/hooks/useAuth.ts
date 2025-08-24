import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import { logUserLogin, logUserLogout, closePreviousSessions } from '../lib/accessLogger'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkOperatorSession = () => {
      try {
        const operatorSession = localStorage.getItem('operator_session')
        if (operatorSession) {
          const sessionData = JSON.parse(operatorSession)
          if (sessionData.expires_at > Date.now()) {
            console.log('Found valid operator session:', sessionData.user_id)
            setUser({
              id: sessionData.user_id,
              email: sessionData.email,
              aud: 'authenticated',
              role: 'authenticated',
              app_metadata: {},
              user_metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any)
            setLoading(false)
            return true
          }
          console.log('Operator session expired, removing')
          // Log logout for expired operator session
          if (user) {
            logUserLogout(user.id, 'operator-session').catch(console.error)
          }
          localStorage.removeItem('operator_session')
        }
      } catch (e) {
        console.error('Error checking operator session:', e)
        localStorage.removeItem('operator_session')
      }
      return false
    }

    if (checkOperatorSession()) return

    console.log('Checking Supabase session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting Supabase session:', error)
        supabase.auth.signOut()
        setUser(null)
      } else {
        console.log('Supabase session found:', session?.user?.id)
        setUser(session?.user ?? null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      // Handle different auth events
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔄 User signed in, closing any previous sessions...')
        // Close any previous sessions for this user
        await closePreviousSessions(session.user.id)
      }
      
      // Log logout when user is signed out
      if (event === 'SIGNED_OUT' && user) {
        console.log('🔄 User signed out, logging logout...')
        await logUserLogout(user.id, 'default')
      }
      
      if (!localStorage.getItem('operator_session')) {
        setUser(session?.user ?? null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle page unload to log logout
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        console.log('🔄 Page unloading, logging logout...')
        // Try to log logout directly
        logUserLogout(user.id, 'default').catch(console.error)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && user) {
        console.log('🔄 Page hidden, logging logout...')
        // Page is being hidden (tab switch, minimize, etc.)
        logUserLogout(user.id, 'default').catch(console.error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in with email:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Sign in error:', error)
    } else {
      console.log('Sign in successful:', data.user?.id)
      // Log user access AFTER successful authentication
      if (data.user && data.session) {
        // Use a small delay to ensure the session is fully established
        setTimeout(async () => {
          try {
            console.log('🔐 Logging user access after successful authentication...')
            await logUserLogin({
              user_id: data.user!.id,
              profile_id: data.user!.id,
              ip_address: undefined, // Will be updated later if available
              user_agent: navigator.userAgent,
              session_id: data.session!.access_token || 'default'
            })
            
            // Try to get IP address asynchronously and update the log
            getClientIP().then(ipAddress => {
              if (ipAddress) {
                console.log('🌐 Got IP address:', ipAddress)
                // Note: We could update the log here if needed
              }
            }).catch(console.error)
          } catch (logError) {
            console.error('❌ Error logging user access:', logError)
          }
        }, 1000) // 1 second delay to ensure session is established
      }
    }
    return { data, error }
  }

  const signUp = async (email: string, password: string, _fullName: string) => {
    console.log('Attempting sign up with email:', email)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (data.user && !error) {
      console.log('Creating profile for user:', data.user.id)
      await supabase.from('profiles').insert({ id: data.user.id })
    }
    if (error) {
      console.error('Sign up error:', error)
    } else {
      console.log('Sign up successful:', data.user?.id)
    }
    return { data, error }
  }

  const signInWithOperator = async (
    expectedRole: 'admin' | 'project_manager' | 'reply_operator' | 'data_operator' | 'sales' | 'client' | null,
    operatorId: string,
    accessKey: string,
  ) => {
    console.log('Attempting operator sign in:', { operatorId, expectedRole })
    
    try {
      const { data: authResult, error: authError } = await supabase
        .rpc('authenticate_operator', { _operator_id: operatorId, _access_key: accessKey })

      if (authError) {
        console.error('Authentication Error:', authError)
        return { error: authError, profile: null as Profile | null }
      }
      
      console.log('Authentication result:', authResult)
      
      if (!authResult || !Array.isArray(authResult) || authResult.length === 0) {
        console.error('No authentication result returned')
        return { error: new Error('Operatore non trovato'), profile: null as Profile | null }
      }

      const authData = authResult[0]
      if (!authData.success) {
        console.error('Authentication failed:', authData)
        return { error: new Error('Credenziali non valide'), profile: null as Profile | null }
      }

      console.log('Login attempt:', { email: authData.email, actualRole: authData.role, expectedRole, success: authData.success })

      // Try to create a real Supabase session first
      try {
        console.log('Attempting Supabase password sign in...')
        const { error: pwError } = await supabase.auth.signInWithPassword({
          email: authData.email,
          password: accessKey,
        })
        if (!pwError) {
          console.log('✅ Real Supabase session created successfully')
          return { error: null, profile: {
            id: authData.user_id,
            role: authData.role as any,
            full_name: authData.full_name,
            operator_id: operatorId,
            access_key: accessKey,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } }
        }
        console.warn('❌ Supabase password sign-in failed, using local session fallback', pwError)
      } catch (e) {
        console.warn('❌ Supabase sign-in exception, using local session fallback', e)
      }

      // Fallback: create a local session for the operator
      try {
        console.log('Creating local operator session...')
        localStorage.setItem('operator_session', JSON.stringify({
          user_id: authData.user_id,
          email: authData.email,
          role: authData.role,
          full_name: authData.full_name,
          operator_id: operatorId,
          expires_at: Date.now() + (24 * 60 * 60 * 1000),
        }))

        setUser({
          id: authData.user_id,
          email: authData.email,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
      } catch (storageError) {
        console.error('Session storage error:', storageError)
        return { error: new Error('Errore nel salvataggio della sessione'), profile: null as Profile | null }
      }

      const profile: Profile = {
        id: authData.user_id,
        role: authData.role as any,
        full_name: authData.full_name,
        operator_id: operatorId,
        access_key: accessKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      console.log('✅ Operator login successful with local session')
      
      // Log user access for operator AFTER successful authentication
      setTimeout(async () => {
        try {
          console.log('🔐 Logging operator access after successful authentication...')
          await logUserLogin({
            user_id: authData.user_id,
            profile_id: authData.user_id,
            ip_address: undefined, // Will be updated later if available
            user_agent: navigator.userAgent,
            session_id: 'operator-session'
          })
          
          // Try to get IP address asynchronously
          getClientIP().then(ipAddress => {
            if (ipAddress) {
              console.log('🌐 Got IP address for operator:', ipAddress)
            }
          }).catch(console.error)
        } catch (logError) {
          console.error('❌ Error logging operator access:', logError)
        }
      }, 1000) // 1 second delay to ensure session is established
      
      return { error: null, profile }
    } catch (error) {
      console.error('Operator sign in exception:', error)
      return { error: error as Error, profile: null as Profile | null }
    }
  }

  const fetchProfileByUserId = async (userId: string): Promise<Profile | null> => {
    if (!userId) return null
    if (userId.startsWith('by-operator-id:')) {
      const opId = userId.split(':', 2)[1]
      const { data } = await supabase.from('profiles').select('*').eq('operator_id', opId).maybeSingle()
      return (data as unknown as Profile) ?? null
    }

    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    return (data as unknown as Profile) ?? null
  }

  const sendPasswordResetByOperatorId = async (operatorId: string) => {
    const { data, error } = await supabase.rpc('get_email_and_role_by_operator', { _operator_id: operatorId })
    if (error) return { error }
    const email = (data?.[0]?.email as string) || null
    if (!email) return { error: new Error('Operatore non trovato') }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` })
    return { error: resetError }
  }

  const signOut = async () => {
    console.log('🔄 Signing out...')
    
    // Log user logout if user exists
    if (user) {
      console.log('🔄 Logging logout for user:', user.id)
      await logUserLogout(user.id, 'default')
    }
    
    // Clear operator session
    localStorage.removeItem('operator_session')
    
    // Clear user state
    setUser(null)
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    } else {
      console.log('✅ Sign out successful')
    }
    return { error }
  }

  return { user, loading, signIn, signUp, signOut, signInWithOperator, fetchProfileByUserId, sendPasswordResetByOperatorId }
}

// Add helper function to get client IP
const getClientIP = async (): Promise<string | undefined> => {
  try {
    // Try to get IP from a public IP service with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000) // Reduced timeout to 2 seconds
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return data.ip
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('IP fetch timed out, using fallback')
    } else {
      console.warn('Could not fetch client IP, using fallback:', error)
    }
    
    // Fallback: try alternative IP service
    try {
      const response = await fetch('https://httpbin.org/ip', { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        const data = await response.json()
        return data.origin
      }
    } catch (fallbackError) {
      console.warn('Fallback IP service also failed:', fallbackError)
    }
    
    return undefined
  }
}