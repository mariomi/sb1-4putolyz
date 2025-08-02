import { useState, useEffect } from 'react'
import { Plus, Send, Eye, Calendar, Users, Mail, Trash2, Play, Edit2, X, CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate, formatDateTime } from '../lib/utils'

interface Campaign {
  id: string
  name: string
  subject: string
  html_content: string
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'paused' | 'sending'
  scheduled_at: string | null
  start_time_of_day: string
  warm_up_days: number
  emails_per_batch: number
  batch_interval_minutes: number
  created_at: string
  updated_at: string
  start_date: string | null
  end_date: string | null; // <-- Added end_date field
  profile_id: string
}

interface CampaignProgress {
  campaignId: string
  totalEmails: number
  emailsSent: number
  emailsPending: number
  emailsProcessing: number
  emailsFailed: number
  progressPercentage: number
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

interface GroupSelection {
  group_id: string;
  percentage_start: number;
  percentage_end: number;
}

// Progress Bar Component
interface ProgressBarProps {
  progress: CampaignProgress
}

function CampaignProgressBar({ progress }: ProgressBarProps) {
  const { progressPercentage } = progress
  
  return (
    <div className="mt-3 px-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-900">{progressPercentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="h-2 bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}

const initialFormData = {
  name: '',
  subject: '',
  html_content: '',
  start_time_of_day: '09:00',
  warm_up_enabled: false,
  warm_up_days: 7,
  emails_per_batch: 50,
  batch_interval_minutes: 15,
  selected_groups: [] as GroupSelection[], // <-- Updated to include percentage ranges
  selected_senders: [] as string[],
  start_date: '',
  end_date: '' // <-- Added end_date to initial form data
}

export function CampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [senders, setSenders] = useState<Sender[]>([])
  const [loading, setLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [campaignProgress, setCampaignProgress] = useState<Map<string, CampaignProgress>>(new Map())

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  // Update campaign progress for active campaigns
  useEffect(() => {
    fetchCampaignProgress()
    
    // Set up interval to update progress every 30 seconds for active campaigns
    const hasActiveCampaigns = campaigns.some(c => c.status === 'sending' || c.status === 'scheduled')
    if (hasActiveCampaigns) {
      const interval = setInterval(fetchCampaignProgress, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [campaigns])

  const fetchData = async () => {
    if (!campaigns.length) setLoading(true);
    try {
      const [campaignsRes, groupsRes, sendersRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('profile_id', user?.id).order('created_at', { ascending: false }),
        supabase.from('groups').select('*').eq('profile_id', user?.id).order('name'),
        supabase.from('senders').select('*').eq('profile_id', user?.id).eq('is_active', true).order('domain')
      ]);

      if (campaignsRes.error) {
        if (campaignsRes.error.code === '404') {
          console.warn('No campaigns found.');
          setCampaigns([]);
        } else {
          throw campaignsRes.error;
        }
      } else {
        setCampaigns(campaignsRes.data || []);
      }

      if (groupsRes.error) throw groupsRes.error;
      if (sendersRes.error) throw sendersRes.error;

      setGroups(groupsRes.data || []);
      setSenders(sendersRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }

  const fetchCampaignProgress = async () => {
    try {
      // Trova campagne attive che necessitano di progresso
      const activeCampaigns = campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled')
      
      if (activeCampaigns.length === 0) {
        setCampaignProgress(new Map())
        return
      }

      const progressData = new Map<string, CampaignProgress>()

      for (const campaign of activeCampaigns) {
        const { data: queueData, error } = await supabase
          .from('campaign_queues')
          .select('status')
          .eq('campaign_id', campaign.id)

        if (error) {
          console.error(`Error fetching progress for campaign ${campaign.id}:`, error)
          continue
        }

        const totalEmails = queueData?.length || 0
        const emailsSent = queueData?.filter(q => q.status === 'sent').length || 0
        const emailsPending = queueData?.filter(q => q.status === 'pending').length || 0
        const emailsProcessing = queueData?.filter(q => q.status === 'processing').length || 0
        const emailsFailed = queueData?.filter(q => q.status === 'failed').length || 0
        const progressPercentage = totalEmails > 0 ? Math.round((emailsSent / totalEmails) * 100) : 0

        progressData.set(campaign.id, {
          campaignId: campaign.id,
          totalEmails,
          emailsSent,
          emailsPending,
          emailsProcessing,
          emailsFailed,
          progressPercentage
        })
      }

      setCampaignProgress(progressData)
    } catch (error: any) {
      console.error('Error fetching campaign progress:', error)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingCampaign(null)
    setShowCreateModal(false)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsActionLoading('submit')

    if (!formData.name?.trim() || !formData.subject?.trim() || !formData.start_date || !formData.end_date) {
      toast.error('Tutti i campi principali (Nome, Oggetto, Date) sono obbligatori')
      setIsActionLoading(null)
      return
    }
    if (formData.selected_groups.length === 0) {
      toast.error('Seleziona almeno un gruppo di destinatari')
      setIsActionLoading(null)
      return
    }
    if (formData.selected_senders.length === 0) {
      toast.error('Seleziona almeno un mittente')
      setIsActionLoading(null)
      return
    }

    const invalidGroups = formData.selected_groups.some(
      (group) => group.percentage_start < 0 || group.percentage_end > 100 || group.percentage_start >= group.percentage_end
    );
    if (invalidGroups) {
      toast.error('Le percentuali dei gruppi devono essere valide e non sovrapposte')
      setIsActionLoading(null)
      return;
    }

    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (startDate < today) {
      toast.error('La data di inizio deve essere oggi o futura')
      setIsActionLoading(null)
      return
    }
    if (endDate < startDate) {
      toast.error('La data di fine non può precedere la data di inizio')
      setIsActionLoading(null)
      return
    }

    const campaignData = {
      name: formData.name.trim(),
      subject: formData.subject.trim(),
      html_content: formData.html_content,
      status: 'draft' as const,
      scheduled_at: null,
      start_time_of_day: formData.start_time_of_day,
      warm_up_days: formData.warm_up_enabled ? handleNumericInput(String(formData.warm_up_days), 1, 30, 7) : 0,
      emails_per_batch: handleNumericInput(String(formData.emails_per_batch), 10, 500, 50),
      batch_interval_minutes: handleNumericInput(String(formData.batch_interval_minutes), 1, 60, 15),
      start_date: formData.start_date,
      end_date: formData.end_date,
      profile_id: user?.id,
      selected_groups: formData.selected_groups, // <-- Save group selections with percentages
    }

    try {
      if (!user?.id) throw new Error('Utente non autenticato')

      if (editingCampaign) {
        const { data: updatedCampaign, error } = await supabase.from('campaigns').update(campaignData).eq('id', editingCampaign.id).eq('profile_id', user.id).select().single()
        if (error) throw error
        await updateCampaignRelations(updatedCampaign.id)
        toast.success('Campagna aggiornata con successo!')
      } else {
        const { data: newCampaign, error } = await supabase.from('campaigns').insert(campaignData).select().single()
        if (error) throw error
        await updateCampaignRelations(newCampaign.id)
        toast.success('Campagna creata con successo!')
      }
      resetForm()
      await fetchData()
    } catch (error: any) {
      console.error('Error saving campaign:', error)
      toast.error(error.message || 'Errore nel salvataggio della campagna')
    } finally {
      setIsActionLoading(null)
    }
  }

  const updateCampaignRelations = async (campaignId: string) => {
    await Promise.all([
      supabase.from('campaign_groups').delete().eq('campaign_id', campaignId),
      supabase.from('campaign_senders').delete().eq('campaign_id', campaignId)
    ])
    const groupRelations = formData.selected_groups.map(groupId => ({ campaign_id: campaignId, group_id: groupId }))
    const senderRelations = formData.selected_senders.map(senderId => ({ campaign_id: campaignId, sender_id: senderId }))
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
    setIsActionLoading(campaignId)
    try {
      if (!user?.id) throw new Error('Utente non autenticato')

      console.log('🔄 Programmazione campagna con generazione email in coda...')

      // 1. Prima recupera i dettagli della campagna per ottenere start_date e start_time_of_day
      const { data: campaignData, error: fetchError } = await supabase
        .from('campaigns')
        .select('start_date, start_time_of_day')
        .eq('id', campaignId)
        .eq('profile_id', user.id)
        .eq('status', 'draft')
        .single()

      if (fetchError) throw fetchError
      if (!campaignData) throw new Error('Campagna non trovata')

      // 2. Calcola la data/ora esatta di programmazione
      const startDate = new Date(campaignData.start_date)
      const [startHour, startMinute] = campaignData.start_time_of_day.split(':').map(Number)
      
      // Imposta l'orario ESATTO
      startDate.setHours(startHour, startMinute, 0, 0)
      
      // Verifica che la data sia nel futuro
      const now = new Date()
      if (startDate <= now) {
        throw new Error('La data e ora di programmazione devono essere nel futuro')
      }

      console.log(`📅 Programmazione per: ${startDate.toLocaleString()}`)

      // 3. Aggiorna lo status a 'scheduled' e imposta scheduled_at alla data esatta
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ 
          scheduled_at: startDate.toISOString(), 
          status: 'scheduled' 
        })
        .eq('id', campaignId)
        .eq('profile_id', user.id)
        .eq('status', 'draft')

      if (updateError) throw updateError

      // Le email verranno generate automaticamente al momento programmato

      toast.success(`Campagna programmata! Partirà il ${startDate.toLocaleDateString()} alle ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`)
      await fetchData()
    } catch (error: any) {
      console.error('Error scheduling campaign:', error)
      toast.error(error.message || 'Errore nella programmazione della campagna')
    } finally {
      setIsActionLoading(null)
    }
  }



  const handleStartCampaignNow = async (campaignId: string) => {
    setIsActionLoading(campaignId);
    try {
      if (!user?.id) throw new Error('Utente non autenticato');

      console.log('🚀 Avvio campagna IMMEDIATO con Edge Function...');

      // Verifica che l'URL di Supabase sia configurato correttamente
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL non è configurato correttamente.');
      }

      // Chiama l'Edge Function start-campaign per generare le email in coda IMMEDIATAMENTE
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Token di accesso non disponibile');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/start-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          campaignId,
          startImmediately: true, // Flag per indicare avvio immediato
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Errore Edge Function: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Risultato avvio immediato:', result);

      toast.success('Campagna avviata! Le email verranno inviate immediatamente.');
      await fetchData();
    } catch (error: any) {
      console.error('Error starting campaign now:', error);
      toast.error(error.message || 'Errore nell\'avvio della campagna');
    } finally {
      setIsActionLoading(null);
    }
  }

  const deleteAllCampaigns = async () => {
    if (!confirm('⚠️ ATTENZIONE! Questa azione eliminerà TUTTE le campagne e i loro dati. Sei sicuro di voler continuare?')) return
    
    try {
      toast.loading('Eliminando tutte le campagne...', { id: 'delete-all' })
      
      // Ottieni tutte le campagne
      const { data: allCampaigns, error: fetchError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('profile_id', user?.id)
      
      if (fetchError) throw fetchError
      
      if (!allCampaigns || allCampaigns.length === 0) {
        toast.success('Nessuna campagna da eliminare', { id: 'delete-all' })
        return
      }
      
      const campaignIds = allCampaigns.map(c => c.id)
      console.log(`🗑️ Eliminando ${campaignIds.length} campagne...`)
      
      // Elimina tutte le relazioni per tutti i campaign IDs
      await Promise.all([
        supabase.from('campaign_queues').delete().in('campaign_id', campaignIds),
        supabase.from('campaign_groups').delete().in('campaign_id', campaignIds),
        supabase.from('campaign_senders').delete().in('campaign_id', campaignIds),
        supabase.from('logs').delete().in('campaign_id', campaignIds)
      ])
      
      // Elimina tutte le campagne
      const { error: deleteError } = await supabase
        .from('campaigns')
        .delete()
        .in('id', campaignIds)
      
      if (deleteError) throw deleteError
      
      toast.success(`✅ Eliminate ${campaignIds.length} campagne con successo!`, { id: 'delete-all' })
      
      // Ricarica la pagina
      setCampaigns([])
      await fetchData()
      
    } catch (error: any) {
      console.error('Error deleting all campaigns:', error)
      toast.error('Errore nell\'eliminazione delle campagne: ' + error.message, { id: 'delete-all' })
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa campagna? L\'azione non può essere annullata.')) return
    setIsActionLoading(campaignId)
    try {
      await Promise.all([
        supabase.from('campaign_groups').delete().eq('campaign_id', campaignId),
        supabase.from('campaign_senders').delete().eq('campaign_id', campaignId)
      ])
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)
      if (error) throw error
      toast.success('Campagna eliminata con successo')
      setCampaigns(campaigns.filter(c => c.id !== campaignId))
    } catch (error: any) {
      console.error('Error deleting campaign:', error)
      toast.error("Errore nell'eliminazione della campagna")
    } finally {
      setIsActionLoading(null)
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
        warm_up_enabled: campaign.warm_up_days > 0,
        selected_groups: groupsRes.data.map(g => g.group_id),
        selected_senders: sendersRes.data.map(s => s.sender_id),
        start_date: campaign.start_date || '',
        end_date: campaign.end_date || '', // <-- Populate end_date
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
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'sending': return 'bg-orange-100 text-orange-800'
      case 'in_progress': return 'bg-orange-100 text-orange-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Bozza'
      case 'scheduled': return 'Programmata'
      case 'sending': return 'In Invio'
      case 'in_progress': return 'In Invio'
      case 'completed': return 'Completata'
      case 'cancelled': return 'Annullata'
      case 'paused': return 'In Pausa'
      default: return status
    }
  }

  const handleNumericInput = (value: string, min: number, max: number, defaultVal: number) => {
    if (value === '') return defaultVal
    const parsed = parseInt(value)
    if (isNaN(parsed)) return defaultVal
    return Math.max(min, Math.min(max, parsed))
  }

  const handleGroupSelection = (groupId: string, field: 'percentage_start' | 'percentage_end', value: number) => {
    setFormData((prev) => {
      const updatedGroups = prev.selected_groups.map((group) =>
        group.group_id === groupId ? { ...group, [field]: value } : group
      );
      return { ...prev, selected_groups: updatedGroups };
    });
  };

  const toggleGroupSelection = (groupId: string) => {
    setFormData((prev) => {
      const exists = prev.selected_groups.find((group) => group.group_id === groupId);
      if (exists) {
        return { ...prev, selected_groups: prev.selected_groups.filter((group) => group.group_id !== groupId) };
      }
      return {
        ...prev,
        selected_groups: [...prev.selected_groups, { group_id: groupId }], // Default to selecting the entire group
      };
    });
  };

  const calculateScheduleSummary = () => {
    if (!formData.start_date || !formData.end_date) return null;

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    const numDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (numDays <= 0) return null;

    // Calculate total emails based on group percentages
    const totalEmails = formData.selected_groups.reduce((sum, group) => {
      const groupContacts = groups.find((g) => g.id === group.group_id)?.contact_count || 0;
      const groupEmails = Math.floor((group.percentage_end - group.percentage_start) / 100 * groupContacts);
      return sum + groupEmails;
    }, 0);

    if (totalEmails === 0) return null; // No emails to send

    const emailPerDay = Math.floor(totalEmails / numDays);
    const emailRemainder = totalEmails % numDays;

    const dailySendCount = Math.ceil(emailPerDay / formData.emails_per_batch);
    const batchSize = dailySendCount > 0 ? Math.floor(emailPerDay / dailySendCount) : 0;
    const intervalBetweenSends = dailySendCount > 0 ? Math.floor((24 * 60) / dailySendCount) : 0; // in minutes

    const intervalHours = Math.floor(intervalBetweenSends / 60);
    const intervalMinutes = intervalBetweenSends % 60;

    return {
      numDays,
      emailPerDay,
      emailRemainder,
      batchSize,
      intervalHours,
      intervalMinutes,
      totalEmails,
    };
  };

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
        <div className="flex items-center space-x-4">
          {campaigns.length > 0 && (
            <button
              onClick={deleteAllCampaigns}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-300 flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Elimina Tutte</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
          >
            <Plus className="h-5 w-5" />
            <span>Nuova Campagna</span>
          </button>
        </div>
      </div>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 pt-4 border-t">
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Calendar className="h-4 w-4 text-green-500" />
                <span>Inizio: <strong>{formatDate(campaign.start_date)}</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Calendar className="h-4 w-4 text-red-500" />
                <span>Fine: <strong>{formatDate(campaign.end_date)}</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {campaign.warm_up_days > 0 ? (
                  <>🔥<span>Warm-up: {campaign.warm_up_days} giorni</span></>
                ) : (
                  <>⚡<span>Modalità diretta</span></>
                )}
              </div>
            </div>

            {/* Progress Bar for Active Campaigns */}
            {(campaign.status === 'sending' || campaign.status === 'scheduled') && campaignProgress.has(campaign.id) && (
              <CampaignProgressBar 
                progress={campaignProgress.get(campaign.id)!} 
              />
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">{campaign.scheduled_at && <span>Programmata per: {formatDateTime(campaign.scheduled_at)}</span>}</div>
              <div className="flex items-center space-x-2">
                {campaign.status === 'draft' && (
                  <>
                    <button onClick={() => handleStartCampaignNow(campaign.id)} disabled={!!isActionLoading} className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isActionLoading === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      <span>Avvia Ora</span>
                    </button>
                    <button onClick={() => handleScheduleCampaign(campaign.id)} disabled={!!isActionLoading} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isActionLoading === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                      <span>Programma</span>
                    </button>
                  </>
                )}
                {(campaign.status === 'sending' || campaign.status === 'in_progress') && (
                  <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span>Campagna in corso</span>
                  </div>
                )}
                {campaign.status === 'scheduled' && (
                  <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Programmata</span>
                  </div>
                )}
                <button onClick={() => showCampaignDetails(campaign)} disabled={!!isActionLoading} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"><Eye className="h-4 w-4" /><span>Dettagli</span></button>
                {campaign.status === 'draft' && <button onClick={() => startEditing(campaign)} disabled={!!isActionLoading} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"><Edit2 className="h-4 w-4" /><span>Modifica</span></button>}
                {campaign.status === 'draft' && <button onClick={() => handleDeleteCampaign(campaign.id)} disabled={!!isActionLoading} className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isActionLoading === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>Elimina</span>
                </button>}
              </div>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="text-center py-12"><Send className="h-16 w-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna campagna</h3><p className="text-gray-600 mb-6">Inizia creando la tua prima campagna email</p><button onClick={() => setShowCreateModal(true)} className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold">Crea Prima Campagna</button></div>
        )}
      </div>

      {(showCreateModal || editingCampaign) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingCampaign ? 'Modifica Campagna' : 'Crea Nuova Campagna'}</h2>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Campagna</label>
                  <input type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Oggetto Email</label>
                  <input type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto HTML</label>
                <textarea rows={8} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={formData.html_content} onChange={(e) => setFormData({ ...formData, html_content: e.target.value })} placeholder="<html><body><h1>Ciao {{first_name}}!</h1><p>Il tuo contenuto qui...</p></body></html>" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Orario Inizio</label><input type="time" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" value={formData.start_time_of_day} onChange={(e) => setFormData({ ...formData, start_time_of_day: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Email per Batch</label><input type="number" min="10" max="500" value={formData.emails_per_batch} onChange={(e) => setFormData({ ...formData, emails_per_batch: handleNumericInput(e.target.value, 10, 500, 50) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Intervallo (min)</label><input type="number" min="1" max="60" value={formData.batch_interval_minutes} onChange={(e) => setFormData({ ...formData, batch_interval_minutes: handleNumericInput(e.target.value, 1, 60, 15) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Gruppi Destinatari</label>
                  <div className="space-y-4 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {groups.map((group) => {
                      const selectedGroup = formData.selected_groups.find((g) => g.group_id === group.id);
                      return (
                        <div key={group.id} className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={!!selectedGroup}
                              onChange={() => toggleGroupSelection(group.id)}
                            />
                            <span className="ml-2 text-sm text-gray-900">{group.name}</span>
                          </label>
                          {selectedGroup && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Inizio (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selectedGroup.percentage_start}
                                  onChange={(e) =>
                                    handleGroupSelection(group.id, 'percentage_start', parseInt(e.target.value, 10))
                                  }
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fine (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selectedGroup.percentage_end}
                                  onChange={(e) =>
                                    handleGroupSelection(group.id, 'percentage_end', parseInt(e.target.value, 10))
                                  }
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Mittenti</label><div className="space-y-2 max-h-32 overflow-y-auto p-2 border rounded-lg">{senders.map((sender) => (<label key={sender.id} className="flex items-center"><input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={formData.selected_senders.includes(sender.id)} onChange={(e) => { if (e.target.checked) { setFormData({ ...formData, selected_senders: [...formData.selected_senders, sender.id] }) } else { setFormData({ ...formData, selected_senders: formData.selected_senders.filter(id => id !== sender.id) }) } } } /><span className="ml-2 text-sm text-gray-900">{sender.display_name} ({sender.email_from})</span></label>))}</div></div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Sistema Warm-Up</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.warm_up_enabled} 
                      onChange={(e) => setFormData({ ...formData, warm_up_enabled: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm text-gray-700">
                      {formData.warm_up_enabled ? 'Abilitato' : 'Disabilitato'}
                    </span>
                  </label>
                </div>
                
                {!formData.warm_up_enabled && (
                  <div className="p-3 bg-gray-50 rounded-lg mb-3">
                    <p className="text-sm text-gray-600">
                      ⚡ <strong>Modalità diretta:</strong> Le email verranno inviate immediatamente al limite massimo configurato per ogni mittente, senza periodo di riscaldamento graduale.
                    </p>
                  </div>
                )}

                {formData.warm_up_enabled && (
                  <>
                    <div className="mb-3">
                      <label htmlFor="warm_up_days" className="block text-sm font-medium text-gray-700 mb-2">Giorni di Warm-Up</label>
                      <input 
                        type="number" 
                        id="warm_up_days" 
                        name="warm_up_days" 
                        value={formData.warm_up_days} 
                        onChange={(e) => setFormData({ ...formData, warm_up_days: handleNumericInput(e.target.value, 1, 30, 7) })} 
                        min={1} 
                        max={30} 
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                      />
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">🔥 Sistema di Warm-Up Automatico</p>
                      <p className="text-sm text-blue-600 mt-1">
                        Il sistema aumenterà gradualmente il limite di invio dal 10% al 100% durante il periodo specificato. 
                        Questo aiuta a costruire la reputazione del dominio e migliorare la deliverability.
                      </p>
                      <p className="text-xs text-blue-500 mt-1">
                        Esempio: Con {formData.warm_up_days} giorni e limite 500/giorno → Giorno 1: 50 email, Giorno {formData.warm_up_days}: 500 email
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Configurazione Invio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data di Inizio</label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={formData.start_date || ''}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data di Fine</label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={formData.end_date || ''}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling Summary */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Riepilogo Pianificazione</h3>
                {(() => {
                  const summary = calculateScheduleSummary();
                  if (!summary) return <p className="text-gray-600">Inserisci date valide per calcolare il riepilogo.</p>;

                  return (
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>Numero totale di giorni:</strong> {summary.numDays}</li>
                      <li><strong>Email medie al giorno:</strong> {summary.emailPerDay} (con {summary.emailRemainder} email rimanenti)</li>
                      <li><strong>Dimensione dei batch:</strong> {summary.batchSize} email per invio</li>
                      <li><strong>Intervallo tra invii:</strong> {summary.intervalHours}h {summary.intervalMinutes}m</li>
                      <li><strong>Totale email da inviare:</strong> {summary.totalEmails}</li>
                    </ul>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button type="button" onClick={resetForm} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Annulla</button>
                <button type="submit" disabled={isActionLoading === 'submit'} className="px-6 py-3 btn-gradient text-white rounded-xl font-medium flex items-center justify-center space-x-2 disabled:opacity-50">
                  {isActionLoading === 'submit' && <Loader2 className="h-5 w-5 animate-spin" />}
                  <span>{editingCampaign ? 'Aggiorna Campagna' : 'Crea Campagna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold text-gray-900">Dettagli Campagna</h2><button onClick={() => { setShowDetailsModal(false); setSelectedCampaign(null) }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="h-6 w-6" /></button></div>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4"><div><h3 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h3><p className="text-gray-600 mt-1">{selectedCampaign.subject}</p></div><span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedCampaign.status)}`}>{getStatusLabel(selectedCampaign.status)}</span></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center"><div className="text-2xl font-bold text-indigo-600">{selectedCampaign.start_time_of_day}</div><div className="text-sm text-gray-600">Orario Inizio</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-purple-600">{selectedCampaign.emails_per_batch}</div><div className="text-sm text-gray-600">Email per Batch</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-orange-600">{selectedCampaign.batch_interval_minutes}min</div><div className="text-sm text-gray-600">Intervallo</div></div>
                </div>
                
                {/* Progress Bar in Modal for Active Campaigns */}
                {(selectedCampaign.status === 'sending' || selectedCampaign.status === 'scheduled') && campaignProgress.has(selectedCampaign.id) && (
                  <div className="mt-6 bg-white p-4 rounded-xl border border-gray-200">
                    <CampaignProgressBar 
                      progress={campaignProgress.get(selectedCampaign.id)!} 
                    />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Preview Email</h4>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200"><div className="text-sm font-medium text-blue-700 mb-1">Oggetto:</div><div className="text-lg font-semibold text-blue-900">{selectedCampaign.subject}</div></div>
                {selectedCampaign.html_content ? (<div className="space-y-3"><div className="flex items-center justify-between"><h5 className="text-md font-semibold text-gray-800">Contenuto Renderizzato:</h5><button onClick={() => { const newWindow = window.open('', '_blank'); if (newWindow) { newWindow.document.write(selectedCampaign.html_content.replace(/{{first_name}}/g, 'Mario').replace(/{{last_name}}/g, 'Rossi').replace(/{{email}}/g, 'mario.rossi@email.com')); newWindow.document.close() } }} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">Apri in nuova finestra</button></div><div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"><div className="bg-gray-100 px-4 py-2 border-b text-sm text-gray-600">Preview con dati di esempio (Mario Rossi)</div><div className="p-4 max-h-96 overflow-y-auto"><div dangerouslySetInnerHTML={{ __html: selectedCampaign.html_content.replace(/{{first_name}}/g, 'Mario').replace(/{{last_name}}/g, 'Rossi').replace(/{{email}}/g, 'mario.rossi@email.com') }} /></div></div><details className="bg-gray-50 p-4 rounded-xl border"><summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">Visualizza codice HTML</summary><div className="mt-3 max-h-48 overflow-y-auto"><pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{selectedCampaign.html_content}</pre></div></details></div>) : (<div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center"><div className="text-yellow-600 font-medium">⚠️ Nessun contenuto HTML</div><div className="text-sm text-yellow-600 mt-1">Aggiungi il contenuto HTML per vedere la preview</div></div>)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><h4 className="text-lg font-semibold text-gray-900 mb-3">Informazioni Temporali</h4><div className="space-y-2"><div className="flex justify-between"><span className="text-gray-600">Creata:</span><span className="font-medium">{formatDate(selectedCampaign.created_at)}</span></div><div className="flex justify-between"><span className="text-gray-600">Ultima modifica:</span><span className="font-medium">{formatDate(selectedCampaign.updated_at)}</span></div>{selectedCampaign.scheduled_at && (<div className="flex justify-between"><span className="text-gray-600">Programmata per:</span><span className="font-medium">{formatDateTime(selectedCampaign.scheduled_at)}</span></div>)}{selectedCampaign.start_date && (<div className="flex justify-between"><span className="text-gray-600">Data di Invio:</span><span className="font-medium">{formatDate(selectedCampaign.start_date)}</span></div>)}</div></div>
                <div><h4 className="text-lg font-semibold text-gray-900 mb-3">Configurazione Avanzata</h4><div className="space-y-2"><div className="flex justify-between"><span className="text-gray-600">Giorni warm-up:</span><span className="font-medium">{selectedCampaign.warm_up_days}</span></div><div className="flex justify-between"><span className="text-gray-600">Batch size:</span><span className="font-medium">{selectedCampaign.emails_per_batch} email</span></div><div className="flex justify-between"><span className="text-gray-600">Intervallo batch:</span><span className="font-medium">{selectedCampaign.batch_interval_minutes} minuti</span></div></div></div>
              </div>
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                {selectedCampaign.status === 'draft' && (<><button onClick={() => { setShowDetailsModal(false); handleStartCampaignNow(selectedCampaign.id) }} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center space-x-2 shadow-lg"><Play className="h-4 w-4" /><span>Avvia Ora</span></button><button onClick={() => { setShowDetailsModal(false); handleScheduleCampaign(selectedCampaign.id) }} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2 shadow-lg"><Calendar className="h-4 w-4" /><span>Programma</span></button><button onClick={() => { setShowDetailsModal(false); startEditing(selectedCampaign) }} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2"><Edit2 className="h-4 w-4" /><span>Modifica Campagna</span></button></>)}
                {(selectedCampaign.status === 'sending' || selectedCampaign.status === 'in_progress') && (<div className="px-6 py-3 bg-orange-100 text-orange-800 rounded-xl font-medium flex items-center space-x-2"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div><span>Campagna in corso di invio</span></div>)}
                {selectedCampaign.status === 'scheduled' && (<div className="px-6 py-3 bg-blue-100 text-blue-800 rounded-xl font-medium flex items-center space-x-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span>Programmata</span></div>)}
                {selectedCampaign.status === 'completed' && (<div className="px-6 py-3 bg-green-100 text-green-800 rounded-xl font-medium flex items-center space-x-2"><CheckCircle className="h-4 w-4" /><span>Campagna completata</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}