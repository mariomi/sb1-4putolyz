import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface LeadRow {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

export function LeadsViewPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [user])

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, is_active')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setLeads((data as unknown as LeadRow[]) || [])
    } catch (error) {
      console.error('Errore nel caricamento dei lead:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="h-12 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Database Lead View</h1>
        <p className="text-gray-600 mt-2">Vista sola-lettura dei contatti disponibili</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Leads recenti</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{lead.first_name} {lead.last_name}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-gray-900">{lead.email}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${lead.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {lead.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Nessun lead disponibile
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

