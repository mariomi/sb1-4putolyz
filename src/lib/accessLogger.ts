import { supabase, supabaseAdmin } from './supabase'

export interface AccessLogEntry {
  user_id: string
  profile_id?: string
  ip_address?: string
  user_agent?: string
  session_id?: string
}

export interface AccessLog {
  id: string
  user_id: string
  profile_id?: string
  login_time: string
  logout_time?: string
  online_duration_minutes?: number
  ip_address?: string
  user_agent?: string
  session_id?: string
  created_at: string
  updated_at: string
}

// Interface for existing logs table
export interface SystemLog {
  id: string
  campaign_id: string
  queue_entry_id?: string
  sender_id?: string
  contact_id?: string
  event_type: string
  event_data: any
  timestamp: string
}

/**
 * Close all previous sessions for a user before creating a new one
 */
export const closePreviousSessions = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Closing previous sessions for user:', userId)
    
    // Find all open sessions for this user
    const { data: openSessions, error: findError } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .is('logout_time', null)
      .order('login_time', { ascending: false })

    if (findError) {
      console.error('❌ Error finding open sessions:', findError)
      return
    }

    if (openSessions && openSessions.length > 0) {
      console.log(`📝 Found ${openSessions.length} open sessions to close`)
      
      // Close all open sessions
      for (const session of openSessions) {
        const { error: updateError } = await supabaseAdmin
          .from('user_access_logs')
          .update({
            logout_time: new Date().toISOString()
          })
          .eq('id', session.id)

        if (updateError) {
          console.error('❌ Error closing session:', updateError)
        } else {
          console.log('✅ Closed session:', session.id)
        }
      }
    } else {
      console.log('ℹ️ No open sessions found for user')
    }
  } catch (error) {
    console.error('❌ Exception closing previous sessions:', error)
  }
}

/**
 * Log user login with session management
 */
export const logUserLogin = async (logEntry: AccessLogEntry): Promise<void> => {
  try {
    console.log('🔐 Logging user login:', logEntry)
    console.log('🔐 Using admin client for logging...')
    
    // First, close any previous sessions for this user
    await closePreviousSessions(logEntry.user_id)
    
    // Test table access first using admin client
    console.log('🧪 Testing table access with admin client...')
    const { data: testData, error: testError } = await supabaseAdmin
      .from('user_access_logs')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ Table access test failed:', testError)
      throw testError
    } else {
      console.log('✅ Table access test successful:', testData)
    }
    
    // Now try to insert the login record using admin client
    console.log('📝 Inserting login record with admin client...')
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .insert({
        user_id: logEntry.user_id,
        profile_id: logEntry.profile_id,
        ip_address: logEntry.ip_address,
        user_agent: logEntry.user_agent,
        session_id: logEntry.session_id,
        login_time: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('❌ Error logging user login:', error)
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw error
    } else {
      console.log('✅ User login logged successfully:', data)
    }
  } catch (error) {
    console.error('❌ Exception logging user login:', error)
    console.error('❌ Exception stack:', error instanceof Error ? error.stack : 'No stack trace')
    // Don't throw the error to avoid breaking the login flow
  }
}

/**
 * Log user logout with session cleanup
 */
export const logUserLogout = async (userId: string, sessionId?: string): Promise<void> => {
  try {
    console.log('🚪 Logging user logout:', { userId, sessionId })
    console.log('🚪 Using admin client for logout logging...')
    
    // Find the login record and update it with logout time using admin client
    const { data: loginRecord, error: findError } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId || 'default')
      .is('logout_time', null)
      .order('login_time', { ascending: false })
      .limit(1)
      .single()

    if (findError || !loginRecord) {
      console.error('❌ Error finding login record for logout:', findError)
      return
    }

    console.log('📝 Found login record for logout:', loginRecord)

    // Update with logout time using admin client (the trigger will automatically calculate online_duration_minutes)
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('user_access_logs')
      .update({
        logout_time: new Date().toISOString()
      })
      .eq('id', loginRecord.id)
      .select()

    if (updateError) {
      console.error('❌ Error logging user logout:', updateError)
      throw updateError
    } else {
      console.log('✅ User logout logged successfully:', updateData)
    }
  } catch (error) {
    console.error('❌ Exception logging user logout:', error)
    // Don't throw the error to avoid breaking the logout flow
  }
}

/**
 * Force logout user and invalidate their session (admin function)
 */
export const forceLogoutUser = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Force logging out all sessions for user:', userId)
    
    const { data: openSessions, error: findError } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .is('logout_time', null)

    if (findError) {
      console.error('❌ Error finding open sessions:', findError)
      return
    }

    if (openSessions && openSessions.length > 0) {
      console.log(`📝 Force closing ${openSessions.length} open sessions`)
      
      for (const session of openSessions) {
        const { error: updateError } = await supabaseAdmin
          .from('user_access_logs')
          .update({
            logout_time: new Date().toISOString()
          })
          .eq('id', session.id)

        if (updateError) {
          console.error('❌ Error force closing session:', updateError)
        } else {
          console.log('✅ Force closed session:', session.id)
        }
      }
    }
  } catch (error) {
    console.error('❌ Exception force logging out user:', error)
  }
}

/**
 * Force logout user completely by invalidating their session (advanced admin function)
 */
export const forceLogoutUserComplete = async (userId: string): Promise<boolean> => {
  try {
    console.log('🔄 Force logout complete for user:', userId)
    
    // Step 1: Close all access log sessions
    await forceLogoutUser(userId)
    
    // Step 2: Try to invalidate the user's JWT token
    // This requires backend support - for now we'll just mark the session as closed
    console.log('ℹ️ Session marked as closed in access logs')
    console.log('ℹ️ For complete session invalidation, implement backend endpoint')
    
    return true
  } catch (error) {
    console.error('❌ Exception in complete force logout:', error)
    return false
  }
}

/**
 * Get user access logs from user_access_logs table
 */
export const getUserAccessLogs = async (): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .order('login_time', { ascending: false })

    if (error) {
      console.error('Error fetching access logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching access logs:', error)
    return []
  }
}

/**
 * Get access logs for a specific user
 */
export const getUserAccessLogsById = async (userId: string): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .order('login_time', { ascending: false })

    if (error) {
      console.error('Error fetching user access logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user access logs:', error)
    return []
  }
}

/**
 * Get current online users
 */
export const getCurrentOnlineUsers = async (): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .is('logout_time', null)
      .order('login_time', { ascending: false })

    if (error) {
      console.error('Error fetching online users:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching online users:', error)
    return []
  }
}

/**
 * Get access statistics
 */
export const getAccessStatistics = async () => {
  try {
    // Get total logins today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todayLogins, error: todayError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .gte('login_time', today.toISOString())

    if (todayError) {
      console.error('Error fetching today logins:', todayError)
    }

    // Get total logins this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { data: weekLogins, error: weekError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .gte('login_time', weekAgo.toISOString())

    if (weekError) {
      console.error('Error fetching week logins:', weekError)
    }

    // Get current online users
    const { data: onlineUsers, error: onlineError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .is('logout_time', null)

    if (onlineError) {
      console.error('Error fetching online users:', onlineError)
    }

    return {
      todayLogins: todayLogins?.length || 0,
      weekLogins: weekLogins?.length || 0,
      currentOnline: onlineUsers?.length || 0
    }
  } catch (error) {
    console.error('Error fetching access statistics:', error)
    return {
      todayLogins: 0,
      weekLogins: 0,
      currentOnline: 0
    }
  }
}

/**
 * Test function to verify table access
 */
export const testTableAccess = async (): Promise<boolean> => {
  try {
    console.log('🧪 Testing table access with admin client...')
    
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Table access test failed:', error)
      return false
    } else {
      console.log('✅ Table access test successful:', data)
      return true
    }
  } catch (error) {
    console.error('❌ Table access test exception:', error)
    return false
  }
}
