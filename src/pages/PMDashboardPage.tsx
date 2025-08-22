import Logo from '/Logo.svg'

export function PMDashboardPage() {
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
          <h1 className="text-4xl font-bold text-gray-900">P.M. Dashboard</h1>
        </div>
        
        {/* Spazio vuoto a destra per bilanciamento */}
        <div className="w-16"></div>
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
