import { useState, useEffect } from 'react'
import { Plus, Search, Mail, Phone, Trash2, Upload, Users } from 'lucide-react'
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
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    selected_groups: [] as string[]
  })

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        supabase.from('contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('groups').select('*').order('name')
      ])

      if (contactsRes.error) throw contactsRes.error
      if (groupsRes.error) throw groupsRes.error

      setContacts(contactsRes.data || [])
      setGroups(groupsRes.data || [])
    } catch (error: any) {
      console.error('Error fetching contacts:', error)
      toast.error('Errore nel caricamento dei contatti')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          profile_id: user!.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone
        })
        .select()
        .single()

      if (error) throw error

      // Add to selected groups
      if (formData.selected_groups.length > 0) {
        const groupAssignments = formData.selected_groups.map(groupId => ({
          contact_id: contact.id,
          group_id: groupId
        }))

        const { error: groupError } = await supabase
          .from('contact_groups')
          .insert(groupAssignments)

        if (groupError) throw groupError
      }

      toast.success('Contatto creato con successo!')
      setShowCreateModal(false)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        selected_groups: []
      })
      fetchData()
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
      fetchData()
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      toast.error('Errore nell\'eliminazione del contatto')
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
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
          <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Importa CSV</span>
          </button>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Contatti</p>
              <p className="text-3xl font-bold text-gray-900">{contacts.length}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contatti Attivi</p>
              <p className="text-3xl font-bold text-gray-900">{contacts.filter(c => c.is_active).length}</p>
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
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
              {filteredContacts.map((contact) => (
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
        </div>

        {filteredContacts.length === 0 && (
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Gruppi</label>
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