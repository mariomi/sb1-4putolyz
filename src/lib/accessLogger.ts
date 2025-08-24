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
  online_duration_minutes?: number | null
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
 * Log user login using user_access_logs table
 */
export const logUserLogin = async (logEntry: AccessLogEntry): Promise<void> => {
  try {
    console.log('🔐 Logging user login:', logEntry.user_id)
    
    // Use user_access_logs table
    const { error } = await supabaseAdmin
      .from('user_access_logs')
      .insert({
        user_id: logEntry.user_id,
        profile_id: logEntry.profile_id,
        ip_address: logEntry.ip_address,
        user_agent: logEntry.user_agent,
        session_id: logEntry.session_id,
        login_time: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Error logging user login:', error)
    } else {
      console.log('✅ User login logged successfully')
    }
  } catch (error) {
    console.error('❌ Exception logging user login:', error)
  }
}

/**
 * Log user logout using user_access_logs table
 */
export const logUserLogout = async (userId: string, sessionId?: string): Promise<void> => {
  try {
    console.log('🚪 Logging user logout:', userId)
    
    // Find the login record and update it with logout time
    const { data: loginRecord, error: findError } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId || 'default')
      .is('logout_time', null)
      .single()

    if (findError || !loginRecord) {
      console.error('❌ Error finding login record for logout:', findError)
      return
    }

    // Update with logout time
    const { error: updateError } = await supabaseAdmin
      .from('user_access_logs')
      .update({
        logout_time: new Date().toISOString()
      })
      .eq('id', loginRecord.id)

    if (updateError) {
      console.error('❌ Error logging user logout:', updateError)
    } else {
      console.log('✅ User logout logged successfully')
    }
  } catch (error) {
    console.error('❌ Exception logging user logout:', error)
  }
}

/**
 * Get user access logs from user_access_logs table
 */
export const getUserAccessLogs = async (): Promise<AccessLog[]> => {
  try {
    console.log('📊 Fetching user access logs...')
    
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .order('login_time', { ascending: false })

    if (error) {
      console.error('❌ Error fetching access logs:', error)
      return []
    }

    console.log(`✅ Fetched ${data?.length || 0} access logs`)
    return data || []
  } catch (error) {
    console.error('❌ Exception fetching access logs:', error)
    return []
  }
}

/**
 * Get access logs for a specific user (temporary solution)
 */
export const getUserAccessLogsById = async (userId: string): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('logs')
      .select('*')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .eq('event_data->user_id', userId)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching user access logs:', error)
      return []
    }

    // Convert logs table format to AccessLog format
    return (data || []).map(log => ({
      id: log.id,
      user_id: log.event_data?.user_id || '',
      profile_id: log.event_data?.profile_id || '',
      login_time: log.event_data?.login_time || log.timestamp,
      logout_time: log.event_data?.logout_time || null,
      online_duration_minutes: log.event_data?.logout_time ? 
        Math.floor((new Date(log.event_data.logout_time).getTime() - new Date(log.event_data.login_time).getTime()) / (1000 * 60)) : 
        null,
      ip_address: log.event_data?.ip_address || '',
      user_agent: log.event_data?.user_agent || '',
      session_id: log.event_data?.session_id || '',
      created_at: log.timestamp,
      updated_at: log.timestamp
    }))
  } catch (error) {
    console.error('Error fetching user access logs:', error)
    return []
  }
}

/**
 * Close all previous sessions for a user before creating a new one
 */
export const closePreviousSessions = async (userId: string): Promise<void> => {
  try {
    console.log(`🔄 Closing previous sessions for user: ${userId}`)
    
    // Find all open sessions for this user and close them
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
      console.log(`📝 Found ${openSessions.length} open sessions to close`)
      
      // Close each open session
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
          console.log(`✅ Closed session: ${session.id}`)
        }
      }
    } else {
      console.log(`ℹ️ No open sessions found for user: ${userId}`)
    }
  } catch (error) {
    console.error('❌ Exception closing previous sessions:', error)
  }
}

/**
 * Get current online users from user_access_logs table
 */
export const getCurrentOnlineUsers = async (): Promise<AccessLog[]> => {
  try {
    console.log('👥 Fetching current online users...')
    
    const { data, error } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .is('logout_time', null)
      .order('login_time', { ascending: false })

    if (error) {
      console.error('❌ Error fetching online users:', error)
      return []
    }

    console.log(`✅ Found ${data?.length || 0} online users`)
    return data || []
  } catch (error) {
    console.error('❌ Exception fetching online users:', error)
    return []
  }
}

/**
 * Get access statistics from user_access_logs table
 */
export const getAccessStatistics = async () => {
  try {
    console.log('📈 Fetching access statistics...')
    
    // Get total logins today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todayLogins, error: todayError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .gte('login_time', today.toISOString())

    if (todayError) {
      console.error('❌ Error fetching today logins:', todayError)
    }

    // Get total logins this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { data: weekLogins, error: weekError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .gte('login_time', weekAgo.toISOString())

    if (weekError) {
      console.error('❌ Error fetching week logins:', weekError)
    }

    // Get current online users
    const { data: onlineUsers, error: onlineError } = await supabaseAdmin
      .from('user_access_logs')
      .select('id')
      .is('logout_time', null)

    if (onlineError) {
      console.error('❌ Error fetching online users:', onlineError)
    }

    const stats = {
      todayLogins: todayLogins?.length || 0,
      weekLogins: weekLogins?.length || 0,
      currentOnline: onlineUsers?.length || 0
    }
    
    console.log('✅ Access statistics:', stats)
    return stats
  } catch (error) {
    console.error('❌ Exception fetching access statistics:', error)
    return {
      todayLogins: 0,
      weekLogins: 0,
      currentOnline: 0
    }
  }
}

/**
 * Force logout a user by closing all their open access log sessions
 */
export const forceLogoutUser = async (userId: string): Promise<boolean> => {
  try {
    console.log(`🔄 Force logging out user: ${userId}`)
    
    // Find all open sessions for this user and close them
    const { data: openSessions, error: findError } = await supabaseAdmin
      .from('user_access_logs')
      .select('*')
      .eq('user_id', userId)
      .is('logout_time', null)

    if (findError) {
      console.error('❌ Error finding open sessions:', findError)
      return false
    }

    if (openSessions && openSessions.length > 0) {
      console.log(`📝 Found ${openSessions.length} open sessions to close`)
      
      // Close each open session
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
          console.log(`✅ Closed session: ${session.id}`)
        }
      }
      
      console.log(`✅ Force logout completed for user: ${userId}`)
      return true
    } else {
      console.log(`ℹ️ No open sessions found for user: ${userId}`)
      return true
    }
  } catch (error) {
    console.error('❌ Exception during force logout:', error)
    return false
  }
}

/**
 * Complete force logout - closes access log sessions and attempts session invalidation
 */
export const forceLogoutUserComplete = async (userId: string): Promise<boolean> => {
  try {
    console.log(`🔄 Starting complete force logout for user: ${userId}`)
    
    // Step 1: Close all access log sessions
    const accessLogSuccess = await forceLogoutUser(userId)
    
    if (!accessLogSuccess) {
      console.error('❌ Failed to close access log sessions')
      return false
    }
    
    console.log('✅ Access log sessions closed successfully')
    
    // Step 2: Try to invalidate the user's Supabase session
    // This is a workaround - in production you'd want a proper backend endpoint
    try {
      console.log('🔄 Attempting to invalidate user session...')
      
      // Update user profile to trigger session refresh (workaround)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId)
      
      if (profileError) {
        console.warn('⚠️ Could not update user profile:', profileError)
      } else {
        console.log('✅ User profile updated to trigger session refresh')
      }
      
    } catch (sessionError) {
      console.warn('⚠️ Session invalidation attempt failed:', sessionError)
    }
    
    console.log('✅ Complete force logout finished')
    return true
    
  } catch (error) {
    console.error('❌ Exception during complete force logout:', error)
    return false
  }
}
