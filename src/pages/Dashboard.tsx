import { useEffect, useState } from 'react'
import { TrendingUp, Send, Users, Mail, BarChart3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
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
      
      console.log('📊 Statistiche caricate:', {
        campagne: campaignsRes.count,
        contatti: contactsRes.count,
        mittenti: sendersRes.count,
        emailInviate: queuesRes.count
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Campagne Totali',
      value: stats.totalCampaigns.toString(),
      icon: Send,
      color: 'bg-blue-500',
      change: 'Attive',
    },
    {
      title: 'Contatti',
      value: stats.totalContacts.toLocaleString(),
      icon: Users,
      color: 'bg-green-500',
      change: 'Totali',
    },
    {
      title: 'Mittenti',
      value: stats.totalSenders.toString(),
      icon: Mail,
      color: 'bg-purple-500',
      change: 'Configurati',
    },
    {
      title: 'Email Inviate',
      value: stats.emailsSentToday.toLocaleString(),
      icon: BarChart3,
      color: 'bg-orange-500',
      change: 'Totali',
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Dashboard</h1>
        <p className="text-gray-600 mt-2 font-medium">Panoramica delle tue attività DEM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 group-hover:text-gray-700 transition-colors">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2 group-hover:scale-105 transition-transform duration-300">{card.value}</p>
                <p className="text-sm text-green-600 font-semibold mt-2 flex items-center">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  {card.change}
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${card.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="h-7 w-7 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-3 animate-pulse"></span>
            Attività Recenti
          </h3>
          <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:shadow-md transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-gray-700">Sistema pulito con successo</p>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-gray-700">Vecchio sistema campagne rimosso</p>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-gray-700">Pronto per il nuovo sistema email</p>
              </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <span className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mr-3 animate-pulse"></span>
            Azioni Rapide
          </h3>
          <div className="space-y-3">
            <button className="w-full p-4 text-left bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md border border-blue-100">
              <div className="font-bold text-blue-900">Nuovo Sistema Campagne</div>
              <div className="text-sm text-blue-700 font-medium">Prossimamente disponibile</div>
            </button>
            <button className="w-full p-4 text-left bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md border border-green-100">
              <div className="font-bold text-green-900">Gestione Avanzata</div>
              <div className="text-sm text-green-700 font-medium">Multi-sender e warm-up</div>
            </button>
            <button className="w-full p-4 text-left bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md border border-purple-100">
              <div className="font-bold text-purple-900">Report Dettagliati</div>
              <div className="text-sm text-purple-700 font-medium">Analytics e tracking completo</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}