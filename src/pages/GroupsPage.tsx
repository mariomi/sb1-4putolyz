import { useState, useEffect } from 'react'
import { Plus, Users, Trash2, Edit2, UserPlus, X, Check, Mail, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { formatDate } from '../lib/utils'

interface Group {
  id: string
  name: string
  description: string
  created_at: string
}

interface GroupWithCount extends Group {
  contact_count: number
}

interface Contact {
  id: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  created_at: string
}

interface ContactWithAssignment extends Contact {
  is_assigned: boolean
}

export function GroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  
  // Contact management states
  const [showContactModal, setShowContactModal] = useState(false)
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [contacts, setContacts] = useState<ContactWithAssignment[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [newContactData, setNewContactData] = useState({
    email: '',
    first_name: '',
    last_name: ''
  })

  useEffect(() => {
    if (user) {
      fetchGroups()
    }
  }, [user])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      // Get groups with contact counts
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select(`
          *,
          contact_groups(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const groupsWithCounts = groupsData?.map(group => ({
        ...group,
        contact_count: group.contact_groups?.[0]?.count || 0
      })) || []

      setGroups(groupsWithCounts)
    } catch (error: any) {
      console.error('Error fetching groups:', error)
      toast.error('Errore nel caricamento dei gruppi')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('groups')
        .insert({
          profile_id: user!.id,
          name: formData.name,
          description: formData.description
        })

      if (error) throw error

      toast.success('Gruppo creato con successo!')
      setShowCreateModal(false)
      setFormData({ name: '', description: '' })
      fetchGroups()
    } catch (error: any) {
      console.error('Error creating group:', error)
      toast.error('Errore nella creazione del gruppo')
    }
  }

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup) return
    
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: formData.name,
          description: formData.description
        })
        .eq('id', editingGroup.id)

      if (error) throw error

      toast.success('Gruppo aggiornato con successo!')
      setEditingGroup(null)
      setFormData({ name: '', description: '' })
      fetchGroups()
    } catch (error: any) {
      console.error('Error updating group:', error)
      toast.error('Errore nell\'aggiornamento del gruppo')
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo gruppo? Tutti i contatti associati verranno rimossi dal gruppo.')) return

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

      if (error) throw error

      toast.success('Gruppo eliminato')
      fetchGroups()
    } catch (error: any) {
      console.error('Error deleting group:', error)
      toast.error('Errore nell\'eliminazione del gruppo')
    }
  }

  const startEditing = (group: Group) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      description: group.description
    })
  }

  // Contact management functions
  const fetchContactsForGroup = async (groupId: string) => {
    setContactsLoading(true)
    try {
      // Fetch all active contacts
      const { data: allContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_active', true)
        .order('first_name', { ascending: true })

      if (contactsError) throw contactsError

      // Fetch existing assignments for this group
      const { data: assignments, error: assignError } = await supabase
        .from('contact_groups')
        .select('contact_id')
        .eq('group_id', groupId)

      if (assignError) throw assignError

      const assignedContactIds = new Set(assignments?.map(a => a.contact_id) || [])

      // Mark contacts as assigned/unassigned
      const contactsWithAssignment: ContactWithAssignment[] = (allContacts || []).map(contact => ({
        ...contact,
        is_assigned: assignedContactIds.has(contact.id)
      }))

      setContacts(contactsWithAssignment)
    } catch (error: any) {
      console.error('Error fetching contacts:', error)
      toast.error('Errore nel caricamento dei contatti')
    } finally {
      setContactsLoading(false)
    }
  }

  const handleManageContacts = async (group: Group) => {
    setSelectedGroup(group)
    setShowContactModal(true)
    await fetchContactsForGroup(group.id)
  }

  const toggleContactAssignment = async (contactId: string, currentlyAssigned: boolean) => {
    if (!selectedGroup) return

    try {
      if (currentlyAssigned) {
        // Remove from group
        const { error } = await supabase
          .from('contact_groups')
          .delete()
          .eq('contact_id', contactId)
          .eq('group_id', selectedGroup.id)

        if (error) throw error
        toast.success('Contatto rimosso dal gruppo')
      } else {
        // Add to group
        const { error } = await supabase
          .from('contact_groups')
          .insert({
            contact_id: contactId,
            group_id: selectedGroup.id
          })

        if (error) throw error
        toast.success('Contatto aggiunto al gruppo')
      }

      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, is_assigned: !currentlyAssigned }
          : contact
      ))

      // Update group count in the main list
      setGroups(prev => prev.map(group => 
        group.id === selectedGroup.id
          ? { 
              ...group, 
              contact_count: currentlyAssigned 
                ? group.contact_count - 1 
                : group.contact_count + 1 
            }
          : group
      ))

    } catch (error: any) {
      console.error('Error toggling contact assignment:', error)
      toast.error('Errore nell\'assegnazione del contatto')
    }
  }

  const handleCreateNewContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedGroup) return

    try {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          email: newContactData.email,
          first_name: newContactData.first_name,
          last_name: newContactData.last_name,
          profile_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (contactError) throw contactError

      // Assign to current group
      const { error: assignError } = await supabase
        .from('contact_groups')
        .insert({
          contact_id: newContact.id,
          group_id: selectedGroup.id
        })

      if (assignError) throw assignError

      toast.success('Nuovo contatto creato e aggiunto al gruppo!')
      
      // Reset form
      setNewContactData({ email: '', first_name: '', last_name: '' })
      setShowNewContactModal(false)
      
      // Refresh contacts list
      await fetchContactsForGroup(selectedGroup.id)
      
      // Update group count
      setGroups(prev => prev.map(group => 
        group.id === selectedGroup.id
          ? { ...group, contact_count: group.contact_count + 1 }
          : group
      ))

    } catch (error: any) {
      console.error('Error creating contact:', error)
      toast.error('Errore nella creazione del contatto')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
            Gruppi Contatti
          </h1>
          <p className="text-gray-600 mt-2">Organizza i tuoi contatti in gruppi per targeting mirato</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Nuovo Gruppo</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEditing(group)}
                  className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleManageContacts(group)}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Gestisci Contatti"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h3>
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{group.description || 'Nessuna descrizione'}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{group.contact_count} contatti</span>
              </div>
              <div className="text-xs text-gray-400">
                {formatDate(group.created_at)}
              </div>
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun gruppo</h3>
            <p className="text-gray-600 mb-6">Crea il tuo primo gruppo per organizzare i contatti</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-gradient text-white px-6 py-3 rounded-xl font-semibold"
            >
              Crea Primo Gruppo
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Group Modal */}
      {(showCreateModal || editingGroup) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingGroup ? 'Modifica Gruppo' : 'Nuovo Gruppo'}
            </h2>
            
            <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Gruppo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. Newsletter Subscribers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione del gruppo (opzionale)"
                />
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingGroup(null)
                    setFormData({ name: '', description: '' })
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 btn-gradient text-white rounded-xl font-medium"
                >
                  {editingGroup ? 'Aggiorna Gruppo' : 'Crea Gruppo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Management Modal */}
      {showContactModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Gestisci Contatti</h2>
                <p className="text-gray-600">Gruppo: {selectedGroup.name}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowNewContactModal(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all duration-300 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nuovo Contatto</span>
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setSelectedGroup(null)
                    setContacts([])
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {contactsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Clicca sui contatti per aggiungerli o rimuoverli dal gruppo
                </div>
                
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => toggleContactAssignment(contact.id, contact.is_assigned)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        contact.is_assigned
                          ? 'border-green-200 bg-green-50 hover:bg-green-100'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            contact.is_assigned ? 'bg-green-500' : 'bg-gray-400'
                          }`}>
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center space-x-1">
                              <Mail className="h-3 w-3" />
                              <span>{contact.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          contact.is_assigned
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-300'
                        }`}>
                          {contact.is_assigned && <Check className="h-4 w-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {contacts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Nessun contatto disponibile</p>
                      <p className="text-sm">Crea il primo contatto per iniziare</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-60">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Nuovo Contatto</h3>
              <button
                onClick={() => {
                  setShowNewContactModal(false)
                  setNewContactData({ email: '', first_name: '', last_name: '' })
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={newContactData.email}
                  onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                  placeholder="esempio@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={newContactData.first_name}
                  onChange={(e) => setNewContactData({ ...newContactData, first_name: e.target.value })}
                  placeholder="Mario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cognome *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={newContactData.last_name}
                  onChange={(e) => setNewContactData({ ...newContactData, last_name: e.target.value })}
                  placeholder="Rossi"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewContactModal(false)
                    setNewContactData({ email: '', first_name: '', last_name: '' })
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-300"
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