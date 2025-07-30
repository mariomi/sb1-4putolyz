import { useState, useEffect } from 'react'
import { Plus, Send, Eye, Calendar, Users, Mail, Trash2, Play, Pause, Edit2, X, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate } from '../lib/utils'

interface Campaign {
  id: string
  name: string
  subject: string
  html_content: string
  status: 'bozza' | 'in_progress' | 'completata' | 'programmata' | 'annullata' | 'in_pausa'
  scheduled_at: string | null
  send_duration_hours: number
  start_time_of_day: string
  warm_up_days: number
  emails_per_batch: number
  batch_interval_minutes: number
  created_at: string
  updated_at: string
  start_date: string | null
  profile_id: string
}

interface Group {
  id: string
  name: string
  description: string
}

interface Sender {
  id: string
  domain: string
  email_from: string
  display_name: string
  is_active: boolean
  daily_limit: number
}

const initialFormData = {
  name: '',
  subject: '',
  html_content: '',
  send_duration_hours: 1,
  start_time_of_day: '09:00',
  warm_up_days: 3,
  emails_per_batch: 50,
  batch_interval_minutes: 15,
  selected_groups: [] as string[],
  selected_senders: [] as string[],
  start_date: ''
}

export function CampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [senders, setSenders] = useState<Sender[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [campaignsRes, groupsRes, sendersRes] = await Promise.all([
        supabase.from('campaigns')
          .select('*')
          .eq('profile_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase.from('groups')
          .select('*')
          .eq('profile_id', user?.id)
          .order('name'),
        supabase.from('senders')
          .select('*')
          .eq('profile_id', user?.id)
          .eq('is_active', true)
          .order('domain')
      ])
      if (campaignsRes.error) throw campaignsRes.error
      if (groupsRes.error) throw groupsRes.error
      if (sendersRes.error) throw sendersRes.error
      setCampaigns(campaignsRes.data || [])
      setGroups(groupsRes.data || [])
      setSenders(sendersRes.data || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Errore nel caricamento dei dati')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingCampaign(null)
    setShowCreateModal(false)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validazione input
    if (!formData.name?.trim() || !formData.subject?.trim() || !formData.start_date) {
      toast.error('Nome, oggetto e data di inizio sono obbligatori')
      return
    }

    if (formData.selected_groups.length === 0) {
      toast.error('Seleziona almeno un gruppo di destinatari')
      return
    }

    if (formData.selected_senders.length === 0) {
      toast.error('Seleziona almeno un mittente')
      return
    }

    const startDate = new Date(formData.start_date)
    if (startDate < new Date()) {
      toast.error('La data di inizio deve essere futura')
      return
    }

    const campaignData = {
      name: formData.name.trim(),
      subject: formData.subject.trim(),
      html_content: formData.html_content,
      status: 'bozza' as const,
      scheduled_at: null,
      send_duration_hours: handleNumericInput(String(formData.send_duration_hours), 1, 72, 1),
      start_time_of_day: formData.start_time_of_day,
      warm_up_days: handleNumericInput(String(formData.warm_up_days), 1, 30, 3),
      emails_per_batch: handleNumericInput(String(formData.emails_per_batch), 10, 500, 50),
      batch_interval_minutes: handleNumericInput(String(formData.batch_interval_minutes), 1, 60, 15),
      start_date: formData.start_date,
      profile_id: user?.id
    }

    try {
      if (!user?.id) throw new Error('Utente non autenticato')

      if (editingCampaign) {
        const { data: updatedCampaign, error } = await supabase
          .from('campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id)
          .eq('profile_id', user.id) // Sicurezza aggiuntiva
          .select()
          .single()
        
        if (error) throw error
        if (!updatedCampaign) throw new Error('Campagna non trovata')
        
        await updateCampaignRelations(updatedCampaign.id)
        toast.success('Campagna aggiornata con successo!')
      } else {
        const { data: newCampaign, error } = await supabase
          .from('campaigns')
          .insert(campaignData)
          .select()
          .single()

        if (error) throw error
        if (!newCampaign) throw new Error('Errore nella creazione della campagna')

        await updateCampaignRelations(newCampaign.id)
        toast.success('Campagna creata con successo!')
      }

      resetForm()
      fetchData()
    } catch (error: any) {
      console.error('Error saving campaign:', error)
      toast.error(error.message || 'Errore nel salvataggio della campagna')
    }
  }

  const updateCampaignRelations = async (campaignId: string) => {
    await Promise.all([
      supabase.from('campaign_groups').delete().eq('campaign_id', campaignId),
      supabase.from('campaign_senders').delete().eq('campaign_id', campaignId)
    ])
    const groupRelations = formData.selected_groups.map(groupId => ({
      campaign_id: campaignId,
      group_id: groupId
    }))
    const senderRelations = formData.selected_senders.map(senderId => ({
      campaign_id: campaignId,
      sender_id: senderId
    }))
    if (groupRelations.length > 0) {
      const { error: groupError } = await supabase.from('campaign_groups').insert(groupRelations)
      if (groupError) throw groupError
    }
    if (senderRelations.length > 0) {
      const { error: senderError } = await supabase.from('campaign_senders').insert(senderRelations)
      if (senderError) throw senderError
    }
  }

  const handleScheduleCampaign = async (campaignId: string) => {
    try {
      if (!user?.id) throw new Error('Utente non autenticato')

      const scheduledAt = new Date()
      scheduledAt.setMinutes(scheduledAt.getMinutes() + 1)

      const { error } = await supabase
        .from('campaigns')
        .update({
          scheduled_at: scheduledAt.toISOString(),
          status: 'programmata'
        })
        .eq('id', campaignId)
        .eq('profile_id', user.id)
        .eq('status', 'bozza') // Solo le bozze possono essere programmate

      if (error) throw error
      toast.success('Campagna programmata! Sarà avviata dal backend.')
      fetchData()
    } catch (error: any) {
      console.error('Error scheduling campaign:', error)
      toast.error(error.message || 'Errore nella programmazione della campagna')
    }
  }

  const handleStartCampaignNow = async (campaignId: string) => {
    try {
      if (!user?.id) throw new Error('Utente non autenticato')

      // Verifica che la campagna appartenga all'utente
      const { data: campaign, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('profile_id', user.id)
        .single()

      if (fetchError || !campaign) throw new Error('Campagna non trovata')
      if (campaign.status !== 'bozza') throw new Error('Solo le bozze possono essere avviate')

      const { data, error } = await supabase.functions.invoke('start-campaign', {
        body: { campaignId }
      })
      
      if (error) throw error
      toast.success('Avvio della campagna in corso...')
      fetchData()
    } catch (error: any) {
      console.error('Error starting campaign:', error)
      toast.error(error.message || "Errore nell'avvio della campagna")
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa campagna? L\'azione non può essere annullata.')) return
    try {
      await Promise.all([
        supabase.from('campaign_groups').delete().eq('campaign_id', campaignId),
        supabase.from('campaign_senders').delete().eq('campaign_id', campaignId)
      ])
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
      if (error) throw error
      toast.success('Campagna eliminata con successo')
      fetchData()
    } catch (error: any) {
      console.error('Error deleting campaign:', error)
      toast.error("Errore nell'eliminazione della campagna")
    }
  }

  const startEditing = async (campaign: Campaign) => {
    setLoading(true)
    try {
      const [groupsRes, sendersRes] = await Promise.all([
        supabase.from('campaign_groups').select('group_id').eq('campaign_id', campaign.id),
        supabase.from('campaign_senders').select('sender_id').eq('campaign_id', campaign.id)
      ])
      if (groupsRes.error) throw groupsRes.error
      if (sendersRes.error) throw sendersRes.error
      setEditingCampaign(campaign)
      setFormData({
        ...campaign,
        selected_groups: groupsRes.data.map(g => g.group_id),
        selected_senders: sendersRes.data.map(s => s.sender_id),
        start_date: campaign.start_date || ''
      })
      setShowCreateModal(true)
    } catch (error) {
      console.error("Error fetching campaign relations:", error)
      toast.error("Impossibile caricare i dettagli della campagna per la modifica.")
    } finally {
      setLoading(false)
    }
  }

  const showCampaignDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setShowDetailsModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bozza': return 'bg-gray-100 text-gray-800'
      case 'programmata': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-orange-100 text-orange-800'
      case 'completata': return 'bg-green-100 text-green-800'
      case 'annullata': return 'bg-red-100 text-red-800'
      case 'in_pausa': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'bozza': return 'Bozza'
      case 'programmata': return 'Programmata'
      case 'in_progress': return 'In Invio'
      case 'completata': return 'Completata'
      case 'annullata': return 'Annullata'
      case 'in_pausa': return 'In Pausa'
      default: return status
    }
  }

  // Gestione input numerici migliorata
  const handleNumericInput = (value: string, min: number, max: number, defaultVal: number) => {
    if (value === '') return defaultVal
    const parsed = parseInt(value)
    if (isNaN(parsed)) return defaultVal
    return Math.max(min, Math.min(max, parsed))
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
            Campagne Email
          </h1>
          <p className="text-gray-600 mt-2">Gestisci le tue campagne di email marketing</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Nuova Campagna</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid gap-6">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Send className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{campaign.name}</h3>
                  <p className="text-gray-600">{campaign.subject}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(campaign.status)}`}>
                  {getStatusLabel(campaign.status)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Creata: {formatDate(campaign.created_at)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>Durata: {campaign.send_duration_hours}h</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                <span>Batch: {campaign.emails_per_batch} email</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {campaign.scheduled_at && (
                  <span>Programmata per: {formatDate(campaign.scheduled_at)}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {campaign.status === 'bozza' && (
                  <>
                    <button
                      onClick={() => handleStartCampaignNow(campaign.id)}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center space-x-2"
                    >
                      <Play className="h-4 w-4" />
                      <span>Avvia Ora</span>
                    </button>

                    <button
                      onClick={() => handleScheduleCampaign(campaign.id)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Programma</span>
                    </button>
                  </>
                )}
                
                {campaign.status === 'in_progress' && (
                  <button className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-300 flex items-center space-x-2">
                    <Pause className="h-4 w-4" />
                    <span>Pausa</span>
                  </button>
                )}

                <button
                  onClick={() => showCampaignDetails(campaign)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Dettagli</span>
                </button>

                {campaign.status === 'bozza' && (
                  <button
                    onClick={() => startEditing(campaign)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>Modifica</span>
                  </button>
                )}

                {/* Aggiunta di un bottone per eliminare le campagne */}
                {campaign.status === 'bozza' && (
                  <button
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-300 flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Elimina</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <Send className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna campagna</h3>
            <p className="text-gray-600 mb-6">Inizia creando la tua prima campagna email</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold"
            >
              Crea Prima Campagna
            </button>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {(showCreateModal || editingCampaign) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editingCampaign ? 'Modifica Campagna' : 'Crea Nuova Campagna'}
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Campagna</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Oggetto Email</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto HTML</label>
                <textarea
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.html_content}
                  onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                  placeholder="<html><body><h1>Ciao {{first_name}}!</h1><p>Il tuo contenuto qui...</p></body></html>"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durata Invio (ore)</label>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={formData.send_duration_hours}
                    onChange={(e) => setFormData({
                      ...formData,
                      send_duration_hours: handleNumericInput(e.target.value, 1, 72, 1)
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Orario Inizio</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.start_time_of_day}
                    onChange={(e) => setFormData({ ...formData, start_time_of_day: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email per Batch</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.emails_per_batch}
                    onChange={(e) => setFormData({
                      ...formData,
                      emails_per_batch: handleNumericInput(e.target.value, 10, 500, 50)
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Intervallo (min)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.batch_interval_minutes}
                    onChange={(e) => setFormData({
                      ...formData,
                      batch_interval_minutes: handleNumericInput(e.target.value, 1, 60, 15)
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gruppi Destinatari</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {groups.map((group) => (
                      <label key={group.id} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={formData.selected_groups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, selected_groups: [...formData.selected_groups, group.id] })
                            } else {
                              setFormData({ ...formData, selected_groups: formData.selected_groups.filter(id => id !== group.id) })
                            }
                          }}
                        />
                        <span className="ml-2 text-sm text-gray-900">{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mittenti</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {senders.map((sender) => (
                      <label key={sender.id} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={formData.selected_senders.includes(sender.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, selected_senders: [...formData.selected_senders, sender.id] })
                            } else {
                              setFormData({ ...formData, selected_senders: formData.selected_senders.filter(id => id !== sender.id) })
                            }
                          }}
                        />
                        <span className="ml-2 text-sm text-gray-900">{sender.display_name} ({sender.email_from})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warm-Up Days Field */}
              <div className="mb-4">
                <label htmlFor="warm_up_days" className="block text-sm font-medium text-gray-700">
                  Giorni di Warm-Up
                </label>
                <input
                  type="number"
                  id="warm_up_days"
                  name="warm_up_days"
                  value={formData.warm_up_days}
                  onChange={(e) => setFormData({
                    ...formData,
                    warm_up_days: handleNumericInput(e.target.value, 1, 30, 3)
                  })}
                  min={1}
                  max={30}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Seleziona il numero di giorni per inviare gradualmente le email.
                </p>
              </div>

              {/* Start Date Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data di Inizio</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 btn-gradient text-white rounded-xl font-medium"
                >
                  {editingCampaign ? 'Aggiorna Campagna' : 'Crea Campagna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {showDetailsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Dettagli Campagna</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedCampaign(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Campaign Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h3>
                    <p className="text-gray-600 mt-1">{selectedCampaign.subject}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedCampaign.status)}`}>
                    {getStatusLabel(selectedCampaign.status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{selectedCampaign.send_duration_hours}h</div>
                    <div className="text-sm text-gray-600">Durata Invio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{selectedCampaign.start_time_of_day}</div>
                    <div className="text-sm text-gray-600">Orario Inizio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedCampaign.emails_per_batch}</div>
                    <div className="text-sm text-gray-600">Email per Batch</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{selectedCampaign.batch_interval_minutes}min</div>
                    <div className="text-sm text-gray-600">Intervallo</div>
                  </div>
                </div>
              </div>

              {/* HTML Content Preview */}
              {/* Email Preview */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Preview Email</h4>
                
                {/* Subject Preview */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <div className="text-sm font-medium text-blue-700 mb-1">Oggetto:</div>
                  <div className="text-lg font-semibold text-blue-900">{selectedCampaign.subject}</div>
                </div>

                {/* HTML Content Rendered */}
                {selectedCampaign.html_content ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-md font-semibold text-gray-800">Contenuto Renderizzato:</h5>
                      <button
                        onClick={() => {
                          const newWindow = window.open('', '_blank')
                          if (newWindow) {
                            newWindow.document.write(selectedCampaign.html_content.replace(/{{first_name}}/g, 'Mario').replace(/{{last_name}}/g, 'Rossi').replace(/{{email}}/g, 'mario.rossi@email.com'))
                            newWindow.document.close()
                          }
                        }}
                        className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Apri in nuova finestra
                      </button>
                    </div>
                    
                    <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b text-sm text-gray-600">
                        Preview con dati di esempio (Mario Rossi)
                      </div>
                      <div className="p-4 max-h-96 overflow-y-auto">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: selectedCampaign.html_content
                              .replace(/{{first_name}}/g, 'Mario')
                              .replace(/{{last_name}}/g, 'Rossi')
                              .replace(/{{email}}/g, 'mario.rossi@email.com')
                          }} 
                        />
                      </div>
                    </div>
                    
                    <details className="bg-gray-50 p-4 rounded-xl border">
                      <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                        Visualizza codice HTML
                      </summary>
                      <div className="mt-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                          {selectedCampaign.html_content}
                        </pre>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center">
                    <div className="text-yellow-600 font-medium">⚠️ Nessun contenuto HTML</div>
                    <div className="text-sm text-yellow-600 mt-1">Aggiungi il contenuto HTML per vedere la preview</div>
                  </div>
                )}
              {/* Campaign Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Informazioni Temporali</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Creata:</span>
                      <span className="font-medium">{formatDate(selectedCampaign.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ultima modifica:</span>
                      <span className="font-medium">{formatDate(selectedCampaign.updated_at)}</span>
                    </div>
                    {selectedCampaign.scheduled_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Programmata per:</span>
                        <span className="font-medium">{formatDate(selectedCampaign.scheduled_at)}</span>
                      </div>
                    )}
                    {/* Aggiunta della visualizzazione della data di invio della campagna */}
                    {selectedCampaign.start_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Data di Invio:</span>
                        <span className="font-medium">{formatDate(selectedCampaign.start_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Configurazione Avanzata</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Giorni warm-up:</span>
                      <span className="font-medium">{selectedCampaign.warm_up_days}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Batch size:</span>
                      <span className="font-medium">{selectedCampaign.emails_per_batch} email</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Intervallo batch:</span>
                      <span className="font-medium">{selectedCampaign.batch_interval_minutes} minuti</span>
                    </div>
                  </div>
                </div>
              </div>
              </div>
              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                {selectedCampaign.status === 'bozza' && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false)
                        handleStartCampaignNow(selectedCampaign.id)
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center space-x-2 shadow-lg"
                    >
                      <Play className="h-4 w-4" />
                      <span>Avvia Ora</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDetailsModal(false)
                        handleScheduleCampaign(selectedCampaign.id)
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2 shadow-lg"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Programma</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowDetailsModal(false)
                        startEditing(selectedCampaign)
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Modifica Campagna</span>
                    </button>
                  </>
                )}
                
                {selectedCampaign.status === 'in_progress' && (
                  <div className="px-6 py-3 bg-orange-100 text-orange-800 rounded-xl font-medium flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span>Campagna in corso di invio</span>
                  </div>
                )}
                
                {selectedCampaign.status === 'completed' && (
                  <div className="px-6 py-3 bg-green-100 text-green-800 rounded-xl font-medium flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Campagna completata</span>
                  </div>
                )}
                
                {selectedCampaign.status === 'bozza' && (
                  <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                    <span>Questa campagna è ancora in bozza.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// NOTA: Per automatizzare l'invio delle campagne programmate, aggiungi questa configurazione a pg_cron nel tuo database Supabase:
//
// -- Menjadwalkan fungsi per inviare campagne programmate ogni minuto
// SELECT cron.schedule(
//   'send-scheduled-campaigns-job',
//   '* * * * *', -- Ogni minuto
//   $$
//   SELECT net.http_post(
//       url:='https://<ID_PROYEK_ANDA>.supabase.co/functions/v1/send-scheduled-campaigns',
//       headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY_ANDA>"}'::jsonb
//   )
//   $$
// );
//
// Sostituisci <ID_PROYEK_ANDA> e <SERVICE_ROLE_KEY_ANDA> con i tuoi dati reali.
// Questo farà sì che la funzione Edge venga chiamata ogni minuto e gestisca l'invio delle campagne programmate.