import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Logo from '/Logo.svg'

export function AuthPage() {
  const { user, signInWithOperator } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    ruolo: '',
    idOperatore: '',
    chiaveAccesso: '',
  })
  const [availableRoles, setAvailableRoles] = useState<string[]>([])

  // Funzione per capitalizzare la prima lettera
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden">
        <div className="flex min-h-[600px]">
          {/* Sezione Logo - 40% dello spazio */}
          <div className="w-2/5 bg-gradient-to-br from-[#0b2e63] to-[#1e40af] flex items-center justify-center p-12 relative overflow-hidden">
            {/* Elementi decorativi di sfondo */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full"></div>
              <div className="absolute bottom-20 right-16 w-24 h-24 bg-white rounded-full"></div>
              <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white rounded-full"></div>
            </div>
            
            {/* Logo centrato */}
            <div className="relative z-10 text-center">
              <img src={Logo} alt="Logo" className="h-48 md:h-56 lg:h-64 w-auto mx-auto mb-8 drop-shadow-lg filter brightness-0" />
              <h1 className="text-white text-3xl md:text-4xl font-bold mb-4">Sendura</h1>
              <p className="text-blue-100 text-lg">Gestione Campagne Email Professionale</p>
            </div>
          </div>

          {/* Sezione Form - 60% dello spazio */}
          <div className="w-3/5 flex items-center justify-center p-12">
            <div className="w-full max-w-lg">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Benvenuto</h2>
                <p className="text-gray-600">Accedi al tuo pannello di controllo</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                  <select
                    value={formData.ruolo}
                    onChange={(e) => setFormData({ ...formData, ruolo: e.target.value })}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent appearance-none transition-all duration-200"
                  >
                    <option value="" disabled>
                      {availableRoles.length ? 'Seleziona il tuo ruolo' : 'Inserisci ID Operatore per caricare i ruoli'}
                    </option>
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>{capitalizeFirstLetter(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID Operatore</label>
                  <input
                    type="text"
                    placeholder="Inserisci il tuo ID operatore"
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent transition-all duration-200"
                    value={formData.idOperatore}
                    onChange={(e) => setFormData({ ...formData, idOperatore: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chiave d'Accesso</label>
                  <input
                    type="password"
                    placeholder="Inserisci la tua chiave d'accesso"
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:border-transparent transition-all duration-200"
                    value={formData.chiaveAccesso}
                    onChange={(e) => setFormData({ ...formData, chiaveAccesso: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#0b2e63] to-[#1e40af] text-white py-4 px-6 rounded-lg text-lg font-semibold hover:from-[#08234a] hover:to-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#0b2e63] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Accesso in corso...
                    </div>
                  ) : (
                    'Accedi al Sistema'
                  )}
                </button>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    className="text-[#0b2e63] hover:text-[#1e40af] text-sm font-medium underline transition-colors duration-200"
                  >
                    Hai dimenticato la password?
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}