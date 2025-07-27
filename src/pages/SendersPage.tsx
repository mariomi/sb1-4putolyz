import { useState, useEffect } from 'react'
import { Plus, Mail, Brain as Domain, CheckCircle, XCircle, AlertCircle, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate } from '../lib/utils'

interface Sender {
  id: string
  domain: string
  email_from: string
  display_name: string
  resend_domain_id: string | null
  resend_status: string
  daily_limit: number
  emails_sent_today: number
  current_day: number
  last_sent_at: string | null
  warm_up_stage: number
  is_active: boolean
  created_at: string
}

interface ResendDomain {
  id: string
  name: string
  status: string
  region: string
}

export function SendersPage() {
  const { user } = useAuth()
  const [senders, setSenders] = useState<Sender[]>([])
  const [resendDomains, setResendDomains] = useState<ResendDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSender, setEditingSender] = useState<Sender | null>(null)
  const [formData, setFormData] = useState({
    domain: '',
    email_from: '',
    display_name: '',
    daily_limit: 150
  })

  useEffect(() => {
    if (user) {
      fetchSenders()
    }
  }, [user])

  useEffect(() => {
    if (showCreateModal || editingSender) {
      fetchResendDomains()
    }
  }, [showCreateModal, editingSender])

  const fetchSenders = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('senders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSenders(data || [])
    } catch (error: any) {
      console.error('Error fetching senders:', error)
      toast.error('Errore nel caricamento dei mittenti')
    } finally {
      setLoading(false)
    }
  }

  const fetchResendDomains = async () => {
    setLoadingDomains(true)
    try {
      console.log('🔄 Fetching Resend domains...')
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-resend-domains`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch domains')
      }

      setResendDomains(result.data.resend_domains || [])
    } catch (error: any) {
      console.error('Error fetching Resend domains:', error)
      toast.error('Errore nel caricamento dei domini Resend')
    } finally {
      setLoadingDomains(false)
    }
  }

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('senders')
        .insert({
          profile_id: user!.id,
          domain: formData.domain,
          email_from: formData.email_from,
          display_name: formData.display_name,
          daily_limit: formData.daily_limit
        })

      if (error) throw error

      toast.success('Mittente creato con successo!')
      setShowCreateModal(false)
      setFormData({
        domain: '',
        email_from: '',
        display_name: '',
        daily_limit: 150
      })
      fetchSenders()
    } catch (error: any) {
      console.error('Error creating sender:', error)
      toast.error('Errore nella creazione del mittente')
    }
  }

  const handleUpdateSender = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSender) return
    
    try {
      const { error } = await supabase
        .from('senders')
        .update({
          domain: formData.domain,
          email_from: formData.email_from,
          display_name: formData.display_name,
          daily_limit: formData.daily_limit
        })
        .eq('id', editingSender.id)

      if (error) throw error

      toast.success('Mittente aggiornato con successo!')
      setEditingSender(null)
      setFormData({
        domain: '',
        email_from: '',
        display_name: '',
        daily_limit: 150
      })
      fetchSenders()
    } catch (error: any) {
      console.error('Error updating sender:', error)
      toast.error('Errore nell\'aggiornamento del mittente')
    }
  }

  const handleDeleteSender = async (senderId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo mittente?')) return

    try {
      const { error } = await supabase
        .from('senders')
        .delete()
        .eq('id', senderId)

      if (error) throw error

      toast.success('Mittente eliminato')
      fetchSenders()
    } catch (error: any) {
      console.error('Error deleting sender:', error)
      toast.error('Errore nell\'eliminazione del mittente')
    }
  }

  const toggleSenderStatus = async (senderId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('senders')
        .update({ is_active: !currentStatus })
        .eq('id', senderId)

      if (error) throw error

      toast.success(`Mittente ${!currentStatus ? 'attivato' : 'disattivato'}`)
      fetchSenders()
    } catch (error: any) {
      console.error('Error toggling sender status:', error)
      toast.error('Errore nell\'aggiornamento dello stato')
    }
  }

  const startEditing = (sender: Sender) => {
    setEditingSender(sender)
    setFormData({
      domain: sender.domain,
      email_from: sender.email_from,
      display_name: sender.display_name,
      daily_limit: sender.daily_limit
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'Verificato'
      case 'failed': return 'Fallito'
      default: return 'In Attesa'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
            Mittenti Email
          </h1>
          <p className="text-gray-600 mt-2">Gestisci i domini e mittenti per le tue campagne</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Nuovo Mittente</span>
        </button>
      </div>

      {/* Senders Grid */}
      <div className="grid gap-6">
        {senders.map((sender) => (
          <div key={sender.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Mail className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{sender.display_name}</h3>
                  <p className="text-gray-600">{sender.email_from}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Domain className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">{sender.domain}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(sender.resend_status)}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(sender.resend_status)}`}>
                    {getStatusLabel(sender.resend_status)}
                  </span>
                </div>
                
                <button
                  onClick={() => toggleSenderStatus(sender.id, sender.is_active)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    sender.is_active 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {sender.is_active ? 'Attivo' : 'Inattivo'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl">
                <div className="text-sm font-medium text-blue-700">Limite Giornaliero</div>
                <div className="text-2xl font-bold text-blue-900">{sender.daily_limit}</div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl">
                <div className="text-sm font-medium text-green-700">Inviate Oggi</div>
                <div className="text-2xl font-bold text-green-900">{sender.emails_sent_today}</div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl">
                <div className="text-sm font-medium text-purple-700">Warm-up Stage</div>
                <div className="text-2xl font-bold text-purple-900">{sender.warm_up_stage}</div>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl">
                <div className="text-sm font-medium text-orange-700">Giorno Corrente</div>
                <div className="text-2xl font-bold text-orange-900">{sender.current_day}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {sender.last_sent_at ? (
                  <span>Ultimo invio: {formatDate(sender.last_sent_at)}</span>
                ) : (
                  <span>Nessun invio</span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEditing(sender)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Modifica</span>
                </button>
                
                <button
                  onClick={() => handleDeleteSender(sender.id)}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Elimina</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {senders.length === 0 && (
          <div className="text-center py-12">
            <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun mittente</h3>
            <p className="text-gray-600 mb-6">Configura il tuo primo mittente per inviare campagne</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold"
            >
              Configura Primo Mittente
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Sender Modal */}
      {(showCreateModal || editingSender) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingSender ? 'Modifica Mittente' : 'Nuovo Mittente'}
            </h2>
            
            <form onSubmit={editingSender ? handleUpdateSender : handleCreateSender} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dominio</label>
                  {loadingDomains ? (
                    <div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500">
                      Caricamento domini...
                    </div>
                  ) : resendDomains.length > 0 ? (
                    <select
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    >
                      <option value="">Seleziona un dominio</option>
                      {resendDomains
                        .filter(domain => domain.status === 'verified')
                        .map((domain) => (
                          <option key={domain.id} value={domain.name}>
                            {domain.name} ({domain.status})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="esempio.com"
                    />
                  )}
                  {resendDomains.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Seleziona uno dei domini verificati su Resend
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Mittente</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.email_from}
                    onChange={(e) => setFormData({ ...formData, email_from: e.target.value })}
                    placeholder="noreply@esempio.com"
                  />
                  {formData.domain && (
                    <p className="text-sm text-gray-500 mt-1">
                      Suggerimento: noreply@{formData.domain}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Visualizzato</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="La Mia Azienda"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Limite Giornaliero</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.daily_limit}
                  onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Numero massimo di email che questo mittente può inviare al giorno
                </p>
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingSender(null)
                    setFormData({
                      domain: '',
                      email_from: '',
                      display_name: '',
                      daily_limit: 150
                    })
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 btn-gradient text-white rounded-xl font-medium"
                >
                  {editingSender ? 'Aggiorna Mittente' : 'Crea Mittente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}