import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '/Logo.svg'

export default function BookingDiscoveryCallPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Errore durante il logout:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con logo, titolo e pulsante esci */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          {/* Logo a sinistra */}
          <div className="flex-shrink-0">
            <img src={Logo} alt="Sendura Logo" className="h-20 w-auto" />
          </div>

          {/* Titolo al centro */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-3xl font-bold text-gray-800">
              Booking Discovery Call
            </h1>
          </div>

          {/* Pulsante Esci a destra */}
          <div className="flex-shrink-0">
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600 font-medium transition-colors duration-200 underline hover:no-underline"
            >
              Esci
            </button>
          </div>
        </div>
      </div>

      {/* Contenuto principale */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Pagina di Sviluppo
            </h2>
            <p className="text-gray-600">
              Questa pagina è in fase di sviluppo per la gestione delle prenotazioni delle discovery call.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
