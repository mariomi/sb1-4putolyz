import { useEffect, useState } from 'react'
import { TrendingUp, Send, Users, Mail, BarChart3 } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Stats {
  totalCampaigns: number
  totalContacts: number
  totalSenders: number
  emailsSentToday: number
}

export function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalContacts: 0,
    totalSenders: 0,
    emailsSentToday: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const fetchStats = async () => {
    try {
      console.log('📊 Caricamento statistiche dashboard...')

      // Check if user is admin (from localStorage session)
      const operatorSession = localStorage.getItem('operator_session')
      const isAdmin = operatorSession ? JSON.parse(operatorSession).role === 'admin' : false
      
      console.log('🔑 Using admin privileges:', isAdmin)

      // Query all data without profile_id filters
      console.log('📊 Querying all data without profile filters...')
      
      const [campaignsRes, contactsRes, sendersRes, queuesRes] = await Promise.all([
        supabase.from('campaigns').select('id', { count: 'exact' }),
        supabase.from('contacts').select('id', { count: 'exact' }),
        supabase.from('senders').select('id', { count: 'exact' }),
        supabase.from('campaign_queues').select('id', { count: 'exact' }).eq('status', 'sent')
      ])

      setStats({
        totalCampaigns: campaignsRes.count || 0,
        totalContacts: contactsRes.count || 0,
        totalSenders: sendersRes.count || 0,
        emailsSentToday: queuesRes.count || 0,
      })

      console.log('📊 Statistiche caricate (all data):', {
        campagne: campaignsRes.count,
        contatti: contactsRes.count,
        mittenti: sendersRes.count,
        emailInviate: queuesRes.count,
        isAdmin,
        errors: {
          campaigns: campaignsRes.error,
          contacts: contactsRes.error,
          senders: sendersRes.error,
          queues: queuesRes.error
        }
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Panoramica delle tue attività DEM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Campagne Totali</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
              <p className="text-sm text-gray-500">Attive</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contatti</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalContacts}</p>
              <p className="text-sm text-gray-500">Totali</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Mittenti</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSenders}</p>
              <p className="text-sm text-gray-500">Configurati</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Mail className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Email Inviate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.emailsSentToday}</p>
              <p className="text-sm text-gray-500">Totali</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attività Recenti</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm text-gray-600">Sistema pulito con successo</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm text-gray-600">Vecchio sistema campagne rimosso</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <p className="text-sm text-gray-600">Pronto per il nuovo sistema email</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Azioni Rapide</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">Nuovo Sistema Campagne</div>
              <div className="text-sm text-gray-500">Prossimamente disponibile</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">Gestione Avanzata</div>
              <div className="text-sm text-gray-500">Multi-sender e warm-up</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-gray-900">Report Dettagliati</div>
              <div className="text-sm text-gray-500">Analytics e tracking completo</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}