import { useState, useEffect } from 'react'
import { Plus, Globe, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate } from '../lib/utils'

interface Domain {
  id: string
  domain_name: string
  verification_status: string
  resend_domain_id: string | null
  dns_records: any
  created_at: string
  updated_at: string
}

interface ResendDomain {
  id: string
  name: string
  status: string
  region: string
  created_at: string
  records: Array<{
    record: string
    name: string
    value: string
    type: string
    priority?: number
  }>
}

interface SyncResult {
  resend_domains: ResendDomain[]
  local_domains: Domain[]
  sync_actions: Array<{
    action: string
    domain: string
    status: string
    message: string
  }>
}

export function DomainsPage() {
  const { user } = useAuth()
  const [domains, setDomains] = useState<Domain[]>([])
  const [resendDomains, setResendDomains] = useState<ResendDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [formData, setFormData] = useState({
    domain_name: ''
  })

  useEffect(() => {
    if (user) {
      fetchDomains()
    }
  }, [user])

  const fetchDomains = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDomains(data || [])
    } catch (error: any) {
      console.error('Error fetching domains:', error)
      toast.error('Errore nel caricamento dei domini')
    } finally {
      setLoading(false)
    }
  }

  const syncWithResend = async () => {
    setSyncing(true)
    try {
      console.log('🔄 Syncing domains with Resend...')
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-resend-domains`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }

      const syncData: SyncResult = result.data
      setResendDomains(syncData.resend_domains)
      
      // Show sync results
      const updatedCount = syncData.sync_actions.filter(a => a.action === 'updated').length
      const newCount = syncData.sync_actions.filter(a => a.action === 'found_new').length
      
      toast.success(`Sync completato: ${updatedCount} domini aggiornati, ${newCount} nuovi domini trovati`)
      
      // Refresh local domains
      await fetchDomains()
    } catch (error: any) {
      console.error('Error syncing domains:', error)
      toast.error('Errore nella sincronizzazione con Resend')
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('domains')
        .insert({
          profile_id: user!.id,
          domain_name: formData.domain_name,
          verification_status: 'pending'
        })

      if (error) throw error

      toast.success('Dominio aggiunto con successo!')
      setShowCreateModal(false)
      setFormData({ domain_name: '' })
      fetchDomains()
    } catch (error: any) {
      console.error('Error creating domain:', error)
      toast.error('Errore nell\'aggiunta del dominio')
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiato negli appunti!')
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
            Domini Email
          </h1>
          <p className="text-gray-600 mt-2">Gestisci i domini per l'invio email e sincronizza con Resend</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={syncWithResend}
            disabled={syncing}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizzando...' : 'Sync Resend'}</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
          >
            <Plus className="h-5 w-5" />
            <span>Nuovo Dominio</span>
          </button>
        </div>
      </div>

      {/* Resend Domains Section */}
      {resendDomains.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <ExternalLink className="h-6 w-6 mr-3 text-blue-600" />
            Domini su Resend
          </h3>
          <div className="grid gap-4">
            {resendDomains.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center space-x-3">
                  <Globe className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-semibold text-gray-900">{domain.name}</div>
                    <div className="text-sm text-gray-600">ID: {domain.id}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(domain.status)}`}>
                    {getStatusLabel(domain.status)}
                  </span>
                  <span className="text-sm text-gray-500">{domain.region}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Domains Grid */}
      <div className="grid gap-6">
        {domains.map((domain) => (
          <div key={domain.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{domain.domain_name}</h3>
                  <p className="text-gray-600">
                    {domain.resend_domain_id ? `Resend ID: ${domain.resend_domain_id}` : 'Non sincronizzato'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(domain.verification_status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(domain.verification_status)}`}>
                  {getStatusLabel(domain.verification_status)}
                </span>
              </div>
            </div>

            {/* DNS Records */}
            {domain.dns_records && Object.keys(domain.dns_records).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Record DNS:</h4>
                <div className="space-y-2">
                  {Array.isArray(domain.dns_records) ? domain.dns_records.map((record: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="grid grid-cols-4 gap-4 flex-1 text-sm">
                          <div><span className="font-medium">Tipo:</span> {record.type}</div>
                          <div><span className="font-medium">Nome:</span> {record.name}</div>
                          <div className="col-span-2"><span className="font-medium">Valore:</span> {record.value}</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(record.value)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500">Record DNS non disponibili</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Creato: {formatDate(domain.created_at)}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedDomain(domain)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Dettagli</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {domains.length === 0 && (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun dominio</h3>
            <p className="text-gray-600 mb-6">Aggiungi il tuo primo dominio per iniziare</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold"
            >
              Aggiungi Primo Dominio
            </button>
          </div>
        )}
      </div>

      {/* Create Domain Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nuovo Dominio</h2>
            
            <form onSubmit={handleCreateDomain} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Dominio</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.domain_name}
                  onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                  placeholder="esempio.com"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Inserisci solo il nome del dominio (senza www o protocollo)
                </p>
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 btn-gradient text-white rounded-xl font-medium"
                >
                  Aggiungi Dominio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}