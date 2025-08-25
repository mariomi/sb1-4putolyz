import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export function ClientPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
        } else {
          // Redirect to login if not authenticated
          navigate('/auth')
        }
      } catch (error) {
        console.error('Error checking user:', error)
        navigate('/auth')
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002F6C] mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo a sinistra */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img 
                  src="/Logo.svg" 
                  alt="Logo" 
                  className="h-8 w-auto"
                />
              </div>
            </div>
            
            {/* Nome pagina al centro */}
            <div className="flex-1 flex justify-center">
              <h1 className="text-xl font-semibold text-[#002F6C]">
                Area Cliente
              </h1>
            </div>
            
            {/* Spazio vuoto a destra per bilanciare */}
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      {/* Contenuto principale */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Benvenuto nell'Area Cliente
            </h2>
            <p className="text-gray-600">
              Questa è la tua area personale. Qui potrai gestire i tuoi appuntamenti e le tue informazioni.
            </p>
            
            {/* Informazioni utente */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Informazioni Account
              </h3>
              <div className="text-sm text-gray-600">
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>ID Utente:</strong> {user.id}</p>
                <p><strong>Ultimo Accesso:</strong> {new Date(user.last_sign_in_at).toLocaleString('it-IT')}</p>
              </div>
            </div>
            
            {/* Pulsante logout */}
            <div className="mt-6">
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  navigate('/auth')
                }}
                className="bg-[#002F6C] text-white px-4 py-2 rounded-md hover:bg-[#002F6C]/90 transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

