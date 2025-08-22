import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.id)
      if (!localStorage.getItem('operator_session')) {
        setUser(session?.user ?? null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in with email:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Sign in error:', error)
    } else {
      console.log('Sign in successful:', data.user?.id)
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
    console.log('Signing out...')
    localStorage.removeItem('operator_session')
    setUser(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    } else {
      console.log('Sign out successful')
    }
    return { error }
  }

  return { user, loading, signIn, signUp, signOut, signInWithOperator, fetchProfileByUserId, sendPasswordResetByOperatorId }
}