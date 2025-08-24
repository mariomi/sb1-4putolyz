import { useState, useEffect } from 'react'
import { Clock, Users, Calendar, Filter, Download, Eye, User, Monitor, Activity } from 'lucide-react'
import { getUserAccessLogs, getAccessStatistics, getCurrentOnlineUsers, AccessLog } from '../lib/accessLogger'
import { supabaseAdmin } from '../lib/supabase'

interface AccessLogWithProfile extends AccessLog {
  profile?: {
    full_name: string
    role: string
    operator_id: string
  }
}

export function AccessLogsSection() {
  const [accessLogs, setAccessLogs] = useState<AccessLogWithProfile[]>([])
  const [onlineUsers, setOnlineUsers] = useState<AccessLogWithProfile[]>([])
  const [statistics, setStatistics] = useState({
    todayLogins: 0,
    weekLogins: 0,
    currentOnline: 0
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    dateRange: '7d',
    userRole: '',
    search: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch access logs
      const logs = await getUserAccessLogs()
      
      // Fetch profile information for each log
      const logsWithProfiles = await Promise.all(
        logs.map(async (log) => {
          try {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, role, operator_id')
              .eq('id', log.profile_id || log.user_id)
              .single()

            return {
              ...log,
              profile: profile || {
                full_name: 'Utente Sconosciuto',
                role: 'unknown',
                operator_id: 'N/A'
              }
            }
          } catch (error) {
            return {
              ...log,
              profile: {
                full_name: 'Utente Sconosciuto',
                role: 'unknown',
                operator_id: 'N/A'
              }
            }
          }
        })
      )

      setAccessLogs(logsWithProfiles)

      // Fetch online users
      const online = await getCurrentOnlineUsers()
      const onlineWithProfiles = await Promise.all(
        online.map(async (log) => {
          try {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, role, operator_id')
              .eq('id', log.profile_id || log.user_id)
              .single()

            return {
              ...log,
              profile: profile || {
                full_name: 'Utente Sconosciuto',
                role: 'unknown',
                operator_id: 'N/A'
              }
            }
          } catch (error) {
            return {
              ...log,
              profile: {
                full_name: 'Utente Sconosciuto',
                role: 'unknown',
                operator_id: 'N/A'
              }
            }
          }
        })
      )

      setOnlineUsers(onlineWithProfiles)

      // Fetch statistics
      const stats = await getAccessStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const filteredLogs = accessLogs.filter(log => {
    const matchesDateRange = (() => {
      const logDate = new Date(log.login_time)
      const now = new Date()
      
      switch (filters.dateRange) {
        case '1d':
          return logDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000)
        case '7d':
          return logDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        case '30d':
          return logDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        default:
          return true
      }
    })()

    const matchesRole = !filters.userRole || log.profile?.role === filters.userRole
    const matchesSearch = !filters.search || 
      log.profile?.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      log.profile?.operator_id?.toLowerCase().includes(filters.search.toLowerCase())

    return matchesDateRange && matchesRole && matchesSearch
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A'
    
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: 'bg-[#F64C38] text-white',
      project_manager: 'bg-[#002F6C] text-white',
      reply_operator: 'bg-[#00C48C] text-white',
      data_operator: 'bg-[#FFA726] text-white',
      sales: 'bg-[#2C8EFF] text-white',
      client: 'bg-[#333333] text-white',
      unknown: 'bg-gray-500 text-white'
    }
    return roleColors[role] || 'bg-gray-500 text-white'
  }

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Amministratore',
      project_manager: 'Project Manager',
      reply_operator: 'Operatore Risposte',
      data_operator: 'Operatore Dati',
      sales: 'Vendite',
      client: 'Cliente',
      unknown: 'Sconosciuto'
    }
    return roleLabels[role] || role
  }

  const exportLogs = () => {
    const csvContent = [
      ['Utente', 'Ruolo', 'ID Operatore', 'Login', 'Logout', 'Durata Online'],
      ...filteredLogs.map(log => [
        log.profile?.full_name || 'N/A',
        getRoleLabel(log.profile?.role || 'unknown'),
        log.profile?.operator_id || 'N/A',
        formatDate(log.login_time),
        log.logout_time ? formatDate(log.logout_time) : 'Online',
        formatDuration(log.online_duration_minutes)
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `access_logs_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleForceLogoutUser = async (userId: string, userName: string) => {
    try {
      if (confirm(`Sei sicuro di voler forzare il logout per ${userName}? Questo disconnetterà l'utente dal sistema.`)) {
        console.log(`🔄 Force logging out user: ${userName} (${userId})`)
        
        // Import the function dynamically since we removed it from imports
        const { forceLogoutUserComplete } = await import('../lib/accessLogger')
        
        // Step 1: Complete force logout (access logs + session invalidation attempt)
        const success = await forceLogoutUserComplete(userId)
        
        if (success) {
          console.log('✅ Force logout completed successfully')
          
          // Step 2: Try to invalidate the user's session by updating their profile
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
          
          alert(`✅ Logout forzato per ${userName} completato!\n\nL'utente verrà disconnesso al prossimo refresh della pagina.`)
        } else {
          alert(`⚠️ Logout forzato parziale per ${userName}.\n\nLe sessioni sono state chiuse nei log, ma l'utente potrebbe rimanere connesso.`)
        }
        
        // Refresh data
        fetchData()
      }
    } catch (error) {
      console.error('Error force logging out user:', error)
      alert('❌ Errore durante il logout forzato.')
    }
  }

  // if (loading) {
  //   return null // Non mostrare nulla durante il caricamento
  // }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#333333] mb-2">Log Accessi Utenti</h1>
            <p className="text-[#333333] text-base leading-relaxed max-w-2xl">
              Monitora gli accessi degli utenti, i tempi di connessione e le sessioni attive.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={exportLogs}
              className="bg-[#00C48C] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#00C48C]/90 transition-colors duration-200 flex items-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Esporta CSV</span>
            </button>
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#333333] text-sm font-medium">Accessi Oggi</p>
                <p className="text-2xl font-bold text-[#333333]">{statistics.todayLogins}</p>
              </div>
              <div className="w-10 h-10 bg-[#002F6C] rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#333333] text-sm font-medium">Accessi Settimana</p>
                <p className="text-2xl font-bold text-[#333333]">{statistics.weekLogins}</p>
              </div>
              <div className="w-10 h-10 bg-[#00C48C] rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#333333] text-sm font-medium">Utenti Online</p>
                <p className="text-2xl font-bold text-[#333333]">{statistics.currentOnline}</p>
              </div>
              <div className="w-10 h-10 bg-[#FFA726] rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#333333] text-sm font-medium">Totale Log</p>
                <p className="text-2xl font-bold text-[#333333]">{accessLogs.length}</p>
              </div>
              <div className="w-10 h-10 bg-[#F64C38] rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#002F6C] rounded-lg flex items-center justify-center">
              <Filter className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-[#333333]">Filtri e Ricerca</h3>
          </div>
          <button
            onClick={() => setFilters({ dateRange: '7d', userRole: '', search: '' })}
            className="text-[#333333] hover:text-[#002F6C] font-medium px-3 py-2 rounded-lg hover:bg-[#F5F7FA] transition-colors duration-200 border border-gray-200 hover:border-[#002F6C]/30"
          >
            Reset Filtri
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <label className="block text-sm font-semibold text-[#333333] mb-3">
              Intervallo Date
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] transition-all duration-200 bg-white text-[#333333] font-medium shadow-sm appearance-none cursor-pointer hover:border-[#002F6C]/50"
            >
              <option value="1d">Ultime 24 ore</option>
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="all">Tutti</option>
            </select>
          </div>
          
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <label className="block text-sm font-semibold text-[#333333] mb-3">
              Ruolo Utente
            </label>
            <select
              value={filters.userRole}
              onChange={(e) => handleFilterChange('userRole', e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] transition-all duration-200 bg-white text-[#333333] font-medium shadow-sm appearance-none cursor-pointer hover:border-[#002F6C]/50"
            >
              <option value="">Tutti i ruoli</option>
              <option value="admin">Amministratore</option>
              <option value="project_manager">Project Manager</option>
              <option value="reply_operator">Operatore Risposte</option>
              <option value="data_operator">Operatore Dati</option>
              <option value="sales">Vendite</option>
              <option value="client">Cliente</option>
            </select>
          </div>
          
          <div className="bg-[#F5F7FA] rounded-lg p-4 border border-gray-200">
            <label className="block text-sm font-semibold text-[#333333] mb-3">
              Ricerca
            </label>
            <input
              type="text"
              placeholder="Cerca per nome, ID operatore..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] transition-colors duration-200 bg-white text-[#333333] font-medium shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Online Users Section */}
      {onlineUsers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-[#F5F7FA]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#333333] flex items-center">
                <Monitor className="w-5 h-5 mr-2 text-[#FFA726]" />
                Utenti Attualmente Online
              </h3>
              <span className="text-sm text-[#333333] bg-[#FFA726] text-white px-3 py-1 rounded">
                {onlineUsers.length} online
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F7FA]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    ID Operatore
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {onlineUsers.map((user, index) => (
                  <tr key={user.id} className={`hover:bg-[#F5F7FA] transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-[#FFA726] rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-[#333333]">
                            {user.profile?.full_name || 'Utente Sconosciuto'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRoleColor(user.profile?.role || 'unknown')}`}>
                        {getRoleLabel(user.profile?.role || 'unknown')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#333333]">
                        {user.profile?.operator_id ? (
                          <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded border border-gray-200">
                            {user.profile.operator_id}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Non specificato</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-[#333333]">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(user.login_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleForceLogoutUser(user.user_id, user.profile?.full_name || 'Utente Sconosciuto')}
                        className="bg-[#F64C38] text-white px-3 py-1 rounded text-xs font-medium hover:bg-[#F64C38]/90 transition-colors duration-200 flex items-center space-x-1"
                        title="Forza logout utente"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Logout</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Access Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-[#F5F7FA]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#333333]">
              Cronologia Accessi
            </h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-[#333333] bg-white px-3 py-1 rounded border border-gray-200">
                {filteredLogs.length} risultati
              </span>
              <span className="text-sm text-[#333333] bg-[#00C48C] text-white px-3 py-1 rounded">
                Totale: {accessLogs.length} log
              </span>
            </div>
          </div>
        </div>
        
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-[#F5F7FA] rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-[#333333]" />
            </div>
            <h3 className="text-lg font-semibold text-[#333333] mb-2">Nessun log trovato</h3>
            <p className="text-[#333333]">Prova a modificare i filtri di ricerca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F7FA]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    ID Operatore
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Logout
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#333333] uppercase tracking-wider">
                    Durata Online
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log, index) => (
                  <tr key={log.id} className={`hover:bg-[#F5F7FA] transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-[#002F6C] rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                          {log.profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-[#333333]">
                            {log.profile?.full_name || 'Utente Sconosciuto'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRoleColor(log.profile?.role || 'unknown')}`}>
                        {getRoleLabel(log.profile?.role || 'unknown')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#333333]">
                        {log.profile?.operator_id ? (
                          <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded border border-gray-200">
                            {log.profile.operator_id}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Non specificato</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-[#333333]">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(log.login_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-[#333333]">
                        {log.logout_time ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            {formatDate(log.logout_time)}
                          </>
                        ) : (
                          <span className="text-[#00C48C] font-medium flex items-center">
                            <Activity className="w-4 h-4 mr-2" />
                            Online
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#333333]">
                        {log.online_duration_minutes ? (
                          <span className="font-medium text-[#002F6C]">
                            {formatDuration(log.online_duration_minutes)}
                          </span>
                        ) : (
                          log.logout_time ? (
                            <span className="text-gray-400">Calcolando...</span>
                          ) : (
                            <span className="text-[#00C48C] font-medium">In corso...</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}




