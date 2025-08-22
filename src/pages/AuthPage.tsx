import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { supabase, testSupabaseConnection } from '../lib/supabase'
import Logo from '/Logo.svg'

export function AuthPage() {
  const { user, signInWithOperator } = useAuth()
  const [loading, setLoading] = useState(false)
  const [connectionTested, setConnectionTested] = useState(false)
  const [formData, setFormData] = useState({
    ruolo: '',
    idOperatore: '',
    chiaveAccesso: '',
  })
  const [availableRoles, setAvailableRoles] = useState<string[]>([])

  useEffect(() => {
    // Test Supabase connection on component mount
    const testConnection = async () => {
      console.log('Testing Supabase connection...')
      const isConnected = await testSupabaseConnection()
      setConnectionTested(true)
      if (!isConnected) {
        console.error('Supabase connection failed')
        toast.error('Errore di connessione al database')
      }
    }
    testConnection()
  }, [])

  useEffect(() => {
    const fetchRoles = async () => {
      if (!formData.idOperatore) {
        setAvailableRoles([])
        return
      }
      
      try {
        console.log('Fetching roles for operator:', formData.idOperatore)
        const { data, error } = await supabase.rpc('get_roles_by_operator', { _operator_id: formData.idOperatore })
        
        if (error) {
          console.error('Error fetching roles:', error)
          setAvailableRoles([])
          return
        }
        
        console.log('Roles fetched successfully:', data)
        const roles = (data || []).map((r: any) => r.role).filter(Boolean)
        setAvailableRoles(roles)
        if (roles.length && !formData.ruolo) {
          setFormData((prev) => ({ ...prev, ruolo: roles[0] }))
        }
      } catch (err) {
        console.error('Exception fetching roles:', err)
        setAvailableRoles([])
      }
    }
    fetchRoles()
  }, [formData.idOperatore])

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('Attempting login with:', { 
        ruolo: formData.ruolo, 
        idOperatore: formData.idOperatore,
        chiaveAccesso: formData.chiaveAccesso ? '***' : 'empty'
      })
      
      const { error } = await signInWithOperator(
        (formData.ruolo || null) as any,
        formData.idOperatore,
        formData.chiaveAccesso,
      )
      
      if (error) {
        console.error('Login error:', error)
        throw error
      }
      
      console.log('Login successful')
      toast.success('Accesso effettuato con successo!')
    } catch (error: any) {
      console.error('Login exception:', error)
      toast.error(error.message || 'Si è verificato un errore durante il login')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-md w-full max-w-5xl p-10 md:p-14">
        <div className="flex items-start gap-16">
          {/* Logo grande a sinistra */}
          <div className="flex-shrink-0 pt-2">
            <img src={Logo} alt="Logo" className="h-32 md:h-40 w-auto" />
          </div>

          {/* Form grande a destra */}
          <div className="flex-1">
            {/* Connection status indicator */}
            {connectionTested && (
              <div className="mb-4 p-3 rounded-lg bg-gray-100 text-sm">
                <span className="font-medium">Stato connessione:</span>
                <span className="ml-2 text-green-600">✓ Connesso</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
              <select
                value={formData.ruolo}
                onChange={(e) => setFormData({ ...formData, ruolo: e.target.value })}
                className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent appearance-none"
              >
                <option value="" disabled>
                  {availableRoles.length ? 'Seleziona ruolo' : 'Inserisci ID Operatore per caricare i ruoli'}
                </option>
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="ID Operatore"
                className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent"
                value={formData.idOperatore}
                onChange={(e) => setFormData({ ...formData, idOperatore: e.target.value })}
              />

              <input
                type="password"
                placeholder="Chiave d'accesso"
                className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent"
                value={formData.chiaveAccesso}
                onChange={(e) => setFormData({ ...formData, chiaveAccesso: e.target.value })}
              />

              <button
                type="submit"
                disabled={loading || !connectionTested}
                className="w-full bg-[#0b2e63] text-white py-4 px-6 rounded-full text-lg font-medium hover:bg-[#08234a] focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Caricamento...' : 'Accedi'}
              </button>

              <div className="text-right">
                <button
                  type="button"
                  className="text-[#0b2e63] hover:opacity-80 text-sm underline transition-colors duration-200"
                >
                  Recupera password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}