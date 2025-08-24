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
 * Log user login using existing logs table (temporary solution)
 */
export const logUserLogin = async (logEntry: AccessLogEntry): Promise<void> => {
  try {
    // Use existing logs table with a special campaign_id for user access logs
    const { error } = await supabase
      .from('logs')
      .insert({
        campaign_id: '00000000-0000-0000-0000-000000000000', // Special ID for user access logs
        event_type: 'user_login',
        event_data: {
          user_id: logEntry.user_id,
          profile_id: logEntry.profile_id,
          ip_address: logEntry.ip_address,
          user_agent: logEntry.user_agent,
          session_id: logEntry.session_id,
          login_time: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      })

    if (error) {
      console.error('Error logging user login:', error)
    }
  } catch (error) {
    console.error('Error logging user login:', error)
  }
}

/**
 * Log user logout (temporary solution using logs table)
 */
export const logUserLogout = async (userId: string, sessionId?: string): Promise<void> => {
  try {
    // Find the login record and update it with logout time
    const { data: loginRecord, error: findError } = await supabase
      .from('logs')
      .select('*')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .eq('event_data->user_id', userId)
      .eq('event_data->session_id', sessionId || 'default')
      .is('event_data->logout_time', null)
      .single()

    if (findError || !loginRecord) {
      console.error('Error finding login record for logout:', findError)
      return
    }

    // Update the event_data with logout time
    const updatedEventData = {
      ...loginRecord.event_data,
      logout_time: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('logs')
      .update({
        event_data: updatedEventData,
        timestamp: new Date().toISOString()
      })
      .eq('id', loginRecord.id)

    if (updateError) {
      console.error('Error logging user logout:', updateError)
    }
  } catch (error) {
    console.error('Error logging user logout:', error)
  }
}

/**
 * Get user access logs from logs table (temporary solution)
 */
export const getUserAccessLogs = async (): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('logs')
      .select('*')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching access logs:', error)
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
    console.error('Error fetching access logs:', error)
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
      .from('logs')
      .select('*')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .eq('event_data->user_id', userId)
      .is('event_data->logout_time', null)

    if (findError) {
      console.error('Error finding open sessions:', findError)
      return
    }

    if (openSessions && openSessions.length > 0) {
      console.log(`📝 Found ${openSessions.length} open sessions to close`)
      
      // Close each open session
      for (const session of openSessions) {
        const updatedEventData = {
          ...session.event_data,
          logout_time: new Date().toISOString()
        }

        const { error: updateError } = await supabaseAdmin
          .from('logs')
          .update({
            event_data: updatedEventData,
            timestamp: new Date().toISOString()
          })
          .eq('id', session.id)

        if (updateError) {
          console.error('Error closing session:', updateError)
        } else {
          console.log(`✅ Closed session: ${session.id}`)
        }
      }
    } else {
      console.log(`ℹ️ No open sessions found for user: ${userId}`)
    }
  } catch (error) {
    console.error('Error closing previous sessions:', error)
  }
}

/**
 * Get current online users (temporary solution)
 */
export const getCurrentOnlineUsers = async (): Promise<AccessLog[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('logs')
      .select('*')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .is('event_data->logout_time', null)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching online users:', error)
      return []
    }

    // Convert logs table format to AccessLog format
    return (data || []).map(log => ({
      id: log.id,
      user_id: log.event_data?.user_id || '',
      profile_id: log.event_data?.profile_id || '',
      login_time: log.event_data?.login_time || log.timestamp,
      logout_time: log.event_data?.logout_time || null,
      online_duration_minutes: null,
      ip_address: log.event_data?.ip_address || '',
      user_agent: log.event_data?.user_agent || '',
      session_id: log.event_data?.session_id || '',
      created_at: log.timestamp,
      updated_at: log.timestamp
    }))
  } catch (error) {
    console.error('Error fetching online users:', error)
    return []
  }
}

/**
 * Get access statistics (temporary solution)
 */
export const getAccessStatistics = async () => {
  try {
    // Get total logins today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todayLogins, error: todayError } = await supabaseAdmin
      .from('logs')
      .select('id')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .gte('timestamp', today.toISOString())

    if (todayError) {
      console.error('Error fetching today logins:', todayError)
    }

    // Get total logins this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { data: weekLogins, error: weekError } = await supabaseAdmin
      .from('logs')
      .select('id')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .gte('timestamp', weekAgo.toISOString())

    if (weekError) {
      console.error('Error fetching week logins:', weekError)
    }

    // Get current online users
    const { data: onlineUsers, error: onlineError } = await supabaseAdmin
      .from('logs')
      .select('id')
      .eq('campaign_id', '00000000-0000-0000-0000-000000000000')
      .eq('event_type', 'user_login')
      .is('event_data->logout_time', null)

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
