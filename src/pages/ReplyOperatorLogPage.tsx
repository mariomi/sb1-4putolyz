import Logo from '/Logo.svg'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ReplyOperatorLogPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo e titolo allo stesso livello */}
      <div className="flex items-center pt-8 px-8">
        {/* Logo a sinistra */}
        <div className="flex-shrink-0">
          <img src={Logo} alt="Logo" className="h-20 w-auto" />
        </div>
        
        {/* Titolo centrato */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-4xl font-bold text-gray-900">Reply Operator Log</h1>
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

      {/* Contenuto principale */}
      <main className="px-8 pt-12">
        <div className="max-w-7xl mx-auto">
          {/* Contenuto vuoto - pronto per sviluppo futuro */}
        </div>
      </main>
    </div>
  )
}
