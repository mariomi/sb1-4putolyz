import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { User, Key, Eye, EyeOff, Shield } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Logo from '/Logo.svg'

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Amministratore', description: 'Accesso completo al sistema' },
  { value: 'project_manager', label: 'Project Manager', description: 'Gestione progetti e campagne' },
  { value: 'reply_operator', label: 'Operatore Risposte', description: 'Gestione risposte e contatti' },
  { value: 'data_operator', label: 'Operatore Dati', description: 'Gestione dati e importazioni' },
  { value: 'sales', label: 'Vendite', description: 'Gestione vendite e lead' },
  { value: 'client', label: 'Cliente', description: 'Accesso limitato ai propri dati' },
]

export function OperatorAuthPage() {
  const { user, signInWithOperator } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showAccessKey, setShowAccessKey] = useState(false)
  const [formData, setFormData] = useState({
    operatorId: '',
    accessKey: '',
    expectedRole: '' as string,
  })

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error, profile } = await signInWithOperator(
        formData.expectedRole as any || null,
        formData.operatorId,
        formData.accessKey
      )
      
      if (error) throw error
      
      toast.success(`Accesso effettuato con successo! Ruolo: ${profile?.role}`)
    } catch (error: any) {
      toast.error(error.message || 'Si è verificato un errore durante l\'accesso')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img src={Logo} alt="Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Accesso Operatore
            </h1>
            <p className="text-gray-600">
              Accedi con il tuo ID operatore e chiave di accesso
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Operatore
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Il tuo ID operatore"
                  value={formData.operatorId}
                  onChange={(e) => setFormData({ ...formData, operatorId: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chiave di Accesso
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type={showAccessKey ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="••••••••"
                  value={formData.accessKey}
                  onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowAccessKey(!showAccessKey)}
                >
                  {showAccessKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ruolo Atteso (Opzionale)
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <select
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={formData.expectedRole}
                  onChange={(e) => setFormData({ ...formData, expectedRole: e.target.value })}
                >
                  <option value="">Seleziona un ruolo (opzionale)</option>
                  {AVAILABLE_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Seleziona il ruolo che ti aspetti di avere per verificare i permessi
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifica in corso...' : 'Accedi'}
            </button>
          </form>

          {/* Ruoli disponibili */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Ruoli disponibili nel sistema:</h3>
            <div className="space-y-2">
              {AVAILABLE_ROLES.map((role) => (
                <div key={role.value} className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{role.label}</span>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/auth"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              Accedi con email e password
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
