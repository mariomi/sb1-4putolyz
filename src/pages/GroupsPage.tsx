import { useState, useEffect } from 'react'
import { Plus, Users, Trash2, Edit2 } from 'lucide-react'
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
    </div>
  )
}