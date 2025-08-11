import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Search, Mail, Phone, Trash2, Upload, Users, ChevronDown, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate } from '../lib/utils'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  is_active: boolean
  created_at: string
}

interface Group {
  id: string
  name: string
}

export function ContactsPage() {
  const { user } = useAuth()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Stati per paginazione intelligente
  const [contacts, setContacts] = useState<Contact[]>([])
  const [totalContactsCount, setTotalContactsCount] = useState(0)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const CONTACTS_PER_PAGE = 200
  
  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFormData(prev => ({ ...prev, showGroupDropdown: false }))
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    selected_group: '', // Ora è una singola stringa invece di un array
    showGroupDropdown: false,
    groupSearchTerm: ''
  })

  useEffect(() => {
    if (user) {
      initializeData()
    }
  }, [user])

  // Effetto per gestire la ricerca con debouncing
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch()
      } else {
        resetToNormalView()
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  const initializeData = async () => {
    setLoading(true)
    try {
      // Carica tutto in sequenza per evitare sovrapposizioni
      await fetchGroups()
      await loadContacts(0, true) // Carica primi contatti e conta totale
    } catch (error: any) {
      console.error('Error initializing data:', error)
      toast.error('Errore nel caricamento dei dati')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    if (!user?.id) {
      console.warn('User not available for fetching groups')
      return
    }
    
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('profile_id', user.id)
        .order('name')

      if (groupsError) throw groupsError
      setGroups(groups || [])
    } catch (error: any) {
      console.error('Error fetching groups:', error)
    }
  }

  const loadContacts = async (page: number, isInitial: boolean = false) => {
    if (!isInitial && loadingMore) return
    if (!user?.id) {
      console.warn('User not available for loading contacts')
      return
    }
    
    setLoadingMore(true)
    try {
      const from = page * CONTACTS_PER_PAGE
      const to = from + CONTACTS_PER_PAGE - 1

      // Se è caricamento iniziale, prendi anche il conteggio totale
      const query = supabase
        .from('contacts')
        .select('*', { count: isInitial ? 'exact' : undefined })
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data: contactsPage, error, count } = await query

      if (error) throw error

      // Aggiorna il conteggio totale solo al primo caricamento
      if (isInitial && count !== null) {
        setTotalContactsCount(count)
      }

      if (isInitial) {
        setContacts(contactsPage || [])
        setCurrentPage(0)
        // Mostra notifica solo se ci sono contatti e non stiamo resettando dalla ricerca
        if ((contactsPage?.length || 0) > 0 && !searchTerm.trim()) {
          toast.success(`Caricati ${count || contactsPage?.length || 0} contatti`)
        }
      } else {
        setContacts(prev => [...prev, ...(contactsPage || [])])
        setCurrentPage(page)
      }

      // Controlla se ci sono altri contatti da caricare
      setHasMore((contactsPage?.length || 0) === CONTACTS_PER_PAGE)

    } catch (error: any) {
      console.error('Error loading contacts:', error)
      if (isInitial) {
        toast.error('Errore nel caricamento dei contatti')
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    if (!user?.id) {
      console.warn('User not available for search')
      return
    }
    
    setIsSearching(true)
    setContacts([])
    setHasMore(false)
    
    try {
      const { data: searchResults, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('profile_id', user.id)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(500) // Limita risultati ricerca a 500

      if (error) throw error

      setContacts(searchResults || [])
      
      // Mostra notifica solo se non ci sono risultati
      if (!searchResults?.length) {
        toast.info('Nessun contatto trovato')
      }
    } catch (error: any) {
      console.error('Error searching contacts:', error)
      toast.error('Errore nella ricerca')
    } finally {
      setIsSearching(false)
    }
  }

  const resetToNormalView = async () => {
    if (isSearching) return
    if (!user?.id) {
      console.warn('User not available for reset view')
      return
    }
    
    setIsSearching(false)
    setHasMore(true)
    setContacts([])
    setCurrentPage(0)
    
    // Carica senza notifica per evitare spam
    setLoadingMore(true)
    try {
      const { data: contactsPage, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, CONTACTS_PER_PAGE - 1)

      if (error) throw error
      
      setContacts(contactsPage || [])
      setHasMore((contactsPage?.length || 0) === CONTACTS_PER_PAGE)
    } catch (error: any) {
      console.error('Error resetting view:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Scroll infinito
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || !hasMore || searchTerm.trim()) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    
    // Carica più contatti quando si è vicini al fondo (200px dal fondo)
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      loadContacts(currentPage + 1)
    }
  }, [loadingMore, hasMore, currentPage, searchTerm])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.id) {
      toast.error('Errore: utente non autenticato')
      return
    }
    
    try {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          profile_id: user.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone
        })
        .select()
        .single()

      if (error) throw error

      // Add to selected group
      if (formData.selected_group) {
        const { error: groupError } = await supabase
          .from('contact_groups')
          .insert({
            contact_id: contact.id,
            group_id: formData.selected_group
          })

        if (groupError) throw groupError
      }

      toast.success('Contatto creato con successo!')
      setShowCreateModal(false)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        selected_group: '',
        showGroupDropdown: false,
        groupSearchTerm: ''
      })
      
      // Ricarica i contatti
      if (!searchTerm.trim()) {
        await loadContacts(0, true) // Include conteggio totale
      }
    } catch (error: any) {
      console.error('Error creating contact:', error)
      toast.error('Errore nella creazione del contatto')
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo contatto?')) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error

      toast.success('Contatto eliminato')
      
      // Ricarica i contatti
      if (!searchTerm.trim()) {
        await loadContacts(0, true) // Include conteggio totale
      } else {
        // Se siamo in modalità ricerca, riesegui la ricerca
        await handleSearch()
      }
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      toast.error('Errore nell\'eliminazione del contatto')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!user?.id) {
      toast.error('Errore: utente non autenticato')
      return
    }

    // Verifica che sia un file CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Per favore seleziona un file CSV')
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const text = e.target?.result as string
        const rows = text.split('\n')
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase())

        // Verifica se il CSV ha il formato nome e cognome separati o uniti
        const hasFullName = headers.includes('nome cognome')
        const hasSeparateNames = headers.includes('first_name') && headers.includes('last_name')
        const hasEmail = headers.includes('email')
        
        if (!hasEmail || (!hasFullName && !hasSeparateNames)) {
          toast.error('Il CSV deve contenere email e nome/cognome (separati o uniti)')
          return
        }

        // Processa le righe del CSV
        const contacts = rows.slice(1).filter(row => row.trim()).map(row => {
          const values = row.split(',').map(v => v.trim())
          const contact: any = {}
          
          headers.forEach((header, index) => {
            const value = values[index]
            if (!value) return

            switch (header) {
              case 'nome cognome':
                // Separa nome e cognome
                const nameParts = value.split(' ')
                contact.first_name = nameParts[0]
                contact.last_name = nameParts.slice(1).join(' ')
                break
              case 'email':
                contact.email = value
                break
              case 'numero di telefono':
                contact.phone = value
                break
              case 'first_name':
                contact.first_name = value
                break
              case 'last_name':
                contact.last_name = value
                break
              case 'phone':
                contact.phone = value
                break
              default:
                // Gestisci altri campi se necessario
                break
            }
          })

          // Aggiungi i campi obbligatori
          contact.profile_id = user.id
          contact.is_active = true
          contact.source = 'csv_import'

          return contact
        })

        if (contacts.length === 0) {
          toast.error('Nessun contatto valido trovato nel CSV')
          return
        }

        // Mostra il toast di caricamento
        const loadingToast = toast.loading(`Importazione di ${contacts.length} contatti in corso...`)

        try {
          // Inserisci i contatti in batch
          const { error } = await supabase
            .from('contacts')
            .insert(contacts)

          if (error) throw error

          toast.success(`${contacts.length} contatti importati con successo!`)
          
          // Ricarica i contatti
          if (!searchTerm.trim()) {
            await loadContacts(0, true) // Include conteggio totale
          }
        } catch (error: any) {
          console.error('Error importing contacts:', error)
          toast.error('Errore durante l\'importazione dei contatti')
        } finally {
          toast.dismiss(loadingToast)
        }
      }

      reader.readAsText(file)
    } catch (error: any) {
      console.error('Error reading CSV:', error)
      toast.error('Errore nella lettura del file CSV')
    }

    // Reset il campo file
    event.target.value = ''
  }

  // I contatti sono già filtrati dalle query di ricerca o paginazione

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-800 font-medium">Caricamento di tutti i contatti...</span>
            </div>
            <p className="text-blue-600 text-sm mt-2">Questo potrebbe richiedere alcuni secondi per caricare tutti i contatti dal database.</p>
          </div>
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
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
            Contatti
          </h1>
          <p className="text-gray-600 mt-2">Gestisci il tuo database contatti</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center space-x-2 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>Importa CSV</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
          >
            <Plus className="h-5 w-5" />
            <span>Nuovo Contatto</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-gray-200/50">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca contatti..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {totalContactsCount > 0 && (
          <div className="mt-3 text-sm text-gray-600 flex items-center justify-between">
            <div>
              📧 {totalContactsCount.toLocaleString()} contatti totali
              {searchTerm && (
                <span className="ml-2">
                  • {contacts.length.toLocaleString()} risultati per "{searchTerm}"
                </span>
              )}
              {!searchTerm && contacts.length < totalContactsCount && (
                <span className="ml-2">
                  • Visualizzati {contacts.length.toLocaleString()} di {totalContactsCount.toLocaleString()}
                </span>
              )}
            </div>
            {isSearching && (
              <div className="flex items-center space-x-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ricerca in corso...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Contatti</p>
              <p className="text-3xl font-bold text-gray-900">{totalContactsCount.toLocaleString()}</p>
              {!searchTerm && contacts.length < totalContactsCount && (
                <p className="text-xs text-gray-500 mt-1">Caricati {contacts.length.toLocaleString()}</p>
              )}
            </div>
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {searchTerm ? 'Risultati Ricerca' : 'Contatti Attivi'}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {searchTerm ? contacts.length.toLocaleString() : contacts.filter(c => c.is_active).length.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gruppi</p>
              <p className="text-3xl font-bold text-gray-900">{groups.length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto max-h-[600px] overflow-y-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contatto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      {contact.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      {contact.phone || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      contact.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {contact.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(contact.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Indicatore caricamento scroll infinito */}
          {loadingMore && !searchTerm && (
            <div className="py-8 text-center">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Caricamento altri contatti...</span>
              </div>
            </div>
          )}
          
          {/* Fine scroll infinito */}
          {!hasMore && !searchTerm && contacts.length > 0 && contacts.length === totalContactsCount && (
            <div className="py-6 text-center text-sm text-gray-500">
              ✅ Tutti i {totalContactsCount.toLocaleString()} contatti sono stati caricati
            </div>
          )}
        </div>

        {contacts.length === 0 && !loading && !isSearching && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun contatto trovato</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Prova a modificare i termini di ricerca' : 'Inizia aggiungendo il tuo primo contatto'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold"
              >
                Aggiungi Primo Contatto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nuovo Contatto</h2>
            
            <form onSubmit={handleCreateContact} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cognome</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gruppo</label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-left pr-10"
                      placeholder="Cerca o seleziona gruppo"
                      value={formData.showGroupDropdown ? formData.groupSearchTerm : (groups.find(g => g.id === formData.selected_group)?.name || '')}
                      onChange={(e) => {
                        if (!formData.showGroupDropdown) {
                          setFormData(prev => ({ ...prev, showGroupDropdown: true }))
                        }
                        setFormData(prev => ({ ...prev, groupSearchTerm: e.target.value }))
                      }}
                      onFocus={() => setFormData(prev => ({ 
                        ...prev, 
                        showGroupDropdown: true,
                        groupSearchTerm: ''
                      }))}
                    />
                    <ChevronDown 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-transform ${formData.showGroupDropdown ? 'transform rotate-180' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, showGroupDropdown: !prev.showGroupDropdown }))}
                    />
                  </div>
                  
                  {formData.showGroupDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
                      <div className="p-2">
                        <div className="max-h-40 overflow-y-auto">
                          {groups
                            .filter(group => 
                              group.name.toLowerCase().includes(formData.groupSearchTerm.toLowerCase())
                            )
                            .map((group) => (
                              <div
                                key={group.id}
                                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                  formData.selected_group === group.id
                                    ? 'bg-indigo-50 text-indigo-900'
                                    : 'hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    selected_group: prev.selected_group === group.id ? '' : group.id,
                                    showGroupDropdown: false,
                                    groupSearchTerm: ''
                                  }))
                                }}
                              >
                                <div className="flex items-center">
                                  <div className={`w-4 h-4 border rounded-full mr-3 flex items-center justify-center ${
                                    formData.selected_group === group.id
                                      ? 'bg-indigo-600 border-indigo-600'
                                      : 'border-gray-300'
                                  }`}>
                                    {formData.selected_group === group.id && (
                                      <div className="w-2 h-2 rounded-full bg-white"></div>
                                    )}
                                  </div>
                                  <span className="text-sm">{group.name}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                  Crea Contatto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}