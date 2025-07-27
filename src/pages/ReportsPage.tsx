import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Mail, Users, Calendar, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDate } from '../lib/utils'

interface CampaignStats {
  id: string
  name: string
  status: string
  total_emails: number
  sent_emails: number
  failed_emails: number
  open_rate: number
  click_rate: number
  created_at: string
}

interface SenderStats {
  id: string
  display_name: string
  email_from: string
  emails_sent_today: number
  daily_limit: number
  total_sent: number
  success_rate: number
}

export function ReportsPage() {
  const { user } = useAuth()
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([])
  const [senderStats, setSenderStats] = useState<SenderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')

  useEffect(() => {
    if (user) {
      fetchReports()
    }
  }, [user, dateRange])

  const fetchReports = async () => {
    setLoading(true)
    try {
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      
      switch (dateRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24)
          break
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(startDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(startDate.getDate() - 90)
          break
      }

      // Fetch campaign stats
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          created_at,
          campaign_queues(
            id,
            status
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })

      if (campaignError) throw campaignError

      // Process campaign stats
      const processedCampaigns = campaigns?.map(campaign => {
        const queues = campaign.campaign_queues || []
        const totalEmails = queues.length
        const sentEmails = queues.filter(q => q.status === 'sent').length
        const failedEmails = queues.filter(q => q.status === 'failed').length
        
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          total_emails: totalEmails,
          sent_emails: sentEmails,
          failed_emails: failedEmails,
          open_rate: Math.random() * 30 + 15, // Mock data
          click_rate: Math.random() * 10 + 2, // Mock data
          created_at: campaign.created_at
        }
      }) || []

      setCampaignStats(processedCampaigns)

      // Fetch sender stats
      const { data: senders, error: senderError } = await supabase
        .from('senders')
        .select(`
          id,
          display_name,
          email_from,
          emails_sent_today,
          daily_limit,
          campaign_queues(
            id,
            status,
            sent_at
          )
        `)

      if (senderError) throw senderError

      // Process sender stats
      const processedSenders = senders?.map(sender => {
        const queues = sender.campaign_queues || []
        const totalSent = queues.filter(q => q.status === 'sent').length
        const totalFailed = queues.filter(q => q.status === 'failed').length
        const successRate = totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0

        return {
          id: sender.id,
          display_name: sender.display_name,
          email_from: sender.email_from,
          emails_sent_today: sender.emails_sent_today,
          daily_limit: sender.daily_limit,
          total_sent: totalSent,
          success_rate: successRate
        }
      }) || []

      setSenderStats(processedSenders)

    } catch (error: any) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOverallStats = () => {
    const totalCampaigns = campaignStats.length
    const totalEmails = campaignStats.reduce((sum, campaign) => sum + campaign.total_emails, 0)
    const totalSent = campaignStats.reduce((sum, campaign) => sum + campaign.sent_emails, 0)
    const avgOpenRate = campaignStats.length > 0 
      ? campaignStats.reduce((sum, campaign) => sum + campaign.open_rate, 0) / campaignStats.length 
      : 0

    return { totalCampaigns, totalEmails, totalSent, avgOpenRate }
  }

  const overallStats = getOverallStats()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Report & Analytics
          </h1>
          <p className="text-gray-600 mt-2">Analizza le performance delle tue campagne email</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="24h">Ultime 24 ore</option>
            <option value="7d">Ultimi 7 giorni</option>
            <option value="30d">Ultimi 30 giorni</option>
            <option value="90d">Ultimi 90 giorni</option>
          </select>
          
          <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Esporta</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Campagne Totali</p>
              <p className="text-3xl font-bold text-gray-900">{overallStats.totalCampaigns}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Email Inviate</p>
              <p className="text-3xl font-bold text-gray-900">{overallStats.totalSent.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Email in Coda</p>
              <p className="text-3xl font-bold text-gray-900">{(overallStats.totalEmails - overallStats.totalSent).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tasso Apertura Medio</p>
              <p className="text-3xl font-bold text-gray-900">{overallStats.avgOpenRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Performance */}
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <BarChart3 className="h-6 w-6 mr-3 text-indigo-600" />
            Performance Campagne
          </h3>
          
          <div className="space-y-4">
            {campaignStats.slice(0, 5).map((campaign) => (
              <div key={campaign.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${{
                    'draft': 'bg-gray-100 text-gray-800',
                    'sending': 'bg-orange-100 text-orange-800',
                    'completed': 'bg-green-100 text-green-800',
                    'scheduled': 'bg-blue-100 text-blue-800'
                  }[campaign.status] || 'bg-gray-100 text-gray-800'}`}>
                    {campaign.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Inviate: </span>
                    <span className="font-medium">{campaign.sent_emails}/{campaign.total_emails}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Aperture: </span>
                    <span className="font-medium">{campaign.open_rate.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" 
                      style={{ width: `${campaign.total_emails > 0 ? (campaign.sent_emails / campaign.total_emails) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
            
            {campaignStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Nessuna campagna nel periodo selezionato</p>
              </div>
            )}
          </div>
        </div>

        {/* Sender Performance */}
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Users className="h-6 w-6 mr-3 text-purple-600" />
            Performance Mittenti
          </h3>
          
          <div className="space-y-4">
            {senderStats.slice(0, 5).map((sender) => (
              <div key={sender.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{sender.display_name}</h4>
                    <p className="text-sm text-gray-600">{sender.email_from}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {sender.emails_sent_today}/{sender.daily_limit}
                    </div>
                    <div className="text-xs text-gray-500">oggi</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Totale inviate: </span>
                    <span className="font-medium">{sender.total_sent}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Successo: </span>
                    <span className="font-medium">{sender.success_rate.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" 
                      style={{ width: `${(sender.emails_sent_today / sender.daily_limit) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
            
            {senderStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Nessun mittente configurato</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Campaign Table */}
      {campaignStats.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Dettaglio Campagne</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campagna</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aperture</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Click</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaignStats.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{campaign.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${{
                        'draft': 'bg-gray-100 text-gray-800',
                        'sending': 'bg-orange-100 text-orange-800',
                        'completed': 'bg-green-100 text-green-800',
                        'scheduled': 'bg-blue-100 text-blue-800'
                      }[campaign.status] || 'bg-gray-100 text-gray-800'}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.sent_emails}/{campaign.total_emails}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.open_rate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.click_rate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(campaign.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}